import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Exercise actual Node HTTP requests, not only mocked handler objects.
test("local pilot server serves public files but blocks credentials and mutation routes", async (t) => {
	const child = spawn(process.execPath, [fileURLToPath(new URL("./serve-print-pilot.mjs", import.meta.url))], {
		env: { ...process.env, PRINT_DEV_PORT: "0", PRINT_CHECKOUT_ENABLED: "false", STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "" },
		stdio: ["ignore", "pipe", "pipe"],
	});
	t.after(async () => {
		if (child.exitCode === null) {
			const exited = new Promise((resolve) => child.once("exit", resolve));
			child.kill();
			await exited;
		}
	});
	const origin = await new Promise((resolve, reject) => {
		let output = "";
		const timer = setTimeout(() => reject(new Error("Local server startup timed out")), 5000);
		child.once("error", (error) => { clearTimeout(timer); reject(error); });
		child.once("exit", () => { clearTimeout(timer); reject(new Error("Local server exited before startup")); });
		child.stdout.on("data", (chunk) => {
			output += chunk;
			const match = output.match(/http:\/\/localhost:(\d+)\/prints.html/);
			if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
		});
	});
	const get = (path, options = {}) => fetch(`${origin}${path}`, { signal: AbortSignal.timeout(5000), ...options });
	const page = await get("/prints.html");
	assert.equal(page.status, 200);
	assert.equal(page.headers.get("referrer-policy"), "no-referrer");
	assert((await page.text()).includes("cms-loader.js"));
	for (const path of ["/site.js", "/prints-pilot.js", "/styles.css", "/assets/claire-thomas-logo.png"]) assert.equal((await get(path)).status, 200, path);
	for (const path of ["/.env", "/.env.local", "/.env.stripe.local", "/node_modules/stripe/package.json", "/package.json", "/scripts/serve-print-pilot.mjs", "/admin.html", "/api/admin/content", "/api/admin/upload-signature", "/api/admin/shop-sync", "/api/_lib/prints.js", "/%2e%2e/.env"]) {
		assert.equal((await get(path)).status, 404, path);
	}
	assert.deepEqual(await (await get("/api/print-catalog")).json(), { enabled: false, testOnly: true });
	assert.equal((await get("/prints.html", { method: "POST" })).status, 404);
	assert.equal((await get("/api/print-checkout")).status, 405);
	assert.equal((await get("/api/print-checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 503);
	assert.equal((await get("/api/stripe-webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 503);
});
