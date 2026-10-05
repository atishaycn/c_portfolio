import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import intakeModule from "../api/intake.js";
import linkLib from "../api/_lib/intake-link.js";

const { createHandler } = intakeModule;
const { decryptToken, encryptToken, hashToken, isToken, issueToken } = linkLib;

const env = {
	CONVEX_URL: "https://example.convex.cloud",
	INTAKE_CONVEX_SECRET: "s".repeat(40),
	INTAKE_LINK_KEY: Buffer.alloc(32, 7).toString("base64"),
	RESEND_API_KEY: "key",
};

/** Fake Convex HTTP API plus Resend. `values` maps a Convex function path to its result. */
const fakeServices = (values) => {
	const calls = [];
	const fetchImpl = async (url, options = {}) => {
		if (String(url).startsWith("https://api.resend.com/")) {
			calls.push({ resend: JSON.parse(options.body) });
			return { ok: true, json: async () => ({}) };
		}
		const body = JSON.parse(options.body);
		calls.push(body);
		const value = values[body.path];
		if (value instanceof Error) return { ok: false, status: 400, json: async () => ({ status: "error", errorMessage: `Uncaught Error: ${value.message}\n    at handler` }) };
		return { ok: true, json: async () => ({ status: "success", value: value ?? null }) };
	};
	return { calls, fetchImpl };
};

const call = async (handler, { method = "GET", url = "/api/intake", body } = {}) => {
	const request = Readable.from(body ? [JSON.stringify(body)] : []);
	Object.assign(request, { method, url, headers: { host: "clairethomas.art", origin: "https://clairethomas.art" } });
	const response = { statusCode: 0, headers: {}, body: "" };
	response.setHeader = (name, value) => (response.headers[name.toLowerCase()] = value);
	response.end = (chunk) => (response.body = chunk);
	await handler(request, response);
	return { ...response, json: response.body ? JSON.parse(response.body) : null };
};

const token = issueToken(env).token;

test("link tokens are 43-character base64url strings that round-trip through encryption", () => {
	const issued = issueToken(env);
	assert.ok(isToken(issued.token));
	assert.equal(issued.tokenHash, hashToken(issued.token));
	assert.equal(decryptToken(issued.tokenCipher, env), issued.token);
	assert.notEqual(encryptToken(issued.token, env), issued.tokenCipher, "each encryption uses a fresh IV");
	assert.throws(() => decryptToken(issued.tokenCipher, { INTAKE_LINK_KEY: Buffer.alloc(32, 1).toString("base64") }));
});

test("view sends only the token hash and the secret to Convex", async () => {
	const services = fakeServices({ "client:view": { clientName: "Ana" } });
	const handler = createHandler({ env, fetchImpl: services.fetchImpl, rateLimit: () => true });
	const result = await call(handler, { url: `/api/intake?op=view&token=${token}` });
	assert.equal(result.statusCode, 200);
	assert.equal(result.json.clientName, "Ana");
	assert.deepEqual(services.calls[0], { path: "client:view", args: { secret: env.INTAKE_CONVEX_SECRET, tokenHash: hashToken(token) }, format: "json" });
	assert.equal(result.headers["x-robots-tag"], "noindex, nofollow");
});

test("malformed or unknown tokens get the closed message", async () => {
	const services = fakeServices({ "client:view": null });
	const handler = createHandler({ env, fetchImpl: services.fetchImpl, rateLimit: () => true, missLimit: () => true });
	const malformed = await call(handler, { url: "/api/intake?op=view&token=abc" });
	assert.equal(malformed.statusCode, 404);
	assert.equal(services.calls.length, 0, "malformed tokens never reach Convex");
	const unknown = await call(handler, { url: `/api/intake?op=view&token=${token}` });
	assert.equal(unknown.statusCode, 404);
	assert.equal(unknown.json.closed, true);
});

test("a closed link on a save returns 410", async () => {
	const services = fakeServices({ "client:swipe": new Error("This intake has closed") });
	const handler = createHandler({ env, fetchImpl: services.fetchImpl, rateLimit: () => true });
	const result = await call(handler, { method: "POST", body: { token, op: "swipe", deckKey: "c1", choice: "like" } });
	assert.equal(result.statusCode, 410);
	assert.equal(result.json.closed, true);
});

test("submit emails Claire once everything is done", async () => {
	const submitted = { ok: true, intakeId: "i1", resubmitted: false, clientName: "Ana Ruiz", eventTypeName: "Wedding", shootDate: "2026-11-01", mustHaves: 3 };
	const services = fakeServices({ "client:submit": submitted });
	const handler = createHandler({ env, fetchImpl: services.fetchImpl, rateLimit: () => true });
	const result = await call(handler, { method: "POST", body: { token, op: "submit" } });
	assert.equal(result.statusCode, 200);
	const email = services.calls.find((entry) => entry.resend).resend;
	assert.equal(email.subject, "Intake finished: Ana Ruiz (Wedding)");
	assert.match(email.text, /Must-have poses: 3/);
	assert.match(email.text, /https:\/\/clairethomas\.art\/intake-admin\.html#intake=i1/);
});

test("submit with missing items explains what is left and sends no email", async () => {
	const services = fakeServices({ "client:submit": { ok: false, missing: { cards: 2, questions: ["q1"] } } });
	const handler = createHandler({ env, fetchImpl: services.fetchImpl, rateLimit: () => true });
	const result = await call(handler, { method: "POST", body: { token, op: "submit" } });
	assert.equal(result.statusCode, 400);
	assert.deepEqual(result.json.missing, { cards: 2, questions: ["q1"] });
	assert.equal(services.calls.some((entry) => entry.resend), false);
});

test("posts from another site are refused", async () => {
	const services = fakeServices({});
	const handler = createHandler({ env, fetchImpl: services.fetchImpl, rateLimit: () => true });
	const request = Readable.from([JSON.stringify({ token, op: "submit" })]);
	Object.assign(request, { method: "POST", url: "/api/intake", headers: { host: "clairethomas.art", origin: "https://evil.example" } });
	const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(chunk) { this.body = chunk; } };
	await handler(request, response);
	assert.equal(response.statusCode, 403);
	assert.equal(services.calls.length, 0);
});
