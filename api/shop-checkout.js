const Stripe = require("stripe");
const { fetchAuthoritativeContent } = require("./_lib/cloudinary");
const { validateContent } = require("./_lib/content");
const { json, readJson } = require("./_lib/http");
const { cartLines, cropRectangle, fail, priceCart, printFileUrl, sessionMetadata } = require("./_lib/shop-order");

const TEST_ONLY_MESSAGE = "Test checkout only. No real payment, printing, or shipping.";
const failWith = (message, statusCode = 503) => Object.assign(new Error(message), { statusCode, publicMessage: true });

const siteOrigin = (env) => {
	let url;
	try { url = new URL(env.SHOP_SITE_URL); } catch { throw failWith("SHOP_SITE_URL must be a valid site origin."); }
	const local = ["localhost", "127.0.0.1"].includes(url.hostname);
	if (!(["http:", "https:"].includes(url.protocol)) || (!local && url.protocol !== "https:") || url.username || url.password || url.pathname !== "/" || url.search || url.hash || !url.hostname) {
		throw failWith("SHOP_SITE_URL must be a valid site origin.");
	}
	return url.origin;
};

const stripeTestGuard = (env) => {
	if (!env.STRIPE_SECRET_KEY) throw failWith("Test checkout is unavailable: STRIPE_SECRET_KEY is missing.");
	if (!env.STRIPE_SECRET_KEY.startsWith("sk_test_")) throw failWith("Test checkout is disabled: STRIPE_SECRET_KEY must be a test key starting with sk_test_.");
	if (env.VERCEL_ENV === "production") throw failWith("Test checkout is disabled in production.");
	return true;
};

const checkoutGuard = (env) => {
	if (env.SHOP_CHECKOUT_ENABLED !== "true") throw failWith("Test checkout is disabled (SHOP_CHECKOUT_ENABLED must be true).");
	stripeTestGuard(env);
	return siteOrigin(env);
};

const getStripeClient = (env) => new Stripe(env.STRIPE_SECRET_KEY, { timeout: 20_000, maxNetworkRetries: 1 });

const confirmOriginal = async (photo, env) => {
	const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = env;
	if (!cloudName || !apiKey || !apiSecret) throw failWith("Cloudinary is not configured.");
	const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/image/upload/${encodeURIComponent(photo.publicId)}`;
	const response = await fetch(url, {
		headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}` },
		signal: AbortSignal.timeout(20_000),
	});
	if (!response.ok) throw failWith("Could not verify the original print file.");
	const resource = await response.json();
	if (resource.public_id !== photo.publicId || resource.width !== photo.width || resource.height !== photo.height || !Number.isInteger(resource.version) || resource.version <= 0 || !/^(jpg|png|tif|tiff)$/.test(resource.format || "")) {
		throw failWith("Original image changed. Reload before checking out.", 409);
	}
	return resource;
};

