// Local preview: serves the site and runs the real /api handlers against the Convex dev deployment.
// - Reads .env.local (written by `npx convex dev`, plus the intake secrets).
// - Uses a local-only admin login so production credentials are never needed.
// - Logs emails instead of sending them.
// Usage: npm run dev   →   http://127.0.0.1:8092
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const port = Number(process.env.PORT || 8092);

const readEnv = (file) =>
	existsSync(file)
		? Object.fromEntries(
				readFileSync(file, "utf8")
					.split("\n")
					.map((line) => line.trim())
					.filter((line) => line && !line.startsWith("#") && line.includes("="))
					.map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).replace(/^["']|["']$/g, "")]),
			)
		: {};

const localEnv = readEnv(path.join(root, ".env.local"));
const password = localEnv.INTAKE_LOCAL_ADMIN_PASSWORD || "preview-only";
const salt = randomBytes(16).toString("hex");
Object.assign(process.env, localEnv, {
	ADMIN_EMAIL: "claire@local.test",
	ADMIN_PASSWORD_HASH: `${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
	ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
	RESEND_API_KEY: "local-preview",
});

const sentEmails = [];
const fetchImpl = async (url, options) => {
	if (String(url).startsWith("https://api.resend.com/")) {
		const email = JSON.parse(options.body);
		sentEmails.push(email);
		console.log(`\n[email not sent: local preview]\nTo: ${email.to}\nSubject: ${email.subject}\n${email.text}\n`);
		return new Response(JSON.stringify({ id: "local" }), { status: 200 });
	}
	return fetch(url, options);
};

const handlers = {
	"/api/intake": require(path.join(root, "api/intake.js")).createHandler({ fetchImpl, rateLimit: () => true }),
	"/api/intake-admin": require(path.join(root, "api/intake-admin.js")).createHandler({ fetchImpl }),
};
const apiHandler = (pathname) => {
	if (handlers[pathname]) return handlers[pathname];
	const file = path.join(root, `${pathname}.js`);
	return file.startsWith(path.join(root, "api")) && existsSync(file) ? require(file) : null;
};

// Apply vercel.json headers so CSP mistakes show up locally too.
const vercel = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8"));
const headerRules = (vercel.headers || []).map((rule) => ({
	pattern: new RegExp(`^${rule.source.replace(/\./g, "\\.").replace(/:\w+\*?/g, "[^/]+")}$`),
	headers: rule.headers,
}));

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".jpg": "image/jpeg", ".JPG": "image/jpeg", ".svg": "image/svg+xml" };

http
	.createServer(async (request, response) => {
		const url = new URL(request.url, `http://${request.headers.host}`);
		for (const rule of headerRules) if (rule.pattern.test(url.pathname)) for (const { key, value } of rule.headers) response.setHeader(key, value);
		// Session cookies are Secure; browsers drop those over plain http, so strip the flag locally.
		const setHeader = response.setHeader.bind(response);
		response.setHeader = (name, value) => setHeader(name, name.toLowerCase() === "set-cookie" ? String(value).replace(/;\s*Secure/i, "") : value);

		if (url.pathname === "/__emails") {
			response.setHeader("Content-Type", "application/json");
			return response.end(JSON.stringify(sentEmails, null, 2));
		}
		if (url.pathname.startsWith("/api/")) {
			const handler = apiHandler(url.pathname);
			if (!handler) {
				response.statusCode = 404;
				return response.end("{}");
			}
			return handler(request, response);
		}

		let pathname = url.pathname;
		if (/^\/intake\/[^/]+$/.test(pathname)) pathname = "/intake.html";
		if (pathname.endsWith("/")) pathname += "index.html";
		const file = path.join(root, decodeURIComponent(pathname));
		if (!file.startsWith(root) || /\/(\.env|node_modules|convex|scripts)/.test(file.slice(root.length))) {
			response.statusCode = 404;
			return response.end("Not found");
		}
		try {
			const body = readFileSync(file);
			response.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
			response.end(body);
		} catch {
			response.statusCode = 404;
			response.end("Not found");
		}
	})
	.listen(port, "127.0.0.1", () => {
		console.log(`Local preview: http://127.0.0.1:${port}/intake-admin.html`);
		console.log(`Admin login: claire@local.test / ${password}`);
		console.log(`Convex: ${process.env.CONVEX_URL || "(CONVEX_URL missing; run npx convex dev)"}`);
	});
