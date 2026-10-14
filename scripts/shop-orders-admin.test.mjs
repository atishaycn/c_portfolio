import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
process.env.ADMIN_SESSION_SECRET = "orders-test-secret";
process.env.ADMIN_EMAIL = "claire@example.test";
const { createSession } = require("../api/_lib/auth.js");
const order = require("../api/_lib/shop-order.js");
const shopOrders = require("../api/admin/shop-orders.js");
const shopOrder = require("../api/shop-order.js");
const catalog = require("../content/shop-catalog.json");

const content = {
	groups: [],
	albums: [{
		id: "nature",
		key: "nature",
		label: "Nature",
		printEnabled: true,
		items: [
			{ id: "photo-one", publicId: "nature/photo-one", width: 4000, height: 3000, title: "Landscape", printEnabled: true },
			{ id: "photo-two", publicId: "nature/photo-two", width: 3000, height: 4000, title: "Portrait", printEnabled: true },
		],
	}],
};
const cart = { lines: [
	{ productSlug: "print", size: "8 x 10", options: { paper: "semi-gloss" }, photoId: "photo-one", crop: { x: 0, y: 0 }, quantity: 2 },
] };
const clone = (value) => structuredClone(value);
const pricedCart = order.priceCart(cart, catalog, clone(content));
const SESSION_ID = "cs_test_fixture";

const frameCart = { lines: [
	{ productSlug: "wood-frame", size: "8 x 10", options: { frame: "black" }, photoId: "photo-one", crop: { x: 0, y: 0 }, quantity: 1 },
] };
const framePriced = order.priceCart(frameCart, catalog, clone(content));

const sessionFixture = (id, { tax = 0, paymentStatus = "paid", metadata = {}, created = 1_760_000_000, priced = pricedCart } = {}) => ({
	id,
	object: "checkout.session",
	livemode: false,
	mode: "payment",
	status: "complete",
	payment_status: paymentStatus,
	currency: "usd",
	amount_total: priced.total + tax,
	total_details: { amount_tax: tax },
	created,
	payment_intent: `pi_${id}`,
	metadata: { ...order.sessionMetadata(priced), ...metadata },
	customer_details: { name: "Casey Rivera", email: "casey@example.test", phone: "+14155550123" },
	collected_information: {
		shipping_details: {
			name: "Casey Rivera",
			address: { line1: "123 Market Street", line2: "", city: "San Francisco", state: "CA", postal_code: "94103", country: "US" },
		},
	},
});

const draftOrder = (id, sessionId) => ({ id, orderReferenceId: sessionId, orderType: "draft" });

const ok = (value) => ({ ok: true, status: 200, json: async () => clone(value) });
const notFound = () => ({ ok: false, status: 404, json: async () => ({}) });

