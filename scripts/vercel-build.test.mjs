import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const buildScript = fileURLToPath(new URL("./vercel-build.mjs", import.meta.url));

test("Vercel builds the configured public directory without serving backend files or secrets", () => {
	const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "intake-build-"));
	try {
		const files = {
			"index.html": "homepage", "intake.html": "intake", "intake-admin.html": "admin",
			"intake.js": "client", "styles.css": "styles", "about-contact-photo.JPG": "photo",
			"assets/photo.webp": "asset", "content/portfolio.json": "{}",
			".env.local": "secret", ".admin-credentials.local.json": "secret",
			"node_modules/convex/package.json": "{}", "convex/client.ts": "backend",
			"api/intake.js": "backend", "scripts/private.mjs": "script", "package.json": "{}",
			"public/stale-secret.txt": "must be removed",
		};
		for (const [name, content] of Object.entries(files)) {
			const target = path.join(fixture, name);
			fs.mkdirSync(path.dirname(target), { recursive: true });
			fs.writeFileSync(target, content);
		}
		execFileSync(process.execPath, [buildScript], {
			cwd: fixture, env: { ...process.env, VERCEL_ENV: "preview", CONVEX_DEPLOY_KEY: "" },
		});
		const output = path.join(fixture, "public");
		assert.ok(fs.existsSync(output), "Build must generate Vercel's public directory");
		for (const name of Object.keys(files).filter(name => /^(assets|content)\//.test(name) || /^[^.\/][^/]*\.(html|js|css|JPG)$/.test(name))) {
			assert.equal(fs.readFileSync(path.join(output, name), "utf8"), files[name]);
		}
		for (const name of [".env.local", ".admin-credentials.local.json", "node_modules", "convex", "api", "scripts", "package.json", "stale-secret.txt"]) {
			assert.equal(fs.existsSync(path.join(output, name)), false, `${name} must not be public`);
		}
		const config = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
		assert.equal(config.outputDirectory, "public");
	} finally {
		fs.rmSync(fixture, { recursive: true, force: true });
	}
});

test("Production build fails closed without the Convex deployment key", () => {
	const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "intake-build-prod-"));
	try {
		assert.throws(() => execFileSync(process.execPath, [buildScript], {
			cwd: fixture, env: { ...process.env, VERCEL_ENV: "production", CONVEX_DEPLOY_KEY: "" }, stdio: "pipe",
		}), /CONVEX_DEPLOY_KEY is not set/);
		assert.equal(fs.existsSync(path.join(fixture, "public")), false);
	} finally {
		fs.rmSync(fixture, { recursive: true, force: true });
	}
});
