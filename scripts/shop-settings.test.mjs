import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { shopSettings, validateContent } = require("../api/_lib/content.js");
const shopCatalog = require("../api/shop-catalog.js");
const catalog = require("../content/shop-catalog.json");

const DEFAULTS = { markup: 2.5, shippingPrints: 8, shippingWallArt: 20 };
const bareContent = () => ({ groups: [], albums: [] });
const withSettings = (shopSettingsValue) => ({ ...bareContent(), shopSettings: shopSettingsValue });

const assertRefused = (candidate) => {
	assert.throws(() => validateContent(candidate), (error) => error.statusCode === 400);
};

const invoke = async (handler, request = { method: "GET", headers: {} }) => {
	const result = { status: 200, headers: {}, body: null };
	const response = {
		setHeader: (name, value) => { result.headers[name] = value; },
		end: (body) => { result.body = body ? JSON.parse(body) : null; },
		set statusCode(value) { result.status = value; },
	};
	await handler(request, response);
	return result;
};

const hasCostKey = (value) => {
	if (!value || typeof value !== "object") return false;
	return Object.entries(value).some(([key, nested]) => key === "cost" || key === "costs" || hasCostKey(nested));
};

test("keeps valid shop settings", () => {
	const settings = { markup: 3, shippingPrints: 10, shippingWallArt: 25 };
	assert.deepEqual(validateContent(withSettings(settings)).shopSettings, settings);
	assert.deepEqual(validateContent(withSettings({ markup: 1.5, shippingPrints: 0, shippingWallArt: 100 })).shopSettings, {
		markup: 1.5,
		shippingPrints: 0,
		shippingWallArt: 100,
	});
	assert.deepEqual(validateContent(withSettings({ markup: 5, shippingPrints: 0, shippingWallArt: 0 })).shopSettings, {
		markup: 5,
		shippingPrints: 0,
		shippingWallArt: 0,
	});
});

test("fills missing shop settings with the defaults", () => {
	assert.deepEqual(validateContent(bareContent()).shopSettings, DEFAULTS);
	assert.deepEqual(validateContent(withSettings(null)).shopSettings, DEFAULTS);
	assert.deepEqual(validateContent(withSettings({})).shopSettings, DEFAULTS);
	assert.deepEqual(validateContent(withSettings({ markup: 3 })).shopSettings, { ...DEFAULTS, markup: 3 });
	assert.deepEqual(validateContent(withSettings({ shippingWallArt: 30 })).shopSettings, { ...DEFAULTS, shippingWallArt: 30 });
});

test("rejects out-of-range or non-numeric shop settings with HTTP 400", () => {
	assertRefused(withSettings({ markup: 1.4 }));
	assertRefused(withSettings({ markup: 5.1 }));
	assertRefused(withSettings({ markup: "2.5" }));
	assertRefused(withSettings({ markup: Number.NaN }));
	assertRefused(withSettings({ shippingPrints: 2.5 }));
	assertRefused(withSettings({ shippingPrints: 101 }));
	assertRefused(withSettings({ shippingPrints: -1 }));
	assertRefused(withSettings({ shippingWallArt: "20" }));
	assertRefused(withSettings({ shippingWallArt: Number.POSITIVE_INFINITY }));
	assertRefused(withSettings("2.5"));
	assertRefused(withSettings([]));
});

test("shopSettings returns the effective settings for any content", () => {
	assert.deepEqual(shopSettings(bareContent()), DEFAULTS);
	assert.deepEqual(shopSettings(undefined), DEFAULTS);
	assert.deepEqual(shopSettings(withSettings({ markup: 4, shippingPrints: 5, shippingWallArt: 50 })), {
		markup: 4,
		shippingPrints: 5,
		shippingWallArt: 50,
	});
});

test("served catalog prices follow the markup and have no cost fields", async () => {
	const handler = shopCatalog.createHandler({
		catalog,
		fetchContent: async () => withSettings({ markup: 2.5, shippingPrints: 8, shippingWallArt: 20 }),
	});
	const atDefault = await invoke(handler);
	assert.equal(atDefault.status, 200);
	assert.equal(atDefault.headers["Cache-Control"], "public, max-age=60");
	assert.equal(hasCostKey(atDefault.body), false);
	assert.equal("markup" in atDefault.body, false);
	assert.deepEqual(atDefault.body.shipping, { prints: 8, wallArt: 20 });
	for (const [index, product] of catalog.products.entries()) {
		assert.deepEqual(atDefault.body.products[index].variants.map((variant) => variant.price), product.variants.map((variant) => variant.price));
	}

	const changed = shopCatalog.createHandler({
		catalog,
		fetchContent: async () => withSettings({ markup: 3, shippingPrints: 10, shippingWallArt: 25 }),
	});
	const repriced = await invoke(changed);
	assert.equal(hasCostKey(repriced.body), false);
	assert.deepEqual(repriced.body.shipping, { prints: 10, wallArt: 25 });
	const printVariant = repriced.body.products[0].variants.find((variant) => variant.size === "8 x 10" && variant.options.paper === "semi-gloss");
	assert.equal(printVariant.price, 18);
});

test("served catalog refuses a request with the wrong method or no content", async () => {
	const handler = shopCatalog.createHandler({ catalog, fetchContent: async () => null });
	assert.equal((await invoke(handler, { method: "POST", headers: {} })).status, 405);
	assert.equal((await invoke(handler)).status, 503);
});
