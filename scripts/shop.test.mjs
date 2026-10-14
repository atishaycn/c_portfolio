import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../shop.js", import.meta.url), "utf8");
const catalogData = JSON.parse(readFileSync(new URL("../content/shop-catalog.json", import.meta.url), "utf8"));
const context = {};
vm.runInNewContext(source, context);
const shop = context.PortfolioShop;
const startedEmpty = shop.catalog.length === 0;
shop.setCatalog(catalogData);
const product = (slug) => shop.catalog.find((entry) => entry.slug === slug);
const fileProduct = (slug) => catalogData.products.find((entry) => entry.slug === slug);
const plain = (value) => JSON.parse(JSON.stringify(value));
const slugPart = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sizeArea = (size) => size.split("x").map((side) => Number(side.trim())).reduce((area, side) => area * side, 1);

test("maps cart lines to the checkout request without prices", () => {
	const request = plain(shop.checkoutRequest([{
		lineId: "line-1",
		productSlug: "print",
		selections: { size: "12 x 16", paper: "matte" },
		photoId: "photo-1",
		crop: { x: 18, y: -12 },
		quantity: 3,
		unitPrice: 19.5,
	}]));
	assert.deepEqual(request, {
		lines: [{
			productSlug: "print",
			size: "12 x 16",
			options: { paper: "matte" },
			photoId: "photo-1",
			crop: { x: 18, y: -12 },
			quantity: 3,
		}],
	});
	assert.equal("price" in request.lines[0], false);
});

test("checks the 125 ppi limit on both sides at the boundary in either orientation", () => {
	assert.equal(shop.photoSupportsSize({ width: 4999, height: 3750 }, "30 x 40"), false);
	assert.equal(shop.photoSupportsSize({ width: 5000, height: 3750 }, "30 x 40"), true);
	assert.equal(shop.photoSupportsSize({ width: 3750, height: 4999 }, "30 x 40"), false);
	assert.equal(shop.photoSupportsSize({ width: 3750, height: 5000 }, "30 x 40"), true);
	assert.equal(shop.photoSupportsSize({ width: 5000, height: 3456 }, "30 x 40"), false);
});

test("reads the Stripe return parameters", () => {
	assert.deepEqual(plain(shop.readCheckoutParams("?checkout=success&session_id=cs_test_abc")), {
		checkout: "success",
		sessionId: "cs_test_abc",
	});
	assert.deepEqual(plain(shop.readCheckoutParams("?checkout=cancelled")), {
		checkout: "cancelled",
		sessionId: "",
	});
});

test("builds catalog products, sizes, options, and defaults from the generated file", () => {
	assert.equal(startedEmpty, true);
	assert.deepEqual(
		plain(shop.catalog.map((entry) => entry.slug)),
		catalogData.products.map((entry) => entry.slug),
	);
	for (const sourceProduct of catalogData.products) {
		const current = product(sourceProduct.slug);
		const sizes = [...new Set(sourceProduct.variants.map((variant) => variant.size))];
		assert.deepEqual(plain(current.sizes), sizes);
		assert.deepEqual(
			plain(current.options.map((group) => ({ key: group.key, values: group.values.map((entry) => entry.value) }))),
			sourceProduct.options.map((group) => ({ key: group.key, values: group.values.map((entry) => entry.value) })),
		);
		const smallestSize = sizes.reduce((smallest, size) => sizeArea(size) < sizeArea(smallest) ? size : smallest, sizes[0]);
		assert.equal(current.optionGroups[0].defaultValue, smallestSize);
		assert.deepEqual(plain(current.optionGroups[0].options.map((entry) => entry.value)), sizes);
		for (const sourceOption of sourceProduct.options) {
			const group = current.optionGroups.find((entry) => entry.key === sourceOption.key);
			assert.equal(group.required, true);
			assert.equal(group.defaultValue, "");
			assert.deepEqual(plain(group.options.map((entry) => entry.value)), sourceOption.values.map((entry) => entry.value));
			assert.equal(group.kind === "swatch", group.key === "frame" || (sourceProduct.slug === "foam-print" && group.key === "edge"));
		}
	}
	const home = shop.renderPage({ productSlug: "", albums: [] });
	assert.equal((home.match(/class="shop-product-card"/g) || []).length, catalogData.products.length);
});

test("uses variant prices and the lowest matching price for incomplete selections", () => {
	const canvas = product("canvas");
	const canvasSource = fileProduct("canvas");
	const expected = canvasSource.variants.find((variant) => variant.size === "12 x 16" && variant.options.depth === "slim");
	assert.ok(expected);
	assert.equal(shop.priceFor(canvas, { size: expected.size, depth: expected.options.depth }), expected.price);
	assert.equal(shop.fromPrice(canvas), Math.min(...canvasSource.variants.map((variant) => variant.price)));
	const partialPrices = canvasSource.variants
		.filter((variant) => variant.size === expected.size)
		.map((variant) => variant.price);
	assert.equal(shop.priceFor(canvas, { size: expected.size }), Math.min(...partialPrices));
	assert.deepEqual(plain(shop.missingRequiredOptions(canvas, { size: expected.size })), ["depth"]);
	assert.deepEqual(plain(shop.missingRequiredOptions(product("print"), {})), ["paper"]);
});

