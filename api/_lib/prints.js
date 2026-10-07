const Stripe = require("stripe");
const { fetchAuthoritativeContent } = require("./cloudinary");
const { validateContent } = require("./content");

// One photograph and one size for the sandbox pilot. These are not launch prices.
const PILOT = Object.freeze({
	photoId: "the-natural-world-10",
	size: "12x16",
	label: "12 × 16 inch fine-art print",
	amount: 4000,
	currency: "usd",
});
const APP = "claire-print-pilot-v1";
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const pilotEnabled = () => process.env.PRINT_CHECKOUT_ENABLED === "true" && process.env.VERCEL_ENV !== "production";
const stripeReady = () => pilotEnabled() && /^sk_test_/.test(process.env.STRIPE_SECRET_KEY || "");
const checkoutReady = () => {
	if (!stripeReady() || !/^whsec_/.test(process.env.STRIPE_WEBHOOK_SECRET || "")) return false;
	try { siteOrigin(); return true; } catch { return false; }
};

const getStripe = () => {
	if (!stripeReady()) throw fail("Test checkout is not configured. Live payments are disabled.", 503);
	return new Stripe(process.env.STRIPE_SECRET_KEY, {
		apiVersion: "2025-08-27.basil",
		timeout: 20_000,
		maxNetworkRetries: 1,
	});
};

const siteOrigin = () => {
	let url;
	try { url = new URL(process.env.PRINT_SITE_URL); } catch { throw fail("PRINT_SITE_URL is not configured", 503); }
	const local = ["localhost", "127.0.0.1"].includes(url.hostname);
	if ((!local && url.protocol !== "https:") || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
		throw fail("PRINT_SITE_URL must be a trusted site origin", 503);
	}
	return url.origin;
};

const productUid = (width, height) => `fine_arts_poster_geo_simplified_product_12-0_${height > width ? "ver" : "hor"}_300x400-mm-12x16-inch_200-gsm-80lb-enhanced-uncoated`;

const selectPilot = (content) => {
	for (const album of content.albums) {
		const photo = album.items.find((item) => item.id === PILOT.photoId);
		if (!photo) continue;
		if (album.printEnabled === false || photo.printEnabled !== true) throw fail("This photograph is not available for printing", 404);
		const long = Math.max(photo.width, photo.height);
		const short = Math.min(photo.width, photo.height);
		if (short < 12 * 300 || long < 16 * 300) throw fail("Original image is too small for this print", 409);
		if (Math.abs(long / short - 4 / 3) > 0.01) throw fail("This pilot requires a 4:3 photograph so it is not cropped", 409);
		return { ...photo, albumLabel: album.label, productUid: productUid(photo.width, photo.height) };
	}
	throw fail("The pilot photograph is unavailable", 404);
};

const loadPilot = async () => {
	// Never sell from the bundled fallback when the current CMS cannot be read.
	const content = await fetchAuthoritativeContent();
	if (!content) throw fail("Print content is unavailable", 503);
	return selectPilot(validateContent(content));
};

const originalUrl = async (photo) => {
	const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
	if (!cloud || !key || !secret) throw fail("Cloudinary is not configured", 503);
	const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/resources/image/upload/${encodeURIComponent(photo.publicId)}`, {
		headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
		signal: AbortSignal.timeout(20_000),
	});
	if (!response.ok) throw fail("Could not verify the original print file", 503);
	const resource = await response.json();
	if (resource.public_id !== photo.publicId || resource.width !== photo.width || resource.height !== photo.height || !Number.isInteger(resource.version) || resource.version <= 0 || !/^(jpg|png|tif|tiff)$/.test(resource.format)) {
		throw fail("Original image changed. Reload before checking out.", 409);
	}
	const path = photo.publicId.split("/").map(encodeURIComponent).join("/");
	// Original resolution and format, never the compressed gallery thumbnail.
	return `https://res.cloudinary.com/${encodeURIComponent(cloud)}/image/upload/v${resource.version}/${path}.${resource.format}`;
};

