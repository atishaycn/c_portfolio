import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const ignoreRules = readFileSync(resolve(root, ".vercelignore"), "utf8")
	.split("\n")
	.map((line) => line.trim())
	.filter((line) => line && !line.startsWith("#"));

// Only the allowlist forms used in .vercelignore: "/*" (ignore everything) and "!/name" or "!/*.ext" (keep).
const globToRegExp = (pattern) =>
	new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`);

const servedRootEntries = () => {
	const keep = ignoreRules.filter((rule) => rule.startsWith("!")).map((rule) => globToRegExp(rule.slice(2)));
	const ignoredEverything = ignoreRules.includes("/*");
	return readdirSync(root).filter((name) => ignoredEverything && keep.some((rx) => rx.test(name)));
};

test("the deploy ignore file is an allowlist that starts by ignoring everything", () => {
	assert.equal(ignoreRules[0], "/*");
	assert.ok(ignoreRules.every((rule) => rule === "/*" || rule.startsWith("!/")));
});

test("the deployed root serves only the site files and keeps secrets, source, and notes private", () => {
	const served = new Set(servedRootEntries());
	for (const name of ["index.html", "site.js", "styles.css", "admin.js", "api", "content", "vercel.json"]) {
		assert.ok(served.has(name), `${name} must be deployed`);
	}
	const privateEntries = [
		".env",
		".env.local",
		".env.gelato.local",
		".admin-credentials.local.json",
		".portfolio-print-sync-state.json",
		".gelato-product-state.json",
		".github",
		".operator-shared",
		"scripts",
		"program.md",
		"GLOSSARY.md",
		"PRINT_SHOP_SETUP.md",
		"README.md",
		"DRIVE_MIGRATION.md",
		"package-lock.json",
	];
	for (const name of privateEntries) {
		assert.equal(served.has(name), false, `${name} must not be deployed`);
	}
});

test("every root file that is not a known site file stays private by default", () => {
	const served = new Set(servedRootEntries());
	const allowedNames = /\.(html|js|css|JPG|md)$|^(api|assets|content|robots\.txt|sitemap\.xml|vercel\.json|package\.json)$/;
	const unexpected = [...served].filter((name) => !allowedNames.test(name) || name.endsWith(".md"));
	assert.deepEqual(unexpected, []);
});

test("API responses are never cached and admin pages refuse framing and inline scripts", () => {
	const config = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"));
	const headersFor = (source) =>
		Object.fromEntries((config.headers.find((entry) => entry.source === source)?.headers || []).map((h) => [h.key, h.value]));
	assert.equal(headersFor("/api/(.*)")["Cache-Control"], "no-store");
	const admin = headersFor("/admin.html");
	assert.equal(admin["X-Frame-Options"], "DENY");
	assert.match(admin["Content-Security-Policy"], /script-src 'self'(;|$)/);
	assert.match(admin["Content-Security-Policy"], /frame-ancestors 'none'/);
	assert.doesNotMatch(admin["Content-Security-Policy"], /unsafe-inline/);
});