const harness = ({ sessions = [], gelatoOrders = [], gelatoDown = false, originalChanged = false, refundError = null, env = {} } = {}) => {
	const store = {
		sessions: new Map(sessions.map((session) => [session.id, clone(session)])),
		updates: [],
		refunds: [],
		gelato: new Map(gelatoOrders.map((entry) => [entry.id, clone(entry)])),
		gelatoCalls: [],
		events: [],
		contentFetches: 0,
		confirms: 0,
		created: 0,
	};
	const stripe = {
		checkout: {
			sessions: {
				list: async (params) => {
					store.listParams = clone(params);
					return { data: [...store.sessions.values()].slice(0, params.limit).map(clone) };
				},
				retrieve: async (id) => {
					const session = store.sessions.get(id);
					if (!session) throw Object.assign(new Error("No such session"), { code: "resource_missing", statusCode: 404 });
					return clone(session);
				},
				update: async (id, patch) => {
					store.updates.push({ id, patch: clone(patch) });
					const session = store.sessions.get(id);
					session.metadata = { ...session.metadata, ...patch.metadata };
					return clone(session);
				},
			},
		},
		refunds: {
			create: async (params, options) => {
				store.events.push("refund");
				if (refundError) throw Object.assign(new Error(refundError), { code: refundError });
				store.refunds.push({ params: clone(params), options: clone(options) });
				return { id: "re_fixture" };
			},
		},
	};
	const gelatoFetch = async (url, init) => {
		if (gelatoDown) throw new Error("network down");
		const body = init.body ? JSON.parse(init.body) : undefined;
		store.gelatoCalls.push({ method: init.method, url, body, key: init.headers["X-API-KEY"] });
		if (url.endsWith(":search")) {
			return ok({ orders: [...store.gelato.values()].filter((entry) => entry.orderReferenceId === body.orderReferenceId) });
		}
		if (init.method === "POST" && url === "https://order.gelatoapis.com/v4/orders") {
			store.created += 1;
			const entry = { id: `g_new_${store.created}`, orderReferenceId: body.orderReferenceId, orderType: "draft", items: body.items };
			store.gelato.set(entry.id, entry);
			return ok(entry);
		}
		const id = decodeURIComponent(url.split("/").pop());
		const existing = store.gelato.get(id);
		if (init.method === "GET") return existing ? ok(existing) : notFound();
		if (init.method === "PATCH") {
			if (!existing) return notFound();
			existing.orderType = body.orderType;
			return ok(existing);
		}
		if (init.method === "DELETE") {
			if (!existing) return notFound();
			store.events.push("delete-draft");
			store.gelato.delete(id);
			return { ok: true, status: 204, json: async () => ({}) };
		}
		throw new Error(`Unexpected Gelato call ${init.method}`);
	};
	const confirmOriginal = async (photo) => {
		store.confirms += 1;
		if (originalChanged) return { public_id: photo.publicId, width: photo.width + 1, height: photo.height, version: 7, format: "jpg" };
		return { public_id: photo.publicId, width: photo.width, height: photo.height, version: 7, format: "jpg" };
	};
	const handler = shopOrders.createHandler({
		env: { CLOUDINARY_CLOUD_NAME: "fixture", STRIPE_SECRET_KEY: "sk_test_fixture", GELATO_API_KEY: "gelato_fixture", ...env },
		catalog,
		fetchContent: async () => { store.contentFetches += 1; return clone(content); },
		confirmOriginal,
		getStripe: () => stripe,
		gelatoFetch,
	});
	return { store, handler };
};

const csrfFor = (token) => JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8")).csrf;
const session = () => {
	const token = createSession(process.env.ADMIN_EMAIL);
	return { token, csrf: csrfFor(token) };
};

const invoke = async (handler, req) => {
	const result = { status: 200, headers: {}, body: null };
	const response = {
		setHeader: (name, value) => { result.headers[name] = value; },
		end: (body) => { result.body = body ? JSON.parse(body) : null; },
		set statusCode(value) { result.status = value; },
	};
	await handler(req, response);
	return result;
};

const authed = ({ method = "GET", body, origin, withCsrf = true } = {}) => {
	const { token, csrf } = session();
	const headers = { cookie: `ct_admin=${encodeURIComponent(token)}`, host: "claire.example" };
	if (withCsrf) headers["x-csrf-token"] = csrf;
	if (origin) headers.origin = origin;
	return { method, url: "/api/admin/shop-orders", headers, body };
};

const postAction = (action, sessionId, extra = {}) => authed({ method: "POST", body: { action, sessionId }, origin: "https://claire.example", ...extra });

test("refuses requests without an admin session", async () => {
	const { handler } = harness();
	const read = await invoke(handler, { method: "GET", url: "/api/admin/shop-orders", headers: {} });
	assert.equal(read.status, 401);
	const write = await invoke(handler, { method: "POST", url: "/api/admin/shop-orders", headers: {}, body: { action: "cancel", sessionId: SESSION_ID } });
	assert.equal(write.status, 401);
});

