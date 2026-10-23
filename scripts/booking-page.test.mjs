import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../site.js", import.meta.url), "utf8");
const sliceFrom = (startMarker, endMarker) => {
	const start = source.indexOf(startMarker);
	const end = source.indexOf(endMarker, start);
	assert(start >= 0 && end > start, `site.js must define ${startMarker} before ${endMarker}`);
	return source.slice(start, end);
};

// The Booking renderers only need escapeHtml and the booking config from site.js; the image helpers and
// galleryPages are stubbed because they depend on Cloudinary and the browser.
const escapeHtmlSource = sliceFrom("const escapeHtml =", "\n\n");
const bookingSource = sliceFrom("const bookingConfig = {", "const renderPrints =");

const albumOf = (prefix) =>
	Array.from({ length: 48 }, (_, index) => ({
		id: `${prefix}-${index}`,
		publicId: `${prefix}-${index}`,
		width: 1200,
		height: 800,
	}));

// The three photos the live Content's testimonials point at, by photo id.
const SPECIAL_15 = "special-occasion-3cf6a06e-62fa-4f35-9c1b-51acc07ccb53";
const RALLY_44 = "protests-ece5f222-4377-4c47-b51a-09ba107c450d";
const SPECIAL_1 = "special-occasion-5ae56d56-289f-4b39-b73d-0b0e7a9a1140";
const specialOccasion = albumOf("special");
specialOccasion[14].id = SPECIAL_15;
specialOccasion[0].id = SPECIAL_1;
const protests = albumOf("protests");
protests[43].id = RALLY_44;

const testimonial = (id, quote, context, photoId) => ({ id, quote, name: "", context, photoId });
const defaultTestimonials = [
	testimonial("testimonial-special-occasion", "Claire did such an amazing job capturing", "Special occasion", SPECIAL_15),
	testimonial("testimonial-rally", "Claire's eye for the critical moments of our rally", "Rally", RALLY_44),
	testimonial("testimonial-san-francisco", "Claire went out of her way", "Special occasion, San Francisco", SPECIAL_1),
];

const context = {
	homeConfig: { inquiryEmail: "hello@example.test" },
	portfolioContent: { testimonials: defaultTestimonials },
	galleryPages: [
		{ key: "special-occasion", label: "special occasion", items: specialOccasion },
		{ key: "protests", label: "events", items: protests },
		{ key: "portraits", label: "portraits", items: albumOf("portraits") },
	],
	resolveImageUrl: (item) => `https://img.test/${item.publicId}`,
	localImageUrl: (item) => `/local/${item.publicId}`,
	imageSrcSet: (item) => `https://img.test/${item.publicId} 400w`,
	URLSearchParams,
};
vm.runInNewContext(
	`${escapeHtmlSource}\n${bookingSource}\nglobalThis.renderBooking = renderBooking;\nglobalThis.bookingConfig = bookingConfig;`,
	context,
);

const html = context.renderBooking();
const config = JSON.parse(JSON.stringify(context.bookingConfig));
const allPackages = [...config.packages, ...config.portraitPackages];

const indexOfOrFail = (text, marker) => {
	const index = text.indexOf(marker);
	assert(index >= 0, `${marker} must render`);
	return index;
};
const headingFor = (id) => indexOfOrFail(html, `id="${id}"`);
const eventsPanel = html.slice(headingFor("events-panel"), headingFor("portraits-panel"));
const portraitsPanel = html.slice(headingFor("portraits-panel"), headingFor("testimonials-heading"));

test("Booking renders the Events and Portraits headings at the top, above the testimonials", () => {
	assert.match(html, /<h2 id="events-heading" class="price-group-title">Events<\/h2>/);
	assert.match(html, /<h2 id="portraits-heading" class="price-group-title">Portraits<\/h2>/);
	assert.match(html, /Documentary coverage, priced by length/);
	assert.match(html, /One-hour sessions/);
	assert(headingFor("events-heading") < headingFor("testimonials-heading"));
	assert(headingFor("portraits-heading") < headingFor("testimonials-heading"));
});

test("the page has no draft layout classes left", () => {
	assert.doesNotMatch(html, /booking-design-/);
	assert.match(html, /<section class="detail-page booking-page">/);
	assert.equal(context.bookingConfig.packages.length, 3);
});

test("the switch starts on Events and controls both panels", () => {
	assert.match(
		html,
		/<button type="button" class="price-switch-button" aria-pressed="true" aria-controls="events-panel" data-price-group="events">Events<\/button>/,
	);
	assert.match(
		html,
		/<button type="button" class="price-switch-button" aria-pressed="false" aria-controls="portraits-panel" data-price-group="portraits">Portraits<\/button>/,
	);
	assert.match(html, /<section class="price-panel" id="events-panel" data-price-panel="events" aria-labelledby="events-heading">/);
	assert.match(
		html,
		/<section class="price-panel" id="portraits-panel" data-price-panel="portraits" aria-labelledby="portraits-heading" hidden>/,
	);
});

