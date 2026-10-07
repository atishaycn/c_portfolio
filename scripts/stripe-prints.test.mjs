import assert from "node:assert/strict";
import test from "node:test";
import { Readable, PassThrough } from "node:stream";
import { createServer } from "node:http";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Stripe = require("stripe");
const prints = require("../api/_lib/prints");
const { rawBody } = require("../api/_lib/print-http");
const checkout = require("../api/print-checkout").createHandler;
const webhookModule = require("../api/stripe-webhook");
const webhook = webhookModule.createHandler;
const catalog = require("../api/print-catalog").createHandler;
const status = require("../api/print-status").createHandler;

Object.assign(process.env, { PRINT_CHECKOUT_ENABLED: "true", PRINT_SITE_URL: "http://localhost:8091", STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "whsec_fixture", CLOUDINARY_CLOUD_NAME: "fixture", CLOUDINARY_API_KEY: "fixture", CLOUDINARY_API_SECRET: "fixture" });
delete process.env.VERCEL_ENV;
const photo = { id: prints.PILOT.photoId, publicId: "nature/test", width: 5184, height: 3888, title: "", printEnabled: true };
const file = "https://res.cloudinary.com/fixture/image/upload/v123/nature/test.jpg";
const pilot = prints.selectPilot({ albums: [{ items: [photo], printEnabled: true, label: "Nature" }] });
const sessionId = "cs_test_abcdefghijklmnop12345678";
const session = () => ({
	id: sessionId, livemode: false, status: "complete", payment_status: "paid", mode: "payment", amount_total: 4000, currency: "usd",
	metadata: prints.checkoutParameters(pilot, file, process.env.PRINT_SITE_URL).metadata,
	customer_details: { email: "test@example.invalid", phone: "+15555555555" },
	collected_information: { shipping_details: { name: "Test Buyer", address: { country: "US", line1: "1 Test St", line2: null, city: "Test City", state: "CA", postal_code: "94102" } } },
});
const request = ({ method = "POST", body, headers = {}, url = "/" } = {}) => {
	const req = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === "string" ? body : JSON.stringify(body))]);
	Object.assign(req, { method, headers, url });
	return req;
};
const invoke = async (handler, req) => {
	const result = { status: 200, headers: {}, body: null };
	const res = { setHeader: (name, value) => { result.headers[name] = value; }, end: (body) => { result.body = JSON.parse(body); }, set statusCode(value) { result.status = value; } };
	await handler(req, res);
	return result;
};
const checkoutBody = { photoId: photo.id, size: "12x16", requestId: "550e8400-e29b-41d4-a716-446655440000" };
const checkoutDeps = (create) => ({ ...prints, loadPilot: async () => pilot, originalUrl: async () => file, getStripe: () => ({ checkout: { sessions: { create } } }) });
const sign = (body, timestamp) => Stripe.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_fixture", ...(timestamp ? { timestamp } : {}) });
const eventRequest = (event, signature) => {
	const body = JSON.stringify(event);
	return request({ body, headers: { "stripe-signature": signature || sign(body) } });
};
const event = () => ({ id: "evt_fixture", type: "checkout.session.completed", livemode: false, data: { object: session() } });
const webhookDeps = (retrieve, update) => ({ ...prints, getStripe: () => ({ webhooks: Stripe.webhooks, checkout: { sessions: { retrieve, update } } }) });

