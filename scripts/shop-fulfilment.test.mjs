import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const order = require("../api/_lib/shop-order.js");
const webhookModule = require("../api/stripe-webhook.js");
const { buildGelatoOrder, buildShopOrderEmail, buildShopOrderMismatchEmail, buildShopOrderRefusalEmail } = require("../api/_lib/shop-fulfilment.js");
const catalog = require("../content/shop-catalog.json");

const content = {
	groups: [],
	albums: [{
		id: "nature",
		key: "nature",
		label: "Nature",
		printEnabled: true,
		items: [
			{ id: "photo-one", publicId: "nature/photo-one", width: 4000, height: 3000, printEnabled: true },
			{ id: "photo-two", publicId: "nature/photo-two", width: 3000, height: 4000, printEnabled: true },
		],
	}],
};
const cart = { lines: [
	{ productSlug: "print", size: "8 x 10", options: { paper: "semi-gloss" }, photoId: "photo-one", crop: { x: 0, y: 0 }, quantity: 2 },
	{ productSlug: "canvas", size: "8 x 10", options: { depth: "thick" }, photoId: "photo-two", crop: { x: 0, y: 0 }, quantity: 1 },
] };
const pricedCart = order.priceCart(cart, catalog, structuredClone(content));
const baseSession = () => ({
	id: "cs_test_fixture123",
	livemode: false,
	status: "complete",
	mode: "payment",
	payment_status: "paid",
	currency: "usd",
	amount_total: pricedCart.total,
	customer: "cus_fixture123",
	metadata: order.sessionMetadata(pricedCart),
	customer_details: { email: "customer@example.test", phone: "+14155550123" },
	shipping_details: {
		name: "Casey Rivera",
		address: { line1: "123 Market Street", line2: "Suite 4", city: "San Francisco", state: "CA", postal_code: "94103", country: "US" },
	},
});
const env = {
	STRIPE_SECRET_KEY: "sk_test_fixture",
	STRIPE_WEBHOOK_SECRET: "whsec_fixture",
	GELATO_API_KEY: "gelato_fixture",
	RESEND_API_KEY: "resend_fixture",
	CLOUDINARY_CLOUD_NAME: "fixture",
	INQUIRY_FROM: "Claire Thomas website <website@clairethomas.art>",
	SHOP_ORDER_TO: "orders@example.test",
};
const rawEvent = Buffer.from('{"id":"evt_fixture123"}');
const eventFor = (session) => ({
	livemode: false,
	type: "checkout.session.completed",
	data: { object: { id: session.id } },
});

const invoke = async (handler, { signature = "fixture-signature", body = rawEvent, stream = false } = {}) => {
	const result = { status: 200, headers: {}, body: null };
	const response = {
		setHeader: (name, value) => { result.headers[name] = value; },
		end: (value) => { result.body = value ? JSON.parse(value) : null; },
		set statusCode(value) { result.status = value; },
	};
	let request = { method: "POST", body, headers: { "stripe-signature": signature } };
	if (stream) {
		request = new EventEmitter();
		request.method = "POST";
		request.headers = { "stripe-signature": signature };
		queueMicrotask(() => {
			request.emit("data", body.subarray(0, 8));
			request.emit("data", body.subarray(8));
			request.emit("end");
		});
	}
	await handler(request, response);
	return result;
};

