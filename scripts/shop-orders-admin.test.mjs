import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
process.env.ADMIN_SESSION_SECRET = "orders-test-secret";
process.env.ADMIN_EMAIL = "claire@example.test";
const { createSession } = require("../api/_lib/auth.js");
const order = require("../api/_lib/shop-order.js");
const shopOrders = require("../api/admin/shop-orders.js");
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

const sessionFixture = (id, { tax = 0, paymentStatus = "paid", metadata = {}, created = 1_760_000_000 } = {}) => ({
	id,
	object: "checkout.session",
	livemode: false,
	mode: "payment",
	status: "complete",
	payment_status: paymentStatus,
	currency: "usd",
	amount_total: pricedCart.total + tax,
	total_details: { amount_tax: tax },
	created,
	payment_intent: `pi_${id}`,
	metadata: { ...order.sessionMetadata(pricedCart), ...metadata },
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

const harness = ({ sessions = [], gelatoOrders = [], gelatoDown = false, originalChanged = false, env = {} } = {}) => {
	const store = {
		sessions: new Map(sessions.map((session) => [session.id, clone(session)])),
		updates: [],
		refunds: [],
		gelato: new Map(gelatoOrders.map((entry) => [entry.id, clone(entry)])),
		gelatoCalls: [],
	};
	const stripe = {
		checkout: {
			sessions: {
				list: async ({ limit }) => ({ data: [...store.sessions.values()].slice(0, limit).map(clone) }),
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
			store.gelato.delete(id);
			return { ok: true, status: 204, json: async () => ({}) };
		}
		throw new Error(`Unexpected Gelato call ${init.method}`);
	};
	const confirmOriginal = async (photo) => {
		if (originalChanged) return { public_id: photo.publicId, width: photo.width + 1, height: photo.height, version: 7, format: "jpg" };
		return { public_id: photo.publicId, width: photo.width, height: photo.height, version: 7, format: "jpg" };
	};
	const handler = shopOrders.createHandler({
		env: { CLOUDINARY_CLOUD_NAME: "fixture", STRIPE_SECRET_KEY: "sk_test_fixture", GELATO_API_KEY: "gelato_fixture", ...env },
		catalog,
		fetchContent: async () => clone(content),
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
	assert.match(row.lines[0].previewUrl, /\/w_600,c_limit\/v7\/nature\/photo-one\.jpg$/);
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
