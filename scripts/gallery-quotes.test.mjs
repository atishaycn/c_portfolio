import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import contentModule from "../api/_lib/content.js";

const source = readFileSync(new URL("../site.js", import.meta.url), "utf8");
const sliceFrom = (startMarker, endMarker) => {
	const start = source.indexOf(startMarker);
	const end = source.indexOf(endMarker, start);
	assert(start >= 0 && end > start, `site.js must define ${startMarker} before ${endMarker}`);
	return source.slice(start, end);
};

// The gallery renderers only need escapeHtml and their own config from site.js; the image helpers
// are stubbed because they depend on Cloudinary and the browser.
const escapeHtmlSource = sliceFrom("const escapeHtml =", "\n\n");
const gallerySource = sliceFrom("const galleryTitleFor =", "const renderWorkshops =");
const context = {
	homeConfig: {
		portfolioSections: { protests: { label: "Events", path: "./events.html" } },
	},
	navLabelOverrides: {},
	galleryPages: [],
	placeholderUrl: (item) => `https://img.test/placeholder/${item.publicId}`,
	galleryImageUrl: (item) => `https://img.test/${item.publicId}`,
	imageSrcSet: (item) => `https://img.test/${item.publicId} 400w`,
	localImageUrl: (item) => `/local/${item.publicId}`,
	URLSearchParams,
};
vm.runInNewContext(
	`${escapeHtmlSource}\n${gallerySource}\nglobalThis.renderGallery = renderGallery;`,
	context,
);
const renderGallery = (page) => context.renderGallery(page);

const photo = (index) => ({
	id: `protests-${index}`,
	publicId: `protests/${index}`,
	title: "",
	location: "",
	width: 1200,
	height: 800,
	order: index,
	printEnabled: false,
});

const eventsAlbum = ({ quotedIndex = null, quote } = {}) => ({
	id: "protests",
	key: "protests",
	label: "events",
	preserveCase: false,
	items: Array.from({ length: 50 }, (_, index) =>
		index === quotedIndex ? { ...photo(index), quote } : photo(index),
	),
});

const quote = { text: "Claire made us feel at ease.", name: "Ana Ruiz", context: "Rally organizer" };

const galleryIndices = (html) => [...html.matchAll(/data-gallery-index="(\d+)"/g)].map((match) => Number(match[1]));

const contentWith = (item, trashItem) => ({
	groups: [],
	albums: [
		{
			id: "protests",
			key: "protests",
			label: "events",
			order: 0,
			parentId: null,
			items: [{ id: "p1", publicId: "protests/p1", order: 0, ...item }],
		},
	],
	trash: trashItem ? [{ albumId: "protests", deletedAt: "2026-10-01T00:00:00.000Z", item: { id: "p2", publicId: "protests/p2", order: 0, ...trashItem } }] : [],
});

test("validator keeps a quote and trims its fields", () => {
	const validated = contentModule.validateContent(
		contentWith({ quote: { text: "  Kind words.  ", name: "  Ana  ", context: " Organizer " } }),
	);
	assert.deepEqual(validated.albums[0].items[0].quote, {
		text: "Kind words.",
		name: "Ana",
		context: "Organizer",
	});
});

test("validator keeps a quote whose name and context are empty", () => {
	const validated = contentModule.validateContent(contentWith({ quote: { text: "Lovely." } }));
	assert.deepEqual(validated.albums[0].items[0].quote, { text: "Lovely.", name: "", context: "" });
});

test("validator drops a quote with blank text and leaves no quote key", () => {
	const validated = contentModule.validateContent(
		contentWith({ quote: { text: "   ", name: "Ana", context: "Organizer" } }),
	);
	assert.equal("quote" in validated.albums[0].items[0], false);
});

test("validator leaves a photo without a quote unchanged", () => {
	const validated = contentModule.validateContent(contentWith({}));
	assert.equal("quote" in validated.albums[0].items[0], false);
	assert.equal(validated.albums[0].items[0].publicId, "protests/p1");
});

test("validator keeps a quote on a trashed photo", () => {
	const validated = contentModule.validateContent(contentWith({}, { quote: { text: "Restore me.", name: "", context: "" } }));
	assert.deepEqual(validated.trash[0].item.quote, { text: "Restore me.", name: "", context: "" });
});

test("the quote renders directly after the photo at album position 43, not on the cover", () => {
	const html = renderGallery(eventsAlbum({ quotedIndex: 43, quote }));
	const photoStart = html.indexOf('data-gallery-index="43"');
	const photoEnd = html.indexOf("</figure>", photoStart) + "</figure>".length;
	const after = html.slice(photoEnd).trimStart();
	assert.ok(after.startsWith('<figure class="section-quote">'), `quote not directly after photo 43: ${after.slice(0, 80)}`);
	assert.equal((html.match(/class="section-quote"/g) || []).length, 1);
	assert.ok(html.indexOf("section-quote") > html.indexOf('class="section-photos"'));
});

test("the quote block shows its text, name and context", () => {
	const html = renderGallery(eventsAlbum({ quotedIndex: 43, quote }));
	assert.match(html, /<blockquote>Claire made us feel at ease\.<\/blockquote>/);
	assert.match(html, /<figcaption><strong>Ana Ruiz<\/strong><span>Rally organizer<\/span><\/figcaption>/);
});

test("a quote with no name or context renders no figcaption", () => {
	const html = renderGallery(eventsAlbum({ quotedIndex: 43, quote: { text: "Only text.", name: "", context: "" } }));
	const quoteStart = html.indexOf('<figure class="section-quote">');
	const quoteBlock = html.slice(quoteStart, html.indexOf("</figure>", quoteStart));
	assert.doesNotMatch(quoteBlock, /figcaption/);
});

test("gallery indices are unchanged by a quote", () => {
	const plain = galleryIndices(renderGallery(eventsAlbum()));
	const withQuote = galleryIndices(renderGallery(eventsAlbum({ quotedIndex: 43, quote })));
	assert.deepEqual(withQuote, plain);
	assert.equal(withQuote.length, 50);
	assert.equal(new Set(withQuote).size, 50);
});

test("quote text is HTML-escaped", () => {
	const html = renderGallery(
		eventsAlbum({
			quotedIndex: 43,
			quote: { text: '<img src=x onerror="alert(1)"> & more', name: "<b>Ana</b>", context: "A & B" },
		}),
	);
	assert.doesNotMatch(html, /<img src=x/);
	assert.doesNotMatch(html, /<b>Ana<\/b>/);
	assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; more/);
	assert.match(html, /&lt;b&gt;Ana&lt;\/b&gt;/);
	assert.match(html, /A &amp; B/);
});