const harness = (options = {}) => {
	const session = options.session || baseSession();
	const state = {
		session: structuredClone(session),
		initialSession: structuredClone(session),
		updates: [],
		gelatoRequests: [],
		createdOrderBodies: [],
		gelatoOrders: options.existingOrders ? structuredClone(options.existingOrders) : [],
		sentEmails: [],
		originalChecks: [],
		retrieves: 0,
		contentReads: 0,
		updateFailures: options.updateFailures || 0,
	};
	const stripe = {
		webhooks: {
			constructEvent: (bytes, signature, secret) => {
				assert.deepEqual(bytes, rawEvent);
				assert.equal(secret, env.STRIPE_WEBHOOK_SECRET);
				if (signature !== "fixture-signature") throw new Error("invalid signature");
				return options.event || eventFor(state.session);
			},
		},
		checkout: { sessions: {
			retrieve: async (id) => {
				state.retrieves += 1;
				assert.equal(id, state.session.id);
				return structuredClone(state.session);
			},
			update: async (id, patch) => {
				assert.equal(id, state.session.id);
				state.updates.push(structuredClone(patch));
				if (state.updateFailures > 0) {
					state.updateFailures -= 1;
					throw new Error("Stripe update failed");
				}
				state.session.metadata = { ...state.session.metadata, ...patch.metadata };
				return structuredClone(state.session);
			},
		} },
	};
	const gelatoFetch = async (url, request) => {
		const body = JSON.parse(request.body);
		state.gelatoRequests.push({ url, method: request.method, headers: request.headers, body });
		if (url.endsWith(":search")) {
			return { ok: true, json: async () => ({ orders: state.gelatoOrders.filter((item) => item.orderReferenceId === body.orderReferenceId) }) };
		}
		if (options.gelatoDelay) await options.gelatoDelay();
		if (options.gelatoFailure) return { ok: false, json: async () => ({ error: "private provider error" }) };
		state.createdOrderBodies.push(body);
		const created = { id: "gelato_order_fixture123", orderReferenceId: body.orderReferenceId, orderType: "draft" };
		state.gelatoOrders.push(created);
		return { ok: true, json: async () => ({ id: created.id }) };
	};
	const handler = webhookModule.createHandler({
		env: options.env || env,
		catalog: options.catalog || catalog,
		getStripe: () => stripe,
		fetchContent: async () => {
			state.contentReads += 1;
			if (options.contentFailure) throw options.contentFailure;
			return structuredClone(options.content || content);
		},
		confirmOriginal: async (photo) => {
			state.originalChecks.push(photo.publicId);
			return photo.publicId === "nature/photo-one"
				? { public_id: photo.publicId, width: 4000, height: 3000, version: 101, format: "jpg" }
				: { public_id: photo.publicId, width: 3000, height: 4000, version: 202, format: "png" };
		},
		gelatoFetch,
		sendEmail: async (payload) => {
			state.sentEmails.push(structuredClone(payload));
			if (options.emailFailure) throw new Error(`send failed for ${state.session.customer_details.email} at ${state.session.shipping_details.address.line1}`);
		},
	});
	return { handler, state, stripe };
};

const expectedFiles = [
	"https://res.cloudinary.com/fixture/image/upload/c_crop,x_125,y_0,w_3750,h_3000/v101/nature/photo-one.jpg",
	"https://res.cloudinary.com/fixture/image/upload/c_crop,x_0,y_125,w_3000,h_3750/v202/nature/photo-two.png",
];

test("builds a Gelato draft for every priced line and full US shipping address", () => {
	const session = baseSession();
	assert.deepEqual(buildGelatoOrder(session, pricedCart, expectedFiles), {
		orderType: "draft",
		orderReferenceId: "cs_test_fixture123",
		customerReferenceId: "cus_fixture123",
		currency: "USD",
		items: [
			{
				itemReferenceId: "cs_test_fixture123-1",
				productUid: pricedCart.lines[0].productUid,
				files: [{ type: "default", url: expectedFiles[0] }],
				quantity: 2,
			},
			{
				itemReferenceId: "cs_test_fixture123-2",
				productUid: pricedCart.lines[1].productUid,
				files: [{ type: "default", url: expectedFiles[1] }],
				quantity: 1,
			},
		],
		shippingAddress: {
			firstName: "Casey",
			lastName: "Rivera",
			addressLine1: "123 Market Street",
			addressLine2: "Suite 4",
			city: "San Francisco",
			state: "CA",
			postCode: "94103",
			country: "US",
			email: "customer@example.test",
			phone: "+14155550123",
		},
	});
});

