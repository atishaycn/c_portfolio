import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const sitePath = resolve(root, "site.js");
const outputPath = resolve(root, "content", "portfolio.json");
const source = readFileSync(sitePath, "utf8");
const boundary = source.indexOf("const placeholderUrl");
if (boundary === -1) throw new Error("Could not locate gallery data boundary in site.js");

const context = { result: null };
vm.runInNewContext(
	`${source.slice(0, boundary)}\nresult = { galleryPages, portfolioLinks };`,
	context,
	{ filename: sitePath },
);

const navigation = {
	"the-natural-world": { order: 0, parentId: null, preserveCase: false },
	"commissioned-work": { order: 1, parentId: null, preserveCase: false },
	california: { order: 0, parentId: "place", preserveCase: true },
	"san-francisco": { order: 0, parentId: "california", preserveCase: true },
	india: { order: 1, parentId: "place", preserveCase: true },
	"shapes-and-shadows": { order: 3, parentId: null, preserveCase: false },
	protests: { order: 4, parentId: null, preserveCase: false },
};

const content = {
	version: 1,
	revision: 0,
	updatedAt: new Date().toISOString(),
	groups: [{ id: "place", label: "place", order: 2, parentId: null }],
	albums: context.result.galleryPages.map((page) => ({
		id: page.key,
		key: page.key,
		label: page.label,
		path: page.path,
		order: navigation[page.key].order,
		parentId: navigation[page.key].parentId,
		preserveCase: navigation[page.key].preserveCase,
		printEnabled: page.key !== "commissioned-work",
		items: page.items.map((item, index) => ({
			id: item.id,
			publicId: item.publicId,
			title: item.title || "",
			location: item.location || "",
			width: item.width,
			height: item.height,
			order: index,
			printEnabled: page.key !== "commissioned-work",
		})),
	})),
	trash: [],
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(content, null, 2)}\n`);
console.log(`Wrote ${content.albums.length} albums and ${content.albums.reduce((sum, album) => sum + album.items.length, 0)} photos to ${outputPath}`);
