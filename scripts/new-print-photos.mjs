#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const snapshotPhotos = (snapshot, name) => {
	assert(snapshot && Array.isArray(snapshot.albums), `${name} snapshot is required`);
	assert(Number.isSafeInteger(snapshot.revision) && snapshot.revision >= 0, `${name} revision is invalid`);
	const ids = new Set();
	return snapshot.albums.flatMap((album) => {
		assert(typeof album.id === "string" && album.id.trim(), `${name} album ID is required`);
		assert(Array.isArray(album.items), `${name} album items are required`);
		return album.items.map((item) => {
			assert(typeof item.id === "string" && item.id.trim(), `${name} photo ID is required`);
			assert(!ids.has(item.id), `${name} contains duplicate photo ID: ${item.id}`);
			ids.add(item.id);
			return { album, item };
		});
	});
};

const trashIds = (snapshot) => {
	assert(snapshot.trash === undefined || Array.isArray(snapshot.trash), "Snapshot trash must be an array");
	return (snapshot.trash || []).map(({ item }) => {
		assert(typeof item?.id === "string" && item.id.trim(), "Trashed photo ID is required");
		return item.id;
	});
};

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

// This boundary produces candidates only. It never calls Shopify, Gelato, or the legacy reconciler.
export const planNewPrintPhotos = ({ baseline, content, knownPhotoIds = [] } = {}) => {
	const original = snapshotPhotos(baseline, "Baseline");
	const current = snapshotPhotos(content, "Current");
	assert(content.revision >= baseline.revision, "Current revision predates the baseline");
	assert(Array.isArray(knownPhotoIds), "Known photo IDs must be an array");
	assert(knownPhotoIds.every((id) => typeof id === "string" && id.trim()), "Known photo ID is invalid");
	const protectedIds = new Set([
		...original.map(({ item }) => item.id),
		...trashIds(baseline),
		...trashIds(content),
		...knownPhotoIds,
	]);
	const plan = {
		mode: "plan-only",
		baselineRevision: baseline.revision,
		revision: content.revision,
		baselineHash: hash(baseline),
		contentHash: hash(content),
		ignoredExistingCount: 0,
		ignoredDisabledCount: 0,
		candidates: [],
		blocked: [],
	};
	for (const { album, item } of current) {
		if (protectedIds.has(item.id)) {
			plan.ignoredExistingCount += 1;
			continue;
		}
		if (item.printEnabled !== true) {
			plan.ignoredDisabledCount += 1;
			continue;
		}
		if (
			typeof item.publicId !== "string" || !/^[a-zA-Z0-9_./-]+$/.test(item.publicId) ||
			!Number.isSafeInteger(item.width) || item.width <= 0 ||
			!Number.isSafeInteger(item.height) || item.height <= 0
		) {
			plan.blocked.push({ photoId: item.id, reason: "A verified original public ID and dimensions are required" });
			continue;
		}
		plan.candidates.push({
			photoId: item.id,
			albumId: album.id,
			publicId: item.publicId,
			width: item.width,
			height: item.height,
			title: item.title || "",
			location: item.location || "",
		});
	}
	return plan;
};

const help = `Usage: node scripts/new-print-photos.mjs --baseline SNAPSHOT.json --content CURRENT.json [--known-ids IDS.json]

Read-only: prints new, print-enabled photo candidates as JSON. Never creates or modifies products.
The baseline must be a reviewed starting CMS snapshot, including disabled photos and Trash.
Optional known IDs must include previously queued/created photo IDs from durable state.
A candidate is not proof that no remote product exists; verify exact mappings before creation.`;

export const runCli = (argv) => {
	if (argv.includes("--help")) return help;
	const files = {};
	for (let index = 0; index < argv.length; index += 1) {
		const option = argv[index];
		assert(["--baseline", "--content", "--known-ids"].includes(option), `Unknown argument: ${option}`);
		assert(!files[option], `Repeated argument: ${option}`);
		const file = argv[++index];
		assert(file && !file.startsWith("--"), `${option} requires a file`);
		files[option] = resolve(file);
	}
	assert(files["--baseline"] && files["--content"], help);
	const read = (file) => JSON.parse(readFileSync(file, "utf8"));
	return JSON.stringify(planNewPrintPhotos({
		baseline: read(files["--baseline"]),
		content: read(files["--content"]),
		knownPhotoIds: files["--known-ids"] ? read(files["--known-ids"]) : [],
	}), null, 2);
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		console.log(runCli(process.argv.slice(2)));
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
