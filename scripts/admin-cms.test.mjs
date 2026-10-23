import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test, { mock } from "node:test";
import auth from "../api/_lib/auth.js";
import contentModule from "../api/_lib/content.js";
import shopSyncModule from "../api/admin/shop-sync.js";

const root = resolve(import.meta.dirname, "..");
const portfolio = JSON.parse(readFileSync(resolve(root, "content", "portfolio.json"), "utf8"));
const adminHtml = readFileSync(resolve(root, "admin.html"), "utf8");
const adminScript = readFileSync(resolve(root, "admin.js"), "utf8");

// Regression: 543f08c
test("confirms successful saves to the administrator", () => {
	assert.match(adminScript, /showMessage\("OK, saved\."\)/);
});

// Regression: 1a19000
test("provides an authenticated one-time shop sync control", async () => {
	assert.match(adminHtml, /id="shop-sync-button"/);
	assert.match(adminScript, /if \(state\.dirty\) await saveContent\(\)/);
	assert.match(adminScript, /request\("\/api\/admin\/shop-sync", \{ method: "POST" \}\)/);

	const requests = [];
	const result = await shopSyncModule.dispatchShopSync({
		token: "test-token",
		fetchImpl: async (url, options) => {
			requests.push({ url, options });
			return { ok: true, status: 204 };
		},
	});
	assert.deepEqual(result, { status: "started" });
	assert.equal(
		requests[0].url,
		"https://api.github.com/repos/atishaycn/c_portfolio/actions/workflows/portfolio-shop-sync.yml/dispatches",
	);
	assert.equal(requests[0].options.method, "POST");
	assert.deepEqual(JSON.parse(requests[0].options.body), { ref: "main" });
	assert.equal(requests[0].options.headers.Authorization, "Bearer test-token");
});

// Regression: 1a19000
test("shop sync fails closed without its dispatch credential", async () => {
	await assert.rejects(
		shopSyncModule.dispatchShopSync({ token: "" }),
		(error) => error.statusCode === 503 && /not configured/.test(error.message),
	);
});

test("validates the complete migrated portfolio", () => {
	const validated = contentModule.validateContent(portfolio);
	assert.equal(validated.albums.length, 7);
	assert.equal(
		validated.albums.reduce((sum, album) => sum + album.items.length, 0),
		293,
	);
	assert.deepEqual(
		Object.fromEntries(validated.albums.map((album) => [album.key, album.items.length])),
		{
			"the-natural-world": 36,
			california: 26,
			"san-francisco": 113,
			india: 30,
			"shapes-and-shadows": 18,
			protests: 47,
			"commissioned-work": 23,
		},
	);
	assert.equal(
		validated.albums
			.find((album) => album.key === "commissioned-work")
			.items.every((item) => item.printEnabled === false),
		true,
	);
	assert.equal(
		validated.albums
			.filter((album) => album.key !== "commissioned-work")
			.every((album) => album.items.every((item) => item.printEnabled === true)),
		true,
	);
});

test("rejects duplicate photo IDs", () => {
	const duplicate = structuredClone(portfolio);
	duplicate.albums[1].items[0].id = duplicate.albums[0].items[0].id;
	assert.throws(() => contentModule.validateContent(duplicate), /unique/);
});

test("preserves nested albums and rejects hierarchy cycles", () => {
	const validated = contentModule.validateContent(portfolio);
	assert.equal(
		validated.albums.find((album) => album.id === "san-francisco").parentId,
		"california",
	);

	const selfParent = structuredClone(portfolio);
	selfParent.albums.find((album) => album.id === "california").parentId = "california";
	assert.throws(() => contentModule.validateContent(selfParent), /cannot contain cycles/);

	const indirectCycle = structuredClone(portfolio);
	indirectCycle.albums.find((album) => album.id === "california").parentId = "san-francisco";
	assert.throws(() => contentModule.validateContent(indirectCycle), /cannot contain cycles/);

	const sectionCycle = structuredClone(portfolio);
	sectionCycle.groups.find((group) => group.id === "place").parentId = "san-francisco";
	assert.throws(() => contentModule.validateContent(sectionCycle), /cannot contain cycles/);
});

