const { fetchAuthoritativeContent } = require("./_lib/cloudinary");
const { validateContent } = require("./_lib/content");
const { json } = require("./_lib/http");
const { buildGelatoOrder, buildShopOrderEmail, buildShopOrderMismatchEmail, buildShopOrderRefusalEmail, printFiles } = require("./_lib/shop-fulfilment");
const { SHOP_ORDER_APP, cartFromMetadata, paidBeforeTax, priceCart } = require("./_lib/shop-order");
const checkout = require("./shop-checkout");
const { sendWithResend } = require("./_lib/inquiry");

const GELATO_API = "https://order.gelatoapis.com/v4/orders";
const PAYMENT_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);
const ORDER_ID_KEY = "gelato_order_id";
const ORDER_EMAIL_KEY = "shop_order_email_sent";
const MISMATCH_EMAIL_KEY = "shop_order_mismatch_email_sent";
const REFUSAL_EMAIL_KEY = "shop_order_refusal_email_sent";
const CART_REFUSAL_CODES = new Set([400, 404, 409]);
const sessionLocks = new Map();
const fail = (message) => new Error(message);

const reply = (response, status, body, headers = {}) => json(response, status, body, { "Cache-Control": "no-store", ...headers });
const method = (request, response) => {
	if (request.method === "POST") return true;
	reply(response, 405, { error: "Method not allowed" }, { Allow: "POST" });
	return false;
};

const rawBody = async (request) => {
	if (typeof request.on !== "function") {
		if (!Buffer.isBuffer(request.body) && typeof request.body !== "string") throw fail("Webhook requires the original request bytes.");
		const bytes = Buffer.from(request.body);
		if (bytes.length > 1_000_000) throw fail("Webhook body is too large.");
		return bytes;
	}
	return new Promise((resolve, reject) => {
		let length = 0;
		let settled = false;
		const chunks = [];
		const cleanup = () => {
			request.off("error", onError);
			request.off("aborted", onAborted);
			request.off("end", onEnd);
			request.off("data", onData);
		};
		const finish = (error) => {
			if (settled) return;
			settled = true;
			cleanup();
			if (error) {
				chunks.length = 0;
				reject(error);
			} else resolve(Buffer.concat(chunks));
		};
		const onError = () => finish(fail("Could not read webhook bytes."));
		const onAborted = () => finish(fail("Webhook request was interrupted."));
		const onEnd = () => finish();
		const onData = (chunk) => {
			if (settled) return;
			const bytes = Buffer.from(chunk);
			length += bytes.length;
			if (length > 1_000_000) return finish(fail("Webhook body is too large."));
			chunks.push(bytes);
		};
		request.on("error", onError);
		request.on("aborted", onAborted);
		request.on("end", onEnd);
		request.on("data", onData);
	});
};

const configured = (env) => env.VERCEL_ENV !== "production"
	&& env.STRIPE_SECRET_KEY?.startsWith("sk_test_")
	&& env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_");

const defaultSendEmail = ({ apiKey, from, to, email, idempotencyKey }) => sendWithResend({
	apiKey,
	from,
	to,
	email,
	fetchImpl: (url, options) => fetch(url, {
		...options,
		headers: { ...options.headers, "Idempotency-Key": idempotencyKey },
	}),
});

const withSessionLock = async (sessionId, action) => {
	const previous = sessionLocks.get(sessionId) || Promise.resolve();
	let release;
	const current = new Promise((resolve) => { release = resolve; });
	sessionLocks.set(sessionId, current);
	await previous;
	try {
		return await action();
	} finally {
		release();
		if (sessionLocks.get(sessionId) === current) sessionLocks.delete(sessionId);
	}
};

const createDependencies = (overrides = {}) => {
	const env = overrides.env || process.env;
	return {
		env,
		catalog: overrides.catalog || require("../content/shop-catalog.json"),
		fetchContent: overrides.fetchContent || fetchAuthoritativeContent,
		validateContent: overrides.validateContent || validateContent,
		confirmOriginal: overrides.confirmOriginal || ((photo) => checkout.confirmOriginal(photo, env)),
		getStripe: overrides.getStripe || (() => checkout.getStripeClient(env)),
		// Workers throw "Illegal invocation" when fetch is called as a method of another object.
		gelatoFetch: overrides.gelatoFetch || ((...args) => fetch(...args)),
		sendEmail: overrides.sendEmail || defaultSendEmail,
	};
};

