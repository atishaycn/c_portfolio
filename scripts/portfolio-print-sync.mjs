#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	closeSync,
	existsSync,
	openSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const CMS_URL = "https://clairethomas.art/api/content";
const GELATO_SCRIPT = resolve(ROOT, "scripts", "gelato-products.mjs");
const STATE_FILE = resolve(ROOT, ".portfolio-print-sync-state.json");
const SNAPSHOT_FILE = resolve(ROOT, ".portfolio-print-sync-content.json");
const LOCK_FILE = resolve(ROOT, ".portfolio-print-sync.lock");

const parseArgs = (argv) => {
	const args = {
		execute: false,
		cmsUrl: process.env.PORTFOLIO_CONTENT_URL || CMS_URL,
		stateFile: process.env.PORTFOLIO_PRINT_SYNC_STATE_FILE || STATE_FILE,
		snapshotFile: process.env.PORTFOLIO_PRINT_SYNC_CONTENT_FILE || SNAPSHOT_FILE,
		lockFile: process.env.PORTFOLIO_PRINT_SYNC_LOCK_FILE || LOCK_FILE,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--execute") args.execute = true;
		else if (arg === "--cms-url") args.cmsUrl = argv[++index];
		else if (arg === "--state-file") args.stateFile = resolve(argv[++index]);
		else if (arg === "--snapshot-file") args.snapshotFile = resolve(argv[++index]);
		else if (arg === "--lock-file") args.lockFile = resolve(argv[++index]);
		else if (arg === "--help") args.help = true;
		else throw new Error(`Unknown argument: ${arg}`);
	}
	return args;
};

const printHelp = () => {
	console.log(`Usage:
  node scripts/portfolio-print-sync.mjs
  node scripts/portfolio-print-sync.mjs --execute

Fetches the public CMS once and runs a dry-run reconcile by default.
--execute enables Gelato creation and Shopify archive/update mutations.`);
};

const readState = (file) => {
	if (!existsSync(file)) {
		return {
			version: 1,
			lastSuccessfulRevision: null,
			lastSuccessfulMode: null,
			pendingRevision: null,
			pendingMode: null,
		};
	}
	return JSON.parse(readFileSync(file, "utf8"));
};

const writeJsonAtomic = (file, value) => {
	const temporaryFile = `${file}.${process.pid}.tmp`;
	writeFileSync(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
	renameSync(temporaryFile, file);
};

const acquireLock = (file) => {
	let descriptor;
	try {
		descriptor = openSync(file, "wx", 0o600);
		writeFileSync(descriptor, `${process.pid}\n`);
		closeSync(descriptor);
	} catch (error) {
		if (descriptor !== undefined) closeSync(descriptor);
		if (error.code === "EEXIST") return null;
		throw error;
	}
	return () => {
		try {
			unlinkSync(file);
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	};
};

const fetchCmsContent = async (url, fetchImpl = fetch) => {
	const response = await fetchImpl(url, {
		headers: { Accept: "application/json", "Cache-Control": "no-cache" },
		signal: AbortSignal.timeout(30 * 1000),
	});
	if (!response.ok) throw new Error(`CMS request failed with HTTP ${response.status}`);
	const content = await response.json();
	assert(Array.isArray(content.albums), "CMS response must contain albums");
	assert(content.revision !== undefined && content.revision !== null, "CMS response must contain revision");
	return content;
};

const runReconcile = ({ snapshotFile, execute }) => {
	const args = [GELATO_SCRIPT, "--reconcile", "--content-file", snapshotFile];
	if (execute) args.push("--execute");
	const result = spawnSync(process.execPath, args, { cwd: ROOT, stdio: "inherit" });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`reconcile exited with code ${result.status ?? "unknown"}`);
};

const runOnce = async ({
	execute = false,
	cmsUrl = CMS_URL,
	stateFile = STATE_FILE,
	snapshotFile = SNAPSHOT_FILE,
	lockFile = LOCK_FILE,
	fetchImpl = fetch,
	runner = runReconcile,
	now = () => new Date().toISOString(),
} = {}) => {
	const release = acquireLock(lockFile);
	if (!release) return { status: "locked" };
	let state = readState(stateFile);
	let pendingRevision = null;
	try {
		const content = await fetchCmsContent(cmsUrl, fetchImpl);
		const revision = String(content.revision);
		const mode = execute ? "execute" : "dry-run";
		if (String(state.lastSuccessfulRevision) === revision && state.lastSuccessfulMode === mode) {
			return { status: "skipped", revision, mode };
		}
		pendingRevision = revision;
		state = {
			...state,
			version: 1,
			pendingRevision: revision,
			pendingMode: mode,
			pendingAt: now(),
		};
		writeJsonAtomic(stateFile, state);
		writeJsonAtomic(snapshotFile, content);
		await runner({ snapshotFile, execute, revision, content });
		state = {
			...state,
			lastSuccessfulRevision: revision,
			lastSuccessfulMode: mode,
			lastSuccessfulAt: now(),
			pendingRevision: null,
			pendingMode: null,
		};
		writeJsonAtomic(stateFile, state);
		return { status: "completed", revision, mode };
	} catch (error) {
		if (pendingRevision !== null) {
			writeJsonAtomic(stateFile, {
				...state,
				pendingRevision,
				pendingErrorAt: now(),
			});
		}
		throw error;
	} finally {
		release();
	}
};

const main = async () => {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) return printHelp();
	const result = await runOnce(args);
	if (result.status === "locked") console.log("Portfolio print sync already running; skipped.");
	else if (result.status === "skipped") console.log(`CMS revision ${result.revision} already completed in ${result.mode}; skipped.`);
	else console.log(`Portfolio print ${result.mode} completed for CMS revision ${result.revision}.`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	main().catch(() => {
		console.error("Portfolio print sync failed; the CMS revision remains pending.");
		process.exitCode = 1;
	});
}

export { acquireLock, fetchCmsContent, readState, runOnce, writeJsonAtomic };
