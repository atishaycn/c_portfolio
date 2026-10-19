import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes, scryptSync } from "node:crypto";
import { Readable } from "node:stream";
import test, { mock } from "node:test";
import auth from "../api/_lib/auth.js";
import { allowedOrigin, readJson } from "../api/_lib/http.js";
import contentRoute from "../api/content.js";
import sessionRoute from "../api/admin/session.js";
import uploadSignatureRoute from "../api/admin/upload-signature.js";

const CLOUDINARY_ENV = {
	CLOUDINARY_CLOUD_NAME: "test-cloud",
	CLOUDINARY_API_KEY: "test-key",
	CLOUDINARY_API_SECRET: "test-secret",
};
const ADMIN_ENV = {
	ADMIN_EMAIL: "admin@example.test",
	ADMIN_SESSION_SECRET: "test-session-secret-0123456789",
};

const withEnv = (vars, fn) => {
	const saved = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
	const restore = () => {
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	};
	for (const [key, value] of Object.entries(vars)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	let result;
	try {
		result = fn();
	} catch (error) {
		restore();
		throw error;
	}
	if (result && typeof result.then === "function") return result.finally(restore);
	restore();
	return result;
};

const quiet = () => {
	mock.method(console, "log", () => {});
	mock.method(console, "warn", () => {});
	mock.method(console, "error", () => {});
};

const fakeResponse = () => ({
	statusCode: 200,
	headers: {},
	body: undefined,
	setHeader(name, value) {
		this.headers[name.toLowerCase()] = value;
	},
	end(chunk) {
		this.body = chunk;
	},
	json() {
		return JSON.parse(this.body);
	},
});

const fakeRequest = ({ method = "GET", headers = {}, body } = {}) => {
	const request = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === "string" ? body : JSON.stringify(body))]);
	request.method = method;
	request.headers = headers;
	return request;
};

const cookieFor = (token) => `ct_admin=${encodeURIComponent(token)}`;

// Expected-failure helper: the test passes while the bug is present and fails once the bug is fixed,
// so the marker has to be removed at that point.
const xfail = (name, reason, fn) =>
	test(`[xfail] ${name}`, async () => {
		quiet();
		let failure = null;
		try {
			await fn();
		} catch (error) {
			failure = error;
		} finally {
			mock.restoreAll();
		}
		assert.ok(failure, `expected failure still reproduces (${reason}); remove the xfail marker if it now passes`);
	});

test("public content route serves the bundled snapshot with edge caching", async () => {
	await withEnv({ ...CLOUDINARY_ENV, CLOUDINARY_CLOUD_NAME: undefined }, async () => {
		quiet();
		const response = fakeResponse();
		await contentRoute(fakeRequest({ method: "GET" }), response);
		mock.restoreAll();
		assert.equal(response.statusCode, 200);
		assert.match(response.headers["cache-control"], /s-maxage=30/);
		assert.ok(Array.isArray(response.json().albums));
	});
});

test("public content route falls back to the bundled snapshot when the CMS read fails", async () => {
	await withEnv(CLOUDINARY_ENV, async () => {
		quiet();
		mock.method(globalThis, "fetch", async () => {
			throw new Error("network down");
		});
		const response = fakeResponse();
		await contentRoute(fakeRequest({ method: "GET" }), response);
		assert.equal(response.statusCode, 200);
		assert.ok(Array.isArray(response.json().albums));
	});
});

test("public content route is read-only and advertises GET", async () => {
	quiet();
	const response = fakeResponse();
	await contentRoute(fakeRequest({ method: "POST" }), response);
	assert.equal(response.statusCode, 405);
	assert.equal(response.headers.allow, "GET");
});

test("same-origin and originless requests pass the origin check; cross-origin and malformed origins do not", () => {
	const sameHost = fakeRequest({ headers: { host: "site.test", origin: "https://site.test" } });
	assert.equal(allowedOrigin(sameHost), true);
	assert.equal(allowedOrigin(fakeRequest({ headers: { host: "site.test" } })), true);
	assert.equal(
		allowedOrigin(fakeRequest({ headers: { host: "site.test", origin: "https://evil.test" } })),
		false,
	);
	assert.equal(allowedOrigin(fakeRequest({ headers: { host: "site.test", origin: "not a url" } })), false);
});

