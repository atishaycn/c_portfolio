const { requireSession } = require("../_lib/auth");
const { fetchAuthoritativeContent } = require("../_lib/cloudinary");
const { validateContent } = require("../_lib/content");
const { allowedOrigin, json, readJson } = require("../_lib/http");
const { cartFromMetadata, cropRectangle, paidBeforeTax, priceCart, printFileUrl } = require("../_lib/shop-order");
const checkout = require("../shop-checkout");
const { isShopOrderSession } = require("../shop-order");

const GELATO_ORDERS = "https://order.gelatoapis.com/v4/orders";
const ORDER_ID_KEY = "gelato_order_id";
const STATUS_KEY = "fulfilment_status";
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;
const ACTIONS = new Set(["approve", "cancel"]);
const LIST_LIMIT = 100;
const PREVIEW_WIDTH = 600;

const failWith = (message, statusCode = 503) => Object.assign(new Error(message), { statusCode, publicMessage: true });
const reply = (response, status, body) => json(response, status, body, { "Cache-Control": "no-store" });
const trimmed = (value) => typeof value === "string" ? value.trim() : "";
const shippingDetails = (session) => session?.collected_information?.shipping_details || session?.shipping_details;
const buyerName = (session) => trimmed(shippingDetails(session)?.name) || trimmed(session?.customer_details?.name);

// Gelato has no test mode. Until release the test-mode guard always passes, so Approve never reaches Gelato's PATCH.
const sendsToGelato = (env) => !(env.STRIPE_SECRET_KEY?.startsWith("sk_test_") && env.VERCEL_ENV !== "production");

