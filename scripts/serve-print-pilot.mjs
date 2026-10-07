import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// Local-only server. No admin routes, uploads, or Shopify/Gelato mutation routes.
const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.PRINT_DEV_PORT || 8091);
process.env.PRINT_CHECKOUT_ENABLED ??= "true";
process.env.PRINT_SITE_URL ??= `http://localhost:${port}`;
const handlers = new Map([
	["/api/content", require("../api/content.js")],
	["/api/print-catalog", require("../api/print-catalog.js")],
	["/api/print-checkout", require("../api/print-checkout.js")],
	["/api/print-status", require("../api/print-status.js")],
	["/api/stripe-webhook", require("../api/stripe-webhook.js")],
]);
const pages = (await readdir(root)).filter((file) => file.endsWith(".html") && file !== "admin.html");
const files = new Set([...pages, "styles.css", "site.js", "cms-loader.js", "gallery-page.js", "prints-pilot.js"]);
const mime = { html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml", webp: "image/webp" };
const server = createServer(async (request, response) => {
	try {
		const path = new URL(request.url, "http://localhost").pathname;
		const handler = handlers.get(path);
		if (handler) return await handler(request, response);
		const file = path === "/" ? "index.html" : path.slice(1);
		if (!["GET", "HEAD"].includes(request.method) || (!files.has(file) && !/^assets\/[a-zA-Z0-9_-]+\.(png|jpg|svg|webp)$/.test(file))) {
			response.writeHead(404); response.end("Not found"); return;
		}
		const bytes = await readFile(join(root, file));
		response.writeHead(200, { "Content-Type": mime[file.split(".").pop()], "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
		response.end(request.method === "HEAD" ? undefined : bytes);
	} catch {
		if (!response.headersSent) response.writeHead(500);
		response.end("Local request failed");
	}
});
server.requestTimeout = 30_000;
server.listen(port, "127.0.0.1", () => console.log(`Print sandbox: http://localhost:${server.address().port}/prints.html`));
