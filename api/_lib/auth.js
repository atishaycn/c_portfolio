const {
	createHmac,
	scryptSync,
	timingSafeEqual,
} = require("node:crypto");

const COOKIE_NAME = "ct_admin";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

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

const verifyPassword = (password) => {
	const [salt, expectedHex] = String(process.env.ADMIN_PASSWORD_HASH || "").split(":");
	if (!salt || !expectedHex || !password) return false;
	const actual = scryptSync(password, salt, 64);
	const expected = Buffer.from(expectedHex, "hex");
	return expected.length === actual.length && timingSafeEqual(actual, expected);
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
	createSession,
	requireSession,
	sessionCookie,
	verifyPassword,
	verifySession,
};