test("uses the minimum file variant price for every product From price", () => {
	for (const sourceProduct of catalogData.products) {
		const lowest = Math.min(...sourceProduct.variants.map((variant) => variant.price));
		assert.equal(shop.fromPrice(product(sourceProduct.slug)), lowest);
	}
});

test("renders every product and catalog option with a product-specific mockup", () => {
	const photo = { id: "art-1", url: "/art-1.jpg", width: 3000, height: 2000 };
	for (const sourceProduct of catalogData.products) {
		const current = product(sourceProduct.slug);
		const firstVariant = sourceProduct.variants[0];
		const base = { size: firstVariant.size, ...firstVariant.options };
		const markup = shop.renderMockup(current, base, photo);
		assert.match(markup, new RegExp("shop-mockup--" + sourceProduct.slug));
		for (const sourceOption of sourceProduct.options) {
			for (const choice of sourceOption.values) {
				const variant = sourceProduct.variants.find((entry) => entry.options[sourceOption.key] === choice.value);
				assert.ok(variant, sourceProduct.slug + " " + sourceOption.key + " " + choice.value);
				const html = shop.renderMockup(current, { size: variant.size, ...variant.options }, photo);
				assert.ok(html.includes("shop-option--" + slugPart(sourceOption.key) + "-" + slugPart(choice.value)));
			}
		}
	}
	assert.match(shop.renderMockup(product("foam-print"), { edge: "black" }, photo), /shop-mockup__object--foam shop-edge--black/);
	assert.match(shop.renderMockup(product("metal-frame"), {}, photo), /shop-mockup__object--frame shop-finish--black/);
	assert.match(shop.renderMockup(product("framed-canvas"), { frame: "dark-wood" }, photo), /shop-mockup__floater-face/);
	assert.match(shop.renderMockup(product("wood-print"), { thickness: "20-mm" }, photo), /shop-option--thickness-20-mm/);
	assert.match(shop.renderMockup(product("metal-print"), { finish: "brushed-silver" }, photo), /shop-finish--brushed-silver/);
});

test("puts each wood frame colour on the moulding in all four mockup views", () => {
	const frame = product("wood-frame");
	const values = fileProduct("wood-frame").options.find((group) => group.key === "frame").values;
	const photo = { id: "art-1", url: "/art-1.jpg", width: 3000, height: 2000 };
	for (const view of ["front", "angle", "corner", "wall"]) {
		const mockups = values.map((choice) => shop.renderMockup(frame, { frame: choice.value }, photo, { view }));
		const objectClasses = mockups.map((markup, index) => {
			const match = markup.match(/<span class="shop-mockup__object ([^"]+)"/);
			assert.ok(match, view + " has a moulding object");
			assert.ok(match[1].includes("shop-finish--" + slugPart(values[index].value)), view + " puts " + values[index].value + " on the object");
			return match[1];
		});
		assert.equal(new Set(objectClasses).size, 4, view + " distinguishes all four frame colours on the object");
		for (const markup of mockups) assert.match(markup, /<span class="shop-mockup__side shop-side--finish shop-finish--/);
	}
	const unselected = shop.renderMockup(frame, {}, photo, { view: "front" });
	assert.match(unselected, /shop-mockup__object--frame shop-finish--black/);
	const metalFrame = shop.renderMockup(product("metal-frame"), {}, photo, { view: "front" });
	assert.match(metalFrame, /shop-mockup__object--frame shop-finish--black/);
});

test("prices and restores only exact cart variants while preserving crop and quantity", () => {
	const photos = [{ id: "known-photo" }];
	const woodFrame = fileProduct("wood-frame");
	const variant = woodFrame.variants.find((entry) => entry.options.frame === "natural-wood");
	assert.ok(variant);
	const valid = {
		lineId: "valid-line",
		productSlug: woodFrame.slug,
		selections: { size: variant.size, ...variant.options },
		photoId: "known-photo",
		crop: { x: 18, y: -12 },
		quantity: 2,
	};
	const invalid = [
		{ ...valid, productSlug: "gallery-frame" },
		{ ...valid, selections: { ...valid.selections, frame: "gallery-black" } },
		{ ...valid, selections: { ...valid.selections, size: "1 x 1" } },
		{ ...valid, selections: { ...valid.selections, paper: "matte" } },
	];
	const restored = plain(shop.parseCart(JSON.stringify([valid, ...invalid]), photos));
	assert.equal(restored.length, 1);
	assert.deepEqual(restored[0].crop, valid.crop);
	assert.equal(restored[0].quantity, valid.quantity);
	assert.equal(restored[0].unitPrice, variant.price);
	assert.deepEqual(plain(shop.parseCart("not json", photos)), []);
});

