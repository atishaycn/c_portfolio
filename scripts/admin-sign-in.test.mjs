import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";
import { resolve } from "node:path";
import test from "node:test";
import auth from "../api/_lib/auth.js";
import sessionModule from "../api/admin/session.js";

const { createHandler } = sessionModule;
const root = resolve(import.meta.dirname, "..");
const adminHtml = readFileSync(resolve(root, "admin.html"), "utf8");
const adminScript = readFileSync(resolve(root, "admin.js"), "utf8");

const NOW = Date.UTC(2026, 9, 14, 12, 7);
const MINUTE = 60 * 1000;
const SECRET = "sign-in-test-secret";
const ADMIN = "claire@example.test";
const baseEnv = { ADMIN_EMAIL: ADMIN, ADMIN_SESSION_SECRET: SECRET, RESEND_API_KEY: "re_test", ADMIN_SITE_URL: "https://clairethomas.art" };

const withEnv = async (overrides, run) => {
	const saved = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
	for (const [key, value] of Object.entries(overrides)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	try {
		return await run();
	} finally {
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
};

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const signWith = (payload) => createHmac("sha256", SECRET).update(payload).digest("base64url");
const decodePayload = (token) => JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));

const request = (body, { method = "POST", host = "clairethomas.art", origin = `https://${host}` } = {}) => {
	const stream = Readable.from([JSON.stringify(body)]);
	stream.method = method;
	stream.headers = { host, origin };
	return stream;
};

const response = () => {
	const res = { statusCode: 0, headers: {}, body: "" };
	res.setHeader = (name, value) => (res.headers[name.toLowerCase()] = value);
	res.end = (chunk) => (res.body = chunk);
	return res;
};

const call = async (handler, options) => {
	const res = response();
	await handler(request(options.body, options), res);
	return { status: res.statusCode, headers: res.headers, json: JSON.parse(res.body) };
};

const fakeResend = () => {
	const calls = [];
	const fetchImpl = async (url, options) => {
		calls.push({ url, options, payload: JSON.parse(options.body) });
		return { ok: true, status: 200, json: async () => ({ id: "email_1" }), text: async () => "" };
	};
	return { calls, fetchImpl };
};

