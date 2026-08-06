import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const liquid = readFileSync(new URL("../shopify-theme-overrides/ct-product-consolidation.liquid", import.meta.url), "utf8");
const script = liquid.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(script, "theme override must contain an inline script");

const loadApi = (cards = []) => {
	const document = {
		documentElement: {},
		body: {},
		addEventListener() {},
		querySelector() {
			return null;
		},
		querySelectorAll(selector) {
			return selector === ".ct-print-card" ? cards.filter((card) => card.classList.has("ct-print-card")) : cards;
		},
	};
	const window = {
		location: { origin: "https://shop.test" },
		requestAnimationFrame() {},
	};
	class MutationObserver {
		observe() {}
	}
	const testableScript = script.replace(
		"    enhanceStorefront();\n    document.addEventListener",
		"    window.__ctTestApi = { artworkKeyFor, baseHandleFor, consolidateProductCards, formatForHandle, normalizedHandle, productHandle };\n    document.addEventListener",
	);
	assert.notEqual(testableScript, script, "theme script test hook must stay aligned with the bootstrap");
	vm.runInNewContext(testableScript, { MutationObserver, URL, decodeURIComponent, document, window });
	return window.__ctTestApi;
};

test("normalizes numeric Shopify duplicate suffixes without losing numeric artwork IDs", () => {
	const api = loadApi();

	assert.equal(api.productHandle("https://shop.test/products/new-album-17-fine-art-print-2?variant=1"), "new-album-17-fine-art-print-2");
	assert.equal(api.normalizedHandle("new-album-17-fine-art-print-2"), "new-album-17-fine-art-print");
	assert.equal(api.formatForHandle("new-album-17-fine-art-print-2").suffix, "-fine-art-print");
	assert.equal(api.baseHandleFor("new-album-17-fine-art-print-2"), "new-album-17");
	assert.equal(api.baseHandleFor("artist-2-fine-art-print"), "artist-2");
});

test("prefers stable artwork tags and supports arbitrary renamed album handles", () => {
	const api = loadApi();
	const card = {
		dataset: { productTags: "series-new-label, format-fine-art, animals-17, claire-thomas" },
		getAttribute() {
			return null;
		},
		querySelector() {
			return null;
		},
	};

	assert.equal(api.artworkKeyFor(card, "renamed-album-17-fine-art-print-3"), "tag:animals-17");
	assert.equal(api.artworkKeyFor({ dataset: {}, getAttribute: () => null, querySelector: () => null }, "renamed-album-17-fine-art-print-3"), "handle:renamed-album-17");
});

test("renders exactly one Fine Art card per artwork within a Horizon scope", () => {
	const scope = {};
	const makeCard = (href) => {
		const item = { hidden: false, parentElement: scope };
		return {
			dataset: {},
			classList: new Set(),
			parentElement: scope,
			querySelector(selector) {
				return selector === 'a[href*="/products/"]' ? { href } : null;
			},
			querySelectorAll() {
				return [];
			},
			getAttribute() {
				return null;
			},
			closest() {
				return item;
			},
			item,
		};
	};
	const cards = [
		makeCard("https://shop.test/products/new-animals-17-fine-art-print-2"),
		makeCard("https://shop.test/products/new-animals-17-fine-art-print"),
		makeCard("https://shop.test/products/new-animals-17-framed-fine-art-print"),
		makeCard("https://shop.test/products/new-animals-17-canvas-print"),
	];
	const api = loadApi(cards);

	api.consolidateProductCards();
	assert.deepEqual(cards.map((card) => card.item.hidden), [true, false, true, true]);
	assert.equal(cards.filter((card) => card.classList.has("ct-print-card")).length, 1);
});

test("targets Horizon media primitives and leaves zoom-dialog sizing to Horizon", () => {
	assert.match(liquid, /product-card, product-component\.resource-card__wrapper, \.resource-card__wrapper/);
	assert.match(liquid, /\.product-media-container--image[^{}]*\.product-media__image/);
	assert.match(liquid, /object-fit: cover !important/);
	assert.doesNotMatch(liquid, /dialog-zoomed-gallery[^{}]*\{[^}]*object-fit: contain/);
});
