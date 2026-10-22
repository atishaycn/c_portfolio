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

const designs = ["a", "b", "c", "d"];
const renderFor = (design) => context.renderBooking(design);
const config = JSON.parse(JSON.stringify(context.bookingConfig));
const allPackages = [...config.packages, ...config.portraitPackages];

const headingFor = (html, id) => {
	const start = html.indexOf(`id="${id}"`);
	assert(start >= 0, `#${id} must render`);
	return start;
};

for (const design of designs) {
	const html = renderFor(design);

	test(`design ${design} renders the Events and Portraits headings at the top`, () => {
		assert.match(html, /<h2 id="events-heading" class="price-group-title">Events<\/h2>/);
		assert.match(html, /<h2 id="portraits-heading" class="price-group-title">Portraits<\/h2>/);
		assert.match(html, /Documentary coverage, priced by length/);
		assert.match(html, /One-hour sessions/);
		assert(headingFor(html, "events-heading") < headingFor(html, "testimonials-heading"));
		assert(headingFor(html, "portraits-heading") < headingFor(html, "testimonials-heading"));
		assert(headingFor(html, "package-included-heading") < headingFor(html, "testimonials-heading"));
	});

	test(`design ${design} shows all five prices`, () => {
		for (const price of ["$450", "$600", "$1200", "$150", "$250"]) {
			assert(html.includes(`>${price}</p>`), `${price} must render`);
		}
	});

	test(`design ${design} gives every package an Inquire link that fills the form`, () => {
		for (const item of allPackages) {
			assert(
				html.includes(`href="#booking-form" data-package="${item.name}">Inquire</a>`),
				`${item.name} must have an Inquire link with data-package`,
			);
		}
		assert.equal(html.match(/data-package="/g).length, allPackages.length);
	});

	test(`design ${design} keeps the included list and notes under the prices`, () => {
		assert.match(html, /What’s included with events/);
		assert.match(html, /<li>Sneak peeks for immediate social media use within 48 hours<\/li>/);
		assert.match(html, /<a href="#booking-form">contact form<\/a>/);
		assert.match(html, /2 outfits/);
	});

	test(`design ${design} sets its class on the page`, () => {
		assert.match(html, new RegExp(`<section class="detail-page booking-page booking-design-${design}">`));
	});
}

test("the design comes from ?design and falls back to a", () => {
	assert.match(context.renderBooking(), /booking-design-a"/);
	assert.match(context.renderBooking("zz"), /booking-design-a"/);
	context.location = { search: "?design=c" };
	assert.match(context.renderBooking(), /booking-design-c"/);
	context.location = { search: "?design=d" };
	assert.match(context.renderBooking(), /booking-design-d"/);
	context.location = { search: "?design=nope" };
	assert.match(context.renderBooking(), /booking-design-a"/);
	delete context.location;
});

test("design b hides the Portraits panel behind an accessible switch", () => {
	const html = renderFor("b");
	assert.match(html, /<button type="button" class="price-switch-button" aria-pressed="true" aria-controls="events-panel" data-price-group="events">Events<\/button>/);
	assert.match(html, /<button type="button" class="price-switch-button" aria-pressed="false" aria-controls="portraits-panel" data-price-group="portraits">Portraits<\/button>/);
	assert.match(html, /<section class="price-panel" id="portraits-panel" data-price-panel="portraits" aria-labelledby="portraits-heading" hidden>/);
	assert.match(html, /<section class="price-panel" id="events-panel" data-price-panel="events" aria-labelledby="events-heading">/);
});

test("design d shows the cover photos of the events and portraits albums", () => {
	const html = renderFor("d");
	assert.match(html, /<img src="https:\/\/img\.test\/protests-0"/);
	assert.match(html, /<img src="https:\/\/img\.test\/portraits-0"/);
});

test("Headshots renders no feature list in the cards and Grad shoot lists its features", () => {
	const cardHtml = renderFor("b");
	const headshots = cardHtml.split("<article").find((chunk) => chunk.includes(">Headshots</h3>"));
	assert(headshots, "Headshots card must render");
	assert.equal(headshots.includes("<ul"), false);
});

test("there are two testimonials and the second points at special-occasion index 14", () => {
	const html = renderFor("a");
	assert.equal(config.testimonials.length, 2);
	assert.deepEqual(config.testimonials[1].photo, { album: "special-occasion", index: 14 });
	assert.equal(config.testimonials[1].name, "");
	assert.equal(config.testimonials[1].context, "Special occasion");
	assert.match(config.testimonials[1].quote, /^Claire did such an amazing job/);
	assert.match(html, /https:\/\/img\.test\/special-14/);
});
