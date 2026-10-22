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
	Array.from({ length: 26 }, (_, index) => ({
		publicId: `${prefix}-${index}`,
		width: 1200,
		height: 800,
	}));

const context = {
	homeConfig: { inquiryEmail: "hello@example.test" },
	galleryPages: [
		{ key: "special-occasion", label: "special occasion", items: albumOf("special") },
		{ key: "protests", label: "events", items: albumOf("protests") },
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

test("Headshots renders no feature list in its card and Grad shoot lists its features", () => {
	const headshots = html.split("<article").find((chunk) => chunk.includes(">Headshots</h3>"));
	assert(headshots, "Headshots card must render");
	assert.equal(headshots.includes("<ul"), false);
});

test("there are two testimonials and the second points at special-occasion index 14", () => {
	assert.equal(config.testimonials.length, 2);
	assert.deepEqual(config.testimonials[1].photo, { album: "special-occasion", index: 14 });
	assert.equal(config.testimonials[1].name, "");
	assert.equal(config.testimonials[1].context, "Special occasion");
	assert.match(config.testimonials[1].quote, /^Claire did such an amazing job/);
	assert.match(html, /https:\/\/img\.test\/special-14/);
});
