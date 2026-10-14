import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const order = require("../api/_lib/shop-order.js");
const checkoutModule = require("../api/shop-checkout.js");
const checkout = checkoutModule.createHandler;
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
const baseLine = (changes = {}) => ({
	productSlug: "print",
	size: "8 x 10",
	options: { paper: "semi-gloss" },
	photoId: "photo-one",
	crop: { x: 0, y: 0 },
	quantity: 1,
	...changes,
});
const validCart = { lines: [baseLine()] };
const env = {
	SHOP_CHECKOUT_ENABLED: "true",
	SHOP_SITE_URL: "http://127.0.0.1:8096",
	STRIPE_SECRET_KEY: "sk_test_fixture",
	CLOUDINARY_CLOUD_NAME: "fixture",
	CLOUDINARY_API_KEY: "fixture-key",
	CLOUDINARY_API_SECRET: "fixture-secret",
};
const request = ({ method = "POST", body, headers = {}, url = "/" } = {}) => ({ method, body, headers, url });
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
const rawContent = () => structuredClone(content);
const priced = (cart = validCart, currentContent = rawContent()) => order.priceCart(cart, catalog, currentContent);
const assertCustomerRefusal = (callback, message) => assert.throws(callback, (error) => error.statusCode === 400 && error.message === message);

test("refuses an empty cart", () => {
	assertCustomerRefusal(() => priced({ lines: [] }), "Your cart is empty.");
});

test("refuses more than 20 cart lines", () => {
	assertCustomerRefusal(() => priced({ lines: Array.from({ length: 21 }, () => baseLine()) }), "Your cart has more than 20 items. Remove some and try again.");
});

test("refuses a malformed cart request", () => {
	assertCustomerRefusal(() => priced({}), "Your cart is invalid. Reload and try again.");
});

test("refuses a product that is not in the catalog", () => {
	assertCustomerRefusal(() => priced({ lines: [baseLine({ productSlug: "unknown" })] }), "This product or its selected options are no longer available.");
});

test("refuses a size that is not a catalog variant", () => {
	assertCustomerRefusal(() => priced({ lines: [baseLine({ size: "99 x 99" })] }), "This product or its selected options are no longer available.");
});

test("refuses an unknown or incomplete option set", () => {
	for (const options of [{ paper: "glossy" }, {}, { paper: "semi-gloss", surprise: "value" }]) {
		assertCustomerRefusal(() => priced({ lines: [baseLine({ options })] }), "This product or its selected options are no longer available.");
	}
});

test("refuses a photo that is missing from current CMS content", () => {
	assertCustomerRefusal(() => priced({ lines: [baseLine({ photoId: "missing" })] }), "This photograph is not available for printing.");
});

test("refuses a photo in an album disabled for printing", () => {
	const disabledAlbum = rawContent();
	disabledAlbum.albums[0].printEnabled = false;
	assertCustomerRefusal(() => priced(validCart, disabledAlbum), "This photograph is not available for printing.");
});

test("refuses a photo that is not print-enabled", () => {
	const disabledPhoto = rawContent();
	disabledPhoto.albums[0].items[0].printEnabled = false;
	assertCustomerRefusal(() => priced(validCart, disabledPhoto), "This photograph is not available for printing.");
});

test("refuses a fractional or out-of-range quantity", () => {
	for (const quantity of [0, 11, 1.5, "2"]) {
		assertCustomerRefusal(() => priced({ lines: [baseLine({ quantity })] }), "Choose a quantity from 1 to 10.");
	}
});

test("refuses an invalid crop offset", () => {
	assertCustomerRefusal(() => priced({ lines: [baseLine({ crop: { x: 51, y: 0 } })] }), "The crop for one photograph is invalid. Edit it and try again.");
});

test("enforces the 125 pixel-per-inch boundary", () => {
	const justUnder = rawContent();
	justUnder.albums[0].items[0].width = 1249;
	justUnder.albums[0].items[0].height = 1000;
	assertCustomerRefusal(() => priced(validCart, justUnder), "This photograph is too small for the selected size.");
	const exact = rawContent();
	exact.albums[0].items[0].width = 1250;
	exact.albums[0].items[0].height = 1000;
	assert.equal(priced(validCart, exact).lines[0].photo.width, 1250);
});

test("returns labeled variants, prices, photo dimensions and crop in cents", () => {
	const line = priced().lines[0];
	assert.deepEqual(line, {
		productSlug: "print",
		productName: "Print",
		category: "Prints",
		size: "8 x 10",
		options: { paper: "semi-gloss" },
		optionLabels: { Paper: "Semi-gloss" },
		variantPrice: 1500,
		quantity: 1,
		lineTotal: 1500,
		orientation: "hor",
		productUid: catalog.products[0].variants[0].productUid.hor,
		photo: { id: "photo-one", publicId: "nature/photo-one", width: 4000, height: 3000 },
		crop: { x: 0, y: 0 },
	});
});

