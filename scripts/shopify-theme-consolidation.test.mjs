import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const liquid = readFileSync(new URL("../shopify-theme-overrides/ct-product-consolidation.liquid", import.meta.url), "utf8");
const script = liquid.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(script, "theme override must contain an inline script");


const createClassList = (initial = []) => {
	const values = new Set(initial);
	return {
		contains: (name) => values.has(name),
		toggle(name, force) {
			const next = force === undefined ? !values.has(name) : force;
			if (next) values.add(name);
			else values.delete(name);
			return next;
		},
		add: (name) => values.add(name),
		remove: (...names) => names.forEach((name) => values.delete(name)),
		has: (name) => values.has(name),
	};
};

const loadApi = (cards = [], mediaContainers = [], printProduct = false) => {
	const documentElementClassList = createClassList(printProduct ? ["ct-print-product"] : []);
	const document = {
		documentElement: { classList: documentElementClassList },
		body: {},
		addEventListener() {},
		querySelector() {
			return null;
		},
		querySelectorAll(selector) {
			if (selector.includes("product-media-container--image") || selector.includes("ct-non-artwork-media")) return mediaContainers;
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
		"    window.__ctTestApi = { artworkKeyFor, baseHandleFor, consolidateProductCards, filterProductMedia, formatForHandle, normalizedHandle, productHandle };\n    document.addEventListener",
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
		dataset: {
			productTags:
				"album-animals, catalog-edge-to-edge-v1, series-new-label, format-fine-art, photo-id:animals-17, claire-thomas",
		},
		getAttribute() {
			return null;
		},
		querySelector() {
			return null;
		},
	};

	assert.equal(api.artworkKeyFor(card, "renamed-album-17-fine-art-print-3"), "tag:photo-id:animals-17");
	assert.equal(api.artworkKeyFor({ dataset: {}, getAttribute: () => null, querySelector: () => null }, "renamed-album-17-fine-art-print-3"), "handle:renamed-album-17");
});

test("renders exactly one Fine Art card per artwork within a Horizon scope", () => {
	const scope = {};
	const makeCard = (href, paginatedListing = false) => {
		const item = {
			hidden: false,
			parentElement: scope,
			matches: (selector) => paginatedListing && selector === ".product-grid__item",
		};
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

test("consolidates divergent format handles by the shared stable photo tag", () => {
	const scope = {};
	const makeCard = (href) => {
		const item = {
			hidden: false,
			parentElement: scope,
			matches: () => false,
		};
		return {
			dataset: { productTags: "album-renamed, photo-id:stable-photo-17, catalog-edge-to-edge-v1" },
			classList: new Set(),
			parentElement: scope,
			querySelector: (selector) => selector === 'a[href*="/products/"]' ? { href } : null,
			querySelectorAll: () => [],
			getAttribute: () => null,
			closest: () => item,
			item,
		};
	};
	const cards = [
		makeCard("https://shop.test/products/old-album-17-fine-art-print"),
		makeCard("https://shop.test/products/renamed-album-uuid-canvas-print"),
		makeCard("https://shop.test/products/another-handle-framed-fine-art-print-2"),
	];
	const api = loadApi(cards);

	api.consolidateProductCards();
	assert.deepEqual(cards.map((card) => card.item.hidden), [false, true, true]);
	assert.equal(cards[0].classList.has("ct-print-card"), true);
});

test("hides non-Fine-Art cards across paginated product and resource listings", () => {
	const scope = {};
	const makeCard = (href, itemClass = "") => {
		const item = {
			hidden: false,
			parentElement: scope,
			matches: (selector) => selector.split(",").map((part) => part.trim()).includes(itemClass),
		};
		return {
			dataset: {},
			classList: new Set(),
			parentElement: scope,
			querySelector: (selector) => selector === 'a[href*="/products/"]' ? { href } : null,
			querySelectorAll: () => [],
			getAttribute: () => null,
			closest: () => item,
			item,
		};
	};
	const productGridCanvas = makeCard("https://shop.test/products/animals-17-canvas-print", ".product-grid__item");
	const resourceListCanvas = makeCard("https://shop.test/products/animals-18-canvas-print", ".resource-list__item");
	const predictiveCanvas = makeCard("https://shop.test/products/animals-19-canvas-print", ".predictive-search-results__card");
	const api = loadApi([productGridCanvas, resourceListCanvas, predictiveCanvas]);

	api.consolidateProductCards();
	assert.equal(productGridCanvas.item.hidden, true);
	assert.equal(resourceListCanvas.item.hidden, true);
	assert.equal(predictiveCanvas.item.hidden, false);
	assert.equal(predictiveCanvas.classList.has("ct-print-card"), true);
});

test("keeps only stable-marker artwork media in the PDP gallery", () => {
	const makeMedia = (alt) => ({
		classList: createClassList(["product-media-container--image"]),
		querySelector: () => ({ alt }),
		closest: () => null,
	});
	const artwork = makeMedia("Claire Thomas artwork: the-natural-world-1");
	const mockup = makeMedia("Gelato mockup preview");
	const api = loadApi([], [artwork, mockup], true);

	api.filterProductMedia();
	assert.equal(artwork.classList.has("ct-artwork-media"), true);
	assert.equal(artwork.classList.has("ct-non-artwork-media"), false);
	assert.equal(mockup.classList.has("ct-non-artwork-media"), true);
});

test("keeps Gelato media visible until stable-marker artwork exists", () => {
	const mockup = {
		classList: createClassList(["product-media-container--image"]),
		querySelector: () => ({ alt: "Gelato mockup preview" }),
		closest: () => null,
	};
	const api = loadApi([], [mockup], true);

	api.filterProductMedia();
	assert.equal(mockup.classList.has("ct-non-artwork-media"), false);
});

test("targets Horizon media primitives and leaves zoom-dialog sizing to Horizon", () => {
	assert.match(liquid, /product-card, product-component\.resource-card__wrapper, \.resource-card__wrapper/);
	assert.match(liquid, /\.product-media-container--image[^{}]*\.product-media__image/);
	assert.match(liquid, /object-fit: cover !important/);
	assert.match(liquid, /ct-non-artwork-media/);
	assert.match(liquid, /Claire Thomas artwork:/);
	assert.doesNotMatch(liquid, /dialog-zoomed-gallery[^{}]*\{[^}]*object-fit: contain/);
});
