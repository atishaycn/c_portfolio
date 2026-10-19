import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { apiRequest, waitForProducts } from "./gelato-products.mjs";

const quietLogs = () => {
	mock.method(console, "log", () => {});
	mock.method(console, "warn", () => {});
};

// Regression: 9da1939 (a network-failed GET is retried with backoff; the attempt budget is seven)
test("retries a network-failed Gelato GET with backoff and gives up after seven attempts", async () => {
	quietLogs();
	const delays = [];
	let calls = 0;
	try {
		await assert.rejects(
			apiRequest("/stores/s/products", {}, {
				fetchImpl: async () => {
					calls += 1;
					throw new TypeError("fetch failed");
				},
				sleepImpl: async (delay) => {
					delays.push(delay);
				},
			}),
			/fetch failed/,
		);
	} finally {
		mock.restoreAll();
	}
	assert.equal(calls, 7);
	assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000, 30000]);
});

// Regression: 8468640 (JSON 429 backoff without Retry-After is capped at five minutes)
test("caps Gelato 429 backoff at five minutes", async () => {
	const originalWindow = process.env.GELATO_429_MAX_ATTEMPTS;
	delete process.env.GELATO_429_MAX_ATTEMPTS;
	quietLogs();
	const delays = [];
	let calls = 0;
	try {
		const result = await apiRequest("/stores/s/products", {}, {
			fetchImpl: async () => {
				calls += 1;
				if (calls <= 12) {
					return { ok: false, status: 429, headers: { get: () => null }, text: async () => "{}" };
				}
				return { ok: true, status: 200, headers: { get: () => null }, text: async () => '{"ok":true}' };
			},
			sleepImpl: async (delay) => {
				delays.push(delay);
			},
		});
		assert.deepEqual(result, { ok: true });
	} finally {
		mock.restoreAll();
		if (originalWindow === undefined) delete process.env.GELATO_429_MAX_ATTEMPTS;
		else process.env.GELATO_429_MAX_ATTEMPTS = originalWindow;
	}
	assert.equal(delays.length, 12);
	assert.equal(delays[8], 256 * 1000);
	assert.deepEqual(delays.slice(9), [300000, 300000, 300000]);
});

// Regression: 4595d6c, 21973be (reads get a five-minute budget and creates a fifteen-minute budget)
test("gives Gelato reads five minutes and POST requests fifteen minutes before aborting", async () => {
	const budgets = [];
	mock.method(AbortSignal, "timeout", (ms) => {
		budgets.push(ms);
		return new AbortController().signal;
	});
	const fetchImpl = async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => "{}" });
	try {
		await apiRequest("/stores/s/products", {}, { fetchImpl });
		await apiRequest("/stores/s/products", { method: "POST", body: "{}" }, { fetchImpl });
	} finally {
		mock.restoreAll();
	}
	assert.deepEqual(budgets, [5 * 60 * 1000, 15 * 60 * 1000]);
});

// Regression: 84e78be (a publishing batch with no progress fails at the stall window instead of waiting out the deadline)
test("fails a Gelato publishing batch that makes no progress within the stall window", async () => {
	quietLogs();
	const state = { products: { k1: { id: "p1" } } };
	let polls = 0;
	try {
		await assert.rejects(
			waitForProducts("store", [{ key: "k1" }], state, {
				timeoutMs: 60 * 1000,
				pollIntervalMs: 1,
				stallTimeoutMs: 30,
				apiRequestImpl: async () => {
					polls += 1;
					return { status: "publishing", externalId: "e1", title: "Photo" };
				},
				writeStateImpl: () => {},
			}),
			/Publishing stalled waiting for 1 Gelato products/,
		);
	} finally {
		mock.restoreAll();
	}
	assert.ok(polls >= 1);
});
