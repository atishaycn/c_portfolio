import content from "../api/content.js";
import inquiry from "../api/inquiry.js";
import shopCatalog from "../api/shop-catalog.js";
import shopCheckout from "../api/shop-checkout.js";
import shopOrder from "../api/shop-order.js";
import stripeWebhook from "../api/stripe-webhook.js";
import adminContent from "../api/admin/content.js";
import adminEmptyTrash from "../api/admin/empty-trash.js";
import adminSession from "../api/admin/session.js";
import adminShopOrders from "../api/admin/shop-orders.js";
import adminShopSync from "../api/admin/shop-sync.js";
import adminUploadSignature from "../api/admin/upload-signature.js";
import { runNodeHandler } from "./node-adapter.mjs";

// Keys are Vercel's function paths. Every file under api/ is listed here: bundling needs static imports.
const routes = new Map([
	["/api/content", content],
	["/api/inquiry", inquiry],
	["/api/shop-catalog", shopCatalog],
	["/api/shop-checkout", shopCheckout],
	["/api/shop-order", shopOrder],
	["/api/stripe-webhook", stripeWebhook],
	["/api/admin/content", adminContent],
	["/api/admin/empty-trash", adminEmptyTrash],
	["/api/admin/session", adminSession],
	["/api/admin/shop-orders", adminShopOrders],
	["/api/admin/shop-sync", adminShopSync],
	["/api/admin/upload-signature", adminUploadSignature],
]);

// Worker responses do not get the _headers file, so the vercel.json /api/* headers are set here.
const apiHeaders = {
	"Cache-Control": "no-store",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "same-origin",
};

// The Shop is open only on the hosts in SHOP_OPEN_HOSTS (the workers.dev test address until release).
// Elsewhere the catalog answers { open: false }, so the store page shows "Coming soon", and checkout does not exist.
const closedShopRoutes = new Set(["/api/shop-checkout", "/api/shop-order"]);
const shopOpen = (hostname, env) =>
	String(env.SHOP_OPEN_HOSTS || "").split(",").map((host) => host.trim()).filter(Boolean).includes(hostname);

const notFound = () => new Response(JSON.stringify({ error: "Not found" }), {
	status: 404,
	headers: { "Content-Type": "application/json; charset=utf-8", ...apiHeaders },
});

export default {
	async fetch(request, env) {
		const { hostname, pathname } = new URL(request.url);
		// html_handling is "none" so /x.html is served as-is like Vercel; the root directory index is mapped here.
		if (pathname === "/") return env.ASSETS.fetch(new URL("/index.html", request.url));
		if (pathname !== "/api" && !pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

		if (!shopOpen(hostname, env)) {
			if (pathname === "/api/shop-catalog") {
				return new Response(JSON.stringify({ open: false }), {
					headers: { "Content-Type": "application/json; charset=utf-8", ...apiHeaders },
				});
			}
			if (closedShopRoutes.has(pathname)) return notFound();
		}

		const handler = routes.get(pathname);
		if (!handler) return notFound();
		const response = await runNodeHandler(handler, request);
		for (const [name, value] of Object.entries(apiHeaders)) {
			if (!response.headers.has(name)) response.headers.set(name, value);
		}
		return response;
	},
};
