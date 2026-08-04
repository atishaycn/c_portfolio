import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import auth from "../api/_lib/auth.js";
import contentModule from "../api/_lib/content.js";

const root = resolve(import.meta.dirname, "..");
const portfolio = JSON.parse(readFileSync(resolve(root, "content", "portfolio.json"), "utf8"));

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
	const password = "temporary-test-password";
	const salt = randomBytes(16).toString("hex");
	process.env.ADMIN_EMAIL = "admin@example.com";
	process.env.ADMIN_PASSWORD_HASH = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
	process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString("hex");
	assert.equal(auth.verifyPassword(password), true);
	assert.equal(auth.verifyPassword("wrong"), false);
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
