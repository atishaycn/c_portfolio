const { fetchAuthoritativeContent } = require("./_lib/cloudinary");
const { validateContent } = require("./_lib/content");
const { json } = require("./_lib/http");
const { SHOP_ORDER_APP, cartFromMetadata, fail, paidBeforeTax, priceCart } = require("./_lib/shop-order");
const checkout = require("./shop-checkout");

const failWith = (message, statusCode = 503) => Object.assign(new Error(message), { statusCode, publicMessage: true });
const isShopOrderSession = (session) => session?.livemode === false && session?.mode === "payment" && session?.metadata?.app === SHOP_ORDER_APP;

const reply = (response, status, body, headers = {}) => json(response, status, body, { "Cache-Control": "no-store", ...headers });
const method = (request, response, expected) => {
	if (request.method === expected) return true;
	reply(response, 405, { error: "Method not allowed" }, { Allow: expected });
	return false;
};
const errorReply = (response, error) => {
	const safeMessage = error.publicMessage;
	const status = safeMessage && [400, 404, 409, 503].includes(error.statusCode) ? error.statusCode : 503;
	const message = safeMessage ? error.message : "Order details are temporarily unavailable. Please try again later.";
	reply(response, status, { error: message });
};

const createDependencies = (overrides = {}) => {
	const env = overrides.env || process.env;
	return {
		env,
		catalog: overrides.catalog || require("../content/shop-catalog.json"),
		fetchContent: overrides.fetchContent || fetchAuthoritativeContent,
		validateContent: overrides.validateContent || validateContent,
		getStripe: overrides.getStripe || (() => checkout.getStripeClient(env)),
	};
};

const createHandler = (overrides = {}) => {
	const deps = createDependencies(overrides);
	return async (request, response) => {
		if (!method(request, response, "GET")) return;
		try {
			const sessionId = new URL(request.url, "http://localhost").searchParams.get("session_id");
			if (!/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId || "")) throw fail("Invalid checkout session ID.");
			if (sessionId.startsWith("cs_live_")) throw fail("Order not found.", 404);
			checkout.stripeTestGuard(deps.env);
			let session;
			try { session = await deps.getStripe().checkout.sessions.retrieve(sessionId); }
			catch (error) {
				if (error.code === "resource_missing" || error.statusCode === 404) throw fail("Order not found.", 404);
				throw error;
			}
			if (!isShopOrderSession(session)) throw fail("Order not found.", 404);

			const cartRequest = cartFromMetadata(session.metadata);
			let content;
			try {
				const raw = await deps.fetchContent();
				if (!raw) throw new Error("No authoritative content");
				content = deps.validateContent(raw);
			} catch {
				throw failWith("Order details are temporarily unavailable. Please try again later.");
			}
			const pricedCart = priceCart(cartRequest, deps.catalog, content, cartRequest.pricing);
			if (session.currency !== "usd" || (session.amount_total != null && paidBeforeTax(session) !== pricedCart.total)) {
				throw fail("Order details could not be verified.", 409);
			}
			const lines = pricedCart.lines.map((line) => ({
				productName: line.productName,
				size: line.size,
				optionLabels: line.optionLabels,
				quantity: line.quantity,
				variantPrice: line.variantPrice,
				lineTotal: line.lineTotal,
			}));
			reply(response, 200, {
				paid: session.status === "complete" && session.payment_status === "paid",
				total: session.amount_total ?? pricedCart.total,
				tax: session.total_details?.amount_tax ?? 0,
				currency: "usd",
				lines,
			});
		} catch (error) { errorReply(response, error); }
	};
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.isShopOrderSession = isShopOrderSession;
