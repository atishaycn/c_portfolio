const { createHmac, randomUUID, timingSafeEqual } = require("node:crypto");

// A small fetch client for the few Stripe calls the Shop makes. The stripe SDK costs 7–16 ms of CPU per
// call on Workers, against a 10 ms Free-plan limit per request; a plain fetch costs about 1 ms.
const API = "https://api.stripe.com/v1";
const API_VERSION = "2026-09-30.endive";
const TIMEOUT_MS = 20_000;
const SIGNATURE_TOLERANCE_SECONDS = 300;
const RETRY_STATUSES = new Set([409, 429, 500, 502, 503, 504]);

const formEntries = (value, prefix, entries) => {
	if (value === undefined) return entries;
	if (value === null) {
		entries.push([prefix, ""]);
	} else if (Array.isArray(value)) {
		value.forEach((item, index) => formEntries(item, `${prefix}[${index}]`, entries));
	} else if (typeof value === "object") {
		for (const [key, item] of Object.entries(value)) formEntries(item, prefix ? `${prefix}[${key}]` : key, entries);
	} else {
		entries.push([prefix, String(value)]);
	}
	return entries;
};

const encodeForm = (params = {}) => new URLSearchParams(formEntries(params, "", [])).toString();

const stripeError = (status, body) => {
	const details = body?.error || {};
	const error = new Error(details.message || `Stripe request failed (${status}).`);
	error.type = details.type;
	error.code = details.code;
	error.statusCode = status;
	return error;
};

const createStripeClient = (secretKey, { fetchImpl = (...args) => fetch(...args) } = {}) => {
	const request = async (method, path, params, { idempotencyKey } = {}) => {
		const query = method === "GET" && params ? encodeForm(params) : "";
		const headers = { Authorization: `Bearer ${secretKey}`, "Stripe-Version": API_VERSION };
		let body;
		if (method === "POST") {
			headers["Content-Type"] = "application/x-www-form-urlencoded";
			// A key on every POST makes the single retry below safe.
			headers["Idempotency-Key"] = idempotencyKey || randomUUID();
			body = encodeForm(params);
		}
		const url = `${API}${path}${query ? `?${query}` : ""}`;
		for (let attempt = 0; ; attempt += 1) {
			let response;
			try {
				response = await fetchImpl(url, { method, headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
			} catch (error) {
				if (attempt === 0) continue;
				throw error;
			}
			const data = await response.json().catch(() => null);
			if (response.ok) return data;
			if (attempt === 0 && RETRY_STATUSES.has(response.status)) continue;
			throw stripeError(response.status, data);
		}
	};

	const id = (value) => encodeURIComponent(value);
	return {
		checkout: {
			sessions: {
				create: (params, options) => request("POST", "/checkout/sessions", params, options),
				retrieve: (sessionId, params) => request("GET", `/checkout/sessions/${id(sessionId)}`, params),
				update: (sessionId, params, options) => request("POST", `/checkout/sessions/${id(sessionId)}`, params, options),
				list: (params) => request("GET", "/checkout/sessions", params),
			},
		},
		refunds: {
			create: (params, options) => request("POST", "/refunds", params, options),
		},
		webhooks: {
			constructEventAsync: async (payload, header, secret, now = Date.now()) => constructEvent(payload, header, secret, now),
		},
	};
};

const constructEvent = (payload, header, secret, now = Date.now()) => {
	const text = Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload ?? "");
	const parts = String(header || "").split(",").map((part) => part.split("=", 2));
	const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
	const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value || "");
	if (!secret || !Number.isFinite(timestamp) || !signatures.length) throw new Error("Invalid Stripe signature header.");
	if (Math.abs(now / 1000 - timestamp) > SIGNATURE_TOLERANCE_SECONDS) throw new Error("Stripe signature is too old.");
	const expected = createHmac("sha256", secret).update(`${timestamp}.${text}`).digest();
	const matches = signatures.some((signature) => {
		const given = Buffer.from(signature, "hex");
		return given.length === expected.length && timingSafeEqual(given, expected);
	});
	if (!matches) throw new Error("Stripe signature does not match.");
	return JSON.parse(text);
};

module.exports = { API_VERSION, constructEvent, createStripeClient, encodeForm };