test("selects the Gelato UID from the photo orientation", () => {
	const result = priced({ lines: [baseLine(), baseLine({ photoId: "photo-two" })] });
	assert.equal(result.lines[0].orientation, "hor");
	assert.equal(result.lines[0].productUid, catalog.products[0].variants[0].productUid.hor);
	assert.equal(result.lines[1].orientation, "ver");
	assert.equal(result.lines[1].productUid, catalog.products[0].variants[0].productUid.ver);
});

test("maps crop offsets to the same landscape mockup region", () => {
	const photo = { width: 400, height: 300 };
	assert.deepEqual(order.cropRectangle(photo, "8 x 10", { x: 0, y: 0 }), { x: 13, y: 0, width: 375, height: 300 });
	assert.deepEqual(order.cropRectangle(photo, "8 x 10", { x: -50, y: 0 }), { x: 0, y: 0, width: 375, height: 300 });
	assert.deepEqual(order.cropRectangle(photo, "8 x 10", { x: 0, y: 50 }), { x: 13, y: 0, width: 375, height: 300 });
});

test("maps crop offsets to the same portrait mockup region", () => {
	const photo = { width: 300, height: 400 };
	assert.deepEqual(order.cropRectangle(photo, "8 x 10", { x: 0, y: 0 }), { x: 0, y: 13, width: 300, height: 375 });
	assert.deepEqual(order.cropRectangle(photo, "8 x 10", { x: -50, y: 0 }), { x: 0, y: 13, width: 300, height: 375 });
	assert.deepEqual(order.cropRectangle(photo, "8 x 10", { x: 0, y: 50 }), { x: 0, y: 25, width: 300, height: 375 });
});

test("builds a cropped, versioned Cloudinary URL without compression or resize", () => {
	assert.equal(
		order.printFileUrl("fixture", { publicId: "nature/photo one" }, { version: 123, format: "jpg" }, { x: 13, y: 0, width: 375, height: 300 }),
		"https://res.cloudinary.com/fixture/image/upload/c_crop,x_13,y_0,w_375,h_300/v123/nature/photo%20one.jpg",
	);
});

test("charges one flat shipping amount for a Prints-only cart", () => {
	const result = priced({ lines: [baseLine(), baseLine({ productSlug: "fine-art-print", options: {} })] });
	assert.equal(result.shipping, 800);
	assert.equal(result.total, result.subtotal + 800);
});

test("charges the Wall Art shipping amount for a mixed cart", () => {
	const result = priced({ lines: [baseLine(), baseLine({ productSlug: "canvas", options: { depth: "slim" } })] });
	assert.equal(result.shipping, 2000);
	assert.equal(result.total, result.subtotal + 2000);
});

test("stores and restores a 20-line cart in bounded Stripe metadata", () => {
	const cart = { lines: Array.from({ length: 20 }, (_, index) => baseLine({ quantity: index % 10 + 1, crop: { x: index - 10, y: 10 - index } })) };
	const firstPrice = priced(cart);
	const metadata = order.sessionMetadata(firstPrice);
	assert.equal(metadata.line_count, "20");
	assert(Object.values(metadata).every((value) => Buffer.byteLength(value, "utf8") < 500));
	const restored = order.cartFromMetadata(metadata);
	assert.deepEqual(priced(restored).total, firstPrice.total);
	assert.deepEqual(restored, cart);
});

test("checkout guard refuses a missing Stripe key", async () => {
	const missingKeyEnv = { ...env };
	delete missingKeyEnv.STRIPE_SECRET_KEY;
	const result = await invoke(checkout({ env: missingKeyEnv }), request({ body: validCart, headers: { origin: env.SHOP_SITE_URL } }));
	assert.equal(result.status, 503);
	assert.equal(result.body.error, "Test checkout is unavailable: STRIPE_SECRET_KEY is missing.");
});

test("checkout guard refuses a live Stripe key", async () => {
	const result = await invoke(checkout({ env: { ...env, STRIPE_SECRET_KEY: "sk_live_fixture" } }), request({ body: validCart, headers: { origin: env.SHOP_SITE_URL } }));
	assert.equal(result.status, 503);
	assert.match(result.body.error, /must be a test key/);
});

test("checkout guard refuses production", async () => {
	const result = await invoke(checkout({ env: { ...env, VERCEL_ENV: "production" } }), request({ body: validCart, headers: { origin: env.SHOP_SITE_URL } }));
	assert.equal(result.status, 503);
	assert.equal(result.body.error, "Test checkout is disabled in production.");
});

