import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { API_VERSION, constructEvent, createStripeClient, encodeForm } = require("../api/_lib/stripe.js");

const recorder = (responses) => {
	const calls = [];
	const fetchImpl = async (url, options) => {
		calls.push({ url, ...options });
		const next = responses.shift();
		if (next instanceof Error) throw next;
		return new Response(JSON.stringify(next.body), { status: next.status });
	};
	return { calls, fetchImpl };
};

const signed = (payload, secret, timestamp) =>
	`t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")}`;

test("encodes nested params the way Stripe expects", () => {
	const form = new URLSearchParams(encodeForm({
		mode: "payment",
		line_items: [{ quantity: 2, price_data: { unit_amount: 1700, product_data: { name: "Print" } } }],
		shipping_address_collection: { allowed_countries: ["US"] },
		automatic_tax: { enabled: true },
		metadata: { clear_me: null, skipped: undefined },
	}));
	assert.equal(form.get("line_items[0][quantity]"), "2");
	assert.equal(form.get("line_items[0][price_data][product_data][name]"), "Print");
	assert.equal(form.get("shipping_address_collection[allowed_countries][0]"), "US");
	assert.equal(form.get("automatic_tax[enabled]"), "true");
	assert.equal(form.get("metadata[clear_me]"), "");
	assert.equal(form.has("metadata[skipped]"), false);
});

test("sends the pinned API version, form body and the caller's idempotency key", async () => {
	const { calls, fetchImpl } = recorder([{ status: 200, body: { id: "re_1" } }]);
	const stripe = createStripeClient("sk_test_x", { fetchImpl });
	const refund = await stripe.refunds.create({ payment_intent: "pi_1" }, { idempotencyKey: "shop-cancel/cs_test_1" });
	assert.equal(refund.id, "re_1");
	assert.equal(calls[0].url, "https://api.stripe.com/v1/refunds");
	assert.equal(calls[0].method, "POST");
	assert.equal(calls[0].body, "payment_intent=pi_1");
	assert.equal(calls[0].headers["Stripe-Version"], API_VERSION);
	assert.equal(calls[0].headers["Idempotency-Key"], "shop-cancel/cs_test_1");
	assert.equal(calls[0].headers.Authorization, "Bearer sk_test_x");
});

test("puts GET params in the query string", async () => {
	const { calls, fetchImpl } = recorder([{ status: 200, body: { data: [] } }]);
	await createStripeClient("sk_test_x", { fetchImpl }).checkout.sessions.list({ limit: 100 });
	assert.equal(calls[0].url, "https://api.stripe.com/v1/checkout/sessions?limit=100");
	assert.equal(calls[0].body, undefined);
});

test("retries a POST once with the same idempotency key", async () => {
	const { calls, fetchImpl } = recorder([new TypeError("network"), { status: 200, body: { id: "cs_test_1" } }]);
	const session = await createStripeClient("sk_test_x", { fetchImpl }).checkout.sessions.create({ mode: "payment" });
	assert.equal(session.id, "cs_test_1");
	assert.equal(calls.length, 2);
	assert.ok(calls[0].headers["Idempotency-Key"]);
	assert.equal(calls[1].headers["Idempotency-Key"], calls[0].headers["Idempotency-Key"]);
});

test("maps Stripe errors to code and statusCode without retrying client errors", async () => {
	const { calls, fetchImpl } = recorder([{ status: 400, body: { error: { type: "invalid_request_error", code: "charge_already_refunded", message: "Already refunded" } } }]);
	await assert.rejects(
		createStripeClient("sk_test_x", { fetchImpl }).refunds.create({ payment_intent: "pi_1" }),
		(error) => error.code === "charge_already_refunded" && error.statusCode === 400 && !error.publicMessage,
	);
	assert.equal(calls.length, 1);
});

test("verifies webhook signatures and rejects forged, stale or missing ones", () => {
	const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
	const now = 1_800_000_000_000;
	const t = now / 1000;
	assert.equal(constructEvent(Buffer.from(payload), signed(payload, "whsec_a", t), "whsec_a", now).id, "evt_1");
	assert.equal(constructEvent(payload, `v1=00,${signed(payload, "whsec_a", t)}`, "whsec_a", now).id, "evt_1");
	assert.throws(() => constructEvent(payload, signed(payload, "whsec_b", t), "whsec_a", now));
	assert.throws(() => constructEvent(`${payload} `, signed(payload, "whsec_a", t), "whsec_a", now));
	assert.throws(() => constructEvent(payload, signed(payload, "whsec_a", t - 301), "whsec_a", now));
	assert.throws(() => constructEvent(payload, "", "whsec_a", now));
});
