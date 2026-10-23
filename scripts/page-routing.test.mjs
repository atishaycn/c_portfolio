import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../site.js", import.meta.url), "utf8");
const start = source.indexOf("const FIXED_PAGE_KEYS =");
const end = source.indexOf("// End page routing", start);
assert(start >= 0 && end > start, "site.js must define the page routing block");
const context = {};
vm.runInNewContext(`${source.slice(start, end)}\nglobalThis.albumForPage = albumForPage;`, context);
const albumForPage = (...args) => context.albumForPage(...args)?.key ?? null;

const pages = [{ key: "prints" }, { key: "booking" }, { key: "the-natural-world" }, { key: "home" }];

// 2026-10-23: an album named "Prints" took over the Shop page (prints.html).
test("a fixed page keeps its own content when an album shares its key", () => {
	assert.equal(albumForPage(pages, "prints", false), null);
	assert.equal(albumForPage(pages, "booking", false), null);
	assert.equal(albumForPage(pages, "home", false), null);
});

test("an album page shows the album even when its key matches a fixed page", () => {
	assert.equal(albumForPage(pages, "prints", true), "prints");
});

test("section pages show their album", () => {
	assert.equal(albumForPage(pages, "the-natural-world", false), "the-natural-world");
	assert.equal(albumForPage(pages, "missing", false), null);
});