test("checkout guard refuses a disabled flag and an invalid site origin", async () => {
	const disabled = await invoke(checkout({ env: { ...env, SHOP_CHECKOUT_ENABLED: "false" } }), request({ body: validCart, headers: { origin: env.SHOP_SITE_URL } }));
	assert.equal(disabled.status, 503);
	assert.match(disabled.body.error, /SHOP_CHECKOUT_ENABLED/);
	const invalidOrigin = await invoke(checkout({ env: { ...env, SHOP_SITE_URL: "https://shop.example.invalid/path" } }), request({ body: validCart, headers: { origin: env.SHOP_SITE_URL } }));
	assert.equal(invalidOrigin.status, 503);
	assert.match(invalidOrigin.body.error, /valid site origin/);
});

test("checkout rejects an untrusted request origin before loading content", async () => {
	let loads = 0;
	const handler = checkout({ env, fetchContent: async () => { loads++; return rawContent(); } });
	const result = await invoke(handler, request({ body: validCart, headers: { origin: "https://other.example.invalid" } }));
	assert.equal(result.status, 403);
	assert.equal(result.body.error, "Checkout request is not allowed.");
	assert.equal(loads, 0);
});

test("empty cart is rejected before checkout configuration is required", async () => {
	const missingKeyEnv = { ...env };
	delete missingKeyEnv.STRIPE_SECRET_KEY;
	const result = await invoke(checkout({ env: missingKeyEnv }), request({ body: { lines: [] } }));
	assert.equal(result.status, 400);
	assert.equal(result.body.error, "Your cart is empty.");
});

test("checkout passes exact server-priced lines, shipping, metadata and return URLs to Stripe", async () => {
	const body = { lines: [
		baseLine({ quantity: 2 }),
		baseLine({ productSlug: "canvas", options: { depth: "thick" }, photoId: "photo-two" }),
	] };
	const calls = [];
	const verified = [];
	const resources = new Map([
		["nature/photo-one", { public_id: "nature/photo-one", width: 4000, height: 3000, version: 101, format: "jpg" }],
		["nature/photo-two", { public_id: "nature/photo-two", width: 3000, height: 4000, version: 202, format: "png" }],
	]);
	const handler = checkout({
		env,
		catalog,
		fetchContent: async () => rawContent(),
		confirmOriginal: async (photo) => { verified.push(photo.publicId); return resources.get(photo.publicId); },
		getStripe: () => ({ checkout: { sessions: { create: async (parameters) => { calls.push(parameters); return { livemode: false, url: "https://checkout.stripe.com/c/pay/session" }; } } } }),
	});
	const result = await invoke(handler, request({ body, headers: { origin: env.SHOP_SITE_URL } }));
	assert.equal(result.status, 200);
	assert.deepEqual(result.body, { url: "https://checkout.stripe.com/c/pay/session" });
	assert.deepEqual(verified, ["nature/photo-one", "nature/photo-two"]);
	const p = priced(body);
	const expectedMetadata = order.sessionMetadata(p);
	assert.deepEqual(calls[0], {
		mode: "payment",
		shipping_address_collection: { allowed_countries: ["US"] },
		phone_number_collection: { enabled: true },
		line_items: [
			{
				quantity: 2,
				price_data: {
					currency: "usd",
					unit_amount: 1500,
					product_data: {
						name: "Print · 8 x 10 · Paper: Semi-gloss",
						description: "Test checkout only. No real payment, printing, or shipping.",
						images: ["https://res.cloudinary.com/fixture/image/upload/c_crop,x_125,y_0,w_3750,h_3000/f_jpg,q_80,w_800,c_limit/v101/nature/photo-one.jpg"],
					},
				},
			},
			{
				quantity: 1,
				price_data: {
					currency: "usd",
					unit_amount: 6500,
					product_data: {
						name: "Canvas · 8 x 10 · Depth: Thick",
						description: "Test checkout only. No real payment, printing, or shipping.",
						images: ["https://res.cloudinary.com/fixture/image/upload/c_crop,x_0,y_125,w_3000,h_3750/f_jpg,q_80,w_800,c_limit/v202/nature/photo-two.png"],
					},
				},
			},
		],
		shipping_options: [{ shipping_rate_data: { type: "fixed_amount", fixed_amount: { amount: 2000, currency: "usd" }, display_name: "US shipping" } }],
		metadata: expectedMetadata,
		success_url: "http://127.0.0.1:8096/prints.html?checkout=success&session_id={CHECKOUT_SESSION_ID}",
		cancel_url: "http://127.0.0.1:8096/prints.html?checkout=cancelled",
		custom_text: { submit: { message: "Test checkout only. No real payment, printing, or shipping." } },
	});
	assert.equal(calls.length, 1);
});