test("refuses a POST from another origin and a POST without the CSRF token", async () => {
	const { handler } = harness({ sessions: [sessionFixture(SESSION_ID)] });
	const otherOrigin = await invoke(handler, authed({ method: "POST", body: { action: "cancel", sessionId: SESSION_ID }, origin: "https://evil.example", withCsrf: true }));
	assert.equal(otherOrigin.status, 403);
	const noToken = await invoke(handler, authed({ method: "POST", body: { action: "cancel", sessionId: SESSION_ID }, origin: "https://claire.example", withCsrf: false }));
	assert.equal(noToken.status, 403);
});

test("refuses to run outside Stripe test mode", async () => {
	const { handler } = harness({ env: { VERCEL_ENV: "production" } });
	const result = await invoke(handler, authed());
	assert.equal(result.status, 503);
	assert.match(result.body.error, /disabled in production/);
});

test("lists only paid shop orders with buyer name and city, and no street, email or phone", async () => {
	const { handler } = harness({
		sessions: [
			sessionFixture("cs_test_paid", { tax: 120, metadata: { gelato_order_id: "g_paid" } }),
			sessionFixture("cs_test_unpaid", { paymentStatus: "unpaid", metadata: { gelato_order_id: "g_unpaid" } }),
			sessionFixture("cs_test_other", { metadata: { app: "other-app" } }),
		],
		gelatoOrders: [draftOrder("g_paid", "cs_test_paid")],
	});
	const result = await invoke(handler, authed());
	assert.equal(result.status, 200);
	assert.deepEqual(result.body.orders.map((row) => row.sessionId), ["cs_test_paid"]);
	const [row] = result.body.orders;
	assert.equal(row.buyerName, "Casey Rivera");
	assert.equal(row.buyerCity, "San Francisco");
	assert.equal(row.amountTotal, pricedCart.total + 120);
	assert.equal(row.tax, 120);
	assert.equal(row.state, "waiting");
	assert.equal(row.gelatoOrderId, "g_paid");
	assert.equal(row.lines.length, 1);
	assert.equal(row.lines[0].productName, pricedCart.lines[0].productName);
	assert.equal(row.lines[0].quantity, 2);
	assert.match(row.lines[0].previewUrl, /c_crop,/);
	assert.match(row.lines[0].previewUrl, /\/image\/upload\/c_crop,x_\d+,y_\d+,w_\d+,h_\d+\/w_600,c_limit\/nature\/photo-one$/);
	const serialized = JSON.stringify(result.body);
	for (const secret of ["123 Market", "Market Street", "casey@example.test", "+14155550123"]) {
		assert.equal(serialized.includes(secret), false, `response leaks ${secret}`);
	}
});

test("lists each order state and marks unpriceable or unreachable orders as needing attention", async () => {
	const unpriceable = sessionFixture("cs_test_gone", { metadata: { gelato_order_id: "g_gone_draft", line_0: JSON.stringify({ p: "print", s: "8 x 10", o: { paper: "semi-gloss" }, i: "photo-removed", c: [0, 0], q: 1 }) } });
	const { handler } = harness({
		sessions: [
			sessionFixture("cs_test_waiting", { metadata: { gelato_order_id: "g_draft" } }),
			sessionFixture("cs_test_approved", { metadata: { gelato_order_id: "g_order" } }),
			sessionFixture("cs_test_test", { metadata: { gelato_order_id: "g_draft_2", fulfilment_status: "approved-test" } }),
			sessionFixture("cs_test_cancelled", { metadata: { gelato_order_id: "g_draft_3", fulfilment_status: "cancelled" } }),
			sessionFixture("cs_test_none"),
			sessionFixture("cs_test_missing_draft", { metadata: { gelato_order_id: "g_absent" } }),
			unpriceable,
		],
		gelatoOrders: [
			draftOrder("g_draft", "cs_test_waiting"),
			{ id: "g_order", orderReferenceId: "cs_test_approved", orderType: "order" },
			draftOrder("g_draft_2", "cs_test_test"),
			draftOrder("g_draft_3", "cs_test_cancelled"),
			draftOrder("g_gone_draft", "cs_test_gone"),
		],
	});
	const result = await invoke(handler, authed());
	const states = Object.fromEntries(result.body.orders.map((row) => [row.sessionId, row.state]));
	assert.deepEqual(states, {
		cs_test_waiting: "waiting",
		cs_test_approved: "approved",
		cs_test_test: "approved-test",
		cs_test_cancelled: "cancelled",
		cs_test_none: "needs-attention",
		cs_test_missing_draft: "needs-attention",
		cs_test_gone: "needs-attention",
	});
	const gone = result.body.orders.find((row) => row.sessionId === "cs_test_gone");
	assert.deepEqual(gone.lines, []);
	const cancelled = result.body.orders.find((row) => row.sessionId === "cs_test_cancelled");
	assert.equal(cancelled.lines.length, 1);
});