test("the Events panel shows the three event prices and the included block", () => {
	for (const price of ["$450", "$600", "$1200"]) {
		assert(eventsPanel.includes(`>${price}</p>`), `${price} must be in the Events panel`);
	}
	assert.match(eventsPanel, /What’s included with events/);
	assert.match(eventsPanel, /<li>Sneak peeks for immediate social media use within 48 hours<\/li>/);
	assert.match(eventsPanel, /<a href="#booking-form">contact form<\/a>/);
});

test("the Portraits panel shows the two portrait prices and no included block", () => {
	for (const price of ["$150", "$250"]) {
		assert(portraitsPanel.includes(`>${price}</p>`), `${price} must be in the Portraits panel`);
	}
	assert.match(portraitsPanel, /2 outfits/);
	assert.doesNotMatch(portraitsPanel, /What’s included with events/);
});

test("every package has an Inquire link that fills the form", () => {
	for (const item of allPackages) {
		assert(
			html.includes(`href="#booking-form" data-package="${item.name}">Inquire</a>`),
			`${item.name} must have an Inquire link with data-package`,
		);
	}
	assert.equal(html.match(/data-package="/g).length, allPackages.length);
});

test("Headshots lists 20 digital images and Grad shoot lists images, outfits and locations on one line", () => {
	const card = (name) => html.split("<article").find((chunk) => chunk.includes(`>${name}</h3>`));
	assert.match(card("Headshots"), /<li>20 digital images<\/li>/);
	assert.match(card("Grad shoot"), /<ul><li>20 digital images, 2 outfits, 2 locations<\/li><\/ul>/);
});

const renderWithTestimonials = (testimonials) => {
	context.portfolioContent = testimonials === null ? null : { testimonials };
	return context.renderBooking();
};
const kindWordsSection = (page) => {
	const start = page.indexOf('<section class="testimonials"');
	assert(start >= 0, "Kind words must render");
	return page.slice(start, page.indexOf("</section>", start));
};
const photoSources = (section) => [...section.matchAll(/<img src="([^"]+)"/g)].map((match) => match[1]);

test("Booking takes testimonials from Content, not from bookingConfig", () => {
	assert.equal(config.testimonials, undefined);
});

test("Kind words renders the Content testimonials in list order, each with the photo its photoId names", () => {
	const section = kindWordsSection(html);
	const quotes = ["Claire did such an amazing job", "critical moments of our rally", "Claire went out of her way"];
	const positions = quotes.map((quote) => section.indexOf(quote));
	assert(positions.every((position) => position >= 0), "all three quotes must render");
	assert.deepEqual([...positions].sort((a, b) => a - b), positions);
	assert.deepEqual(photoSources(section), [
		"https://img.test/special-14",
		"https://img.test/protests-43",
		"https://img.test/special-0",
	]);
	assert.match(section, /<figcaption><span>Special occasion, San Francisco<\/span><\/figcaption>/);
});

test("a testimonial whose photoId matches no photo renders without a photo", () => {
	const page = renderWithTestimonials([testimonial("t-1", "A plain quote", "Rally", "no-such-photo")]);
	const section = kindWordsSection(page);
	assert.match(section, /A plain quote/);
	assert.deepEqual(photoSources(section), []);
	assert.doesNotMatch(section, /has-photo/);
});

test("an empty testimonial list hides the Kind words section", () => {
	const page = renderWithTestimonials([]);
	assert.doesNotMatch(page, /Kind words/);
	assert.doesNotMatch(page, /testimonials-heading/);
});

test("with no Content loaded, the Kind words section is hidden", () => {
	const page = renderWithTestimonials(null);
	assert.doesNotMatch(page, /Kind words/);
	assert.match(page, /I'd love to hear from you!/);
});

test("testimonial quotes and names are HTML-escaped", () => {
	const page = renderWithTestimonials([
		{ id: "t-1", quote: '<img src=x onerror="alert(1)"> & "quoted"', name: "<b>Ann</b>", context: "", photoId: "" },
	]);
	const section = kindWordsSection(page);
	assert.doesNotMatch(section, /<img src=x/);
	assert.doesNotMatch(section, /<b>Ann<\/b>/);
	assert.match(section, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; &quot;quoted&quot;/);
	assert.match(section, /&lt;b&gt;Ann&lt;\/b&gt;/);
});

// Regression: 2ff05c0 put even-row photos in the wider 6fr column, so the middle testimonial's photo was larger than the others.
test("on wide screens, even testimonial rows swap column widths so every photo gets the 5fr column", () => {
	const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8").replace(/\s+/g, " ");
	assert.match(css, /\.testimonial\.has-photo \{[^}]*grid-template-columns: minmax\(0, 5fr\) minmax\(0, 6fr\);/);
	assert.match(
		css,
		/@media \(min-width: 1001px\) \{ \.testimonial\.has-photo:nth-child\(even\) \{ grid-template-columns: minmax\(0, 6fr\) minmax\(0, 5fr\); \}/,
	);
});
