#!/usr/bin/env node
// Local migration tool only. It never changes files in Drive or website content.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
export const LOCAL_DIR = resolve(ROOT, ".drive-migration.local");
export const SCOPES = [
	"https://www.googleapis.com/auth/drive.readonly",
	"https://www.googleapis.com/auth/drive.file",
];

export function desktopClient(document) {
	const client = document.installed;
	if (!client || !/^[\w.-]+\.apps\.googleusercontent\.com$/.test(client.client_id || "") ||
		!client.client_secret) {
		throw new Error("Download an OAuth client JSON for a Desktop app from Google Cloud.");
	}
	return { client_id: client.client_id, client_secret: client.client_secret };
}

export function authorizationUrl({ client, redirectUri, state, verifier }) {
	const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
	url.search = new URLSearchParams({
		client_id: client.client_id,
		redirect_uri: redirectUri,
		response_type: "code",
		scope: SCOPES.join(" "),
		state,
		code_challenge: createHash("sha256").update(verifier).digest("base64url"),
		code_challenge_method: "S256",
		access_type: "online", // No persistent refresh token for this one-time migration.
		prompt: "select_account consent",
	}).toString();
	return url.toString();
}

function validState(actual, expected) {
	if (!actual) return false;
	const a = Buffer.from(actual);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

export async function exchangeCode({ client, code, verifier, redirectUri, fetchImpl = fetch, signal }) {
	const response = await fetchImpl("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ ...client, code, code_verifier: verifier,
			redirect_uri: redirectUri, grant_type: "authorization_code" }),
		signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
	});
	if (!response.ok) throw new Error(`Google token exchange failed with HTTP ${response.status}.`);
	const token = await response.json();
	const granted = new Set((token.scope || "").split(" "));
	if (!token.access_token || token.token_type?.toLowerCase() !== "bearer" ||
		!Number.isFinite(token.expires_in) || token.expires_in <= 0 ||
		!SCOPES.every((scope) => granted.has(scope))) {
		throw new Error("Google did not grant both requested Drive permissions. No token was saved.");
	}
	return { access_token: token.access_token, token_type: "Bearer", scope: token.scope,
		expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString() };
}

export async function saveToken(token) {
	await mkdir(LOCAL_DIR, { recursive: true, mode: 0o700 });
	await chmod(LOCAL_DIR, 0o700);
	const path = resolve(LOCAL_DIR, "token.json");
	await writeFile(path, JSON.stringify(token, null, 2) + "\n", { mode: 0o600 });
	await chmod(path, 0o600);
}

export async function startSignIn({ client, port = 8765, timeoutMs = 600_000,
	fetchImpl = fetch, save = saveToken } = {}) {
	const state = randomBytes(32).toString("base64url");
	const verifier = randomBytes(48).toString("base64url");
	let redirectUri;
	let timer;
	let processing = false;
	let finished = false;
	const controller = new AbortController();
	let settle;
	const done = new Promise((resolveDone, rejectDone) => { settle = { resolveDone, rejectDone }; });
	// Attach a rejection handler immediately, even if the caller has not started awaiting.
	done.catch(() => {});
	const reply = (res, status, text) => {
		res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
			"Content-Security-Policy": "default-src 'none'" });
		res.end(text);
	};
	const finish = (error) => {
		if (finished) return;
		finished = true;
		controller.abort();
		clearTimeout(timer);
		server.close();
		if (error) settle.rejectDone(error);
		else settle.resolveDone();
	};
	const server = createServer(async (req, res) => {
		const url = new URL(req.url, redirectUri);
		if (req.method !== "GET" || url.pathname !== "/oauth/callback") {
			return reply(res, 404, "Not found.");
		}
		if (!validState(url.searchParams.get("state"), state)) {
			return reply(res, 400, "Invalid sign-in state. Use the original sign-in link.");
		}
		if (finished || processing) return reply(res, 409, "Sign-in is already being processed or has ended.");
		if (url.searchParams.has("error")) {
			reply(res, 400, "Google authorization was not granted. No changes were made.");
			return finish(new Error("Google authorization was not granted."));
		}
		const code = url.searchParams.get("code");
		if (!code) return reply(res, 400, "Missing authorization code.");
		processing = true;
		try {
			const token = await exchangeCode({ client, code, verifier, redirectUri, fetchImpl, signal: controller.signal });
			controller.signal.throwIfAborted();
			await save(token);
			reply(res, 200, "Google Drive connected. You can close this tab. No Drive files or website content have changed.");
			finish();
		} catch (error) {
			reply(res, 500, "Sign-in failed. Return to the migration script. No Drive files were changed.");
			finish(error);
		}
	});
	await new Promise((resolveListening, rejectListening) => {
		server.once("error", rejectListening);
		server.listen(port, "127.0.0.1", resolveListening);
	});
	redirectUri = `http://127.0.0.1:${server.address().port}/oauth/callback`;
	timer = setTimeout(() => finish(new Error("Sign-in expired after ten minutes. Run the script again.")), timeoutMs);
	return { url: authorizationUrl({ client, redirectUri, state, verifier }), redirectUri, done,
		cancel: () => finish(new Error("Sign-in cancelled.")) };
}

async function main() {
	const path = process.argv[2] || resolve(LOCAL_DIR, "client.json");
	let client;
	try { client = desktopClient(JSON.parse(await readFile(path, "utf8"))); }
	catch (error) {
		if (error.code === "ENOENT") throw new Error(
			"OAuth client not found. Save the Desktop app client JSON to .drive-migration.local/client.json. See DRIVE_MIGRATION.md.");
		throw error;
	}
	const session = await startSignIn({ client });
	const cancel = () => session.cancel();
	process.once("SIGINT", cancel);
	process.once("SIGTERM", cancel);
	console.log("Open this Google sign-in link in the browser on this computer:");
	console.log(session.url);
	console.log("This requests read access to existing Drive files, and management of files created by this app.");
	try {
		await session.done;
		console.log("Connected. An expiring token was saved locally with owner-only permissions. No Drive writes occurred.");
	} finally {
		process.removeListener("SIGINT", cancel);
		process.removeListener("SIGTERM", cancel);
	}
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
	main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
