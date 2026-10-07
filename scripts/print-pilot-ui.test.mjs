import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../prints-pilot.js", import.meta.url), "utf8");

class Element {
	constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.textContent = ""; }
	append(child) { child.parent = this; this.children.push(child); }
	remove() { this.parent.children = this.parent.children.filter((item) => item !== this); }
	replaceChildren() { this.children = []; }
	addEventListener(event, listener) { this.listeners[event] = listener; }
}
const descendants = (element) => [element, ...element.children.flatMap(descendants)];
const words = (element) => descendants(element).map((item) => item.textContent).join(" ");
const sampleCatalog = (checkoutReady = true) => ({
	enabled: true, testOnly: true, checkoutReady, photo: { id: "the-natural-world-10", title: "Nature photograph", image: "https://res.cloudinary.com/fixture/image/upload/test.jpg", width: 5184, height: 3888 },
	size: "12x16", label: "12 × 16 inch fine-art print", amount: 4000, currency: "usd",
});
const flush = async () => { for (let turn = 0; turn < 10; turn++) await new Promise(setImmediate); };
const mount = async ({ search = "", catalog = sampleCatalog(), route } = {}) => {
	const root = new Element("div");
	const requests = [], redirects = [], history = [];
	const context = {
		document: { getElementById: () => root, createElement: (tag) => new Element(tag) },
		location: { search, pathname: "/prints.html", assign: (url) => redirects.push(url) },
		history: { replaceState: (...args) => history.push(args) },
		URLSearchParams, Intl, AbortSignal,
		crypto: { randomUUID: () => "550e8400-e29b-41d4-a716-446655440000" },
		setTimeout: (fn) => { fn(); return 0; },
		fetch: async (url, options) => {
			requests.push({ url, options });
			if (url === "/api/print-catalog") return { ok: true, json: async () => catalog };
			return route ? route(url, options) : { ok: false, json: async () => ({ error: "Test session not found" }) };
		},
	};
	vm.runInNewContext(source, context);
	await flush();
	return { root, requests, redirects, history, button: descendants(root).find((item) => item.tag === "button") };
};

test("disabled catalog shows contact availability rather than a purchase button", async () => {
	const page = await mount({ catalog: { enabled: false } });
	assert.equal(page.button, undefined);
	assert(words(page.root).includes("not open yet"));
});
test("pilot labels the test price and refuses unconfigured checkout", async () => {
	const page = await mount({ catalog: sampleCatalog(false) });
	assert.equal(page.button.disabled, true);
	assert(words(page.root).includes("Sandbox pilot only"));
	assert(words(page.root).includes("$40.00 test price"));
	assert(words(page.root).includes("webhook signing secret"));
});
test("success query alone cannot claim a paid or validated order", async () => {
	const page = await mount({ search: "?checkout=success&session_id=forged" });
	assert(words(page.root).includes("Could not verify checkout"));
	assert(!words(page.root).includes("Test payment confirmed"));
	assert.equal(page.history[0][2], "/prints.html");
});
test("unpaid status remains unpaid despite a success return URL", async () => {
	const page = await mount({ search: "?checkout=success&session_id=cs_test_fixture", route: async () => ({ ok: true, json: async () => ({ paid: false, validated: false }) }) });
	assert(words(page.root).includes("has not confirmed"));
	assert(!words(page.root).includes("Test payment confirmed"));
});
test("validated payment explicitly says nothing was sent to Gelato", async () => {
	const page = await mount({ search: "?checkout=success&session_id=cs_test_fixture", route: async () => ({ ok: true, json: async () => ({ paid: true, validated: true }) }) });
	assert(words(page.root).includes("Test payment confirmed"));
	assert(words(page.root).includes("Nothing was sent to Gelato"));
});
test("pending validation polls six times then reports webhook troubleshooting", async () => {
	const page = await mount({ search: "?checkout=success&session_id=cs_test_fixture", route: async () => ({ ok: true, json: async () => ({ paid: true, validated: false }) }) });
	assert.equal(page.requests.filter((request) => request.url.startsWith("/api/print-status")).length, 6);
	assert(words(page.root).includes("webhook delivery log"));
});
test("cancelled checkout does not verify or claim a payment", async () => {
	const page = await mount({ search: "?checkout=cancelled" });
	assert(words(page.root).includes("Checkout cancelled"));
	assert.equal(page.requests.length, 1);
	assert(!words(page.root).includes("payment confirmed"));
});
test("checkout retries use the same ID and never redirect to an untrusted host", async () => {
	let attempts = 0;
	const page = await mount({ route: async () => {
		attempts++;
		if (attempts === 1) return { ok: false, json: async () => ({ error: "Network retry needed" }) };
		if (attempts === 2) return { ok: true, json: async () => ({ url: "https://checkout.stripe.com.evil.invalid/path" }) };
		return { ok: true, json: async () => ({ url: "https://checkout.stripe.com/c/pay/fixture" }) };
	} });
	await page.button.listeners.click();
	assert.equal(page.button.disabled, false);
	assert(words(page.root).includes("Network retry needed"));
	await page.button.listeners.click();
	assert.deepEqual(page.redirects, []);
	assert(words(page.root).includes("Unexpected checkout link"));
	await page.button.listeners.click();
	assert.deepEqual(page.redirects, ["https://checkout.stripe.com/c/pay/fixture"]);
	const bodies = page.requests.filter((request) => request.url === "/api/print-checkout").map((request) => JSON.parse(request.options.body));
	assert.equal(bodies.length, 3);
	assert(bodies.every((body) => body.requestId === bodies[0].requestId));
	assert.deepEqual(Object.keys(bodies[0]).sort(), ["photoId", "requestId", "size"]);
});