test("configuration is opt-in, rejects live keys and is always disabled on production", () => {
	const original = { ...process.env };
	try {
		assert(prints.checkoutReady());
		process.env.PRINT_CHECKOUT_ENABLED = "false";
		assert.throws(prints.getStripe, /disabled/);
		process.env.PRINT_CHECKOUT_ENABLED = "true";
		process.env.STRIPE_SECRET_KEY = "sk_live_fixture";
		assert.throws(prints.getStripe, /disabled/);
		process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
		process.env.VERCEL_ENV = "production";
		assert.equal(prints.pilotEnabled(), false);
		assert.throws(prints.getStripe, /disabled/);
	} finally { delete process.env.VERCEL_ENV; Object.assign(process.env, original); }
});
test("checkout needs a webhook secret and trusted redirect origin before taking even a fake payment", async () => {
	const secret = process.env.STRIPE_WEBHOOK_SECRET;
	const origin = process.env.PRINT_SITE_URL;
	try {
		delete process.env.STRIPE_WEBHOOK_SECRET;
		assert.equal(prints.checkoutReady(), false);
		assert.equal((await invoke(checkout(), request({ body: checkoutBody, headers: { origin } }))).status, 503);
		process.env.STRIPE_WEBHOOK_SECRET = secret;
		process.env.PRINT_SITE_URL = "https://evil.invalid/redirect";
		assert.equal(prints.checkoutReady(), false);
		process.env.PRINT_SITE_URL = origin;
		assert.equal(prints.checkoutReady(), true);
	} finally { process.env.STRIPE_WEBHOOK_SECRET = secret; process.env.PRINT_SITE_URL = origin; }
});
test("trusted origin rejects paths, credentials, and nonlocal HTTP", () => {
	const original = process.env.PRINT_SITE_URL;
	try {
		for (const value of ["http://example.com", "https://user:pass@example.com", "https://example.com/path", "https://example.com?x=1", "not-a-url"]) {
			process.env.PRINT_SITE_URL = value;
			assert.throws(prints.siteOrigin);
		}
		process.env.PRINT_SITE_URL = "https://preview.example.com";
		assert.equal(prints.siteOrigin(), "https://preview.example.com");
	} finally { process.env.PRINT_SITE_URL = original; }
});
test("one eligible 4:3 photo only, with resolution and album/photo gates", () => {
	for (const change of [{ printEnabled: false }, { width: 1600, height: 1200 }, { width: 4000, height: 3000 }, { width: 6000, height: 4000 }, { id: "other" }]) {
		assert.throws(() => prints.selectPilot({ albums: [{ items: [{ ...photo, ...change }] }] }));
	}
	assert.throws(() => prints.selectPilot({ albums: [{ printEnabled: false, items: [photo] }] }));
	const portrait = prints.selectPilot({ albums: [{ items: [{ ...photo, width: 3888, height: 5184 }] }] });
	assert(portrait.productUid.includes("_ver_"));
	assert(pilot.productUid.includes("_hor_"));
});
test("missing authoritative CMS fails closed rather than using bundled photos", async () => {
	const fetch = globalThis.fetch;
	globalThis.fetch = async () => ({ ok: true, json: async () => ({ resources: [] }) });
	try { await assert.rejects(prints.loadPilot, /unavailable/); } finally { globalThis.fetch = fetch; }
});
test("original file is full resolution, versioned, verified against Cloudinary", async () => {
	const fetch = globalThis.fetch;
	let resource = { public_id: photo.publicId, width: photo.width, height: photo.height, version: 123, format: "jpg" };
	globalThis.fetch = async (url, options) => {
		assert(url.endsWith("nature%2Ftest"));
		assert(options.headers.Authorization.startsWith("Basic "));
		return { ok: true, json: async () => resource };
	};
	try {
		assert.equal(await prints.originalUrl(photo), file);
		for (const change of [{ width: 1200 }, { public_id: "other" }, { format: "pdf" }, { version: 0 }]) {
			const original = resource; resource = { ...original, ...change };
			await assert.rejects(() => prints.originalUrl(photo)); resource = original;
		}
	} finally { globalThis.fetch = fetch; }
});
test("checkout owns price, quantity, country, currency, and file; retry key is stable", async () => {
	const calls = [];
	const handler = checkout(checkoutDeps(async (params, options) => { calls.push({ params, options }); return { livemode: false, url: "https://checkout.stripe.com/c/pay/fixture" }; }));
	const run = () => invoke(handler, request({ body: checkoutBody, headers: { origin: process.env.PRINT_SITE_URL } }));
	assert.equal((await run()).status, 200);
	await run();
	assert.equal(calls[0].params.line_items[0].price_data.unit_amount, 4000);
	assert.equal(calls[0].params.line_items[0].quantity, 1);
	assert.deepEqual(calls[0].params.shipping_address_collection.allowed_countries, ["US"]);
	assert.deepEqual(calls[0].params.payment_method_types, ["card"]);
	assert.equal(calls[0].params.metadata.print_file, file);
	assert.equal(calls[0].params.line_items[0].price_data.product_data.images[0], file.replace("/image/upload/", "/image/upload/f_jpg,q_80,w_800,c_limit/"));
	assert.equal(calls[0].options.idempotencyKey, calls[1].options.idempotencyKey);
	assert.equal((await run()).headers["Cache-Control"], "no-store");
});
test("checkout rejects forged origins, missing origins, arbitrary products/prices/sizes and large bodies before session creation", async () => {
	let created = 0;
	const handler = checkout(checkoutDeps(async () => { created++; }));
	for (const origin of [undefined, "https://evil.invalid", "http://localhost:8091.evil.invalid"]) {
		assert.equal((await invoke(handler, request({ body: checkoutBody, headers: { origin, host: "evil.invalid" } }))).status, 403);
	}
	for (const change of [{ photoId: "other" }, { size: "8x10" }, { amount: 1 }, { quantity: 5 }, { print_file: "https://evil.invalid" }, { requestId: "bad" }]) {
		assert.equal((await invoke(handler, request({ body: { ...checkoutBody, ...change }, headers: { origin: process.env.PRINT_SITE_URL } }))).status, 400);
	}
	assert.equal((await invoke(handler, request({ body: { ...checkoutBody, extra: "x".repeat(5000) }, headers: { origin: process.env.PRINT_SITE_URL } }))).status, 413);
	assert.equal(created, 0);
});
test("unexpected live or third-party checkout URL is not returned", async () => {
	for (const session of [{ livemode: true, url: "https://checkout.stripe.com/test" }, { livemode: false, url: "https://checkout.stripe.com.evil.invalid/test" }]) {
		const result = await invoke(checkout(checkoutDeps(async () => session)), request({ body: checkoutBody, headers: { origin: process.env.PRINT_SITE_URL } }));
		assert.equal(result.status, 503);
		assert.equal(result.body.url, undefined);
	}
});
test("draft payload matches paid canonical session but never submits an order", () => {
	const draft = prints.buildDraftOrder(session());
	assert.equal(draft.orderType, "draft");
	assert.equal(draft.orderReferenceId, `stripe-test-${sessionId}`);
	assert.equal(draft.items[0].files[0].url, file);
	assert.equal(draft.items[0].quantity, 1);
	assert.equal(draft.shippingAddress.lastName, "Buyer");
	assert.equal(draft.shippingAddress.country, "US");
});
test("draft validation rejects unpaid, incomplete, live, altered amounts/products/files and missing shipping", () => {
	for (const change of [{ livemode: true }, { payment_status: "unpaid" }, { status: "open" }, { mode: "subscription" }, { amount_total: 3999 }, { currency: "eur" }, { collected_information: null }, { customer_details: {} }]) {
		assert.throws(() => prints.buildDraftOrder({ ...session(), ...change }));
	}
	for (const change of [{ app: "other" }, { size: "8x10" }, { photo_id: "other" }, { product_uid: "forged" }, { print_file: "https://evil.invalid/file.jpg" }, { print_file: "https://res.cloudinary.com/other/image/upload/v123/test.jpg" }, { print_file: "https://res.cloudinary.com/fixture/image/upload/q_auto/test.jpg" }, { print_file: `${file}?transform=1` }, { print_file: "bad-url" }]) {
		const current = session(); Object.assign(current.metadata, change);
		assert.throws(() => prints.buildDraftOrder(current));
	}
	const current = session(); current.collected_information.shipping_details.address.country = "GB";
	assert.throws(() => prints.buildDraftOrder(current));
});
test("raw webhook body parser is disabled and rejects parsed JSON/oversized bytes", async () => {
	assert.equal(webhookModule.config.api.bodyParser, false);
	await assert.rejects(() => rawBody({ body: {} }));
	await assert.rejects(() => rawBody({ body: Buffer.alloc(1_000_001) }));
	await assert.rejects(() => rawBody(Readable.from([Buffer.alloc(600_000), Buffer.alloc(600_000)])));
	assert.equal((await rawBody(request({ body: " { \"exact\": true } " }))).toString(), " { \"exact\": true } ");
});
test("Vercel's parsed body getter is not accessed when a signed raw stream is available", async () => {
	const handler = webhook(webhookDeps(async () => session(), async () => {}));
	const req = eventRequest(event());
	Object.defineProperty(req, "body", { get: () => { assert.fail("must read raw stream, not parsed body"); } });
	assert.equal((await invoke(handler, req)).body.validated, true);
	const reqWithParsedBody = eventRequest(event());
	reqWithParsedBody.body = event();
	assert.equal((await invoke(handler, reqWithParsedBody)).body.validated, true);
});
test("webhook verifies exact bytes after Vercel restores an already-consumed IncomingMessage", { timeout: 5000 }, async (t) => {
	let validated = 0;
	const handler = webhook(webhookDeps(async () => session(), async () => { validated++; }));
	const server = createServer(async (req, res) => {
		try {
			const chunks = [];
			await new Promise((resolve, reject) => { req.on("data", (chunk) => chunks.push(chunk)); req.on("end", resolve); req.on("error", reject); });
			// Match Vercel's restoreBody implementation. The original iterator is ended.
			const restored = new PassThrough();
			const on = restored.on.bind(restored);
			const originalOn = req.on.bind(req);
			req.read = restored.read.bind(restored);
			req.on = req.addListener = (name, listener) => ["data", "end"].includes(name) ? on(name, listener) : originalOn(name, listener);
			restored.end(Buffer.concat(chunks));
			Object.defineProperty(req, "body", { get: () => { throw new Error("Parsed getter must not be touched"); } });
			await handler(req, res);
		} catch { res.statusCode = 500; res.end("Helper simulation failed"); }
	});
	t.after(() => new Promise((resolve) => server.close(resolve)));
	await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
	const payload = ` ${JSON.stringify(event())}\n`;
	const response = await fetch(`http://127.0.0.1:${server.address().port}`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": sign(payload) }, body: payload, signal: AbortSignal.timeout(3000) });
	assert.equal(response.status, 200);
	assert.equal((await response.json()).validated, true);
	assert.equal(validated, 1);
});
test("raw body abort rejects and keeps later stream errors handled", async () => {
	const stream = new PassThrough();
	const pending = rawBody(stream);
	stream.emit("aborted");
	await assert.rejects(pending, /interrupted/);
	stream.emit("error", new Error("Late transport error"));
	stream.end();
});
test("webhook rejects missing, tampered and stale signatures without reading sessions", async () => {
	let reads = 0;
	const handler = webhook(webhookDeps(async () => { reads++; }, async () => {}));
	const body = JSON.stringify(event());
	for (const signature of ["bad", sign(`${body} `), sign(body, Math.floor(Date.now() / 1000) - 600)]) {
		assert.equal((await invoke(handler, eventRequest(event(), signature))).status, 400);
	}
	assert.equal((await invoke(handler, request({ body }))).status, 400);
	assert.equal(reads, 0);
});
test("verified webhook uses current session, repeated/concurrent deliveries are safe dry runs", async () => {
	const updates = [];
	const handler = webhook(webhookDeps(async (id) => { assert.equal(id, sessionId); return session(); }, async (...args) => updates.push(args)));
	const results = await Promise.all([invoke(handler, eventRequest(event())), invoke(handler, eventRequest(event()))]);
	assert(results.every((result) => result.status === 200 && result.body.fulfilment === "dry-run"));
	assert.equal(updates.length, 2);
	assert.deepEqual(updates[0], updates[1]);
	assert.equal(updates[0][1].metadata.pilot_validation, "passed");
	assert(!JSON.stringify(updates).includes("test@example.invalid"));
	assert(!JSON.stringify(updates).includes("1 Test St"));
});
test("unpaid canonical session never passes despite paid event payload", async () => {
	let updates = 0;
	const handler = webhook(webhookDeps(async () => ({ ...session(), payment_status: "unpaid" }), async () => { updates++; }));
	const result = await invoke(handler, eventRequest(event()));
	assert.equal(result.body.pending, true);
	assert.equal(updates, 0);
});
test("live, unrelated app and unrelated events are acknowledged without validation", async () => {
	let reads = 0;
	const handler = webhook(webhookDeps(async () => { reads++; }, async () => {}));
	for (const change of [{ livemode: true }, { type: "payment_intent.succeeded" }, { data: { object: { ...session(), metadata: { app: "other" } } } }]) {
		assert.equal((await invoke(handler, eventRequest({ ...event(), ...change }))).body.ignored, true);
	}
	assert.equal(reads, 0);
});
test("provider or validation failure returns retryable 500; retry can pass", async () => {
	let failed = true;
	const handler = webhook(webhookDeps(async () => { if (failed) throw new Error("private provider details"); return session(); }, async () => {}));
	const result = await invoke(handler, eventRequest(event()));
	assert.equal(result.status, 500);
	assert(!JSON.stringify(result.body).includes("private"));
	failed = false;
	assert.equal((await invoke(handler, eventRequest(event()))).status, 200);
	const invalid = webhook(webhookDeps(async () => ({ ...session(), amount_total: 1 }), async () => assert.fail("must not update")));
	assert.equal((await invoke(invalid, eventRequest(event()))).status, 500);
});
test("status verifies Stripe, never returns address/email and rejects non-pilot/live sessions", async () => {
	const handler = status({ ...prints, getStripe: () => ({ checkout: { sessions: { retrieve: async () => ({ ...session(), metadata: { ...session().metadata, pilot_validation: "passed" } }) } } }) });
	const result = await invoke(handler, request({ method: "GET", url: `/api/print-status?session_id=${sessionId}` }));
	assert.deepEqual(result.body, { testOnly: true, paid: true, validated: true, fulfilment: "dry-run" });
	assert.equal((await invoke(handler, request({ method: "GET", url: "/api/print-status?session_id=cs_live_forged" }))).status, 400);
	const live = status({ ...prints, getStripe: () => ({ checkout: { sessions: { retrieve: async () => ({ ...session(), livemode: true }) } } }) });
	assert.equal((await invoke(live, request({ method: "GET", url: `/api/print-status?session_id=${sessionId}` }))).status, 404);
});
test("disabled catalog does not read CMS; configured catalog exposes only public fields", async () => {
	const disabled = catalog({ ...prints, pilotEnabled: () => false, loadPilot: () => assert.fail("must not load") });
	assert.deepEqual((await invoke(disabled, request({ method: "GET" }))).body, { enabled: false, testOnly: true });
	const result = await invoke(catalog({ ...prints, loadPilot: async () => pilot, checkoutReady: () => false }), request({ method: "GET" }));
	assert.equal(result.body.checkoutReady, false);
	assert.equal(result.body.amount, 4000);
	assert.equal(result.body.photo.publicId, undefined);
});
test("all print endpoints enforce methods", async () => {
	for (const [handler, method] of [[checkout(), "GET"], [webhook(), "GET"], [catalog(), "POST"], [status(), "POST"]]) {
		assert.equal((await invoke(handler, request({ method }))).status, 405);
	}
});
