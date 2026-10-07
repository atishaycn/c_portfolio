import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { desktopClient, authorizationUrl, exchangeCode, startSignIn, SCOPES } from "./drive-sign-in.mjs";

const client = { client_id: "example.apps.googleusercontent.com", client_secret: "test-secret" };
const token = { access_token: "test-token", token_type: "Bearer", expires_in: 3600, scope: SCOPES.join(" ") };

test("requires Desktop OAuth credentials, not an API key or web client", () => {
	assert.deepEqual(desktopClient({ installed: client }), client);
	assert.throws(() => desktopClient({ web: client }), /Desktop/);
	assert.throws(() => desktopClient({ installed: { client_id: "api-key" } }), /Desktop/);
});

test("authorization uses PKCE, state, no refresh token, and bounded Drive scopes", () => {
	const url = new URL(authorizationUrl({ client, redirectUri: "http://127.0.0.1:8765/oauth/callback", state: "state", verifier: "verifier" }));
	assert.equal(url.origin, "https://accounts.google.com");
	assert.equal(url.searchParams.get("state"), "state");
	assert.equal(url.searchParams.get("code_challenge_method"), "S256");
	assert.equal(url.searchParams.get("code_challenge"), createHash("sha256").update("verifier").digest("base64url"));
	assert.equal(url.searchParams.get("access_type"), "online");
	assert.deepEqual(url.searchParams.get("scope").split(" "), SCOPES);
	assert.ok(!SCOPES.includes("https://www.googleapis.com/auth/drive"));
});

test("exchange keeps secrets out of errors and rejects missing permissions", async () => {
	const options = { client, code: "secret-code", verifier: "verifier", redirectUri: "http://127.0.0.1/callback" };
	await assert.rejects(exchangeCode({ ...options, fetchImpl: async () => new Response("secret-details", { status: 400 }) }),
		{ message: "Google token exchange failed with HTTP 400." });
	await assert.rejects(exchangeCode({ ...options, fetchImpl: async () => Response.json({ ...token, scope: SCOPES[0] }) }), /both requested/);
	let request;
	const result = await exchangeCode({ ...options, fetchImpl: async (url, init) => {
		request = { url, init }; return Response.json({ ...token, refresh_token: "unwanted" });
	} });
	assert.equal(request.url, "https://oauth2.googleapis.com/token");
	assert.equal(request.init.method, "POST");
	assert.equal(request.init.body.get("code_verifier"), "verifier");
	assert.equal(result.access_token, "test-token");
	assert.equal(result.refresh_token, undefined);
	assert.ok(Date.parse(result.expires_at) > Date.now());
});

test("callback ignores unrelated requests, requires state, and exchanges once", async () => {
	let exchanges = 0;
	let saved;
	const session = await startSignIn({ client, port: 0, save: async (value) => { saved = value; },
		fetchImpl: async () => { exchanges++; return Response.json(token); } });
	try {
		assert.equal(new URL(session.redirectUri).hostname, "127.0.0.1");
		assert.equal((await fetch(session.redirectUri)).status, 400);
		assert.equal((await fetch(new URL("/", session.redirectUri))).status, 404);
		assert.equal((await fetch(session.redirectUri + "?code=code&state=wrong")).status, 400);
		assert.equal(exchanges, 0);
		const callback = new URL(session.redirectUri);
		callback.search = new URLSearchParams({ code: "code", state: new URL(session.url).searchParams.get("state") });
		const response = await fetch(callback);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "no-store");
		await session.done;
		assert.equal(exchanges, 1);
		assert.equal(saved.access_token, "test-token");
	} finally { session.cancel(); }
});

test("denied consent and timeout do not save tokens", async () => {
	let writes = 0;
	const denied = await startSignIn({ client, port: 0, save: async () => { writes++; } });
	const callback = new URL(denied.redirectUri);
	callback.search = new URLSearchParams({ error: "access_denied", state: new URL(denied.url).searchParams.get("state") });
	assert.equal((await fetch(callback)).status, 400);
	await assert.rejects(denied.done, /not granted/);
	const expired = await startSignIn({ client, port: 0, timeoutMs: 10, save: async () => { writes++; } });
	await assert.rejects(expired.done, /expired/);
	assert.equal(writes, 0);
});
