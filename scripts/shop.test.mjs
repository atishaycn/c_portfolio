import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../shop.js", import.meta.url), "utf8");
const context = {};
vm.runInNewContext(source, context);
const shop = context.PortfolioShop;
const product = (slug) => shop.catalog.find((entry) => entry.slug === slug);

test("prices a complete Gallery Frame selection by size and option surcharges", () => {
	const galleryFrame = product("gallery-frame");
	assert.equal(shop.priceFor(galleryFrame, {
		size: "11 x 14",
		frame: "Gallery Black",
		paper: "Lustre",
		mat: "White mat",
	}), 137);
});

test("shows the catalog From price until required selections are present", () => {
	assert.equal(shop.fromPrice(product("print")), 3);
	assert.equal(shop.fromPrice(product("gallery-frame")), 82);
	assert.equal(
		shop.missingRequiredOptions(product("gallery-frame"), { size: "11 x 14", mat: "White mat" }).join(","),
		"frame,paper",
	);
	assert.equal(shop.missingRequiredOptions(product("gallery-frame"), {
		size: "11 x 14",
		frame: "Gallery Black",
		paper: "Lustre",
		mat: "White mat",
	}).length, 0);
});

test("orients an 11 x 14 mockup to match the photograph", () => {
	const landscape = shop.dimensionsFor("11 x 14", { width: 3000, height: 2000 });
	const portrait = shop.dimensionsFor("11 x 14", { width: 2000, height: 3000 });
	assert.equal(landscape.orientation, "landscape");
	assert.equal(landscape.width, 14);
	assert.equal(landscape.height, 11);
	assert.equal(portrait.orientation, "portrait");
	assert.equal(portrait.width, 11);
	assert.equal(portrait.height, 14);
});

test("uses only photos enabled at both album and item level in CMS order", () => {
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
	assert.equal(photos.map((photo) => photo.id).join(","), "nature-1,events-1");
	assert.equal(photos[0].albumLabel, "Nature");
});

test("renders product-specific side faces, finishes, and surface effects", () => {
	const photo = { id: "art-1", url: "/art-1.jpg", width: 3000, height: 2000 };
	const mockup = (slug, selections = {}) => shop.renderMockup(product(slug), selections, photo);
	assert.match(mockup("print"), /shop-side--paper/);
	assert.match(mockup("fine-art-print"), /shop-mockup--fine-art-print/);
	assert.match(mockup("canvas"), /shop-side--photo/);
	assert.match(mockup("canvas", { edge: "Black wrap" }), /shop-side--edge shop-edge--black-wrap/);
	assert.match(mockup("metal-print"), /shop-side--aluminium/);
	assert.match(mockup("metal-print"), /shop-mockup__sheen/);
	assert.match(mockup("standout-print"), /shop-side--black/);
	assert.match(mockup("standout-print", { edge: "White edge" }), /shop-side--edge shop-edge--white-edge/);
	assert.match(mockup("gallery-frame", { frame: "Gallery Black", mat: "White mat" }), /shop-side--finish shop-finish--gallery-black/);
	assert.match(mockup("gallery-frame", { mat: "White mat" }), /shop-mat--white-mat/);
	assert.match(mockup("framed-canvas"), /shop-mockup__floater-face/);
	assert.match(mockup("bamboo-panel"), /shop-mockup__wood-grain/);
	assert.match(mockup("bamboo-panel", { finish: "Carbonized" }), /shop-side--grain shop-finish--carbonized/);
	assert.match(mockup("wood-print"), /shop-side--grain/);
	assert.match(mockup("acrylic-print"), /shop-side--acrylic/);
});

test("renders the four current-photo product views and cycles card photos", () => {
	const albums = [{
		key: "prints",
		label: "Prints",
		printEnabled: true,
		items: [
			{ id: "photo-a", printEnabled: true, url: "/photo-a.jpg", width: 3000, height: 2000 },
			{ id: "photo-b", printEnabled: true, url: "/photo-b.jpg", width: 2000, height: 3000 },
		],
	}];
	const store = shop.renderPage({ productSlug: "", albums });
	const firstCardStart = store.indexOf("shop-product-card");
	const firstCard = store.slice(firstCardStart, store.indexOf("</a>", firstCardStart) + 4);
	assert.match(firstCard, /src="\/photo-a\.jpg"/);
	assert.match(firstCard, /src="\/photo-b\.jpg"/);

	const page = shop.renderPage({ productSlug: "gallery-frame", albums });
	assert.equal((page.match(/class="shop-view-thumb(?:\s|")/g) || []).length, 4);
	assert.match(page, /data-shop-view="front"/);
	assert.match(page, /data-shop-view="angle"/);
	assert.match(page, /data-shop-view="corner"/);
	assert.match(page, /data-shop-view="wall"/);
	assert.match(page, /Photograph 1 of 2/);
	assert.match(page, /shop-mockup--view-corner/);
	assert.match(shop.renderMockup(product("gallery-frame"), { size: "11 x 14" }, albums[0].items[0], { view: "wall" }), /--shop-wall-art-width:28\.00%/);
	assert.match(shop.renderMockup(product("gallery-frame"), { size: "11 x 14" }, albums[0].items[0], { view: "wall" }), /shop-mockup__furniture/);
});
