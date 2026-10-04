const { allowedOrigin, json, readJson } = require("./_lib/http");
const { buildInquiryEmail, createRateLimiter, parseInquiry, sendWithResend } = require("./_lib/inquiry");

const allow = createRateLimiter();

const clientKey = (request) =>
	String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown")
		.split(",")[0]
		.trim();

const createHandler = ({ fetchImpl = fetch, env = process.env, rateLimit = allow } = {}) =>
	async (request, response) => {
		if (request.method !== "POST") {
			response.setHeader("Allow", "POST");
			return json(response, 405, { error: "Method not allowed" });
		}
		if (!allowedOrigin(request)) return json(response, 403, { error: "Invalid origin" });

		try {
			const body = await readJson(request, 20_000);
			// Hidden field people never see; bots that fill it get a quiet success.
			if (String(body.website || "").trim()) return json(response, 200, { sent: true });
			if (!rateLimit(clientKey(request))) {
				return json(response, 429, { error: "Too many inquiries from this connection. Please try again later." });
			}

			const parsed = parseInquiry(body);
			if (!parsed.ok) return json(response, 400, { error: "Please check the highlighted fields.", fields: parsed.errors });

			const apiKey = env.RESEND_API_KEY;
			if (!apiKey) return json(response, 503, { error: "Inquiries can't be sent right now.", fallback: true });

			await sendWithResend({
				apiKey,
				from: env.INQUIRY_FROM || "Claire Thomas website <website@clairethomas.art>",
				to: env.INQUIRY_TO || "contact@clairethomas.art",
				email: buildInquiryEmail(parsed.inquiry),
				fetchImpl,
			});
			return json(response, 200, { sent: true });
		} catch (error) {
			if (error.statusCode === 400 || error.statusCode === 413) return json(response, error.statusCode, { error: error.message });
			console.error("Inquiry send failed:", error.message);
			return json(response, 502, { error: "Inquiries can't be sent right now.", fallback: true });
		}
	};

module.exports = createHandler();
module.exports.createHandler = createHandler;