test("creates and verifies a signed admin session", () => {
	process.env.ADMIN_EMAIL = "admin@example.com";
	process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString("hex");
	assert.equal("verifyPassword" in auth, false);
	const token = auth.createSession(process.env.ADMIN_EMAIL);
	const session = auth.verifySession({
		headers: { cookie: `ct_admin=${encodeURIComponent(token)}` },
	});
	assert.equal(session.email, process.env.ADMIN_EMAIL);
	assert.ok(session.csrf);
	assert.throws(
		() =>
			auth.requireSession({
				method: "PUT",
				headers: { cookie: `ct_admin=${encodeURIComponent(token)}` },
			}),
		/Invalid request token/,
	);
	assert.equal(
		auth.requireSession({
			method: "PUT",
			headers: {
				cookie: `ct_admin=${encodeURIComponent(token)}`,
				"x-csrf-token": session.csrf,
			},
		}).email,
		process.env.ADMIN_EMAIL,
	);
});

const cloudinaryEnv = {
	CLOUDINARY_CLOUD_NAME: "test-cloud",
	CLOUDINARY_API_KEY: "test-key",
	CLOUDINARY_API_SECRET: "test-secret",
};

// Fakes the three Cloudinary calls a save makes: read the authoritative record, download it, upload.
const fakeCloudinary = (current) => {
	const uploads = [];
	mock.method(globalThis, "fetch", async (url, options = {}) => {
		const href = String(url);
		const method = options.method || "GET";
		if (method === "GET" && href.startsWith("https://api.cloudinary.com/v1_1/test-cloud/resources/raw/upload")) {
			return Response.json({ resources: [{ secure_url: "https://res.cloudinary.test/current.json" }] });
		}
		if (method === "GET" && href.startsWith("https://res.cloudinary.test/current.json")) {
			return Response.json(current);
		}
		if (method === "POST" && href === "https://api.cloudinary.com/v1_1/test-cloud/raw/upload") {
			const form = options.body;
			const file = form.get("file");
			uploads.push({
				publicId: form.get("public_id"),
				content: JSON.parse(Buffer.from(file.split(",")[1], "base64").toString("utf8")),
			});
			return Response.json({ public_id: form.get("public_id") });
		}
		throw new Error(`unexpected fetch in test: ${method} ${href}`);
	});
	return uploads;
};

