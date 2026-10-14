const { requireSession } = require("../_lib/auth");
const { fetchAuthoritativeContent } = require("../_lib/cloudinary");
const { validateContent } = require("../_lib/content");
const { allowedOrigin, json, readJson } = require("../_lib/http");
const { cartFromMetadata, cropRectangle, paidBeforeTax, priceCart, sessionMetadata } = require("../_lib/shop-order");
const { buildGelatoOrder, printFiles } = require("../_lib/shop-fulfilment");
const checkout = require("../shop-checkout");
const { isShopOrderSession } = require("../shop-order");

const GELATO_ORDERS = "https://order.gelatoapis.com/v4/orders";
const ORDER_ID_KEY = "gelato_order_id";
const STATUS_KEY = "fulfilment_status";
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;
const ACTIONS = new Set(["approve", "cancel", "preview", "edit"]);
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

// Reprices the cart from the session's recorded settings. Throws when the order cannot be shown or approved.
const pricedOrder = (deps, session, content) => {
	const cartRequest = cartFromMetadata(session.metadata);
	const pricedCart = priceCart(cartRequest, deps.catalog, content, cartRequest.pricing);
	if (session.currency !== "usd" || paidBeforeTax(session) !== pricedCart.total) {
		throw failWith("Order details could not be verified.", 409);
	}
	return pricedCart;
};

const printDeps = (deps) => ({ cloudName: deps.env.CLOUDINARY_CLOUD_NAME, confirmOriginal: deps.confirmOriginal });

const pickLine = (pricedCart, lineIndex) => {
	if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= pricedCart.lines.length) throw failWith("Invalid order line.", 400);
	return pricedCart.lines[lineIndex];
};

// An option value is offered only when changing that one group alone yields a catalog variant at the same unit price.
const editOptionsFor = (deps, pricedCart, content, index) => {
	const line = pricedCart.lines[index];
	const product = deps.catalog.products.find((entry) => entry.slug === line.productSlug);
	const samePrice = (key, value) => {
		const trial = { lines: [{ productSlug: line.productSlug, size: line.size, options: { ...line.options, [key]: value }, photoId: line.photo.id, crop: line.crop, quantity: line.quantity }] };
		try {
			return priceCart(trial, deps.catalog, content, pricedCart.pricing).lines[0].variantPrice === line.variantPrice;
		} catch {
			return false;
		}
	};
	return (product?.options || []).map((group) => ({
		key: group.key,
		label: group.label,
		values: group.values.filter((entry) => samePrice(group.key, entry.value)).map(({ value, label }) => ({ value, label })),
	}));
};

