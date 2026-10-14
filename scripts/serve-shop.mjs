import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const port = Number(process.env.SHOP_DEV_PORT || 8096);
const envFiles = [".env", ".env.local", ".env.stripe.local"];
const shellKeys = new Set(Object.keys(process.env));

const parseEnv = (source) => {
	const values = new Map();
	for (const rawLine of source.replace(/^\uFEFF/, "").split(/\r?\n/)) {
		const match = rawLine.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
		if (!match) continue;
		let value = match[2];
		if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
			const quote = value[0];
			value = value.slice(1, -1);
			if (quote === "\"") value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\\"/g, "\"");
		} else {
			value = value.replace(/\s+#.*$/, "").trim();
		}
		values.set(match[1], value);
	}
	return values;
};

for (const name of envFiles) {
	try {
		const content = await readFile(resolve(root, name), "utf8");
		for (const [key, value] of parseEnv(content)) {
			if (!shellKeys.has(key)) process.env[key] = value;
		}
	} catch (error) {
		if (error.code !== "ENOENT") throw new Error(`Could not load ${name}`);
	}
}

process.env.SHOP_CHECKOUT_ENABLED = "true";
process.env.SHOP_SITE_URL = `http://127.0.0.1:${port}`;

const handlers = new Map([
	["/api/content", require("../api/content.js")],
	["/api/shop-checkout", require("../api/shop-checkout.js")],
	["/api/shop-order", require("../api/shop-order.js")],
]);
const mimeTypes = {
	".css": "text/css; charset=utf-8",
	".gif": "image/gif",
	".html": "text/html; charset=utf-8",
	".ico": "image/x-icon",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".mp4": "video/mp4",
	".pdf": "application/pdf",
	".png": "image/png",
	".svg": "image/svg+xml",
	".webp": "image/webp",
	".woff": "font/woff",
	".woff2": "font/woff2",
};

const sendNotFound = (response) => {
	response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
	response.end("Not found");
};

const server = createServer(async (request, response) => {
	try {
		const pathname = new URL(request.url, "http://127.0.0.1").pathname;
		const handler = handlers.get(pathname);
		if (handler) return await handler(request, response);
		if (pathname === "/api" || pathname.startsWith("/api/")) return sendNotFound(response);
		if (!["GET", "HEAD"].includes(request.method)) {
			response.writeHead(405, { Allow: "GET, HEAD", "Cache-Control": "no-store" });
			return response.end("Method not allowed");
		}

		let relative;
		try { relative = decodeURIComponent(pathname === "/" ? "/index.html" : pathname); } catch { return sendNotFound(response); }
		const segments = relative.split(/[\\/]+/).filter(Boolean);
		if (segments.some((segment) => segment.startsWith("."))) return sendNotFound(response);
		const filePath = resolve(root, `.${relative.startsWith("/") ? relative : `/${relative}`}`);
		if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return sendNotFound(response);
		const realPath = await realpath(filePath);
		if (realPath !== root && !realPath.startsWith(`${root}${sep}`)) return sendNotFound(response);
		if (!(await stat(realPath)).isFile()) return sendNotFound(response);
		const bytes = await readFile(realPath);
		response.writeHead(200, {
			"Content-Type": mimeTypes[extname(realPath).toLowerCase()] || "application/octet-stream",
			"Cache-Control": "no-store",
			"Referrer-Policy": "no-referrer",
		});
		response.end(request.method === "HEAD" ? undefined : bytes);
	} catch (error) {
		if (error.code === "ENOENT" || error.code === "ENOTDIR" || error.code === "EACCES") return sendNotFound(response);
		if (!response.headersSent) response.writeHead(500, { "Cache-Control": "no-store" });
		response.end("Local request failed");
	}
});

server.requestTimeout = 30_000;
server.listen(port, "127.0.0.1", () => console.log(`Shop sandbox: http://127.0.0.1:${server.address().port}/prints.html`));