test("uses the full customer name as both names when it is one word", () => {
	const session = baseSession();
	session.shipping_details.name = "Prince";
	const address = buildGelatoOrder(session, pricedCart, expectedFiles).shippingAddress;
	assert.equal(address.firstName, "Prince");
	assert.equal(address.lastName, "Prince");
});

test("rejects a missing US shipping address part", () => {
	const session = baseSession();
	session.shipping_details.address.city = "   ";
	assert.throws(() => buildGelatoOrder(session, pricedCart, expectedFiles), /complete US shipping address/);
});

test("rejects non-US shipping addresses", () => {
	const session = baseSession();
	session.shipping_details.address.country = "CA";
	assert.throws(() => buildGelatoOrder(session, pricedCart, expectedFiles), /complete US shipping address/);
});

test("rejects a missing customer email", () => {
	const session = baseSession();
	session.customer_details.email = " ";
	session.customer_email = "";
	assert.throws(() => buildGelatoOrder(session, pricedCart, expectedFiles), /valid customer email/);
});

test("builds Claire's two-line order email with total and Gelato ID", () => {
	const email = buildShopOrderEmail({ session: baseSession(), pricedCart, gelatoOrderId: "gelato_order_fixture123" });
	assert.deepEqual(email, {
		subject: "Shop order paid — $115.00",
		text: [
			"Paid Shop order",
			"Customer: Casey Rivera",
			"City: San Francisco",
			"Items:",
			"- Print · 8 x 10 · Paper: Semi-gloss × 2 — $30.00",
			"- Canvas · 8 x 10 · Depth: Thick × 1 — $65.00",
			"Total: $115.00",
			"Sales tax: $0.00",
			"Paid: $115.00",
			"Gelato order: gelato_order_fixture123",
			"Draft order: check it and submit it in the Gelato dashboard (Orders → Drafts).",
		].join("\n"),
	});
});

test("shows sales tax and the tax-inclusive amount paid in Claire's order email", () => {
	const session = { ...baseSession(), amount_total: pricedCart.total + 1000, total_details: { amount_tax: 1000 } };
	const email = buildShopOrderEmail({ session, pricedCart, gelatoOrderId: "gelato_order_fixture123" });
	assert.deepEqual(email.text.split("\n").slice(-6), [
		"- Canvas · 8 x 10 · Depth: Thick × 1 — $65.00",
		"Total: $115.00",
		"Sales tax: $10.00",
		"Paid: $125.00",
		"Gelato order: gelato_order_fixture123",
		"Draft order: check it and submit it in the Gelato dashboard (Orders → Drafts).",
	]);
});

test("creates the Gelato draft when the tax-inclusive payment matches the pre-tax catalog total", async () => {
	const session = { ...baseSession(), amount_total: pricedCart.total + 1000, total_details: { amount_tax: 1000 } };
	const fixture = harness({ session });
	const response = await invoke(fixture.handler);
	assert.equal(response.status, 200);
	assert.equal(fixture.state.createdOrderBodies.length, 1);
	assert.equal(fixture.state.sentEmails.length, 1);
	assert.equal(fixture.state.sentEmails[0].email.subject, "Shop order paid — $115.00");
});

test("emails a mismatch and creates no draft when the pre-tax amount differs from the catalog total", async () => {
	const session = { ...baseSession(), amount_total: pricedCart.total + 1000, total_details: { amount_tax: 500 } };
	const fixture = harness({ session });
	const response = await invoke(fixture.handler);
	assert.equal(response.status, 200);
	assert.equal(fixture.state.createdOrderBodies.length, 0);
	assert.equal(fixture.state.sentEmails.length, 1);
	assert.match(fixture.state.sentEmails[0].email.subject, /^Shop order total mismatch/);
});