test("origin check compares against the forwarded host when a proxy sets one", () => {
	const request = fakeRequest({
		headers: { host: "internal.test", "x-forwarded-host": "site.test", origin: "https://site.test" },
	});
	assert.equal(allowedOrigin(request), true);
});

test("readJson parses a JSON body, treats an empty body as an empty object, and rejects bad input", async () => {
	assert.deepEqual(await readJson(fakeRequest({ body: { a: 1 } })), { a: 1 });
	assert.deepEqual(await readJson(fakeRequest()), {});
	await assert.rejects(readJson(fakeRequest({ body: "{nope" })), (error) => error.statusCode === 400);
	await assert.rejects(readJson(fakeRequest({ body: "x".repeat(50) }), 10), (error) => error.statusCode === 413);
});

test("requireSession rejects anonymous callers and state-changing calls without the CSRF token", () => {
	withEnv(ADMIN_ENV, () => {
		const token = auth.createSession(ADMIN_ENV.ADMIN_EMAIL);
		const session = auth.verifySession({ headers: { cookie: cookieFor(token) } });
		assert.throws(() => auth.requireSession({ method: "GET", headers: {} }), (e) => e.statusCode === 401);
		assert.equal(auth.requireSession({ method: "GET", headers: { cookie: cookieFor(token) } }).email, ADMIN_ENV.ADMIN_EMAIL);
		assert.throws(
			() => auth.requireSession({ method: "POST", headers: { cookie: cookieFor(token) } }),
			(e) => e.statusCode === 403,
		);
		assert.equal(
			auth.requireSession({
				method: "POST",
				headers: { cookie: cookieFor(token), "x-csrf-token": session.csrf },
			}).email,
			ADMIN_ENV.ADMIN_EMAIL,
		);
	});
});

test("sessions expire, and a token signed with another secret is refused", () => {
	withEnv(ADMIN_ENV, () => {
		const current = auth.createSession(ADMIN_ENV.ADMIN_EMAIL);
		const claims = JSON.parse(Buffer.from(current.split(".")[0], "base64url").toString("utf8"));
		const stalePayload = Buffer.from(JSON.stringify({ ...claims, exp: 1 })).toString("base64url");
		const staleToken = `${stalePayload}.${createHmac("sha256", ADMIN_ENV.ADMIN_SESSION_SECRET).update(stalePayload).digest("base64url")}`;
		assert.equal(auth.verifySession({ headers: { cookie: cookieFor(staleToken) } }), null);
		assert.notEqual(auth.verifySession({ headers: { cookie: cookieFor(current) } }), null);

		const forged = auth.createSession(ADMIN_ENV.ADMIN_EMAIL);
		process.env.ADMIN_SESSION_SECRET = "a-different-secret-entirely-0000";
		assert.equal(auth.verifySession({ headers: { cookie: cookieFor(forged) } }), null);
	});
});

test("admin sign-in sets a strict HttpOnly cookie for the right password and refuses the wrong one", async () => {
	const password = "temporary-test-password";
	const salt = randomBytes(16).toString("hex");
	const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
	await withEnv({ ...ADMIN_ENV, ADMIN_PASSWORD_HASH: hash }, async () => {
		quiet();
		const wrong = fakeResponse();
		await sessionRoute(
			fakeRequest({ method: "POST", headers: { host: "site.test" }, body: { email: ADMIN_ENV.ADMIN_EMAIL, password: "nope" } }),
			wrong,
		);
		assert.equal(wrong.statusCode, 401);
		assert.equal(wrong.headers["set-cookie"], undefined);

		const ok = fakeResponse();
		await sessionRoute(
			fakeRequest({ method: "POST", headers: { host: "site.test" }, body: { email: ADMIN_ENV.ADMIN_EMAIL, password } }),
			ok,
		);
		assert.equal(ok.statusCode, 200);
		const cookie = ok.headers["set-cookie"];
		assert.match(cookie, /^ct_admin=.+; Path=\/; HttpOnly; Secure; SameSite=Strict/);
		const signedIn = fakeResponse();
		await sessionRoute(fakeRequest({ method: "GET", headers: { cookie: cookie.split(";")[0] } }), signedIn);
		assert.equal(signedIn.json().authenticated, true);
		assert.ok(signedIn.json().csrf);
	});
});

