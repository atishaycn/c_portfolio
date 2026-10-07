import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { scanFolder, backupPath, matchExact, buildPlan } from "./drive-migration-plan.mjs";

const folderType = "application/vnd.google-apps.folder";
const image = { id: "img", name: "one.jpg", path: "Root/one.jpg", mimeType: "image/jpeg", md5Checksum: "hash" };

test("scanner uses GET only, traverses folders, paginates, and does not follow shortcuts", async () => {
	const calls = [];
	const responses = [
		{ id: "root", name: "Root", mimeType: folderType },
		{ files: [image, { id: "child", name: "Child", mimeType: folderType },
			{ id: "shortcut", name: "Outside", mimeType: "application/vnd.google-apps.shortcut", shortcutDetails: { targetId: "outside" } }], nextPageToken: "next" },
		{ files: [{ ...image, id: "img2" }] },
		{ files: [{ ...image, id: "img3" }] },
	];
	const result = await scanFolder("root", { token: "token", fetchImpl: async (url, init) => {
		assert.equal(init.method, "GET");
		assert.equal(init.headers.Authorization, "Bearer token");
		assert.equal(url.origin, "https://www.googleapis.com");
		calls.push(url); return Response.json(responses.shift());
	} });
	assert.equal(calls.length, 4);
	assert.equal(calls[2].searchParams.get("pageToken"), "next");
	assert.equal(result.folders.length, 2);
	assert.equal(result.files.length, 4);
	assert.equal(result.files.find((f) => f.id === "img3").path, "Root/Child/one.jpg");
});

test("incomplete or non-folder inventories stop rather than report missing photos", async () => {
	await assert.rejects(scanFolder("root", { fetchImpl: async () => Response.json({ mimeType: "image/jpeg" }) }), /folder/);
	const responses = [{ id: "root", name: "Root", mimeType: folderType }, { files: [], incompleteSearch: true }];
	await assert.rejects(scanFolder("root", { fetchImpl: async () => Response.json(responses.shift()) }), /incomplete/);
});

test("exact hashes override old mappings; non-exact old matches require review", () => {
	const photo = { id: "photo" };
	const inventory = { files: [image, { ...image, id: "dup" }] };
	const exact = matchExact(photo, "hash", inventory, { items: { photo: "img" } });
	assert.equal(exact.status, "exact");
	assert.equal(exact.driveFileId, "img");
	assert.equal(exact.candidates.length, 2);
	assert.equal(matchExact(photo, "different", inventory, { items: { photo: "img" } }).status, "needs-visual-review");
	assert.equal(matchExact(photo, "different", inventory, { items: { photo: "missing" } }).status, "unmatched");
});

test("backup paths cannot escape the backup image directory", () => {
	assert.throws(() => backupPath({ type: "image", public_id: "../../secrets", format: "jpg" }), /Unsafe/);
	assert.throws(() => backupPath({ type: "image", public_id: "photo", format: "../x" }), /Unsupported/);
});

test("plan preserves IDs, album parent, captions, order, and print settings", async () => {
	const backup = await mkdtemp(resolve(tmpdir(), "drive-plan-test-"));
	try {
		await mkdir(resolve(backup, "image"));
		await writeFile(resolve(backup, "image/a.jpg"), "photo");
		const md5 = createHash("md5").update("photo").digest("hex");
		const first = { id: "first", publicId: "a", order: 0, printEnabled: true, title: "caption" };
		const second = { id: "second", publicId: "a", order: 1, printEnabled: false };
		const content = { revision: 1, updatedAt: "date", albums: [{ key: "special-occasion", parentId: "protests", items: [second, first] }] };
		const inventory = { root: { id: "root", name: "Root" }, files: [{ ...image, md5Checksum: md5 }] };
		const plan = await buildPlan(content, inventory, [{ type: "image", public_id: "a", format: "jpg", bytes: 5 }], {}, backup);
		assert.equal(plan.dryRun, true);
		assert.equal(plan.summary.exact, 2);
		assert.equal(plan.summary.printEnabled, 1);
		assert.equal(plan.albums[0].parentId, "protests");
		assert.deepEqual(plan.albums[0].entries[0].photo, first);
		assert.equal(plan.albums[0].entries[0].proposedName, "001-first");
		assert.equal(content.albums[0].items[0].id, "second");
	} finally { await rm(backup, { recursive: true }); }
});