test("saves only against the current revision, bumps it, and keeps the previous revision as history", async () => {
	const current = { ...portfolio, revision: 3 };
	const saved = { ...portfolio, revision: 2 };
	const savedEnv = Object.fromEntries(Object.keys(cloudinaryEnv).map((key) => [key, process.env[key]]));
	Object.assign(process.env, cloudinaryEnv);
	try {
		const uploads = fakeCloudinary(current);
		await assert.rejects(contentModule.saveContent(saved), (error) => error.statusCode === 409);
		assert.equal(uploads.length, 0);

		const next = await contentModule.saveContent({ ...portfolio, revision: 3 });
		assert.equal(next.revision, 4);
		assert.equal(uploads.length, 2);
		assert.match(uploads[0].publicId, /^portfolio-cms\/history\//);
		assert.equal(uploads[0].content.revision, 3);
		assert.equal(uploads[1].publicId, "portfolio-cms/content.json");
		assert.equal(uploads[1].content.revision, 4);
	} finally {
		mock.restoreAll();
		for (const [key, value] of Object.entries(savedEnv)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
});


const testimonialEntry = (overrides = {}) => ({
	id: "testimonial-test",
	quote: "A quote",
	name: "",
	context: "",
	photoId: "",
	...overrides,
});

test("Content without a testimonials list gets the three Booking testimonials in order", () => {
	const validated = contentModule.validateContent(portfolio);
	assert.deepEqual(
		validated.testimonials.map((entry) => entry.id),
		["testimonial-special-occasion", "testimonial-rally", "testimonial-san-francisco"],
	);
	assert.deepEqual(
		validated.testimonials.map((entry) => entry.photoId),
		[
			"special-occasion-3cf6a06e-62fa-4f35-9c1b-51acc07ccb53",
			"protests-ece5f222-4377-4c47-b51a-09ba107c450d",
			"special-occasion-5ae56d56-289f-4b39-b73d-0b0e7a9a1140",
		],
	);
	assert.deepEqual(
		validated.testimonials.map((entry) => entry.context),
		["Special occasion", "Rally", "Special occasion, San Francisco"],
	);
	assert.ok(validated.testimonials.every((entry) => entry.name === "" && entry.quote.length > 0));
	assert.match(validated.testimonials[0].quote, /^Claire did such an amazing job/);
});

test("an explicit empty testimonials list stays empty", () => {
	const validated = contentModule.validateContent({ ...portfolio, testimonials: [] });
	assert.deepEqual(validated.testimonials, []);
});

test("testimonials keep their order and are trimmed to their field limits", () => {
	const validated = contentModule.validateContent({
		...portfolio,
		testimonials: [
			testimonialEntry({ id: "b", quote: "  Second  ", name: " Ann ", context: "x".repeat(300), photoId: " photo-1 " }),
			testimonialEntry({ id: "a", quote: "First" }),
		],
	});
	assert.deepEqual(
		validated.testimonials.map((entry) => entry.id),
		["b", "a"],
	);
	assert.equal(validated.testimonials[0].quote, "Second");
	assert.equal(validated.testimonials[0].name, "Ann");
	assert.equal(validated.testimonials[0].context.length, 200);
	assert.equal(validated.testimonials[0].photoId, "photo-1");
});

test("drops testimonials with a blank quote and entries without an id", () => {
	const validated = contentModule.validateContent({
		...portfolio,
		testimonials: [
			testimonialEntry({ id: "blank", quote: "   " }),
			testimonialEntry({ id: "", quote: "No id" }),
			testimonialEntry({ id: "kept", quote: "Kept" }),
		],
	});
	assert.deepEqual(
		validated.testimonials.map((entry) => entry.id),
		["kept"],
	);
});

test("rejects duplicate testimonial ids", () => {
	assert.throws(
		() =>
			contentModule.validateContent({
				...portfolio,
				testimonials: [testimonialEntry({ id: "same" }), testimonialEntry({ id: "same", quote: "Other" })],
			}),
		(error) => error.statusCode === 400 && /unique/.test(error.message),
	);
});

test("caps the testimonial list at 50", () => {
	const fifty = Array.from({ length: 50 }, (_, index) => testimonialEntry({ id: `t-${index}` }));
	assert.equal(contentModule.validateContent({ ...portfolio, testimonials: fifty }).testimonials.length, 50);
	assert.throws(
		() =>
			contentModule.validateContent({
				...portfolio,
				testimonials: [...fifty, testimonialEntry({ id: "t-50" })],
			}),
		(error) => error.statusCode === 400 && /limit/.test(error.message),
	);
});

test("the admin has a Testimonials panel with the required controls", () => {
	assert.match(adminHtml, /id="testimonials-button"/);
	assert.match(adminHtml, /data-testid="testimonials-button"/);
	assert.match(adminScript, /"add-testimonial"/);
	assert.match(adminScript, /testimonial-quote-/);
	assert.match(adminScript, /testimonial-name-/);
	assert.match(adminScript, /testimonial-context-/);
	assert.match(adminScript, /testimonial-album-/);
	assert.match(adminScript, /testimonial-photo-/);
	assert.match(adminScript, /"testimonial-" \+ crypto\.randomUUID\(\)/);
	assert.match(adminScript, /A testimonial without a quote is removed when you save\./);
});
