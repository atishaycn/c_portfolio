const {
	adminEmails,
	clearSessionCookie,
	createLoginToken,
	createSession,
	loginWindowIndex,
	requireSession,
	sessionCookie,
	verifyLoginToken,
	verifySession,
} = require("../_lib/auth");
const { allowedOrigin, json, readJson } = require("../_lib/http");
const { sendWithResend } = require("../_lib/inquiry");

const LOCAL_HOST = /^(localhost|127\.0\.0\.1)(:\d+)?$/;
const FROM = "Claire Thomas website <website@clairethomas.art>";

const requestHost = (request) => request.headers["x-forwarded-host"] || request.headers.host || "";

const loginEmail = (link) => ({
	subject: "Your Claire Thomas admin sign-in link",
	text: [
		"Sign in to the portfolio admin:",
		"",
		link,
		"",
		"It expires in about 30 minutes. If you did not ask for it, ignore this email.",
	].join("\n"),
});

const withIdempotencyKey = (fetchImpl, key) => (url, options) =>
	fetchImpl(url, {
		...options,
		headers: { ...options.headers, "Idempotency-Key": key },
	});

// The emailed link's origin comes from configuration, never from the request's Host header, which a non-browser client can forge.
// Local development without ADMIN_SITE_URL links back to the local host.
const linkOrigin = (local, host) => {
	const configured = String(process.env.ADMIN_SITE_URL || "").trim();
	if (!configured) return local ? `http://${host}` : null;
	try {
		const url = new URL(configured);
		if (url.protocol !== "https:" && !LOCAL_HOST.test(url.host)) return null;
		return url.origin;
	} catch {
		return null;
	}
};

// Every email gets the same answer, so the response never shows whether it is the admin's.
const requestLink = async ({ request, response, body, fetchImpl, now }) => {
	const email = String(body.email || "").trim().toLowerCase();
	if (!adminEmails().includes(email)) return json(response, 200, { sent: true });

	const host = requestHost(request);
	const local = LOCAL_HOST.test(host);
	const origin = linkOrigin(local, host);
	if (!origin) {
		console.error("Admin sign-in link not sent: ADMIN_SITE_URL is missing or invalid");
		return json(response, 200, { sent: true });
	}
	const link = `${origin}/admin.html#login=${createLoginToken(email, now)}`;
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) {
		if (local) return json(response, 200, { sent: true, devLink: link });
		console.error("Admin sign-in link not sent: RESEND_API_KEY is missing");
		return json(response, 200, { sent: true });
	}
	try {
		await sendWithResend({
			apiKey,
			from: process.env.INQUIRY_FROM || FROM,
			to: email,
			email: loginEmail(link),
			fetchImpl: withIdempotencyKey(fetchImpl, `admin-login/${email}/${loginWindowIndex(now)}`),
		});
	} catch (error) {
		console.error("Admin sign-in link send failed:", error.message);
	}
	return json(response, 200, { sent: true });
};

const redeemLink = (response, token, now) => {
	const login = verifyLoginToken(token, now);
	if (!login) {
		return json(response, 401, { error: "This sign-in link is invalid or has expired. Ask for a new one." });
	}
	const sessionToken = createSession(String(login.email).toLowerCase());
	response.setHeader("Set-Cookie", sessionCookie(sessionToken));
	const session = verifySession({
		headers: { cookie: `ct_admin=${encodeURIComponent(sessionToken)}` },
	});
	return json(response, 200, {
		authenticated: true,
		csrf: session.csrf,
		email: session.email,
	});
};

const createHandler = ({ fetchImpl = fetch, now = () => Date.now() } = {}) =>
	async (request, response) => {
		try {
			if (request.method === "GET") {
				const session = verifySession(request);
				return json(response, 200, {
					authenticated: Boolean(session),
					csrf: session?.csrf || null,
					email: session?.email || null,
				});
			}
			if (request.method === "DELETE") {
				requireSession(request);
				if (!allowedOrigin(request)) return json(response, 403, { error: "Invalid origin" });
				response.setHeader("Set-Cookie", clearSessionCookie());
				return json(response, 200, { authenticated: false });
			}
			if (request.method !== "POST") {
				response.setHeader("Allow", "GET, POST, DELETE");
				return json(response, 405, { error: "Method not allowed" });
			}
			if (!allowedOrigin(request)) return json(response, 403, { error: "Invalid origin" });
			const body = await readJson(request, 20_000);
			if (body.action === "request-link") {
				return await requestLink({ request, response, body, fetchImpl, now: now() });
			}
			if (body.action === "redeem") {
				return redeemLink(response, body.token, now());
			}
			return json(response, 400, { error: "Unknown action" });
		} catch (error) {
			console.error(error);
			return json(response, error.statusCode || 500, {
				error: error.statusCode ? error.message : "Unable to sign in",
			});
		}
	};

module.exports = createHandler();
module.exports.createHandler = createHandler;