test("builds a refusal email with only the Stripe session, paid total and reason", () => {
	const email = buildShopOrderRefusalEmail({
		session: baseSession(),
		error: Object.assign(new Error("This product or its selected options are no longer available."), { publicMessage: true, statusCode: 400 }),
	});
	assert.deepEqual(email, {
		subject: "Shop order cannot be fulfilled automatically — $115.00 USD",
		text: [
			"Paid Shop order cannot be fulfilled automatically.",
			"Stripe session: cs_test_fixture123",
			"Paid total: $115.00 USD",
			"Reason: This product or its selected options are no longer available.",
			"No Gelato draft order was created. Please review this payment.",
		].join("\n"),
	});
});

test("returns 503 when Stripe webhook configuration is missing", async () => {
	const fixture = harness({ env: { ...env, STRIPE_WEBHOOK_SECRET: "" } });
	const response = await invoke(fixture.handler);
	assert.equal(response.status, 503);
	assert.match(response.body.error, /webhook is not configured/i);
	assert.equal(fixture.state.retrieves, 0);
});

test("verifies the raw Stripe signature before doing any fulfillment work", async () => {
	const fixture = harness();
	const response = await invoke(fixture.handler, { signature: "bad-signature", stream: true });
	assert.equal(response.status, 400);
	assert.equal(fixture.state.retrieves, 0);
	assert.equal(fixture.state.contentReads, 0);
	assert.equal(fixture.state.gelatoRequests.length, 0);
	assert.equal(fixture.state.sentEmails.length, 0);
});

test("acknowledges unrelated and live Stripe events without fetching a session", async () => {
	for (const event of [
		{ ...eventFor(baseSession()), type: "customer.updated" },
		{ ...eventFor(baseSession()), livemode: true },
	]) {
		const fixture = harness({ event });
		const response = await invoke(fixture.handler);
		assert.equal(response.status, 200);
		assert.equal(fixture.state.retrieves, 0);
		assert.equal(fixture.state.gelatoRequests.length, 0);
	}
});

test("acknowledges other apps and unpaid Shop sessions without creating Gelato orders", async () => {
	for (const session of [
		{ ...baseSession(), metadata: { ...baseSession().metadata, app: "another-app" } },
		{ ...baseSession(), payment_status: "unpaid" },
	]) {
		const fixture = harness({ session });
		const response = await invoke(fixture.handler);
		assert.equal(response.status, 200);
		assert.equal(fixture.state.contentReads, 0);
		assert.equal(fixture.state.gelatoRequests.length, 0);
		assert.equal(fixture.state.createdOrderBodies.length, 0);
	}
});

test("creates one paid Shop draft and saves its Gelato ID", async () => {
	const session = baseSession();
	const fixture = harness({ event: { ...eventFor(session), type: "checkout.session.async_payment_succeeded" } });
	const response = await invoke(fixture.handler);
	assert.equal(response.status, 200);
	assert.deepEqual(fixture.state.createdOrderBodies, [buildGelatoOrder(fixture.state.initialSession, pricedCart, expectedFiles)]);
	const createRequest = fixture.state.gelatoRequests.find((call) => !call.url.endsWith(":search"));
	assert.equal(createRequest.url, "https://order.gelatoapis.com/v4/orders");
	assert.equal(createRequest.headers["X-API-KEY"], "gelato_fixture");
	assert.deepEqual(fixture.state.originalChecks, ["nature/photo-one", "nature/photo-two"]);
	assert.equal(fixture.state.session.metadata.gelato_order_id, "gelato_order_fixture123");
	assert.equal(fixture.state.session.metadata.shop_order_email_sent, "true");
	assert.equal(fixture.state.sentEmails.length, 1);
	assert.equal(fixture.state.sentEmails[0].to, "orders@example.test");
	assert.equal(fixture.state.sentEmails[0].idempotencyKey, "shop-order-paid/cs_test_fixture123");
	assert.deepEqual(fixture.state.sentEmails[0].email, buildShopOrderEmail({ session: fixture.state.initialSession, pricedCart, gelatoOrderId: "gelato_order_fixture123" }));
	assert.deepEqual(fixture.state.gelatoRequests[0].body, { orderReferenceId: "cs_test_fixture123", limit: 100 });
});

