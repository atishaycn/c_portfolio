const { createCipheriv, createDecipheriv, createHash, randomBytes } = require("node:crypto");

// An intake link token is 32 random bytes. Convex stores its SHA-256 hash for lookup and an
// AES-GCM copy encrypted with INTAKE_LINK_KEY, which only Vercel has, so "Copy link" keeps working
// without a database leak exposing working links.

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const createToken = () => randomBytes(32).toString("base64url");

const isToken = (value) => TOKEN_PATTERN.test(String(value || ""));

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

const linkKey = (env) => {
	const key = Buffer.from(String(env.INTAKE_LINK_KEY || ""), "base64");
	if (key.length !== 32) {
		const error = new Error("Intake links are not configured");
		error.statusCode = 503;
		throw error;
	}
	return key;
};

const encryptToken = (token, env = process.env) => {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", linkKey(env), iv);
	const sealed = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
	return [iv, cipher.getAuthTag(), sealed].map((part) => part.toString("base64url")).join(".");
};

const decryptToken = (value, env = process.env) => {
	const [iv, tag, sealed] = String(value || "").split(".").map((part) => Buffer.from(part, "base64url"));
	const decipher = createDecipheriv("aes-256-gcm", linkKey(env), iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(sealed), decipher.final()]).toString("utf8");
};

/** A fresh token with everything Convex needs to store. */
const issueToken = (env = process.env) => {
	const token = createToken();
	return { token, tokenHash: hashToken(token), tokenCipher: encryptToken(token, env) };
};

const siteOrigin = (request, env = process.env) => {
	if (env.INTAKE_SITE_ORIGIN) return env.INTAKE_SITE_ORIGIN.replace(/\/$/, "");
	const host = request.headers["x-forwarded-host"] || request.headers.host || "clairethomas.art";
	const proto = request.headers["x-forwarded-proto"] || (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
	return `${proto}://${host}`;
};

const intakeUrl = (request, token, env = process.env) => `${siteOrigin(request, env)}/intake/${token}`;

module.exports = { createToken, decryptToken, encryptToken, hashToken, intakeUrl, isToken, issueToken, siteOrigin };
