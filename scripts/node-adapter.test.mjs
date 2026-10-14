import assert from "node:assert/strict";
import { test } from "node:test";
import { runNodeHandler } from "../worker/node-adapter.mjs";

test("gives a Node handler the parsed JSON body, method, path with query, and host", async () => {
	const handler = async (request, response) => {
		let raw = "";
		for await (const chunk of request) raw += chunk;
		response.statusCode = 201;
		response.setHeader("Content-Type", "application/json; charset=utf-8");
		response.end(JSON.stringify({ method: request.method, url: request.url, host: request.headers.host, body: JSON.parse(raw) }));
	};
	const response = await runNodeHandler(handler, new Request("https://site.example/api/echo?x=1", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ a: 1 }),
	}));
	assert.equal(response.status, 201);
	assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
	assert.deepEqual(await response.json(), { method: "POST", url: "/api/echo?x=1", host: "site.example", body: { a: 1 } });
});

test("reads the raw bytes with on('data') and on('end')", async () => {
	const handler = (request, response) => {
		const chunks = [];
		request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
		request.on("end", () => response.end(Buffer.concat(chunks)));
	};
	const bytes = Buffer.from([0, 1, 2, 255]);
	const response = await runNodeHandler(handler, new Request("https://site.example/api/raw", { method: "POST", body: bytes }));
	assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
});

test("applies writeHead with headers, then end", async () => {
	const handler = (request, response) => {
		response.writeHead(418, { "Content-Type": "text/plain; charset=utf-8", "X-Brewed": "yes" });
		response.end("teapot");
	};
	const response = await runNodeHandler(handler, new Request("https://site.example/api/tea"));
	assert.equal(response.status, 418);
	assert.equal(response.headers.get("x-brewed"), "yes");
	assert.equal(await response.text(), "teapot");
});

test("keeps multiple setHeader calls and array values such as Set-Cookie", async () => {
	const handler = (request, response) => {
		response.setHeader("Set-Cookie", ["ct_admin=abc; Path=/", "other=1; Path=/"]);
		response.setHeader("Cache-Control", "no-store");
		response.setHeader("X-Frame-Options", "DENY");
		response.end("ok");
	};
	const response = await runNodeHandler(handler, new Request("https://site.example/api/cookies"));
	assert.deepEqual(response.headers.getSetCookie(), ["ct_admin=abc; Path=/", "other=1; Path=/"]);
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.equal(response.headers.get("x-frame-options"), "DENY");
});

test("answers 500 when a handler throws or never ends its response", async () => {
	const thrower = async () => { throw new Error("boom"); };
	const silent = (request, response) => response.setHeader("X-Silent", "1");
	for (const handler of [thrower, silent]) {
		const response = await runNodeHandler(handler, new Request("https://site.example/api/bad"), { timeoutMs: 20 });
		assert.equal(response.status, 500);
		assert.deepEqual(await response.json(), { error: "Internal error" });
	}
});