// Reprices the cart and returns one row per line. verifyFiles confirms each original and returns the print-file previews.
const orderLines = async (deps, session, content, { verifyFiles = false, editable = false } = {}) => {
	const pricedCart = pricedOrder(deps, session, content);
	const files = verifyFiles ? await printFiles(printDeps(deps), pricedCart) : null;
	return pricedCart.lines.map((line, index) => {
		const row = {
			productName: line.productName,
			size: line.size,
			optionLabels: line.optionLabels,
			quantity: line.quantity,
			previewUrl: files
				? files[index].replace(/\/v(\d+)\//, `/w_${PREVIEW_WIDTH},c_limit/v$1/`)
				: previewUrl(deps.env.CLOUDINARY_CLOUD_NAME, line.photo, cropRectangle(line.photo, line.size, line.crop)),
		};
		if (editable) Object.assign(row, { crop: line.crop, options: { ...line.options }, editOptions: editOptionsFor(deps, pricedCart, content, index) });
		return row;
	});
};

const previewFor = async (deps, session, body) => {
	const pricedCart = pricedOrder(deps, session, await loadContent(deps));
	const line = pickLine(pricedCart, body.lineIndex);
	if (body.crop === undefined) throw failWith("The crop for one photograph is invalid. Edit it and try again.", 400);
	return previewUrl(deps.env.CLOUDINARY_CLOUD_NAME, line.photo, cropRectangle(line.photo, line.size, body.crop));
};

// Shape-checks the edit request. Option and crop values are checked against the catalog when the cart is repriced.
const editRequests = (lines, lineCount) => {
	if (!Array.isArray(lines) || lines.length < 1) throw failWith("Invalid order request.", 400);
	const seen = new Set();
	return lines.map((entry) => {
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw failWith("Invalid order request.", 400);
		const { index, crop, options } = entry;
		if (!Number.isInteger(index) || index < 0 || index >= lineCount || seen.has(index)) throw failWith("Invalid order line.", 400);
		if (!options || typeof options !== "object" || Array.isArray(options)) throw failWith("Invalid order request.", 400);
		seen.add(index);
		return { index, crop, options };
	});
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
	let state;
	if (fulfilment === "cancelled") state = "cancelled";
	else if (fulfilment === "approved-test") state = "approved-test";
	else state = await gelatoState(deps, session);

	let lines = [];
	let linesOk = true;
	try { lines = await orderLines(deps, session, content, { editable: state === "waiting" }); }
	catch { linesOk = false; }
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

// Replaces the draft only when every edited line keeps its unit price and the total is unchanged.
// The new draft is created before the old one is deleted, so a failure never leaves the session without a draft.
const editOrder = async (deps, stripe, session, rawLines) => {
	if (session.metadata[STATUS_KEY] === "cancelled") throw failWith("This order is cancelled.", 409);
	if (session.metadata[STATUS_KEY] === "approved-test") throw failWith("This order is already approved.", 409);
	if (session.payment_status !== "paid") throw failWith("This order is not paid.", 409);
	const oldDraftId = session.metadata[ORDER_ID_KEY];
	if (!oldDraftId) throw failWith("This order has no Gelato draft yet.", 409);
	const draft = await gelatoOrder(deps, session, oldDraftId);
	if (!draft) throw failWith("The Gelato draft was not found.", 409);
	if (draft.orderType === "order") throw failWith("This order is already approved.", 409);
	if (draft.orderType !== "draft") throw failWith("This Gelato order cannot be edited.", 409);

	const current = cartFromMetadata(session.metadata);
	const edits = editRequests(rawLines, current.lines.length);
	const content = await loadContent(deps);
	const before = pricedOrder(deps, session, content);
	const editedLines = current.lines.map((line, index) => {
		const edit = edits.find((entry) => entry.index === index);
		return edit ? { ...line, crop: edit.crop, options: edit.options } : line;
	});
	const after = priceCart({ lines: editedLines }, deps.catalog, content, current.pricing);
	const priceChanged = after.total !== before.total
		|| edits.some(({ index }) => after.lines[index].variantPrice !== before.lines[index].variantPrice);
	if (priceChanged) throw failWith("This change would alter the price.", 409);

	const lineMetadata = sessionMetadata(after);
	const files = await printFiles(printDeps(deps), after);
	const created = await gelatoCall(deps, "POST", "", buildGelatoOrder(session, after, files));
	if (!created.ok) throw failWith("Gelato could not create the new draft. Try again.");
	const newDraftId = (await created.json())?.id;
	if (typeof newDraftId !== "string" || !newDraftId) throw failWith("Gelato could not create the new draft. Try again.");

	const removed = await gelatoCall(deps, "DELETE", `/${encodeURIComponent(oldDraftId)}`);
	if (!removed.ok && removed.status !== 404) {
		// Best effort: keep the session on its old draft by removing the new one.
		await gelatoCall(deps, "DELETE", `/${encodeURIComponent(newDraftId)}`).catch(() => {});
		throw failWith("Gelato could not replace the draft. Try again.");
	}
	await stripe.checkout.sessions.update(session.id, { metadata: { ...lineMetadata, [ORDER_ID_KEY]: newDraftId } });
	return "waiting";
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
			if (body.action === "preview") return reply(response, 200, { previewUrl: await previewFor(deps, session, body) });
			if (body.action === "edit") return reply(response, 200, { state: await editOrder(deps, stripe, session, body.lines) });
			const state = body.action === "approve"
				? await approve(deps, stripe, session)
				: await cancel(deps, stripe, session);
			return reply(response, 200, { state });
		} catch (error) { errorReply(response, error); }
	};
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
