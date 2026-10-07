import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../site.js", import.meta.url), "utf8");
const start = source.indexOf("const printInquiryUrl =");
const end = source.indexOf("const responsiveWidths =", start);
assert(start >= 0 && end > start);
const context = { printShopConfig: { shopUrl: "./prints.html", email: "contact@clairethomas.art", pilotPhotoId: "the-natural-world-10" } };
vm.runInNewContext(`${source.slice(start, end)}\nglobalThis.printLinks = { printOrderUrl };`, context);
const api = context.printLinks;

test("pilot and navigation lead to local print availability, not a guessed Shopify URL", () => {
	assert.equal(api.printOrderUrl(), "./prints.html");
	assert.equal(api.printOrderUrl({ id: "the-natural-world-10" }, { key: "the-natural-world" }), "./prints.html");
});
test("other CMS photographs lead to a photo-specific inquiry", () => {
	for (const id of ["the-natural-world-3", "protests-16", "wildlife-550e8400-e29b-41d4-a716-446655440000"]) {
		const url = api.printOrderUrl({ id }, { key: "renamed-album" });
		assert(url.startsWith("mailto:contact@clairethomas.art?"));
		assert(decodeURIComponent(url).includes(id));
	}
});
