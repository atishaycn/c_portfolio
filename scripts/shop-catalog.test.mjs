import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
	calculateRetailPrice,
	parseGelatoSize,
	PRODUCTS,
	selectVariants,
	SIZE_SPECS,
} from "./shop-catalog.mjs";

const expectedSlugs = [
	"print",
	"fine-art-print",
	"canvas",
	"framed-canvas",
	"metal-print",
	"acrylic-print",
	"wood-print",
	"foam-print",
	"wood-frame",
	"metal-frame",
];

const expectedSizes = new Set([
	"8x10",
	"8x12",
	"11x14",
	"12x12",
	"12x16",
	"12x18",
	"16x16",
	"16x20",
	"16x24",
	"18x24",
	"20x20",
	"20x30",
	"24x36",
	"28x40",
	"30x40",
]);

const catalogFile = resolve(import.meta.dirname, "..", "content", "shop-catalog.json");

test("parses inch-first and mm-first Gelato size formats", () => {
	assert.equal(parseGelatoSize("12x16-inch-300x400-mm").label, "12 x 16");
	assert.equal(parseGelatoSize("300x400-mm-12x16-inch").label, "12 x 16");
	assert.equal(parseGelatoSize("16x12-inch-400x300-mm").label, "12 x 16");
	assert.equal(parseGelatoSize("a4"), null);
});

test("selects one product per orientation and option from inline products", () => {
	const canvas = PRODUCTS.find((product) => product.slug === "canvas");
	const size = SIZE_SPECS.find((item) => item.key === "12x16");
	const products = canvas.options[0].values.flatMap((depth) =>
		["hor", "ver"].map((orientation) => ({
			productUid: `${depth.value}-${orientation}-fixture`,
			attributes: {
				ProductStatus: "activated",
				Orientation: orientation,
				CanvasThicknessType: depth.gelatoValue,
				UnifiedCanvasFormat: "12x16-inch-300x400-mm",
			},
		})),
	);
	products.push({
		productUid: "slim-hor-mm-first-fixture",
		attributes: {
			ProductStatus: "activated",
			Orientation: "hor",
			CanvasThicknessType: "wood-fsc-slim",
			UnifiedCanvasFormat: "300x400-mm-12x16-inch",
		},
	});

	const result = selectVariants(canvas, products, [size]);
	assert.equal(result.omitted.length, 0);
	assert.deepEqual(result.variants.map((variant) => variant.options.depth), ["slim", "thick"]);
	assert.deepEqual(result.variants[0].productUid, {
		hor: "slim-hor-fixture",
		ver: "slim-ver-fixture",
	});
});

test("fails when an orientation has an ambiguous product match", () => {
	const canvas = PRODUCTS.find((product) => product.slug === "canvas");
	const size = SIZE_SPECS.find((item) => item.key === "12x16");
	const product = (productUid, orientation) => ({
		productUid,
		attributes: {
			ProductStatus: "activated",
			Orientation: orientation,
			CanvasThicknessType: "wood-fsc-slim",
			UnifiedCanvasFormat: "12x16-inch-300x400-mm",
		},
	});
	assert.throws(
		() => selectVariants(canvas, [product("hor-1", "hor"), product("hor-2", "hor"), product("ver-1", "ver")], [size]),
		/Ambiguous Gelato match for canvas 12 x 16 .*hor matched 2 products/,
	);
});

test("rounds retail prices up from the higher orientation cost", () => {
	assert.equal(calculateRetailPrice(10.01, 10.2), 26);
	assert.equal(calculateRetailPrice(20, 20.01), 51);
});

test("generated catalog has the expected products, sizes, UIDs, options, and prices", () => {
	const catalog = JSON.parse(readFileSync(catalogFile, "utf8"));
	assert.deepEqual(catalog.products.map((product) => product.slug), expectedSlugs);
	assert.equal(catalog.products.length, 10);

	for (const product of catalog.products) {
		const optionKeys = product.options.map((option) => option.key);
		for (const variant of product.variants) {
			assert.ok(expectedSizes.has(variant.size.replaceAll(" ", "")), `${product.slug} has unknown size ${variant.size}`);
			assert.equal(typeof variant.productUid.hor, "string");
			assert.ok(variant.productUid.hor.length > 0);
			assert.equal(typeof variant.productUid.ver, "string");
			assert.ok(variant.productUid.ver.length > 0);
			assert.ok(Number.isInteger(variant.price) && variant.price > 0);
			assert.deepEqual(Object.keys(variant.options).sort(), [...optionKeys].sort());
			for (const productOption of product.options) {
				assert.ok(
					productOption.values.some((value) => value.value === variant.options[productOption.key]),
					`${product.slug} has invalid ${productOption.key} option`,
				);
			}
		}
	}

	function hasCostKey(value) {
		if (!value || typeof value !== "object") return false;
		return Object.entries(value).some(([key, nested]) => key === "cost" || hasCostKey(nested));
	}
	assert.equal(hasCostKey(catalog), false);
});