test("a Gelato outage shows a waiting order as needing attention, not waiting", async () => {
	const { handler } = harness({
		sessions: [sessionFixture("cs_test_waiting", { metadata: { gelato_order_id: "g_draft" } })],
		gelatoDown: true,
	});
	const result = await invoke(handler, authed());
	assert.equal(result.status, 200);
	assert.equal(result.body.orders[0].state, "needs-attention");
	assert.equal(result.body.orders[0].lines.length, 1);
});

test("approve in test mode checks the draft and never calls Gelato's PATCH", async () => {
	const { handler, store } = harness({
		sessions: [sessionFixture(SESSION_ID, { metadata: { gelato_order_id: "g_draft" } })],
		gelatoOrders: [draftOrder("g_draft", SESSION_ID)],
	});
	const result = await invoke(handler, postAction("approve", SESSION_ID));
	assert.equal(result.status, 200);
	assert.deepEqual(result.body, { state: "approved-test" });
	assert.equal(store.gelatoCalls.some((call) => call.method === "PATCH"), false);
	assert.deepEqual(store.updates, [{ id: SESSION_ID, patch: { metadata: { fulfilment_status: "approved-test" } } }]);
	assert.equal(store.gelato.get("g_draft").orderType, "draft");
});

test("approve answers approved for an order Gelato already holds and changes nothing", async () => {
	const { handler, store } = harness({
		sessions: [sessionFixture(SESSION_ID, { metadata: { gelato_order_id: "g_order" } })],
		gelatoOrders: [{ id: "g_order", orderReferenceId: SESSION_ID, orderType: "order" }],
	});
	const result = await invoke(handler, postAction("approve", SESSION_ID));
	assert.deepEqual(result.body, { state: "approved" });
	assert.equal(store.updates.length, 0);
	assert.equal(store.gelatoCalls.some((call) => call.method === "PATCH"), false);
});

test("approve refuses cancelled, unpaid and unknown sessions", async () => {
	const { handler } = harness({
		sessions: [
			sessionFixture("cs_test_cancelled", { metadata: { gelato_order_id: "g_c", fulfilment_status: "cancelled" } }),
			sessionFixture("cs_test_unpaid", { paymentStatus: "unpaid", metadata: { gelato_order_id: "g_u" } }),
		],
		gelatoOrders: [draftOrder("g_c", "cs_test_cancelled"), draftOrder("g_u", "cs_test_unpaid")],
	});
	assert.equal((await invoke(handler, postAction("approve", "cs_test_cancelled"))).status, 409);
	assert.equal((await invoke(handler, postAction("approve", "cs_test_unpaid"))).status, 409);
	assert.equal((await invoke(handler, postAction("approve", "cs_test_unknown"))).status, 404);
});

