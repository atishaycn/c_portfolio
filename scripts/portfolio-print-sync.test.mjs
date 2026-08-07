import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { requestShopifyClientCredentialsToken } from "./gelato-products.mjs";
import { acquireLock, runOnce } from "./portfolio-print-sync.mjs";

const tempPaths = () => {
	const directory = mkdtempSync(join(tmpdir(), "portfolio-print-sync-"));
	return {
		directory,
		stateFile: join(directory, "state.json"),
		snapshotFile: join(directory, "snapshot.json"),
		lockFile: join(directory, "sync.lock"),
	};
};

const responseFor = (revision) => ({
	ok: true,
	status: 200,
	json: async () => ({ revision, updatedAt: "2026-08-06T16:34:43.953Z", albums: [] }),
});

test("Shopify client credentials requests a token without logging credentials", async () => {
	let request;
	const token = await requestShopifyClientCredentialsToken({
		domain: "shop.clairethomas.art",
		clientId: "client-id",
		clientSecret: "client-secret",
		fetchImpl: async (url, options) => {
			request = { url, options };
			return { ok: true, status: 200, json: async () => ({ access_token: "token-not-printed", expires_in: 86400 }) };
		},
	});
	assert.equal(token, "token-not-printed");
	assert.equal(request.url, "https://shop.clairethomas.art/admin/oauth/access_token");
	assert.equal(request.options.method, "POST");
	assert.equal(new URLSearchParams(request.options.body).get("grant_type"), "client_credentials");
	assert.equal(new URLSearchParams(request.options.body).get("client_id"), "client-id");
});

test("marks a successful revision and skips only the same successful mode", async () => {
	const paths = tempPaths();
	try {
		let runs = 0;
		const runner = async () => {
			runs += 1;
		};
		const options = {
			...paths,
			fetchImpl: async () => responseFor(187),
			runner,
		};
		assert.equal((await runOnce(options)).status, "completed");
		assert.equal((await runOnce(options)).status, "skipped");
		assert.equal((await runOnce({ ...options, execute: true })).status, "completed");
		assert.equal(runs, 2);
	} finally {
		rmSync(paths.directory, { recursive: true, force: true });
	}
});

test("failed reconcile leaves the revision pending and retries it", async () => {
	const paths = tempPaths();
	try {
		let shouldFail = true;
		let runs = 0;
		const options = {
			...paths,
			fetchImpl: async () => responseFor(188),
			runner: async () => {
				runs += 1;
				if (shouldFail) throw new Error("simulated reconcile failure");
			},
		};
		await assert.rejects(runOnce(options), /simulated reconcile failure/);
		const failedState = JSON.parse(readFileSync(paths.stateFile, "utf8"));
		assert.equal(failedState.pendingRevision, "188");
		assert.equal(failedState.lastSuccessfulRevision, null);
		shouldFail = false;
		assert.equal((await runOnce(options)).status, "completed");
		assert.equal(runs, 2);
	} finally {
		rmSync(paths.directory, { recursive: true, force: true });
	}
});

test("lock prevents overlapping sync runs", async () => {
	const paths = tempPaths();
	try {
		const release = acquireLock(paths.lockFile);
		assert.equal((await runOnce({ ...paths, fetchImpl: async () => responseFor(189) })).status, "locked");
		release();
	} finally {
		rmSync(paths.directory, { recursive: true, force: true });
	}
});
