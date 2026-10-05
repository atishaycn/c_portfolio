const { createConvex } = require("./_lib/convex");
const { allowedOrigin, json, readJson } = require("./_lib/http");
const { createRateLimiter, sendWithResend } = require("./_lib/inquiry");
const { buildSubmitEmail } = require("./_lib/intake-email");
const { hashToken, isToken, siteOrigin } = require("./_lib/intake-link");

// The client's intake page talks only to this function. The link token is the only credential.

const allowRequest = createRateLimiter({ limit: 600, windowMs: 10 * 60 * 1000 });
const allowMiss = createRateLimiter({ limit: 30, windowMs: 10 * 60 * 1000 });

const clientKey = (request) =>
	String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown")
		.split(",")[0]
		.trim();

const CLOSED = { error: "This intake has closed. Please contact Claire for a new link.", closed: true };

const createHandler = ({ fetchImpl = fetch, env = process.env, rateLimit = allowRequest, missLimit = allowMiss } = {}) => {
	const convex = createConvex({ env, fetchImpl });

	const notifyClaire = async (request, submitted) => {
		if (!env.RESEND_API_KEY) return console.warn("Intake submitted, but RESEND_API_KEY is not set; no email sent.");
		try {
			await sendWithResend({
				apiKey: env.RESEND_API_KEY,
				from: env.INQUIRY_FROM || "Claire Thomas website <website@clairethomas.art>",
				to: env.INTAKE_NOTIFY_TO || env.INQUIRY_TO || "contact@clairethomas.art",
				email: buildSubmitEmail(submitted, `${siteOrigin(request, env)}/intake-admin.html#intake=${submitted.intakeId}`),
				fetchImpl,
			});
		} catch (error) {
			// The client's answers are saved either way; a failed email must not fail their submit.
			console.error("Intake email failed:", error.message);
		}
	};

	const handle = async (request, response) => {
		const key = clientKey(request);
		if (!rateLimit(key)) return json(response, 429, { error: "Too many requests. Please wait a few minutes." });

		const params = new URL(request.url, "http://local").searchParams;
		const body = request.method === "POST" ? await readJson(request, 50_000) : {};
		const token = String(request.method === "POST" ? body.token : params.get("token"));
		if (!isToken(token)) return json(response, 404, CLOSED);
		const tokenHash = hashToken(token);

		if (request.method === "GET") {
			const op = params.get("op");
			if (op === "image") {
				const url = await convex.query("client:poseImageUrl", { tokenHash, poseId: String(params.get("pose") || "") });
				if (!url) return json(response, 404, { error: "Image not found" });
				const upstream = await fetchImpl(url);
				if (!upstream.ok) return json(response, 502, { error: "Image unavailable" });
				response.statusCode = 200;
				response.setHeader("Content-Type", upstream.headers.get("content-type") || "image/webp");
				response.setHeader("Cache-Control", "private, max-age=86400");
				return response.end(Buffer.from(await upstream.arrayBuffer()));
			}
			if (op !== "view") return json(response, 400, { error: "Unknown action" });
			const view = await convex.query("client:view", { tokenHash });
			if (!view) {
				if (!missLimit(key)) return json(response, 429, { error: "Too many requests. Please wait a few minutes." });
				return json(response, 404, CLOSED);
			}
			return json(response, 200, view);
		}

		if (request.method !== "POST") {
			response.setHeader("Allow", "GET, POST");
			return json(response, 405, { error: "Method not allowed" });
		}
		if (!allowedOrigin(request)) return json(response, 403, { error: "Invalid origin" });

		const { op } = body;
		if (op === "swipe") {
			const choice = body.choice === null ? null : String(body.choice);
			await convex.mutation("client:swipe", { tokenHash, deckKey: String(body.deckKey), choice });
		} else if (op === "answer") {
			const value = Array.isArray(body.value) ? body.value.map(String).slice(0, 50) : String(body.value ?? "");
			await convex.mutation("client:answer", { tokenHash, questionKey: String(body.questionKey), value });
		} else if (op === "posesNote") {
			await convex.mutation("client:posesNote", { tokenHash, text: String(body.text ?? "") });
		} else if (op === "submit") {
			const submitted = await convex.mutation("client:submit", { tokenHash });
			if (!submitted.ok) return json(response, 400, { error: "A few things still need an answer.", missing: submitted.missing });
			await notifyClaire(request, submitted);
		} else {
			return json(response, 400, { error: "Unknown action" });
		}
		return json(response, 200, { saved: true });
	};

	return async (request, response) => {
		response.setHeader("X-Robots-Tag", "noindex, nofollow");
		response.setHeader("Referrer-Policy", "no-referrer");
		try {
			return await handle(request, response);
		} catch (error) {
			if (/has closed/.test(error.message)) return json(response, 410, CLOSED);
			if (!error.statusCode || error.statusCode >= 500) console.error("Intake request failed:", error.message);
			return json(response, error.statusCode || 500, { error: error.statusCode ? error.message : "Something went wrong. Please try again." });
		}
	};
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