const previewImageUrl = (printFile) => printFile.replace(/\/v(\d+)\//, "/f_jpg,q_80,w_800,c_limit/v$1/");

const lineName = (line) => {
	const options = Object.entries(line.optionLabels).map(([label, value]) => `${label}: ${value}`);
	return [line.productName, line.size, ...options].join(" · ").slice(0, 250);
};

const checkoutParameters = (pricedCart, filesByLine, origin) => ({
	mode: "payment",
	shipping_address_collection: { allowed_countries: ["US"] },
	phone_number_collection: { enabled: true },
	line_items: pricedCart.lines.map((line) => ({
		quantity: line.quantity,
		price_data: {
			currency: "usd",
			unit_amount: line.variantPrice,
			product_data: {
				name: lineName(line),
				description: TEST_ONLY_MESSAGE,
				images: [previewImageUrl(filesByLine.get(line))],
			},
		},
	})),
	shipping_options: [{
		shipping_rate_data: {
			type: "fixed_amount",
			fixed_amount: { amount: pricedCart.shipping, currency: "usd" },
			display_name: "US shipping",
		},
	}],
	metadata: sessionMetadata(pricedCart),
	success_url: `${origin}/prints.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
	cancel_url: `${origin}/prints.html?checkout=cancelled`,
	custom_text: { submit: { message: TEST_ONLY_MESSAGE } },
});

const reply = (response, status, body, headers = {}) => json(response, status, body, { "Cache-Control": "no-store", ...headers });
const method = (request, response, expected) => {
	if (request.method === expected) return true;
	reply(response, 405, { error: "Method not allowed" }, { Allow: expected });
	return false;
};

const smallJson = async (request) => {
	try {
		if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body) && Buffer.byteLength(JSON.stringify(request.body)) > 8192) {
			throw failWith("Checkout request is too large.", 413);
		}
		return await readJson(request, 8192);
	} catch (error) {
		if (error.statusCode === 413 && error.publicMessage) throw error;
		if (error.statusCode === 413) throw failWith("Checkout request is too large.", 413);
		throw failWith("Your cart is invalid. Check the request and try again.", 400);
	}
};

const errorReply = (response, error) => {
	const safeMessage = error.publicMessage;
	const status = safeMessage && [400, 403, 404, 409, 413, 503].includes(error.statusCode) ? error.statusCode : 503;
	const message = safeMessage ? error.message : status === 503
		? "Checkout is temporarily unavailable. Please try again later."
		: "Your checkout request could not be completed.";
	reply(response, status, { error: message });
};

const createDependencies = (overrides = {}) => {
	const env = overrides.env || process.env;
	return {
		env,
		catalog: overrides.catalog || require("../content/shop-catalog.json"),
		fetchContent: overrides.fetchContent || fetchAuthoritativeContent,
		validateContent: overrides.validateContent || validateContent,
		confirmOriginal: overrides.confirmOriginal || ((photo) => confirmOriginal(photo, env)),
		getStripe: overrides.getStripe || (() => getStripeClient(env)),
	};
};

const createHandler = (overrides = {}) => {
	const deps = createDependencies(overrides);
	return async (request, response) => {
		if (!method(request, response, "POST")) return;
		try {
			const body = await smallJson(request);
			cartLines(body);
			const origin = checkoutGuard(deps.env);
			if (request.headers?.origin !== origin) throw failWith("Checkout request is not allowed.", 403);

			let content;
			try {
				const raw = await deps.fetchContent();
				if (!raw) throw new Error("No authoritative content");
				content = deps.validateContent(raw);
			} catch {
				throw failWith("Print content is unavailable. Please try again later.");
			}
			const pricedCart = priceCart(body, deps.catalog, content);
			const cloudName = deps.env.CLOUDINARY_CLOUD_NAME;
			const resources = new Map();
			const filesByLine = new Map();
			for (const line of pricedCart.lines) {
				let resource = resources.get(line.photo.publicId);
				if (!resource) {
					resource = await deps.confirmOriginal(line.photo);
					resources.set(line.photo.publicId, resource);
				}
				if (resource.public_id !== line.photo.publicId || resource.width !== line.photo.width || resource.height !== line.photo.height) {
					throw fail("Original image changed. Reload before checking out.", 409);
				}
				const rectangle = cropRectangle(line.photo, line.size, line.crop);
				filesByLine.set(line, printFileUrl(cloudName, line.photo, resource, rectangle));
			}

			const stripe = deps.getStripe();
			const session = await stripe.checkout.sessions.create(checkoutParameters(pricedCart, filesByLine, origin));
			let sessionUrl;
			try { sessionUrl = new URL(session.url); } catch { throw failWith("Checkout could not be started. Please try again."); }
			if (session.livemode !== false || sessionUrl.origin !== "https://checkout.stripe.com") {
				throw failWith("Checkout could not be started. Please try again.");
			}
			reply(response, 200, { url: sessionUrl.href });
		} catch (error) { errorReply(response, error); }
	};
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.checkoutGuard = checkoutGuard;
module.exports.checkoutParameters = checkoutParameters;
module.exports.confirmOriginal = confirmOriginal;
module.exports.getStripeClient = getStripeClient;
module.exports.siteOrigin = siteOrigin;
module.exports.stripeTestGuard = stripeTestGuard;