test("keeps product page prices in From state until each required option is chosen", () => {
	const frame = product("wood-frame");
	const html = shop.renderPage({ productSlug: "wood-frame", albums: [] });
	assert.ok(html.includes("From $" + shop.fromPrice(frame).toFixed(2)));
	assert.deepEqual(plain(shop.missingRequiredOptions(frame, {})), ["frame"]);
	assert.doesNotMatch(html, /production time/i);
});

test("renders selected catalog option labels in product page headings", () => {
	for (const slug of ["wood-frame", "print", "wood-print"]) {
		const source = fileProduct(slug);
		for (const group of source.options) {
			for (const choice of group.values) {
				const html = shop.renderPage({
					productSlug: slug,
					albums: [],
					selections: { [group.key]: choice.value },
				});
				const headingValues = Array.from(html.matchAll(/data-shop-selected-value>([^<]*)<\/span>/g), (match) => match[1]);
				assert.ok(headingValues.includes(choice.label), slug + " shows " + choice.label);
				assert.ok(!headingValues.includes(choice.value), slug + " hides raw value " + choice.value);
			}
		}
	}
});

test("keeps the four mockup views and wall scene distinct", () => {
	const canvas = product("canvas");
	const variant = fileProduct("canvas").variants.find((entry) => entry.options.depth === "thick");
	const selections = { size: variant.size, ...variant.options };
	const photo = { id: "art-1", url: "/art-1.jpg", width: 3000, height: 2000 };
	const views = ["front", "angle", "corner", "wall"].map((view) => shop.renderMockup(canvas, selections, photo, { view }));
	assert.equal(new Set(views).size, views.length);
	assert.ok(views[3].includes("shop-mockup__furniture"));
	assert.ok(views[3].includes("--shop-wall-art-width:"));
});

test("recomputes a serialized cart price from its exact catalog variant", () => {
	const printSource = fileProduct("print");
	const variant = printSource.variants.find((entry) => entry.options.paper === "matte");
	const otherVariant = printSource.variants.find((entry) => entry.size === variant.size && entry.options.paper !== variant.options.paper);
	assert.ok(variant && otherVariant);
	const line = {
		lineId: "print-line",
		productSlug: printSource.slug,
		selections: { size: variant.size, ...variant.options },
		photoId: "known-photo",
		crop: { x: -20, y: 14 },
		quantity: 3,
		unitPrice: otherVariant.price,
	};
	const restored = plain(shop.parseCart(shop.serializeCart([line]), [{ id: "known-photo" }]));
	assert.equal(restored[0].unitPrice, variant.price);
	assert.equal(shop.lineTotal(restored[0]), variant.price * line.quantity);
	assert.equal(shop.cartSubtotal(restored), variant.price * line.quantity);
});

test("drops stored lines with missing photos and unknown option keys", () => {
	const sourceProduct = fileProduct("wood-frame");
	const variant = sourceProduct.variants[0];
	const line = {
		productSlug: sourceProduct.slug,
		selections: { size: variant.size, ...variant.options },
		photoId: "known-photo",
		quantity: 1,
	};
	const invalid = [
		{ ...line, photoId: "missing-photo" },
		{ ...line, selections: { ...line.selections, extra: "value" } },
	];
	assert.deepEqual(plain(shop.parseCart(JSON.stringify(invalid), [{ id: "known-photo" }])), []);
});

test("returns a print inquiry message when the catalog is empty", () => {
	shop.setCatalog({ products: [] });
	const unavailable = shop.renderPage({ albums: [] });
	assert.match(unavailable, /The print store is unavailable right now/);
	assert.match(unavailable, /mailto:contact@clairethomas\.art/);
	assert.match(unavailable, /contact@clairethomas\.art/);
	shop.setCatalog(catalogData);
});

test("keeps photo selection, size orientation, and crop behavior", () => {
	const photos = shop.selectStorePhotos([
		{
			key: "nature",
			label: "Nature",
			printEnabled: true,
			items: [
				{ id: "nature-1", printEnabled: true },
				{ id: "nature-2", printEnabled: false },
			],
		},
		{
			key: "disabled-album",
			printEnabled: false,
			items: [{ id: "disabled-1", printEnabled: true }],
		},
		{
			key: "events",
			label: "Events",
			printEnabled: true,
			items: [{ id: "events-1", printEnabled: true }],
		},
	]);
	assert.equal(photos.map((entry) => entry.id).join(","), "nature-1,events-1");
	assert.equal(photos[0].albumLabel, "Nature");
	const landscape = shop.dimensionsFor("11 x 14", { width: 3000, height: 2000 });
	const portrait = shop.dimensionsFor("11 x 14", { width: 2000, height: 3000 });
	assert.equal(landscape.orientation, "landscape");
	assert.equal(landscape.width, 14);
	assert.equal(landscape.height, 11);
	assert.equal(portrait.orientation, "portrait");
	assert.equal(portrait.width, 11);
	assert.equal(portrait.height, 14);
	assert.deepEqual(plain(shop.clampCrop({ x: 85, y: -73 })), { x: 50, y: -50 });
});
