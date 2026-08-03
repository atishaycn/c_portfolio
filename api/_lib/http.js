const json = (response, status, body, headers = {}) => {
	response.statusCode = status;
	response.setHeader("Content-Type", "application/json; charset=utf-8");
	for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
	response.end(JSON.stringify(body));
};

const readJson = async (request, limit = 2_000_000) => {
	if (request.body && typeof request.body === "object") return request.body;
	let raw = "";
	for await (const chunk of request) {
		raw += chunk;
		if (Buffer.byteLength(raw) > limit) {
			const error = new Error("Request body is too large");
			error.statusCode = 413;
			throw error;
		}
	}
	if (!raw) return {};
	try {
		return JSON.parse(raw);
	} catch {
		const error = new Error("Invalid JSON");
		error.statusCode = 400;
		throw error;
	}
};

const allowedOrigin = (request) => {
	const origin = request.headers.origin;
	if (!origin) return true;
	const host = request.headers["x-forwarded-host"] || request.headers.host;
	if (!host) return false;
	try {
		return new URL(origin).host === host;
	} catch {
		return false;
	}
};

module.exports = { allowedOrigin, json, readJson };