const gelatoCall = (deps, method, path, body) => {
	if (!deps.env.GELATO_API_KEY) throw failWith("Gelato is not configured.");
	const headers = { "X-API-KEY": deps.env.GELATO_API_KEY };
	if (body !== undefined) headers["Content-Type"] = "application/json";
	return deps.gelatoFetch(`${GELATO_ORDERS}${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
		signal: AbortSignal.timeout(20_000),
	});
};

// Returns null when Gelato has no such order. A draft for another payment is refused.
const gelatoOrder = async (deps, session, gelatoOrderId) => {
	const response = await gelatoCall(deps, "GET", `/${encodeURIComponent(gelatoOrderId)}`);
	if (response.status === 404) return null;
	if (!response.ok) throw failWith("Gelato could not be reached. Try again.");
	const order = await response.json();
	if (order?.orderReferenceId !== session.id) throw failWith("The Gelato order does not match this payment.", 409);
	return order;
};

const searchGelatoOrderId = async (deps, sessionId) => {
	const response = await gelatoCall(deps, "POST", ":search", { orderReferenceId: sessionId, limit: 100 });
	if (!response.ok) throw failWith("Gelato could not be reached. Try again.");
	const result = await response.json();
	const match = (Array.isArray(result?.orders) ? result.orders : []).find((order) => order.orderReferenceId === sessionId);
	return typeof match?.id === "string" && match.id ? match.id : null;
};

const existingGelatoOrder = async (deps, session) => {
	const gelatoOrderId = session.metadata[ORDER_ID_KEY] || await searchGelatoOrderId(deps, session.id);
	return gelatoOrderId ? gelatoOrder(deps, session, gelatoOrderId) : null;
};

const loadContent = async (deps) => {
	const raw = await deps.fetchContent();
	if (!raw) throw failWith("Print content is unavailable. Try again later.");
	return deps.validateContent(raw);
};

// Listing skips the Cloudinary Admin API (rate-limited) and previews the crop by public ID; Approve confirms the original.
const previewUrl = (cloudName, photo, rectangle) => {
	const { x, y, width, height } = rectangle;
	const publicId = photo.publicId.split("/").map(encodeURIComponent).join("/");
	return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/c_crop,x_${x},y_${y},w_${width},h_${height}/w_${PREVIEW_WIDTH},c_limit/${publicId}`;
};

// Reprices the cart from the session's recorded settings. With verifyFiles, also confirms each original print file. Throws when the order cannot be shown or approved.
const orderLines = async (deps, session, content, { verifyFiles = false } = {}) => {
	const cartRequest = cartFromMetadata(session.metadata);
	const pricedCart = priceCart(cartRequest, deps.catalog, content, cartRequest.pricing);
	if (session.currency !== "usd" || paidBeforeTax(session) !== pricedCart.total) {
		throw failWith("Order details could not be verified.", 409);
	}
	const resources = new Map();
	const lines = [];
	for (const line of pricedCart.lines) {
		const rectangle = cropRectangle(line.photo, line.size, line.crop);
		const lineSummary = { productName: line.productName, size: line.size, optionLabels: line.optionLabels, quantity: line.quantity };
		if (!verifyFiles) {
			lines.push({ ...lineSummary, previewUrl: previewUrl(deps.env.CLOUDINARY_CLOUD_NAME, line.photo, rectangle) });
			continue;
		}
		let resource = resources.get(line.photo.publicId);
		if (!resource) {
			resource = await deps.confirmOriginal(line.photo);
			if (resource.public_id !== line.photo.publicId || resource.width !== line.photo.width || resource.height !== line.photo.height) {
				throw failWith("Original print file changed.", 409);
			}
			resources.set(line.photo.publicId, resource);
		}
		const printFile = printFileUrl(deps.env.CLOUDINARY_CLOUD_NAME, line.photo, resource, rectangle);
		lines.push({ ...lineSummary, previewUrl: printFile.replace(/\/v(\d+)\//, `/w_${PREVIEW_WIDTH},c_limit/v$1/`) });
	}
	return lines;
};

const gelatoState = async (deps, session) => {
	const gelatoOrderId = session.metadata[ORDER_ID_KEY];
	if (!gelatoOrderId) return "needs-attention";
	try {
		const order = await gelatoOrder(deps, session, gelatoOrderId);
		if (order?.orderType === "draft") return "waiting";
		if (order?.orderType === "order") return "approved";
	} catch {
		// An unreachable or mismatched Gelato order shows as needing attention, never as waiting.
	}
	return "needs-attention";
};

const listRow = async (deps, session, content) => {
	const fulfilment = session.metadata[STATUS_KEY];
	let lines = [];
	let linesOk = true;
	try { lines = await orderLines(deps, session, content); }
	catch { linesOk = false; }

	let state;
	if (fulfilment === "cancelled") state = "cancelled";
	else if (fulfilment === "approved-test") state = "approved-test";
	else state = await gelatoState(deps, session);
	if (!linesOk && state !== "cancelled") state = "needs-attention";

	return {
		sessionId: session.id,
		created: new Date(session.created * 1000).toISOString(),
		buyerName: buyerName(session),
		buyerCity: trimmed(shippingDetails(session)?.address?.city),
		amountTotal: session.amount_total,
		tax: session.total_details?.amount_tax ?? 0,
		state,
		gelatoOrderId: session.metadata[ORDER_ID_KEY] || null,
		lines,
	};
};

const loadOrder = async (stripe, sessionId) => {
	let session;
	try {
		session = await stripe.checkout.sessions.retrieve(sessionId);
	} catch (error) {
		if (error.code === "resource_missing" || error.statusCode === 404) throw failWith("Order not found.", 404);
		throw error;
	}
	if (!isShopOrderSession(session)) throw failWith("Order not found.", 404);
	return session;
};

const approve = async (deps, stripe, session) => {
	const status = session.metadata[STATUS_KEY];
	if (status === "cancelled") throw failWith("This order is cancelled.", 409);
	if (session.payment_status !== "paid") throw failWith("This order is not paid.", 409);
	const gelatoOrderId = session.metadata[ORDER_ID_KEY];
	if (!gelatoOrderId) throw failWith("This order has no Gelato draft yet.", 409);
	const gelato = await gelatoOrder(deps, session, gelatoOrderId);
	if (!gelato) throw failWith("The Gelato draft was not found.", 409);
	if (gelato.orderType === "order") return "approved";
	if (gelato.orderType !== "draft") throw failWith("This Gelato order cannot be approved.", 409);
	await orderLines(deps, session, await loadContent(deps), { verifyFiles: true });

	if (!sendsToGelato(deps.env)) {
		if (status !== "approved-test") {
			await stripe.checkout.sessions.update(session.id, { metadata: { [STATUS_KEY]: "approved-test" } });
		}
		return "approved-test";
	}
	const response = await gelatoCall(deps, "PATCH", `/${encodeURIComponent(gelatoOrderId)}`, { orderType: "order" });
	if (!response.ok) throw failWith("Gelato could not approve the order. Try again.");
	await stripe.checkout.sessions.update(session.id, { metadata: { [STATUS_KEY]: "approved" } });
	return "approved";
};

const cancel = async (deps, stripe, session) => {
	if (session.metadata[STATUS_KEY] === "cancelled") return "cancelled";
	if (session.payment_status !== "paid") throw failWith("This order is not paid.", 409);
	const gelato = await existingGelatoOrder(deps, session);
	if (gelato?.orderType === "order") throw failWith("Already sent to print.", 409);
	if (gelato && gelato.orderType !== "draft") throw failWith("This Gelato order cannot be cancelled.", 409);
	const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
	if (!paymentIntent) throw failWith("This order has no payment to refund.", 409);

	// Draft first: if the refund then fails, a retry finds no draft and only refunds.
	if (gelato) {
		const response = await gelatoCall(deps, "DELETE", `/${encodeURIComponent(gelato.id)}`);
		if (!response.ok && response.status !== 404) throw failWith("Gelato could not delete the draft. Try again.");
	}
	try {
		await stripe.refunds.create({ payment_intent: paymentIntent }, { idempotencyKey: `shop-cancel/${session.id}` });
	} catch (error) {
		if (error.code !== "charge_already_refunded") throw error;
	}
	await stripe.checkout.sessions.update(session.id, { metadata: { [STATUS_KEY]: "cancelled" } });
	return "cancelled";
};

const postBody = async (request) => {
	let body;
	try { body = await readJson(request, 8192); }
	catch { throw failWith("Invalid order request.", 400); }
	if (!body || typeof body !== "object" || Array.isArray(body)) throw failWith("Invalid order request.", 400);
	return body;
};

const errorReply = (response, error) => {
	if (error.statusCode === 401 || error.statusCode === 403) return reply(response, error.statusCode, { error: error.message });
	if (error.publicMessage && [400, 404, 409, 503].includes(error.statusCode)) return reply(response, error.statusCode, { error: error.message });
	console.error(error);
	return reply(response, 503, { error: "Orders are temporarily unavailable. Please try again later." });
};

const createDependencies = (overrides = {}) => {
	const env = overrides.env || process.env;
	return {
		env,
		catalog: overrides.catalog || require("../../content/shop-catalog.json"),
		fetchContent: overrides.fetchContent || fetchAuthoritativeContent,
		validateContent: overrides.validateContent || validateContent,
		confirmOriginal: overrides.confirmOriginal || ((photo) => checkout.confirmOriginal(photo, env)),
		getStripe: overrides.getStripe || (() => checkout.getStripeClient(env)),
		gelatoFetch: overrides.gelatoFetch || fetch,
	};
};

const createHandler = (overrides = {}) => {
	const deps = createDependencies(overrides);
	return async (request, response) => {
		try {
			requireSession(request);
			if (request.method !== "GET" && request.method !== "POST") {
				response.setHeader("Allow", "GET, POST");
				return reply(response, 405, { error: "Method not allowed" });
			}
			if (request.method === "POST" && !allowedOrigin(request)) return reply(response, 403, { error: "Invalid origin" });
			checkout.stripeTestGuard(deps.env);
			const stripe = deps.getStripe();

			if (request.method === "GET") {
				const listed = await stripe.checkout.sessions.list({ limit: LIST_LIMIT });
				const sessions = (listed.data || []).filter((session) => isShopOrderSession(session) && session.payment_status === "paid");
				const content = sessions.length ? await loadContent(deps) : null;
				return reply(response, 200, { orders: await Promise.all(sessions.map((session) => listRow(deps, session, content))) });
			}

			const body = await postBody(request);
			if (!ACTIONS.has(body.action)) throw failWith("Unknown order action.", 400);
			if (!SESSION_ID.test(body.sessionId || "")) throw failWith("Invalid checkout session ID.", 400);
			const session = await loadOrder(stripe, body.sessionId);
			const state = body.action === "approve"
				? await approve(deps, stripe, session)
				: await cancel(deps, stripe, session);
			return reply(response, 200, { state });
		} catch (error) { errorReply(response, error); }
	};
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
