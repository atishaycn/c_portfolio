// Calls Convex functions over its HTTP API. Browsers never do this (ADR 0001);
// only Vercel functions, which add the shared secret to every call.

const createConvex = ({ env = process.env, fetchImpl = fetch } = {}) => {
	const call = async (kind, path, args = {}) => {
		const url = env.CONVEX_URL;
		const secret = env.INTAKE_CONVEX_SECRET;
		if (!url || !secret) {
			const error = new Error("Intake storage is not configured");
			error.statusCode = 503;
			throw error;
		}
		const response = await fetchImpl(`${url.replace(/\/$/, "")}/api/${kind}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path, args: { secret, ...args }, format: "json" }),
		});
		const body = await response.json().catch(() => ({}));
		if (!response.ok || body.status !== "success") {
			// Convex wraps thrown errors as "Uncaught Error: <message>" plus a stack; keep the message.
			const message = String(body.errorMessage || `Convex responded ${response.status}`);
			const error = new Error(message.match(/Uncaught Error: ([^\n]+)/)?.[1] || message.split("\n")[0]);
			error.statusCode = 400;
			error.convex = true;
			throw error;
		}
		return body.value;
	};
	return {
		query: (path, args) => call("query", path, args),
		mutation: (path, args) => call("mutation", path, args),
	};
};

module.exports = { createConvex };
