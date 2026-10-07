const { json, readJson } = require("./http");
const { fail } = require("./prints");

const reply = (response, status, body, headers = {}) => json(response, status, body, { "Cache-Control": "no-store", ...headers });
const method = (request, response, expected) => {
	if (request.method === expected) return true;
	reply(response, 405, { error: "Method not allowed" }, { Allow: expected });
	return false;
};
const errorReply = (response, error) => {
	const status = [400, 403, 404, 409, 413, 503].includes(error.statusCode) ? error.statusCode : 503;
	reply(response, status, { error: status === 503 ? "Test checkout is unavailable. Please try again later." : error.message });
};
const smallJson = async (request) => {
	if (request.body && Buffer.byteLength(JSON.stringify(request.body)) > 4096) throw fail("Request body is too large", 413);
	return readJson(request, 4096);
};
const rawBody = async (request) => {
	// Vercel restores data/end events after its initial body read. The original
	// request's async iterator can already be ended, so use the restored events.
	// Never access the lazy parsed body getter while a raw stream is available.
	if (typeof request.on !== "function") {
		if (!Buffer.isBuffer(request.body) && typeof request.body !== "string") throw fail("Webhook requires the original request bytes", 400);
		const bytes = Buffer.from(request.body);
		if (bytes.length > 1_000_000) throw fail("Request body is too large", 413);
		return bytes;
	}
	return new Promise((resolve, reject) => {
		let length = 0;
		let settled = false;
		const chunks = [];
		const finish = (error) => {
			if (settled) return;
			settled = true;
			if (error) { chunks.length = 0; reject(error); }
			else resolve(Buffer.concat(chunks));
		};
		const onError = () => finish(fail("Could not read webhook bytes", 400));
		const onAborted = () => finish(fail("Webhook request was interrupted", 400));
		request.on("error", onError);
		request.on("aborted", onAborted);
		request.on("end", () => {
			finish();
			request.off("error", onError);
			request.off("aborted", onAborted);
		});
		request.on("data", (chunk) => {
			if (settled) return;
			const bytes = Buffer.from(chunk);
			length += bytes.length;
			if (length > 1_000_000) return finish(fail("Request body is too large", 413));
			chunks.push(bytes);
		});
	});
};
module.exports = { reply, method, errorReply, smallJson, rawBody };
