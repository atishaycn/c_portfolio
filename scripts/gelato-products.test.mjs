import assert from "node:assert/strict";
import test from "node:test";

import {
	aspectGroupFor,
	buildManifest,
	cloudinaryUrl,
	expectedProductKeys,
	findStaleProducts,
	managedProductKey,
	normalizeVariant,
	orientationFor,
	referenceLabelFor,
	selectExistingProduct,
	selectTemplateVariants,
} from "./gelato-products.mjs";

test("builds a dynamic non-commissioned catalog", () => {
	const manifest = buildManifest();
	assert(manifest.photoCount > 0);
	assert.equal(manifest.productCount, manifest.photoCount * 3);
	assert.equal(new Set(manifest.photos.map((photo) => photo.printId)).size, manifest.photoCount);
	assert.equal(manifest.photos.some((photo) => photo.series === "commissioned-work"), false);
	assert.equal(manifest.photos.find((photo) => photo.printId === "the-natural-world-3")?.publicId, "3_asebdu");
	assert.equal(manifest.photos.find((photo) => photo.printId === "san-francisco-24")?.publicId, "place/california/san-francisco/24");
	assert.deepEqual(manifest.photos.find((photo) => photo.aspectGroup === "square")?.sizesByMedium, {
		"fine-art": ["10x10", "12x12", "16x16"],
		framed: ["12x12", "16x16", "20x20"],
		canvas: ["8x8", "12x12", "16x16"],
	});
	assert.equal(
		manifest.photos.find((photo) => photo.printId === "protests-san-francisco-16")?.publicId,
		"place/california/san-francisco/16",
	);
});

test("classifies orientation and aspect ratios", () => {
	assert.equal(orientationFor(5184, 3456), "horizontal");
	assert.equal(orientationFor(3888, 5184), "vertical");
	assert.equal(aspectGroupFor(4000, 3900), "square");
	assert.equal(aspectGroupFor(4000, 3000), "classic");
	assert.equal(aspectGroupFor(4500, 3000), "wide");
});

test("creates Gelato-compatible Cloudinary JPG URLs", () => {
	assert.equal(
		cloudinaryUrl("place/california/1"),
		"https://res.cloudinary.com/dpmdkrggj/image/upload/f_jpg,q_95/place/california/1.jpg",
	);
});

test("builds stable customer-facing reference labels", () => {
	assert.equal(referenceLabelFor("the-natural-world-3", "the-natural-world"), "3");
	assert.equal(referenceLabelFor("protests-san-francisco-16", "protests"), "San Francisco 16");
});

test("normalizes and selects exact template variants", () => {
	const photo = {
		orientation: "horizontal",
		aspectGroup: "wide",
		sizesByMedium: {
			"fine-art": ["8x12", "12x18", "16x24"],
		},
	};
	const template = {
		variants: ["8x12", "12x18", "16x24"].map((size) =>
			normalizeVariant({
				id: size,
				title: `${size} - Horizontal`,
				productUid: `product_hor_${size}-inch`,
				imagePlaceholders: [{ name: "Artwork" }],
			}),
		),
	};
	assert.deepEqual(
		selectTemplateVariants(template, photo, "fine-art").map((variant) => variant.id),
		["8x12", "12x18", "16x24"],
	);
});

test("uses product-specific square sizes and Gelato wood frame labels", () => {
	const photo = {
		orientation: "vertical",
		aspectGroup: "square",
		sizesByMedium: {
			framed: ["12x12", "16x16", "20x20"],
			canvas: ["8x8", "12x12", "16x16"],
		},
	};
	const framedTemplate = {
		variants: ["12x12", "16x16", "20x20"].flatMap((size) =>
			["Wood frame", "Black frame"].map((frame) =>
				normalizeVariant({
					id: `${size}-${frame}`,
					title: `${size} - Vertical - ${frame}`,
					productUid: `product_ver_${size}-inch_${frame === "Wood frame" ? "wood" : "black"}_`,
					imagePlaceholders: [{ name: "Artwork" }],
				}),
			),
		),
	};
	assert.equal(selectTemplateVariants(framedTemplate, photo, "framed").length, 6);

	const canvasTemplate = {
		variants: ["8x8", "12x12", "16x16"].map((size) =>
			normalizeVariant({
				id: size,
				title: `${size} - Vertical - Slim`,
				productUid: `canvas_ver_${size}-inch`,
				imagePlaceholders: [{ name: "Artwork" }],
			}),
		),
	};
	assert.equal(selectTemplateVariants(canvasTemplate, photo, "canvas").length, 3);
	assert.equal(
		normalizeVariant({
			title: "20x20 cm / 8x8″ - Vertical - Slim",
			productUid: "canvas_200x200-mm-8x8-inch_canvas_wood-fsc-slim_4-0_ver",
		}).size,
		"8x8",
	);
});

test("reports managed products removed from the portfolio", () => {
	const photos = [{ printId: "kept-photo" }];
	const state = {
		products: {
			"kept-photo:fine-art": { id: "kept" },
			"deleted-photo:canvas": { id: "deleted", externalId: "shopify-deleted" },
		},
	};
	const remote = [
		{
			id: "deleted",
			externalId: "shopify-deleted",
			status: "active",
			title: "Deleted",
			tags: ["deleted-photo", "format-canvas", "claire-thomas"],
		},
		{
			id: "unmanaged",
			tags: ["deleted-photo", "format-canvas"],
		},
	];
	assert.equal(expectedProductKeys(photos).size, 3);
	assert.equal(managedProductKey(remote[0]), "deleted-photo:canvas");
	assert.equal(managedProductKey(remote[1]), null);
	assert.deepEqual(findStaleProducts(state, remote, photos), [
		{
			key: "deleted-photo:canvas",
			id: "deleted",
			externalId: "shopify-deleted",
			status: "active",
			title: "Deleted",
			source: "state+gelato",
		},
	]);
});

test("prefers an active product and treats a missing recorded product as recoverable", () => {
	const photo = { printId: "photo-1", seriesLabel: "Photo", referenceLabel: "1" };
	const products = [
		{
			id: "recorded-created",
			status: "created",
			title: "Photo 1 - Fine Art Print",
			tags: ["photo-1", "format-fine-art"],
		},
		{
			id: "active-copy",
			status: "active",
			title: "Photo 1 - Fine Art Print",
			tags: ["photo-1", "format-fine-art"],
		},
	];
	assert.equal(selectExistingProduct(products, photo, "fine-art", "recorded-created")?.id, "active-copy");
	assert.equal(selectExistingProduct([], photo, "fine-art", "recorded-created"), undefined);
});
