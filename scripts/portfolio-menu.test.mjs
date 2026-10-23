import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../site.js", import.meta.url), "utf8");
const start = source.indexOf("const buildPortfolioMenu =");
const end = source.indexOf("const galleryTitleFor =", start);
assert(start >= 0 && end > start, "site.js must define buildPortfolioMenu before galleryTitleFor");
const context = {};
vm.runInNewContext(`${source.slice(start, end)}\nglobalThis.buildPortfolioMenu = buildPortfolioMenu;`, context);
// The vm realm has its own Array and Object prototypes; a JSON round-trip brings results back to this realm.
const buildPortfolioMenu = (...args) => JSON.parse(JSON.stringify(context.buildPortfolioMenu(...args)));

const sections = {
	protests: { label: "Events", path: "./events.html" },
	"the-natural-world": { label: "Nature", path: "./nature.html" },
	"shapes-and-shadows": { label: "Street", path: "./street.html" },
};

const album = (key, order, photoCount, { label = key, parentId = null, preserveCase = false } = {}) => ({
	id: key,
	key,
	label,
	order,
	parentId,
	preserveCase,
	items: Array.from({ length: photoCount }, (_, index) => ({ id: `${key}-${index}`, order: index })),
});

// Shape of the live Content on 2026-10-20: a new top-level album, a child album, an empty group.
const liveContent = {
	groups: [{ id: "place", label: "place", order: 4, parentId: null }],
	albums: [
		album("protests", 0, 50, { label: "events" }),
		album("the-natural-world", 1, 28, { label: "nature" }),
		album("shapes-and-shadows", 2, 24, { label: "street" }),
		album("portraits", 3, 17, { label: "portraits" }),
		album("slideshow", 5, 22, { label: "slideshow" }),
		album("special-occasion", 0, 26, { label: "special occasion", parentId: "protests" }),
	],
};

const labelsOf = (menu) =>
	menu.map((entry) =>
		entry.type === "group" ? `${entry.label}: ${entry.links.map((link) => link.label).join(", ")}` : entry.label,
	);

test("live Content: the menu lists top-level albums with photos in admin order", () => {
	const menu = buildPortfolioMenu(liveContent, sections, "slideshow");
	assert.deepEqual(labelsOf(menu), ["Events", "Nature", "Street", "portraits"]);
});

test("live Content: the three original sections keep their addresses and every other album opens in gallery.html", () => {
	const menu = buildPortfolioMenu(liveContent, sections, "slideshow");
	assert.deepEqual(
		menu.map((entry) => entry.path),
		["./events.html", "./nature.html", "./street.html", "./gallery.html?album=portraits"],
	);
});

test("live Content: the slideshow, child albums and an empty group stay out of the menu", () => {
	const menu = buildPortfolioMenu(liveContent, sections, "slideshow");
	const keys = menu.flatMap((entry) => (entry.type === "group" ? entry.links : [entry])).map((link) => link.key);
	assert.equal(keys.includes("slideshow"), false);
	assert.equal(keys.includes("special-occasion"), false);
	assert.equal(menu.some((entry) => entry.type === "group"), false);
});

test("a group shows as a heading over its albums that have photos; empty albums and empty groups are left out", () => {
	const content = {
		groups: [
			{ id: "place", label: "place", order: 2, parentId: null },
			{ id: "archive", label: "archive", order: 5, parentId: null },
		],
		albums: [
			album("protests", 0, 50, { label: "events" }),
			album("the-natural-world", 1, 28, { label: "nature" }),
			album("california", 0, 26, { label: "california", parentId: "place", preserveCase: true }),
			album("india", 1, 0, { label: "india", parentId: "place" }),
			album("shapes-and-shadows", 3, 24, { label: "street" }),
			album("old-prints", 0, 0, { label: "old prints", parentId: "archive" }),
			album("no-photos", 6, 0, { label: "no photos" }),
		],
	};
	const menu = buildPortfolioMenu(content, sections, "slideshow");
	assert.deepEqual(labelsOf(menu), ["Events", "Nature", "place: california", "Street"]);
	assert.deepEqual(menu[2].links[0], {
		type: "link",
		key: "california",
		label: "california",
		path: "./gallery.html?album=california",
		preserveCase: true,
	});
});

test("admin order decides where a group falls among top-level albums", () => {
	const content = {
		groups: [{ id: "place", label: "place", order: 0, parentId: null }],
		albums: [
			album("the-natural-world", 1, 28, { label: "nature" }),
			album("india", 0, 30, { label: "india", parentId: "place" }),
		],
	};
	assert.deepEqual(labelsOf(buildPortfolioMenu(content, sections, "slideshow")), ["place: india", "Nature"]);
});

test("without Content the menu is the three original sections in order", () => {
	const menu = buildPortfolioMenu(null, sections, "slideshow");
	assert.deepEqual(labelsOf(menu), ["Events", "Nature", "Street"]);
	assert.deepEqual(
		menu.map((entry) => entry.path),
		["./events.html", "./nature.html", "./street.html"],
	);
});

test("the bundled fallback Content still gives Events, Nature and Street", () => {
	const bundled = JSON.parse(readFileSync(new URL("../content/portfolio.json", import.meta.url), "utf8"));
	const labels = labelsOf(buildPortfolioMenu(bundled, sections, "slideshow"));
	for (const label of ["Events", "Nature", "Street"]) assert.ok(labels.includes(label), `${label} must be in the menu`);
});

test("a Shop only album is left out of the Portfolio menu, at the top level and inside a section", () => {
	const content = {
		groups: [{ id: "place", label: "place", order: 4, parentId: null }],
		albums: [
			album("protests", 0, 50, { label: "events" }),
			{ ...album("print-only", 1, 12, { label: "print only" }), shopOnly: true },
			{ ...album("print-only-child", 0, 9, { label: "print child", parentId: "place" }), shopOnly: true },
			album("portraits", 3, 17, { label: "portraits", parentId: "place" }),
		],
	};
	assert.deepEqual(labelsOf(buildPortfolioMenu(content, sections, "slideshow")), ["Events", "place: portraits"]);
});

test("a Shop only child album is not offered as a tab under its section", () => {
	const pages = [
		{ id: "protests", key: "protests", parentId: null, items: [{ id: "p-1" }] },
		{ id: "special", key: "special", parentId: "protests", items: [{ id: "s-1" }] },
		{ id: "print-child", key: "print-child", parentId: "protests", shopOnly: true, items: [{ id: "c-1" }] },
	];
	const source = readFileSync(new URL("../site.js", import.meta.url), "utf8");
	const start = source.indexOf("const sectionRootFor =");
	const end = source.indexOf("const albumPathFor =", start);
	assert(start >= 0 && end > start, "site.js must define sectionRootFor and sectionFamilyFor before albumPathFor");
	const family = vm.runInNewContext(
		`const galleryPages = ${JSON.stringify(pages)};\n${source.slice(start, end)}\nsectionFamilyFor(galleryPages[0]).map((page) => page.key);`,
	);
	assert.deepEqual([...family], ["protests", "special"]);
});
