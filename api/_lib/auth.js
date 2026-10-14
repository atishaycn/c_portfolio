const { createHmac, timingSafeEqual } = require("node:crypto");

const COOKIE_NAME = "ct_admin";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_PURPOSE = "login";

const base64UrlEncode = (value) => Buffer.from(value).toString("base64url");
const base64UrlDecode = (value) => Buffer.from(value, "base64url").toString("utf8");

const sign = (value) =>
	createHmac("sha256", process.env.ADMIN_SESSION_SECRET || "")
		.update(value)
		.digest("base64url");

const parseCookies = (request) =>
	Object.fromEntries(
		String(request.headers.cookie || "")
			.split(";")
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part) => {
				const separator = part.indexOf("=");
				return separator === -1
					? [part, ""]
					: [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
			}),
	);

const loginWindowIndex = (now = Date.now()) => Math.floor(now / LOGIN_WINDOW_MS);

// `now` is epoch milliseconds. The link expires at the end of the window after the current one,
// so it lives 15 to 30 minutes.
const createLoginToken = (email, now = Date.now()) => {
	if (!process.env.ADMIN_SESSION_SECRET) throw new Error("ADMIN_SESSION_SECRET is not set");
	const exp = ((loginWindowIndex(now) + 2) * LOGIN_WINDOW_MS) / 1000;
	const payload = base64UrlEncode(
		JSON.stringify({
			purpose: LOGIN_PURPOSE,
			email: String(email).trim().toLowerCase(),
			exp,
		}),
	);
	return `${payload}.${sign(payload)}`;
};

const verifyLoginToken = (token, now = Date.now()) => {
	if (!process.env.ADMIN_SESSION_SECRET || typeof token !== "string") return null;
	const [payload, signature, extra] = token.split(".");
	if (!payload || !signature || extra !== undefined) return null;
	const expected = Buffer.from(sign(payload));
	const actual = Buffer.from(signature);
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
	try {
		const login = JSON.parse(base64UrlDecode(payload));
		const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
		if (
			login.purpose !== LOGIN_PURPOSE ||
			typeof login.exp !== "number" ||
			login.exp <= Math.floor(now / 1000) ||
			!adminEmail ||
			String(login.email || "").toLowerCase() !== adminEmail
		) {
			return null;
		}
		return login;
	} catch {
		return null;
	}
};

const createSession = (email) => {
	const payload = base64UrlEncode(
		JSON.stringify({
			email,
			csrf: base64UrlEncode(require("node:crypto").randomBytes(24)),
			exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
		}),
	);
	return `${payload}.${sign(payload)}`;
};

const verifySession = (request) => {
	const secret = process.env.ADMIN_SESSION_SECRET;
	if (!secret) return null;
	const token = parseCookies(request)[COOKIE_NAME];
	if (!token) return null;
	const [payload, signature] = token.split(".");
	if (!payload || !signature) return null;
	const expected = sign(payload);
	const signatureBuffer = Buffer.from(signature);
	const expectedBuffer = Buffer.from(expected);
	if (
		signatureBuffer.length !== expectedBuffer.length ||
		!timingSafeEqual(signatureBuffer, expectedBuffer)
	) {
		return null;
	}
	try {
		const session = JSON.parse(base64UrlDecode(payload));
		if (
			session.purpose === LOGIN_PURPOSE ||
			session.exp < Math.floor(Date.now() / 1000) ||
			session.email !== process.env.ADMIN_EMAIL
		) {
			return null;
		}
		return session;
	} catch {
		return null;
	}
};

const requireSession = (request) => {
	const session = verifySession(request);
	if (!session) {
		const error = new Error("Authentication required");
		error.statusCode = 401;
		throw error;
	}
	if (
		request.method !== "GET" &&
		request.method !== "HEAD" &&
		request.headers["x-csrf-token"] !== session.csrf
	) {
		const error = new Error("Invalid request token");
		error.statusCode = 403;
		throw error;
	}
	return session;
};

const sessionCookie = (token) =>
	`${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;

const clearSessionCookie = () =>
	`${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

module.exports = {
	clearSessionCookie,
	createLoginToken,
	createSession,
	loginWindowIndex,
	requireSession,
	sessionCookie,
	verifyLoginToken,
	verifySession,
};
