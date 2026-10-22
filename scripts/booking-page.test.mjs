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

const specialOccasion = Array.from({ length: 26 }, (_, index) => ({
	publicId: `special-${index}`,
	width: 1200,
	height: 800,
}));

const context = {
	homeConfig: { inquiryEmail: "hello@example.test" },
	galleryPages: [{ key: "special-occasion", label: "special occasion", items: specialOccasion }],
	resolveImageUrl: (item) => `https://img.test/${item.publicId}`,
	localImageUrl: (item) => `/local/${item.publicId}`,
	imageSrcSet: (item) => `https://img.test/${item.publicId} 400w`,
};
vm.runInNewContext(
	`${escapeHtmlSource}\n${bookingSource}\nglobalThis.renderBooking = renderBooking;\nglobalThis.bookingConfig = bookingConfig;`,
	context,
);

const html = context.renderBooking();
const config = JSON.parse(JSON.stringify(context.bookingConfig));

const cardFor = (name) => {
	const card = html.split("<article").find((chunk) => chunk.includes(`<h2>${name}</h2>`));
	assert(card, `${name} card must render`);
	return card;
};

test("Portraits heading sits after the event packages and before Kind words", () => {
	const eventsEnd = html.indexOf("Full Day Event");
	const included = html.indexOf('id="package-included-heading"');
	const portraits = html.indexOf('<h2 id="portrait-packages-heading" class="section-eyebrow">Portraits</h2>');
	const testimonials = html.indexOf('id="testimonials-heading"');
	assert(eventsEnd >= 0 && included > eventsEnd, "event packages and What's included must render");
	assert(portraits > included, "Portraits must come after What's included");
	assert(testimonials > portraits, "Portraits must come before Kind words");
	assert.match(html, /<section class="portrait-packages" aria-labelledby="portrait-packages-heading">/);
});

test("both portrait cards show name, duration and price with an Inquire link", () => {
	const headshots = cardFor("Headshots");
	assert.match(headshots, /class="package-duration">1 hr</);
	assert.match(headshots, /class="package-price">\$150</);
	assert.match(headshots, /data-package="Headshots"/);

	const grad = cardFor("Grad shoot");
	assert.match(grad, /class="package-duration">1 hr</);
	assert.match(grad, /class="package-price">\$250</);
	assert.match(grad, /data-package="Grad shoot"/);
});

test("Grad shoot lists its outfits and locations", () => {
	const grad = cardFor("Grad shoot");
	assert.match(grad, /<li>2 outfits<\/li>/);
	assert.match(grad, /<li>2 locations<\/li>/);
});

test("Headshots card renders no feature list", () => {
	assert.deepEqual(config.portraitPackages[0].features, []);
	assert.equal(cardFor("Headshots").includes("<ul"), false);
});

test("there are two testimonials and the second points at special-occasion index 14", () => {
	assert.equal(config.testimonials.length, 2);
	assert.deepEqual(config.testimonials[1].photo, { album: "special-occasion", index: 14 });
	assert.equal(config.testimonials[1].name, "");
	assert.equal(config.testimonials[1].context, "Special occasion");
	assert.match(config.testimonials[1].quote, /^Claire did such an amazing job/);
	assert.match(html, /https:\/\/img\.test\/special-14/);
});
