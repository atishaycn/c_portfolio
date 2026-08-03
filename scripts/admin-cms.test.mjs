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
});

test("rejects duplicate photo IDs", () => {
	const duplicate = structuredClone(portfolio);
	duplicate.albums[1].items[0].id = duplicate.albums[0].items[0].id;
	assert.throws(() => contentModule.validateContent(duplicate), /unique/);
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