const linkFrom = (text) => text.match(/https?:\/\/\S+?#login=(\S+)/)[1];

test("login token is valid for the admin until the window after next closes", () =>
	withEnv(baseEnv, () => {
		const token = auth.createLoginToken("Claire@Example.test", NOW);
		assert.notEqual(auth.verifyLoginToken(token, NOW), null);
		const { exp } = decodePayload(token);
		const lifetime = exp * 1000 - NOW;
		assert.ok(lifetime > 15 * MINUTE && lifetime <= 30 * MINUTE, `lifetime ${lifetime}`);
		assert.notEqual(auth.verifyLoginToken(token, exp * 1000 - 1), null);
		assert.equal(auth.verifyLoginToken(token, exp * 1000), null);
	}));

test("login token rejects tampered, wrong-purpose and wrong-email tokens", () =>
	withEnv(baseEnv, () => {
		const token = auth.createLoginToken(ADMIN, NOW);
		const { exp } = decodePayload(token);
		const signature = token.split(".")[1];

		const forged = encode({ purpose: "login", email: ADMIN, exp: exp + 86_400 });
		assert.equal(auth.verifyLoginToken(`${forged}.${signature}`, NOW), null);

		const sessionPurpose = encode({ purpose: "session", email: ADMIN, exp });
		assert.equal(auth.verifyLoginToken(`${sessionPurpose}.${signWith(sessionPurpose)}`, NOW), null);

		assert.equal(auth.verifyLoginToken(auth.createLoginToken("other@example.test", NOW), NOW), null);
		assert.equal(auth.verifyLoginToken("not-a-token", NOW), null);
	}));

test("login tokens and session cookies cannot be swapped", () =>
	withEnv(baseEnv, () => {
		const loginToken = auth.createLoginToken(ADMIN);
		const sessionToken = auth.createSession(ADMIN);
		assert.equal(auth.verifyLoginToken(sessionToken), null);
		assert.equal(auth.verifySession({ headers: { cookie: `ct_admin=${encodeURIComponent(loginToken)}` } }), null);
		assert.equal(
			auth.verifySession({ headers: { cookie: `ct_admin=${encodeURIComponent(sessionToken)}` } }).email,
			ADMIN,
		);
	}));

test("login token cannot be made without a session secret", () =>
	withEnv({ ...baseEnv, ADMIN_SESSION_SECRET: undefined }, () => {
		assert.throws(() => auth.createLoginToken(ADMIN, NOW), /ADMIN_SESSION_SECRET/);
		assert.equal(auth.verifyLoginToken("a.b", NOW), null);
	}));

test("request-link sends nothing for any other email and answers the same", () =>
	withEnv(baseEnv, async () => {
		const resend = fakeResend();
		const handler = createHandler({ fetchImpl: resend.fetchImpl, now: () => NOW });
		const result = await call(handler, { body: { action: "request-link", email: "someone@example.test" } });
		assert.equal(result.status, 200);
		assert.deepEqual(result.json, { sent: true });
		assert.equal(resend.calls.length, 0);
	}));

test("request-link emails the admin one link keyed by the 15-minute window", () =>
	withEnv(baseEnv, async () => {
		const resend = fakeResend();
		const handler = createHandler({ fetchImpl: resend.fetchImpl, now: () => NOW });
		const result = await call(handler, { body: { action: "request-link", email: " CLAIRE@example.test " } });
		assert.deepEqual(result.json, { sent: true });
		assert.equal(resend.calls.length, 1);
		const [{ url, options, payload }] = resend.calls;
		assert.equal(url, "https://api.resend.com/emails");
		assert.equal(options.headers["Idempotency-Key"], `admin-login/${ADMIN}/${auth.loginWindowIndex(NOW)}`);
		assert.deepEqual(payload.to, [ADMIN]);
		assert.equal(payload.subject, "Your Claire Thomas admin sign-in link");
		assert.match(payload.text, /It expires in about 30 minutes\. If you did not ask for it, ignore this email\./);
		const link = payload.text.match(/https:\/\/clairethomas\.art\/admin\.html#login=\S+/)[0];
		assert.notEqual(auth.verifyLoginToken(linkFrom(link), NOW), null);

		await call(handler, { body: { action: "request-link", email: ADMIN } });
		assert.equal(resend.calls[1].options.headers["Idempotency-Key"], resend.calls[0].options.headers["Idempotency-Key"]);

		const later = createHandler({ fetchImpl: resend.fetchImpl, now: () => NOW + 20 * MINUTE });
		await call(later, { body: { action: "request-link", email: ADMIN } });
		assert.notEqual(resend.calls[2].options.headers["Idempotency-Key"], resend.calls[0].options.headers["Idempotency-Key"]);
	}));

test("request-link returns the link only on localhost without Resend", () =>
	withEnv({ ...baseEnv, RESEND_API_KEY: undefined, ADMIN_SITE_URL: undefined }, async () => {
		const resend = fakeResend();
		const handler = createHandler({ fetchImpl: resend.fetchImpl, now: () => NOW });

		const local = await call(handler, {
			body: { action: "request-link", email: ADMIN },
			host: "localhost:8787",
			origin: "http://localhost:8787",
		});
		assert.equal(local.json.sent, true);
		assert.match(local.json.devLink, /^http:\/\/localhost:8787\/admin\.html#login=/);
		assert.notEqual(auth.verifyLoginToken(linkFrom(local.json.devLink), NOW), null);

		const remote = await call(handler, { body: { action: "request-link", email: ADMIN } });
		assert.deepEqual(remote.json, { sent: true });

		const stranger = await call(handler, {
			body: { action: "request-link", email: "other@example.test" },
			host: "localhost:8787",
			origin: "http://localhost:8787",
		});
		assert.deepEqual(stranger.json, { sent: true });
		assert.equal(resend.calls.length, 0);
	}));

test("request-link does not return the link on localhost when Resend sends it", () =>
	withEnv(baseEnv, async () => {
		const resend = fakeResend();
		const handler = createHandler({ fetchImpl: resend.fetchImpl, now: () => NOW });
		const result = await call(handler, {
			body: { action: "request-link", email: ADMIN },
			host: "localhost:8787",
			origin: "http://localhost:8787",
		});
		assert.deepEqual(result.json, { sent: true });
		assert.equal(resend.calls.length, 1);
	}));

test("redeem sets the session cookie for a valid link and refuses an invalid one", () =>
	withEnv(baseEnv, async () => {
		const handler = createHandler({ now: () => NOW });
		const token = auth.createLoginToken(ADMIN, NOW);
		const result = await call(handler, { body: { action: "redeem", token } });
		assert.equal(result.status, 200);
		assert.equal(result.json.authenticated, true);
		assert.equal(result.json.email, ADMIN);
		assert.ok(result.json.csrf);
		const cookie = result.headers["set-cookie"];
		assert.match(cookie, /^ct_admin=/);
		assert.match(cookie, /HttpOnly; Secure; SameSite=Strict; Max-Age=604800/);
		assert.equal(auth.verifySession({ headers: { cookie: cookie.split(";")[0] } }).csrf, result.json.csrf);

		const expired = await call(handler, { body: { action: "redeem", token: auth.createLoginToken(ADMIN, NOW - 60 * MINUTE) } });
		const wrongEmail = await call(handler, { body: { action: "redeem", token: auth.createLoginToken("other@example.test", NOW) } });
		const garbage = await call(handler, { body: { action: "redeem", token: "garbage" } });
		for (const refused of [expired, wrongEmail, garbage]) {
			assert.equal(refused.status, 401);
			assert.equal(refused.json.error, "This sign-in link is invalid or has expired. Ask for a new one.");
			assert.equal(refused.headers["set-cookie"], undefined);
		}
	}));

test("the session endpoint has no password path and refuses cross-site origins", () =>
	withEnv(baseEnv, async () => {
		const handler = createHandler({ fetchImpl: fakeResend().fetchImpl, now: () => NOW });
		const password = await call(handler, { body: { email: ADMIN, password: "anything" } });
		assert.equal(password.status, 400);
		const cross = await call(handler, {
			body: { action: "request-link", email: ADMIN },
			origin: "https://evil.example",
		});
		assert.equal(cross.status, 403);
	}));

test("admin page asks for an email only and redeems the link from the fragment", () => {
	assert.doesNotMatch(adminHtml, /type="password"/);
	assert.match(adminHtml, /Email me a sign-in link/);
	assert.match(adminScript, /action: "request-link"/);
	assert.match(adminScript, /action: "redeem"/);
	assert.match(adminScript, /history\.replaceState\(null, "", window\.location\.pathname \+ window\.location\.search\)/);
});

test("request-link takes the link origin from ADMIN_SITE_URL, never from a forged Host", () =>
	withEnv(baseEnv, async () => {
		const resend = fakeResend();
		const handler = createHandler({ fetchImpl: resend.fetchImpl, now: () => NOW });
		await call(handler, { body: { action: "request-link", email: ADMIN }, host: "evil.example", origin: undefined });
		assert.equal(resend.calls.length, 1);
		assert.match(resend.calls[0].payload.text, /https:\/\/clairethomas\.art\/admin\.html#login=/);
		assert.doesNotMatch(resend.calls[0].payload.text, /evil\.example/);
	}));

test("request-link sends nothing off localhost when ADMIN_SITE_URL is missing", () =>
	withEnv({ ...baseEnv, ADMIN_SITE_URL: undefined }, async () => {
		const resend = fakeResend();
		const handler = createHandler({ fetchImpl: resend.fetchImpl, now: () => NOW });
		const result = await call(handler, { body: { action: "request-link", email: ADMIN } });
		assert.deepEqual(result.json, { sent: true });
		assert.equal(resend.calls.length, 0);
	}));

const LIST_ENV = { ...baseEnv, ADMIN_EMAIL: "Admin@Example.test, second@example.test" };

test("request-link sends one link to the listed admin who asked for it", () =>
	withEnv(LIST_ENV, async () => {
		const resend = fakeResend();
		const handler = createHandler({ fetchImpl: resend.fetchImpl, now: () => NOW });
		const result = await call(handler, { body: { action: "request-link", email: "second@example.test" } });
		assert.deepEqual(result.json, { sent: true });
		assert.equal(resend.calls.length, 1);
		const [{ payload }] = resend.calls;
		assert.deepEqual(payload.to, ["second@example.test"]);
		assert.equal(auth.verifyLoginToken(linkFrom(payload.text), NOW).email, "second@example.test");
	}));

test("request-link for an address not in the list sends nothing and answers the same", () =>
	withEnv(LIST_ENV, async () => {
		const resend = fakeResend();
		const handler = createHandler({ fetchImpl: resend.fetchImpl, now: () => NOW });
		const result = await call(handler, { body: { action: "request-link", email: "stranger@example.test" } });
		assert.deepEqual(result.json, { sent: true });
		assert.equal(resend.calls.length, 0);
	}));

test("redeem signs in a second listed admin under their own address", () =>
	withEnv(LIST_ENV, async () => {
		const handler = createHandler({ now: () => NOW });
		const token = auth.createLoginToken("second@example.test", NOW);
		const result = await call(handler, { body: { action: "redeem", token } });
		assert.equal(result.status, 200);
		assert.equal(result.json.email, "second@example.test");
		const cookie = result.headers["set-cookie"].split(";")[0];
		assert.equal(auth.requireSession({ method: "GET", headers: { cookie } }).email, "second@example.test");
	}));

test("a session for an address removed from ADMIN_EMAIL is rejected", () =>
	withEnv(LIST_ENV, async () => {
		const cookie = `ct_admin=${encodeURIComponent(auth.createSession("second@example.test"))}`;
		assert.equal(auth.verifySession({ headers: { cookie } }).email, "second@example.test");
		await withEnv({ ...LIST_ENV, ADMIN_EMAIL: "Admin@Example.test" }, async () => {
			assert.equal(auth.verifySession({ headers: { cookie } }), null);
		});
	}));

test("each listed admin gets their own Resend idempotency key in the same window", () =>
	withEnv(LIST_ENV, async () => {
		const resend = fakeResend();
		const handler = createHandler({ fetchImpl: resend.fetchImpl, now: () => NOW });
		await call(handler, { body: { action: "request-link", email: "Admin@Example.test" } });
		await call(handler, { body: { action: "request-link", email: "second@example.test" } });
		assert.equal(resend.calls.length, 2);
		const [first, second] = resend.calls.map((call) => call.options.headers["Idempotency-Key"]);
		assert.notEqual(first, second);
		assert.equal(first, `admin-login/admin@example.test/${auth.loginWindowIndex(NOW)}`);
		assert.equal(second, `admin-login/second@example.test/${auth.loginWindowIndex(NOW)}`);
	}));