test("uses Stripe session metadata to suppress a repeated order and email", async () => {
	const fixture = harness();
	assert.equal((await invoke(fixture.handler)).status, 200);
	const requestCount = fixture.state.gelatoRequests.length;
	assert.equal((await invoke(fixture.handler)).status, 200);
	assert.equal(fixture.state.createdOrderBodies.length, 1);
	assert.equal(fixture.state.gelatoRequests.length, requestCount);
	assert.equal(fixture.state.sentEmails.length, 1);
});

test("serializes concurrent deliveries for the same session in one process", async () => {
	const fixture = harness({ gelatoDelay: () => new Promise((resolve) => setTimeout(resolve, 10)) });
	const responses = await Promise.all([invoke(fixture.handler), invoke(fixture.handler)]);
	assert.deepEqual(responses.map((response) => response.status), [200, 200]);
	assert.equal(fixture.state.createdOrderBodies.length, 1);
	assert.equal(fixture.state.sentEmails.length, 1);
	assert.equal(fixture.state.retrieves, 2);
});

test("finds the existing Gelato order after a metadata write is lost", async () => {
	const fixture = harness({ updateFailures: 1 });
	assert.equal((await invoke(fixture.handler)).status, 500);
	assert.equal(fixture.state.session.metadata.gelato_order_id, undefined);
	assert.equal(fixture.state.createdOrderBodies.length, 1);
	assert.equal((await invoke(fixture.handler)).status, 200);
	assert.equal(fixture.state.createdOrderBodies.length, 1);
	assert.equal(fixture.state.session.metadata.gelato_order_id, "gelato_order_fixture123");
	assert.equal(fixture.state.sentEmails.length, 1);
	assert.equal(fixture.state.gelatoRequests.filter((call) => call.url.endsWith(":search")).length, 2);
});

test("emails Claire and acknowledges a paid-total mismatch without creating an order", async () => {
	const session = baseSession();
	session.amount_total += 1;
	const fixture = harness({ session });
	const response = await invoke(fixture.handler);
	assert.equal(response.status, 200);
	assert.equal(fixture.state.gelatoRequests.length, 0);
	assert.equal(fixture.state.createdOrderBodies.length, 0);
	assert.equal(fixture.state.sentEmails.length, 1);
	assert.deepEqual(fixture.state.sentEmails[0].email, buildShopOrderMismatchEmail({ session, pricedCart }));
	assert.equal(fixture.state.session.metadata.gelato_order_id, undefined);
});

test("emails Claire once when a paid cart product was removed from the catalog", async () => {
	const removedCatalog = { ...catalog, products: catalog.products.filter((product) => product.slug !== "print") };
	const fixture = harness({ catalog: removedCatalog });
	const first = await invoke(fixture.handler);
	const second = await invoke(fixture.handler);
	assert.deepEqual([first.status, second.status], [200, 200]);
	assert.equal(fixture.state.createdOrderBodies.length, 0);
	assert.equal(fixture.state.gelatoRequests.length, 0);
	assert.equal(fixture.state.sentEmails.length, 1);
	assert.equal(fixture.state.session.metadata.shop_order_refusal_email_sent, "true");
	assert.equal(fixture.state.sentEmails[0].idempotencyKey, "shop-order-cannot-fulfill/cs_test_fixture123");
	assert.deepEqual(fixture.state.sentEmails[0].email, {
		subject: "Shop order cannot be fulfilled automatically — $115.00 USD",
		text: [
			"Paid Shop order cannot be fulfilled automatically.",
			"Stripe session: cs_test_fixture123",
			"Paid total: $115.00 USD",
			"Reason: This product or its selected options are no longer available.",
			"No Gelato draft order was created. Please review this payment.",
		].join("\n"),
	});
	assert.doesNotMatch(fixture.state.sentEmails[0].email.text, /123 Market Street|customer@example\.test/);
});