const checkoutParameters = (photo, printFile, origin) => ({
	mode: "payment",
	payment_method_types: ["card"],
	shipping_address_collection: { allowed_countries: ["US"] },
	phone_number_collection: { enabled: true },
	line_items: [{
		quantity: 1,
		price_data: {
			currency: PILOT.currency,
			unit_amount: PILOT.amount,
			product_data: {
				name: `TEST ONLY · ${(photo.title || "Nature photograph").slice(0, 180)} · ${PILOT.label}`,
				description: "Sandbox payment. US shipping included in test price. Nothing will be printed or shipped.",
				// A small JPEG for Stripe's UI, separate from the full-resolution print file.
				images: [printFile.replace("/image/upload/", "/image/upload/f_jpg,q_80,w_800,c_limit/")],
			},
		},
	}],
	metadata: { app: APP, photo_id: photo.id, size: PILOT.size, product_uid: photo.productUid, print_file: printFile },
	payment_intent_data: { metadata: { app: APP, photo_id: photo.id, size: PILOT.size } },
	success_url: `${origin}/prints.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
	cancel_url: `${origin}/prints.html?checkout=cancelled`,
	custom_text: { submit: { message: "Test checkout only. No real payment, printing, or shipping." } },
});

const isPilotSession = (session) => session?.livemode === false && session?.metadata?.app === APP;

const buildDraftOrder = (session) => {
	if (!isPilotSession(session) || session.payment_status !== "paid" || session.status !== "complete" || session.mode !== "payment") throw fail("Not a completed pilot payment", 409);
	if (session.currency !== PILOT.currency || session.amount_total !== PILOT.amount || session.metadata.photo_id !== PILOT.photoId || session.metadata.size !== PILOT.size) throw fail("Pilot order details do not match", 409);
	const uid = session.metadata.product_uid;
	if (![productUid(4, 3), productUid(3, 4)].includes(uid)) throw fail("Invalid print product", 409);
	let file;
	try { file = new URL(session.metadata.print_file); } catch { throw fail("Invalid original print file", 409); }
	const cloud = process.env.CLOUDINARY_CLOUD_NAME;
	if (!cloud) throw fail("Cloudinary is not configured", 503);
	if (file.origin !== "https://res.cloudinary.com" || !file.pathname.startsWith(`/${encodeURIComponent(cloud)}/image/upload/`) || !/^\/[a-zA-Z0-9_-]+\/image\/upload\/v\d+\/[a-zA-Z0-9_./%-]+\.(jpg|png|tif|tiff)$/.test(file.pathname) || file.search || file.hash || file.username || file.password) throw fail("Invalid original print file", 409);
	const shipping = session.collected_information?.shipping_details || session.shipping_details;
	const address = shipping?.address;
	const name = shipping?.name?.trim();
	const email = session.customer_details?.email;
	if (!name || !email || address?.country !== "US" || !address.line1 || !address.city || !address.postal_code || !address.state) throw fail("Shipping information is incomplete", 409);
	const [firstName, ...rest] = name.split(/\s+/);
	return {
		orderType: "draft",
		orderReferenceId: `stripe-test-${session.id}`,
		customerReferenceId: session.id,
		currency: "USD",
		items: [{ itemReferenceId: PILOT.photoId, productUid: uid, files: [{ type: "default", url: file.href }], quantity: 1 }],
		shippingAddress: { firstName, lastName: rest.join(" ") || firstName, addressLine1: address.line1, addressLine2: address.line2 || "", city: address.city, postCode: address.postal_code, state: address.state, country: "US", email, phone: session.customer_details.phone || "" },
	};
};

module.exports = { APP, PILOT, fail, pilotEnabled, checkoutReady, getStripe, siteOrigin, selectPilot, loadPilot, originalUrl, checkoutParameters, isPilotSession, buildDraftOrder };