test("approve refuses when the original print file changed", async () => {
	const { handler, store } = harness({
		sessions: [sessionFixture(SESSION_ID, { metadata: { gelato_order_id: "g_draft" } })],
		gelatoOrders: [draftOrder("g_draft", SESSION_ID)],
		originalChanged: true,
	});
	const result = await invoke(handler, postAction("approve", SESSION_ID));
	assert.equal(result.status, 409);
	assert.equal(store.updates.length, 0);
});

test("cancel refunds the full payment, deletes the Gelato draft and marks the session cancelled", async () => {
	const { handler, store } = harness({
		sessions: [sessionFixture(SESSION_ID, { tax: 90, metadata: { gelato_order_id: "g_draft" } })],
		gelatoOrders: [draftOrder("g_draft", SESSION_ID)],
	});
	const result = await invoke(handler, postAction("cancel", SESSION_ID));
	assert.equal(result.status, 200);
	assert.deepEqual(result.body, { state: "cancelled" });
	assert.deepEqual(store.refunds, [{ params: { payment_intent: `pi_${SESSION_ID}` }, options: { idempotencyKey: `shop-cancel/${SESSION_ID}` } }]);
	assert.equal(store.gelato.has("g_draft"), false);
	assert.deepEqual(store.updates, [{ id: SESSION_ID, patch: { metadata: { fulfilment_status: "cancelled" } } }]);
});

test("repeating cancel refunds nothing more", async () => {
	const { handler, store } = harness({
		sessions: [sessionFixture(SESSION_ID, { metadata: { gelato_order_id: "g_draft" } })],
		gelatoOrders: [draftOrder("g_draft", SESSION_ID)],
	});
	await invoke(handler, postAction("cancel", SESSION_ID));
	const again = await invoke(handler, postAction("cancel", SESSION_ID));
	assert.equal(again.status, 200);
	assert.deepEqual(again.body, { state: "cancelled" });
	assert.equal(store.refunds.length, 1);
});

test("cancel refuses an order Gelato already sent to print, and refunds nothing", async () => {
	const { handler, store } = harness({
		sessions: [sessionFixture(SESSION_ID, { metadata: { gelato_order_id: "g_order" } })],
		gelatoOrders: [{ id: "g_order", orderReferenceId: SESSION_ID, orderType: "order" }],
	});
	const result = await invoke(handler, postAction("cancel", SESSION_ID));
	assert.equal(result.status, 409);
	assert.equal(result.body.error, "Already sent to print.");
	assert.equal(store.refunds.length, 0);
	assert.equal(store.updates.length, 0);
});

test("cancel finds a Gelato draft by reference when the session has no Gelato ID", async () => {
	const { handler, store } = harness({
		sessions: [sessionFixture(SESSION_ID)],
		gelatoOrders: [draftOrder("g_found", SESSION_ID)],
	});
	const result = await invoke(handler, postAction("cancel", SESSION_ID));
	assert.equal(result.status, 200);
	assert.equal(store.gelato.has("g_found"), false);
	assert.equal(store.refunds.length, 1);
});

test("cancel treats a Gelato draft that is already gone as deleted", async () => {
	const { handler, store } = harness({
		sessions: [sessionFixture(SESSION_ID, { metadata: { gelato_order_id: "g_gone" } })],
	});
	const result = await invoke(handler, postAction("cancel", SESSION_ID));
	assert.equal(result.status, 200);
	assert.equal(store.refunds.length, 1);
	assert.deepEqual(store.updates, [{ id: SESSION_ID, patch: { metadata: { fulfilment_status: "cancelled" } } }]);
});

test("rejects an unknown action and a malformed session ID", async () => {
	const { handler } = harness({ sessions: [sessionFixture(SESSION_ID)] });
	assert.equal((await invoke(handler, postAction("refund", SESSION_ID))).status, 400);
	assert.equal((await invoke(handler, postAction("cancel", "not-a-session"))).status, 400);
});