test("emails Claire once when a paid cart photo is no longer print-enabled", async () => {
	const disabledContent = structuredClone(content);
	disabledContent.albums[0].items[0].printEnabled = false;
	const fixture = harness({ content: disabledContent });
	const first = await invoke(fixture.handler);
	const second = await invoke(fixture.handler);
	assert.deepEqual([first.status, second.status], [200, 200]);
	assert.equal(fixture.state.createdOrderBodies.length, 0);
	assert.equal(fixture.state.gelatoRequests.length, 0);
	assert.equal(fixture.state.sentEmails.length, 1);
	assert.equal(fixture.state.session.metadata.shop_order_refusal_email_sent, "true");
	assert.match(fixture.state.sentEmails[0].email.text, /Reason: This photograph is not available for printing\./);
	assert.doesNotMatch(fixture.state.sentEmails[0].email.text, /123 Market Street|customer@example\.test/);
});

test("emails Claire once when paid cart metadata cannot be verified", async () => {
	const session = baseSession();
	session.metadata.line_count = "invalid";
	const fixture = harness({ session });
	assert.equal((await invoke(fixture.handler)).status, 200);
	assert.equal((await invoke(fixture.handler)).status, 200);
	assert.equal(fixture.state.createdOrderBodies.length, 0);
	assert.equal(fixture.state.sentEmails.length, 1);
	assert.match(fixture.state.sentEmails[0].email.text, /Reason: Order details could not be verified\./);
});

test("keeps paid-cart content fetch failures retryable", async () => {
	const fixture = harness({ contentFailure: new Error("Cloudinary unavailable") });
	const response = await invoke(fixture.handler);
	assert.equal(response.status, 500);
	assert.equal(fixture.state.createdOrderBodies.length, 0);
	assert.equal(fixture.state.sentEmails.length, 0);
});

test("returns 500 and writes no metadata when Gelato fails", async () => {
	const fixture = harness({ gelatoFailure: true });
	const response = await invoke(fixture.handler);
	assert.equal(response.status, 500);
	assert.equal(fixture.state.session.metadata.gelato_order_id, undefined);
	assert.equal(fixture.state.sentEmails.length, 0);
});

test("acknowledges a paid order when Claire's email send fails", async () => {
	const fixture = harness({ emailFailure: true });
	const response = await invoke(fixture.handler);
	assert.equal(response.status, 200);
	assert.equal(fixture.state.session.metadata.gelato_order_id, "gelato_order_fixture123");
	assert.equal(fixture.state.session.metadata.shop_order_email_sent, undefined);
});

test("skips Claire's email when Resend is not configured", async () => {
	const noResend = { ...env };
	delete noResend.RESEND_API_KEY;
	const fixture = harness({ env: noResend });
	const response = await invoke(fixture.handler);
	assert.equal(response.status, 200);
	assert.equal(fixture.state.session.metadata.gelato_order_id, "gelato_order_fixture123");
	assert.equal(fixture.state.sentEmails.length, 0);
});

test("sends Claire's email to the contact address when SHOP_ORDER_TO is unset", async () => {
	const noRecipient = { ...env };
	delete noRecipient.SHOP_ORDER_TO;
	const fixture = harness({ env: noRecipient });
	assert.equal((await invoke(fixture.handler)).status, 200);
	assert.equal(fixture.state.sentEmails[0].to, "contact@clairethomas.art");
});

test("never returns or logs customer address or email", async () => {
	const fixture = harness({ emailFailure: true });
	const customerAddress = fixture.state.session.shipping_details.address.line1;
	const customerEmail = fixture.state.session.customer_details.email;
	const logs = [];
	const originalLog = console.log;
	const originalError = console.error;
	console.log = (...args) => logs.push(args.join(" "));
	console.error = (...args) => logs.push(args.join(" "));
	let response;
	try { response = await invoke(fixture.handler); }
	finally {
		console.log = originalLog;
		console.error = originalError;
	}
	const exposed = `${JSON.stringify(response)}\n${logs.join("\n")}`;
	assert.equal(response.status, 200);
	assert.doesNotMatch(exposed, new RegExp(customerAddress));
	assert.doesNotMatch(exposed, new RegExp(customerEmail));
});
