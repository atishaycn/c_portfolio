import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../shop.js", import.meta.url), "utf8");
const catalogData = JSON.parse(readFileSync(new URL("../content/shop-catalog.json", import.meta.url), "utf8"));
const context = {};
vm.runInNewContext(source, context);
const shop = context.PortfolioShop;
shop.setCatalog(catalogData);
const product = (slug) => shop.catalog.find((entry) => entry.slug === slug);
const fileProduct = (slug) => catalogData.products.find((entry) => entry.slug === slug);
const plain = (value) => JSON.parse(JSON.stringify(value));

const frameValues = () => fileProduct("wood-frame").options.find((group) => group.key === "frame").values.map((entry) => entry.value);
const photo = (id, width, height, title = "") => ({ id, url: "/" + id + ".jpg", width, height, title, printEnabled: true });
const albums = (items) => [{ key: "prints", label: "Prints", printEnabled: true, items }];
const wallHome = (items) => {
	context.location = { search: "" };
	return shop.renderPage({ productSlug: "", albums: albums(items) });
};
const cardsIn = (html) => html.split('<article class="shop-wall-card"').slice(1);

test("wall card links carry the wood frame product, the photo and the frame colour", () => {
	assert.equal(
		shop.wallCardHref("wood-frame", "portfolio-admin/prints/abc", "natural-wood"),
		"./prints.html?product=wood-frame&photo=portfolio-admin%2Fprints%2Fabc&frame=natural-wood",
	);
});

test("wall price is the lowest wood frame variant price among the sizes the photo supports", () => {
	const wood = product("wood-frame");
	const variants = fileProduct("wood-frame").variants;
	const cheapest = (sizes) => Math.min(...variants.filter((variant) => sizes.includes(variant.size)).map((variant) => variant.price));
	// 1600 x 1200 at 125 ppi supports 8 x 10 and 8 x 12 only.
	assert.equal(shop.wallPrice(wood, photo("small", 1600, 1200)), cheapest(["8 x 10", "8 x 12"]));
	// A large photo supports every size, so its price is the product's lowest price.
	assert.equal(shop.wallPrice(wood, photo("large", 5184, 3888)), shop.fromPrice(wood));
	// 1200 x 900 is too small for every size, so there is no price to show.
	assert.equal(shop.wallPrice(wood, photo("tiny", 1200, 900)), null);
});

test("wall cards are one per print-enabled photo, in order, with rooms rotating living, entry, bedroom", () => {
	const html = wallHome([
		photo("a", 5184, 3888),
		photo("b", 3888, 5184),
		photo("c", 5184, 3888),
		photo("d", 3888, 5184),
	]);
	const cards = cardsIn(html);
	assert.equal(cards.length, 4);
	const rooms = cards.map((card) => (card.match(/class="shop-wall-room-img" src="([^"]+)"/) || [])[1]);
	assert.deepEqual(rooms, [
		"./assets/rooms/living.webp",
		"./assets/rooms/entry.webp",
		"./assets/rooms/bedroom.webp",
		"./assets/rooms/living.webp",
	]);
	assert.match(cards[1], /data-wall-photo="b"/);
});

test("wall swatches come from the wood frame catalog options, with the white frame first and selected", () => {
	const html = wallHome([photo("a", 5184, 3888)]);
	const [card] = cardsIn(html);
	const swatches = [...card.matchAll(/data-wall-frame="([^"]+)"[^>]*aria-pressed="(true|false)"/g)];
	const expected = ["white", ...frameValues().filter((value) => value !== "white")];
	assert.deepEqual(swatches.map((match) => match[1]), expected);
	assert.deepEqual(swatches.map((match) => match[2]), ["true", "false", "false", "false"]);
	assert.match(card, /data-frame="white"/);
	assert.deepEqual(expected.slice().sort(), frameValues().slice().sort());
});

test("the wall card shows its title only when the photo has one", () => {
	const html = wallHome([photo("a", 5184, 3888, "Dusk"), photo("b", 5184, 3888, "")]);
	const [titled, untitled] = cardsIn(html);
	assert.match(titled, /class="shop-wall-title" href="\.\/prints\.html\?product=wood-frame&amp;photo=a&amp;frame=white">Dusk<\/a>/);
	assert.doesNotMatch(untitled, /shop-wall-title/);
});

test("each wall card price line reads From and the catalog price", () => {
	const html = wallHome([photo("a", 5184, 3888)]);
	const [card] = cardsIn(html);
	assert.match(card, new RegExp('class="shop-wall-price">From \\$' + shop.fromPrice(product("wood-frame")).toFixed(2) + "<"));
});

test("product params select a known photo and a valid frame, and ignore unknown or invalid ones", () => {
	const wood = product("wood-frame");
	const photos = [photo("a", 5184, 3888), photo("b", 3888, 5184)];
	assert.deepEqual(plain(shop.readProductParams("?product=wood-frame&photo=b&frame=black", wood, photos)), {
		photoIndex: 1,
		photoId: "b",
		selections: { frame: "black" },
	});
	assert.deepEqual(plain(shop.readProductParams("?product=wood-frame&photo=missing&frame=black", wood, photos)), {
		photoIndex: 0,
		photoId: "",
		selections: { frame: "black" },
	});
	assert.deepEqual(plain(shop.readProductParams("?product=wood-frame&photo=b&frame=purple", wood, photos)), {
		photoIndex: 1,
		photoId: "b",
		selections: {},
	});
	assert.deepEqual(plain(shop.readProductParams("?product=wood-frame", wood, photos)), {
		photoIndex: 0,
		photoId: "",
		selections: {},
	});
});

test("the picker starts with the linked photo selected only when that photo supports the size", () => {
	const large = photo("large", 5184, 3888);
	const small = photo("small", 1600, 1200);
	assert.deepEqual([...shop.preselectedPhotoIds(large, "8 x 10")], ["large"]);
	assert.deepEqual([...shop.preselectedPhotoIds(small, "30 x 40")], []);
	assert.deepEqual([...shop.preselectedPhotoIds(null, "8 x 10")], []);
});

test("the product page opened from a wall card shows that photo and frame", () => {
	const photos = [photo("a", 5184, 3888), photo("b", 3888, 5184)];
	context.location = { search: "?product=wood-frame&photo=b&frame=black" };
	const html = shop.renderPage({ productSlug: "wood-frame", albums: albums(photos) });
	assert.match(html, /Photograph 2 of 2/);
	assert.match(html, /<button class="shop-option[^"]*is-selected[^"]*" type="button" data-shop-option-group="frame" data-shop-option-value="black"/);
	assert.doesNotMatch(html, /data-shop-option-value="white"[^>]*aria-pressed="true"/);
	assert.match(html, /src="\/b\.jpg"/);
	context.location = { search: "" };
});