const gelatoRequest = async (deps, path, body) => {
	if (!deps.env.GELATO_API_KEY) throw fail("Gelato is not configured.");
	const response = await deps.gelatoFetch(`${GELATO_API}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-API-KEY": deps.env.GELATO_API_KEY },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(20_000),
	});
	if (!response.ok) throw fail("Gelato request failed.");
	return response.json();
};

const findGelatoOrder = async (deps, sessionId) => {
	const result = await gelatoRequest(deps, ":search", { orderReferenceId: sessionId, limit: 100 });
	const match = (Array.isArray(result?.orders) ? result.orders : []).find((order) => order.orderReferenceId === sessionId);
	if (!match) return null;
	if (typeof match.id !== "string" || !match.id) throw fail("Gelato returned an invalid order.");
	return match.id;
};

const sendClaireEmailOnce = async ({ deps, stripe, session, key, idempotencyKey, email }) => {
	if (!deps.env.RESEND_API_KEY || session.metadata?.[key] === "true") return;
	try {
		await deps.sendEmail({
			apiKey: deps.env.RESEND_API_KEY,
			from: deps.env.INQUIRY_FROM || "Claire Thomas website <website@clairethomas.art>",
			to: deps.env.SHOP_ORDER_TO || "contact@clairethomas.art",
			email,
			idempotencyKey,
		});
		await stripe.checkout.sessions.update(session.id, { metadata: { [key]: "true" } });
	} catch {
		// Email failures must not cause Stripe to retry a successfully paid order.
	}
};

const createHandler = (overrides = {}) => {
	const deps = createDependencies(overrides);
	return async (request, response) => {
		if (!method(request, response)) return;
		if (!configured(deps.env)) return reply(response, 503, { error: "Shop webhook is not configured." });

		let stripe;
		let event;
		try {
			stripe = deps.getStripe();
			event = await stripe.webhooks.constructEventAsync(
				await rawBody(request),
				request.headers?.["stripe-signature"],
				deps.env.STRIPE_WEBHOOK_SECRET,
			);
		} catch {
			return reply(response, 400, { error: "Invalid webhook signature or body." });
		}
		if (event?.livemode !== false || !PAYMENT_EVENTS.has(event?.type)) return reply(response, 200, { ignored: true });
		const sessionId = event.data?.object?.id;
		if (typeof sessionId !== "string" || !sessionId) return reply(response, 200, { ignored: true });

		return withSessionLock(sessionId, async () => {
			try {
				const session = await stripe.checkout.sessions.retrieve(sessionId);
				if (session?.livemode !== false || session?.mode !== "payment" || session?.metadata?.app !== SHOP_ORDER_APP) {
					return reply(response, 200, { ignored: true });
				}
				if (session.payment_status !== "paid") return reply(response, 200, { pending: true });

				const handleCartRefusal = async (error) => {
					if (error?.publicMessage !== true || !CART_REFUSAL_CODES.has(error.statusCode)) throw error;
					await sendClaireEmailOnce({
						deps,
						stripe,
						session,
						key: REFUSAL_EMAIL_KEY,
						idempotencyKey: `shop-order-cannot-fulfill/${session.id}`,
						email: buildShopOrderRefusalEmail({ session, error }),
					});
					return reply(response, 200, { received: true });
				};

				let cartRequest;
				try { cartRequest = cartFromMetadata(session.metadata); }
				catch (error) { return await handleCartRefusal(error); }
				const rawContent = await deps.fetchContent();
				if (!rawContent) throw fail("Authoritative print content is unavailable.");
				const content = deps.validateContent(rawContent);
				let pricedCart;
				try { pricedCart = priceCart(cartRequest, deps.catalog, content, cartRequest.pricing); }
				catch (error) { return await handleCartRefusal(error); }
				if (session.currency !== "usd" || paidBeforeTax(session) !== pricedCart.total) {
					await sendClaireEmailOnce({
						deps,
						stripe,
						session,
						key: MISMATCH_EMAIL_KEY,
						idempotencyKey: `shop-order-total-mismatch/${session.id}`,
						email: buildShopOrderMismatchEmail({ session, pricedCart }),
					});
					return reply(response, 200, { received: true });
				}

				let gelatoOrderId = typeof session.metadata[ORDER_ID_KEY] === "string" ? session.metadata[ORDER_ID_KEY] : "";
				if (!gelatoOrderId) {
					gelatoOrderId = await findGelatoOrder(deps, session.id) || "";
					if (!gelatoOrderId) {
						const files = await printFiles({ cloudName: deps.env.CLOUDINARY_CLOUD_NAME, confirmOriginal: deps.confirmOriginal }, pricedCart);
						const order = buildGelatoOrder(session, pricedCart, files);
						const created = await gelatoRequest(deps, "", order);
						if (typeof created?.id !== "string" || !created.id) throw fail("Gelato returned an invalid order.");
						gelatoOrderId = created.id;
					}
					await stripe.checkout.sessions.update(session.id, { metadata: { [ORDER_ID_KEY]: gelatoOrderId } });
				}

				await sendClaireEmailOnce({
					deps,
					stripe,
					session,
					key: ORDER_EMAIL_KEY,
					idempotencyKey: `shop-order-paid/${session.id}`,
					email: buildShopOrderEmail({ session, pricedCart, gelatoOrderId }),
				});
				return reply(response, 200, { received: true });
			} catch (error) {
				console.error("Shop webhook failed:", error?.message || error);
				return reply(response, 500, { error: "Shop webhook processing failed; retry required." });
			}
		});
	};
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.config = { api: { bodyParser: false } };
