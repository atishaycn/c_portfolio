import { Readable } from "node:stream";

const NO_BODY_STATUS = new Set([204, 304]);

const toBuffer = (chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(typeof chunk === "string" ? chunk : Uint8Array.from(chunk)));

class NodeResponse {
	statusCode = 200;
	headersSent = false;
	finished = false;
	#headers = new Map();
	#chunks = [];
	onFinish = null;

	setHeader(name, value) {
		this.#headers.set(name.toLowerCase(), { name, value });
	}

	getHeader(name) {
		return this.#headers.get(name.toLowerCase())?.value;
	}

	removeHeader(name) {
		this.#headers.delete(name.toLowerCase());
	}

	writeHead(status, headers = {}) {
		this.statusCode = status;
		for (const [name, value] of Object.entries(headers)) this.setHeader(name, value);
		this.headersSent = true;
		return this;
	}

	write(chunk) {
		this.headersSent = true;
		if (chunk !== undefined && chunk !== null) this.#chunks.push(toBuffer(chunk));
		return true;
	}

	end(chunk) {
		if (this.finished) return this;
		this.write(chunk);
		this.finished = true;
		this.onFinish?.();
		return this;
	}

	toResponse() {
		const headers = new Headers();
		for (const { name, value } of this.#headers.values()) {
			for (const item of Array.isArray(value) ? value : [value]) headers.append(name, String(item));
		}
		const body = NO_BODY_STATUS.has(this.statusCode) ? null : Buffer.concat(this.#chunks);
		return new Response(body, { status: this.statusCode, headers });
	}
}

const toNodeRequest = async (request) => {
	const url = new URL(request.url);
	const hasBody = !["GET", "HEAD"].includes(request.method);
	const bytes = hasBody ? Buffer.from(await request.arrayBuffer()) : Buffer.alloc(0);
	const headers = Object.fromEntries([...request.headers].map(([name, value]) => [name.toLowerCase(), value]));
	headers.host = url.host;
	const nodeRequest = Readable.from(bytes.length ? [bytes] : []);
	Object.assign(nodeRequest, {
		method: request.method,
		url: `${url.pathname}${url.search}`,
		headers,
	});
	return nodeRequest;
};

const finishOrTimeout = (response, timeoutMs) => new Promise((resolve) => {
	const timer = setTimeout(resolve, timeoutMs);
	response.onFinish = () => {
		clearTimeout(timer);
		resolve();
	};
	if (response.finished) response.onFinish();
});

// Runs a Vercel-style (req, res) handler inside a Fetch handler. Resolves to the Response the handler wrote.
// Handlers may end the response from a stream event after they return, so the adapter waits up to timeoutMs.
export const runNodeHandler = async (handler, request, { timeoutMs = 25_000 } = {}) => {
	const nodeRequest = await toNodeRequest(request);
	const nodeResponse = new NodeResponse();
	let threw = false;
	try {
		await handler(nodeRequest, nodeResponse);
	} catch {
		threw = true;
	}
	if (!threw && !nodeResponse.finished) await finishOrTimeout(nodeResponse, timeoutMs);
	if (!nodeResponse.finished) {
		nodeResponse.writeHead(500, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
		nodeResponse.end(JSON.stringify({ error: "Internal error" }));
	}
	return nodeResponse.toResponse();
};