test("admin sign-out needs the CSRF token and clears the cookie", async () => {
	await withEnv(ADMIN_ENV, async () => {
		quiet();
		const token = auth.createSession(ADMIN_ENV.ADMIN_EMAIL);
		const csrf = auth.verifySession({ headers: { cookie: cookieFor(token) } }).csrf;
		const refused = fakeResponse();
		await sessionRoute(fakeRequest({ method: "DELETE", headers: { cookie: cookieFor(token), host: "site.test" } }), refused);
		assert.equal(refused.statusCode, 403);
		const accepted = fakeResponse();
		await sessionRoute(
			fakeRequest({ method: "DELETE", headers: { cookie: cookieFor(token), "x-csrf-token": csrf, host: "site.test" } }),
			accepted,
		);
		assert.equal(accepted.statusCode, 200);
		assert.match(accepted.headers["set-cookie"], /Max-Age=0/);
	});
});

test("upload signature route issues a per-upload public ID and a Cloudinary-compatible signature", async () => {
	await withEnv({ ...ADMIN_ENV, ...CLOUDINARY_ENV }, async () => {
		quiet();
		const token = auth.createSession(ADMIN_ENV.ADMIN_EMAIL);
		const csrf = auth.verifySession({ headers: { cookie: cookieFor(token) } }).csrf;
		const response = fakeResponse();
		await uploadSignatureRoute(
			fakeRequest({
				method: "POST",
				headers: { cookie: cookieFor(token), "x-csrf-token": csrf, host: "site.test" },
				body: { albumKey: "Special Occasions!" },
			}),
			response,
		);
		assert.equal(response.statusCode, 200);
		const issued = response.json();
		assert.match(issued.publicId, /^portfolio-admin\/special-occasions\/[0-9a-f-]{36}$/);
		const expected = createHash("sha1")
			.update(`overwrite=false&public_id=${issued.publicId}&timestamp=${issued.timestamp}test-secret`)
			.digest("hex");
		assert.equal(issued.signature, expected);
		assert.equal(issued.apiKey, "test-key");
		assert.equal(issued.uploadUrl, "https://api.cloudinary.com/v1_1/test-cloud/image/upload");
	});
});

test("upload signature route refuses to sign without Cloudinary configuration", async () => {
	await withEnv({ ...ADMIN_ENV, ...CLOUDINARY_ENV, CLOUDINARY_API_SECRET: undefined }, async () => {
		quiet();
		const token = auth.createSession(ADMIN_ENV.ADMIN_EMAIL);
		const csrf = auth.verifySession({ headers: { cookie: cookieFor(token) } }).csrf;
		const response = fakeResponse();
		await uploadSignatureRoute(
			fakeRequest({
				method: "POST",
				headers: { cookie: cookieFor(token), "x-csrf-token": csrf, host: "site.test" },
				body: { albumKey: "nature" },
			}),
			response,
		);
		assert.equal(response.statusCode, 503);
		assert.equal(response.json().error, "Cloudinary is not configured");
	});
});

// Regression: 3bf52d8
test(
	"admin session still works when ADMIN_EMAIL is set with capitals",
	"verifySession compares the session email with the raw ADMIN_EMAIL, while sign-in stores it lowercased",
	async () => {
		await withEnv({ ...ADMIN_ENV, ADMIN_EMAIL: "Admin@Example.test" }, async () => {
			const token = auth.createSession("admin@example.test");
			assert.notEqual(auth.verifySession({ headers: { cookie: cookieFor(token) } }), null);
		});
	},
);

// Regression: e03fc75
test(
	"a malformed percent-encoded session cookie is treated as signed out, not as a server error",
	"parseCookies calls decodeURIComponent, which throws on a bad escape and surfaces as a 500",
	async () => {
		await withEnv(ADMIN_ENV, async () => {
			const response = fakeResponse();
			await sessionRoute(fakeRequest({ method: "GET", headers: { cookie: "ct_admin=%E0%A4%A" } }), response);
			assert.equal(response.statusCode, 200);
			assert.equal(response.json().authenticated, false);
		});
	},
);