test("listing stays under the Workers Free limit of 50 subrequests", async () => {
	const sessions = [
		sessionFixture("cs_test_live_approved", { metadata: { gelato_order_id: "g_order", fulfilment_status: "approved" } }),
		sessionFixture("cs_test_waiting", { metadata: { gelato_order_id: "g_draft" } }),
	];
	const { store, handler } = harness({
		sessions,
		gelatoOrders: [{ id: "g_order", orderReferenceId: "cs_test_live_approved", orderType: "order" }, draftOrder("g_draft", "cs_test_waiting")],
	});
	const result = await invoke(handler, authed());
	assert.equal(store.listParams.status, "complete");
	assert.ok(store.listParams.limit + 3 <= 50);
	assert.deepEqual(result.body.orders.map((row) => row.state), ["approved", "waiting"]);
	assert.deepEqual(store.gelatoCalls.map((call) => call.url.split("/").pop()), ["g_draft"]);
});

test("listing reads content once and never calls the Cloudinary Admin API per photo", async () => {
	const sessions = ["cs_test_a", "cs_test_b", "cs_test_c"].map((id) => sessionFixture(id, { metadata: { gelato_order_id: `g_${id}` } }));
	const { store, handler } = harness({ sessions, gelatoOrders: sessions.map((entry) => draftOrder(`g_${entry.id}`, entry.id)) });
	const result = await invoke(handler, authed());
	assert.equal(result.status, 200);
	assert.equal(result.body.orders.length, 3);
	assert.equal(store.contentFetches, 1);
	assert.equal(store.confirms, 0);
});

test("cancel deletes the draft before refunding, and an already-refunded payment still completes", async () => {
	const first = harness({ sessions: [sessionFixture(SESSION_ID, { metadata: { gelato_order_id: "g_one" } })], gelatoOrders: [draftOrder("g_one", SESSION_ID)] });
	assert.equal((await invoke(first.handler, postAction("cancel", SESSION_ID))).status, 200);
	assert.deepEqual(first.store.events, ["delete-draft", "refund"]);

	const retry = harness({ sessions: [sessionFixture(SESSION_ID, { metadata: { gelato_order_id: "g_one" } })], refundError: "charge_already_refunded" });
	const result = await invoke(retry.handler, postAction("cancel", SESSION_ID));
	assert.equal(result.status, 200);
	assert.equal(result.body.state, "cancelled");
	assert.equal(retry.store.sessions.get(SESSION_ID).metadata.fulfilment_status, "cancelled");
});

const optionLabel = (productSlug, key, value) => catalog.products
	.find((entry) => entry.slug === productSlug).options
	.find((group) => group.key === key).values
	.find((entry) => entry.value === value).label;
const woodFrameGroup = catalog.products.find((entry) => entry.slug === "wood-frame").options[0];
const draftsFor = (store, sessionId) => [...store.gelato.values()].filter((entry) => entry.orderReferenceId === sessionId);
const editRequest = (sessionId, lines) => postAction("edit", sessionId, { body: { action: "edit", sessionId, lines } });
const shopOrderView = (store, sessionId) => invoke(shopOrder.createHandler({
	env: { STRIPE_SECRET_KEY: "sk_test_fixture" },
	catalog,
	fetchContent: async () => clone(content),
	getStripe: () => ({ checkout: { sessions: { retrieve: async (id) => clone(store.sessions.get(id)) } } }),
}), { method: "GET", url: `/api/shop-order?session_id=${sessionId}`, headers: {} });