test("checkout verifies a photograph only once when several lines use it", async () => {
	let verified = 0;
	const handler = checkout({
		env,
		catalog,
		fetchContent: async () => rawContent(),
		confirmOriginal: async () => {
			verified++;
			return { public_id: "nature/photo-one", width: 4000, height: 3000, version: 101, format: "jpg" };
		},
		getStripe: () => ({ checkout: { sessions: { create: async () => ({ livemode: false, url: "https://checkout.stripe.com/c/pay/session" }) } } }),
	});
	const result = await invoke(handler, request({ body: { lines: [baseLine(), baseLine({ quantity: 2 })] }, headers: { origin: env.SHOP_SITE_URL } }));
	assert.equal(result.status, 200);
	assert.equal(verified, 1);
});

test("Cloudinary original check requires the exact original resource", async () => {
	const previousFetch = globalThis.fetch;
	let seen;
	globalThis.fetch = async (url, options) => {
		seen = { url, options };
		return { ok: true, json: async () => ({ public_id: "nature/photo-one", width: 4000, height: 3000, version: 101, format: "jpg" }) };
	};
	try {
		const resource = await checkoutModule.confirmOriginal({ publicId: "nature/photo-one", width: 4000, height: 3000 }, env);
		assert.equal(resource.version, 101);
		assert.match(seen.url, /nature%2Fphoto-one$/);
		assert.match(seen.options.headers.Authorization, /^Basic /);
		globalThis.fetch = async () => ({ ok: true, json: async () => ({ public_id: "nature/photo-one", width: 3999, height: 3000, version: 101, format: "jpg" }) });
		await assert.rejects(() => checkoutModule.confirmOriginal({ publicId: "nature/photo-one", width: 4000, height: 3000 }, env), (error) => error.statusCode === 409);
	} finally { globalThis.fetch = previousFetch; }
});

test("order status rebuilds the order from app metadata and rejects sessions from other apps", async () => {
	const cartPrice = priced();
	const session = {
		livemode: false,
		mode: "payment",
		status: "complete",
		payment_status: "paid",
		currency: "usd",
		amount_total: cartPrice.total,
		metadata: order.sessionMetadata(cartPrice),
	};
	const handler = shopOrder.createHandler({ env, catalog, fetchContent: async () => rawContent(), getStripe: () => ({ checkout: { sessions: { retrieve: async () => session } } }) });
	const result = await invoke(handler, request({ method: "GET", url: "/api/shop-order?session_id=cs_test_fixture123" }));
	assert.deepEqual(result.body, {
		paid: true,
		total: cartPrice.total,
		currency: "usd",
		lines: [{ productName: "Print", size: "8 x 10", optionLabels: { Paper: "Semi-gloss" }, quantity: 1, variantPrice: 1500, lineTotal: 1500 }],
	});
	const otherApp = shopOrder.createHandler({ env, getStripe: () => ({ checkout: { sessions: { retrieve: async () => ({ ...session, metadata: { ...session.metadata, app: "other" } }) } } }) });
	assert.equal((await invoke(otherApp, request({ method: "GET", url: "/api/shop-order?session_id=cs_test_fixture123" }))).status, 404);
});

test("order status reports unpaid sessions and treats missing Stripe sessions as not found", async () => {
	const cartPrice = priced();
	const session = { livemode: false, mode: "payment", status: "open", payment_status: "unpaid", currency: "usd", amount_total: cartPrice.total, metadata: order.sessionMetadata(cartPrice) };
	const handler = shopOrder.createHandler({ env, catalog, fetchContent: async () => rawContent(), getStripe: () => ({ checkout: { sessions: { retrieve: async () => session } } }) });
	const result = await invoke(handler, request({ method: "GET", url: "/api/shop-order?session_id=cs_test_fixture123" }));
	assert.equal(result.body.paid, false);
	const missing = shopOrder.createHandler({ env, getStripe: () => ({ checkout: { sessions: { retrieve: async () => { throw Object.assign(new Error("missing"), { code: "resource_missing" }); } } } }) });
	assert.equal((await invoke(missing, request({ method: "GET", url: "/api/shop-order?session_id=cs_test_fixture123" }))).status, 404);
});

test("order status remains available when new checkout is disabled", async () => {
	const cartPrice = priced();
	const session = { livemode: false, mode: "payment", status: "open", payment_status: "unpaid", currency: "usd", amount_total: cartPrice.total, metadata: order.sessionMetadata(cartPrice) };
	const handler = shopOrder.createHandler({ env: { ...env, SHOP_CHECKOUT_ENABLED: "false" }, catalog, fetchContent: async () => rawContent(), getStripe: () => ({ checkout: { sessions: { retrieve: async () => session } } }) });
	const result = await invoke(handler, request({ method: "GET", url: "/api/shop-order?session_id=cs_test_fixture123" }));
	assert.equal(result.status, 200);
	assert.equal(result.body.paid, false);
});
