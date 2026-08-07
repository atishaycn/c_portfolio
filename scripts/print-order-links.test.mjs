import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../site.js", import.meta.url), "utf8");
const mapStart = source.indexOf("const SHOPIFY_SERIES_HANDLES =");
const mapEnd = source.indexOf("const buildCloudinaryUrl =", mapStart);
const start = source.indexOf("const printInquiryUrl =");
const end = source.indexOf("const responsiveWidths =", start);
assert(mapStart >= 0 && mapEnd > mapStart && start >= 0 && end > start, "site.js print URL helpers must remain available");

const context = {
	printShopConfig: {
		shopUrl: "https://shop.clairethomas.art/collections/all",
		email: "contact@clairethomas.art",
		productUrls: {
			"the-natural-world-3":
				"https://shop.clairethomas.art/products/the-natural-world-3-fine-art-print?variant=53830433439928",
		},
	},
};
vm.runInNewContext(
	`${source.slice(mapStart, mapEnd)}${source.slice(start, end)}\nglobalThis.__printLinkApi = { printOrderUrl, referenceLabelFor, shopifyFineArtHandleFor };`,
	context,
);
const api = context.__printLinkApi;

test("preserves explicit canonical product URL overrides", () => {
	assert.equal(
		api.printOrderUrl(
			{ id: "the-natural-world-3" },
			{ key: "the-natural-world", label: "the natural world" },
		),
		"https://shop.clairethomas.art/products/the-natural-world-3-fine-art-print?variant=53830433439928",
	);
});

test("matches stable catalog handles despite existing album label changes", () => {
	assert.equal(
		api.shopifyFineArtHandleFor(
			{ id: "protests-san-francisco-16" },
			{ key: "protests", label: "Renamed Reportage" },
		),
		"reportage-san-francisco-16-fine-art-print",
	);
	assert.equal(
		api.shopifyFineArtHandleFor(
			{ id: "shapes-and-shadows-1" },
			{ key: "shapes-and-shadows", label: "Renamed Shapes" },
		),
		"shapes-shadows-1-fine-art-print",
	);
	assert.equal(
		api.printOrderUrl(
			{ id: "san-francisco-83" },
			{ key: "san-francisco", label: "San Francisco" },
		),
		"https://shop.clairethomas.art/products/san-francisco-83-fine-art-print",
	);
});

test("resolves a renamed arbitrary CMS album and UUID photo ID directly", () => {
	const album = { key: "wildlife", label: "Animal Portraits" };
	const item = { id: "wildlife-550e8400-e29b-41d4-a716-446655440000" };

	assert.equal(
		api.referenceLabelFor(item.id, album.key),
		"550e8400 E29b 41d4 A716 446655440000",
	);
	assert.equal(
		api.printOrderUrl(item, album),
		"https://shop.clairethomas.art/products/wildlife-550e8400-e29b-41d4-a716-446655440000-fine-art-print",
	);
});