test("listing gives waiting lines their crop, options and same-price option choices only", async () => {
	const { handler } = harness({
		sessions: [
			sessionFixture("cs_test_print", { metadata: { gelato_order_id: "g_print" } }),
			sessionFixture("cs_test_frame", { priced: framePriced, metadata: { gelato_order_id: "g_frame" } }),
			sessionFixture("cs_test_sent", { metadata: { gelato_order_id: "g_order" } }),
		],
		gelatoOrders: [draftOrder("g_print", "cs_test_print"), draftOrder("g_frame", "cs_test_frame"), { id: "g_order", orderReferenceId: "cs_test_sent", orderType: "order" }],
	});
	const result = await invoke(handler, authed());
	const rows = Object.fromEntries(result.body.orders.map((row) => [row.sessionId, row]));
	const [printLine] = rows.cs_test_print.lines;
	assert.deepEqual(printLine.crop, { x: 0, y: 0 });
	assert.deepEqual(printLine.options, { paper: "semi-gloss" });
	// Matte and archival matte cost more at 8 x 10, so they are left out.
	const paper = printLine.editOptions.find((group) => group.key === "paper");
	assert.deepEqual(paper.values, [{ value: "semi-gloss", label: optionLabel("print", "paper", "semi-gloss") }]);
	const [frameLine] = rows.cs_test_frame.lines;
	assert.deepEqual(frameLine.editOptions[0].values.map((entry) => entry.value).sort(), ["black", "dark-wood", "natural-wood", "white"]);
	const [sentLine] = rows.cs_test_sent.lines;
	assert.equal(sentLine.crop, undefined);
	assert.equal(sentLine.editOptions, undefined);
});

test("preview returns the crop of one line and saves nothing", async () => {
	const { handler, store } = harness({ sessions: [sessionFixture(SESSION_ID, { metadata: { gelato_order_id: "g_draft" } })], gelatoOrders: [draftOrder("g_draft", SESSION_ID)] });
	const preview = (crop, lineIndex = 0) => invoke(handler, postAction("preview", SESSION_ID, { body: { action: "preview", sessionId: SESSION_ID, lineIndex, crop } }));
	const left = await preview({ x: -50, y: 0 });
	const right = await preview({ x: 50, y: 0 });
	assert.equal(left.status, 200);
	assert.match(left.body.previewUrl, /\/image\/upload\/c_crop,x_\d+,y_\d+,w_\d+,h_\d+\/w_600,c_limit\/nature\/photo-one$/);
	assert.notEqual(left.body.previewUrl, right.body.previewUrl);
	assert.equal((await preview({ x: 51, y: 0 })).status, 400);
	assert.equal((await preview({ x: 0, y: 0 }, 1)).status, 400);
	assert.equal(store.updates.length, 0);
	assert.equal(store.gelatoCalls.length, 0);
	assert.equal(store.confirms, 0);
});

test("a same-price edit replaces the draft and its print file, and the buyer's view shows the new options", async () => {
	const { handler, store } = harness({
		sessions: [sessionFixture(SESSION_ID, { priced: framePriced, metadata: { gelato_order_id: "g_draft" } })],
		gelatoOrders: [draftOrder("g_draft", SESSION_ID)],
	});
	const before = store.sessions.get(SESSION_ID).metadata;
	const result = await invoke(handler, editRequest(SESSION_ID, [{ index: 0, crop: { x: 10, y: -20 }, options: { frame: "white" } }]));
	assert.equal(result.status, 200);
	assert.deepEqual(result.body, { state: "waiting" });

	const drafts = draftsFor(store, SESSION_ID);
	assert.equal(drafts.length, 1);
	const [draft] = drafts;
	assert.notEqual(draft.id, "g_draft");
	assert.equal(store.gelato.has("g_draft"), false);
	assert.equal(store.gelatoCalls.some((call) => call.method === "PATCH"), false);
	const whiteVariant = catalog.products.find((entry) => entry.slug === "wood-frame").variants
		.find((variant) => variant.size === "8 x 10" && variant.options.frame === "white");
	assert.equal(draft.items[0].productUid, whiteVariant.productUid.hor);
	assert.equal(draft.items[0].quantity, 1);
	assert.match(draft.items[0].files[0].url, /\/image\/upload\/c_crop,x_\d+,y_\d+,w_\d+,h_\d+\/v7\/nature\/photo-one\.jpg$/);

	const metadata = store.sessions.get(SESSION_ID).metadata;
	assert.equal(metadata.gelato_order_id, draft.id);
	assert.equal(metadata.app, before.app);
	assert.equal(metadata.pricing, before.pricing);
	assert.equal(metadata.line_count, "1");
	assert.equal(JSON.parse(metadata.line_0).o.frame, "white");
	assert.deepEqual(JSON.parse(metadata.line_0).c, [10, -20]);

	const view = await shopOrderView(store, SESSION_ID);
	assert.equal(view.status, 200);
	assert.deepEqual(view.body.lines[0].optionLabels, { [woodFrameGroup.label]: optionLabel("wood-frame", "frame", "white") });
});

test("an edit that would change the price is refused and changes nothing", async () => {
	const { handler, store } = harness({ sessions: [sessionFixture(SESSION_ID, { metadata: { gelato_order_id: "g_draft" } })], gelatoOrders: [draftOrder("g_draft", SESSION_ID)] });
	const result = await invoke(handler, editRequest(SESSION_ID, [{ index: 0, crop: { x: 0, y: 0 }, options: { paper: "matte" } }]));
	assert.equal(result.status, 409);
	assert.equal(result.body.error, "This change would alter the price.");
	assert.deepEqual([...store.gelato.keys()], ["g_draft"]);
	assert.equal(store.gelatoCalls.some((call) => ["POST", "DELETE", "PATCH"].includes(call.method)), false);
	assert.equal(store.updates.length, 0);
	assert.equal(store.confirms, 0);
});

test("edit refuses cancelled, sent and test-approved orders", async () => {
	const { handler, store } = harness({
		sessions: [
			sessionFixture("cs_test_cancelled", { priced: framePriced, metadata: { gelato_order_id: "g_c", fulfilment_status: "cancelled" } }),
			sessionFixture("cs_test_sent", { priced: framePriced, metadata: { gelato_order_id: "g_o" } }),
			sessionFixture("cs_test_test", { priced: framePriced, metadata: { gelato_order_id: "g_t", fulfilment_status: "approved-test" } }),
		],
		gelatoOrders: [draftOrder("g_c", "cs_test_cancelled"), { id: "g_o", orderReferenceId: "cs_test_sent", orderType: "order" }, draftOrder("g_t", "cs_test_test")],
	});
	const lines = [{ index: 0, crop: { x: 0, y: 0 }, options: { frame: "white" } }];
	for (const id of ["cs_test_cancelled", "cs_test_sent", "cs_test_test"]) {
		assert.equal((await invoke(handler, editRequest(id, lines))).status, 409, id);
	}
	assert.equal(store.created, 0);
	assert.equal(store.updates.length, 0);
});

test("edit rejects an unknown or repeated line, an out-of-range crop and an option that is not a catalog variant", async () => {
	const { handler, store } = harness({ sessions: [sessionFixture(SESSION_ID, { metadata: { gelato_order_id: "g_draft" } })], gelatoOrders: [draftOrder("g_draft", SESSION_ID)] });
	const same = { index: 0, crop: { x: 0, y: 0 }, options: { paper: "semi-gloss" } };
	assert.equal((await invoke(handler, editRequest(SESSION_ID, [{ ...same, index: 1 }]))).status, 400);
	assert.equal((await invoke(handler, editRequest(SESSION_ID, [same, same]))).status, 400);
	assert.equal((await invoke(handler, editRequest(SESSION_ID, [{ ...same, crop: { x: 0, y: 60 } }]))).status, 400);
	assert.equal((await invoke(handler, editRequest(SESSION_ID, [{ ...same, options: { paper: "gold" } }]))).status, 400);
	assert.equal(store.created, 0);
	assert.equal(store.updates.length, 0);
});
