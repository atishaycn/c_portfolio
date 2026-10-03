import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import trashModule from "../api/_lib/trash.js";

const { emptyTrashBatch, planTrashPurge } = trashModule;
const adminScript = readFileSync(resolve(import.meta.dirname, "..", "admin.js"), "utf8");

const photo = (id, publicId = `portfolio-admin/a/${id}`) => ({
	id,
	publicId,
	title: "",
	location: "",
	width: 100,
	height: 100,
	order: 0,
});

const trashed = (id, publicId) => ({ albumId: "a", deletedAt: "2026-10-01T00:00:00.000Z", item: photo(id, publicId) });

const document = ({ revision = 5, items = [photo("live-1")], trash = [] } = {}) => ({
	version: 1,
	revision,
	updatedAt: "2026-10-01T00:00:00.000Z",
	groups: [],
	albums: [{ id: "a", key: "a", label: "A", path: "./gallery.html?album=a", order: 0, parentId: null, items }],
	trash,
});

const harness = (reads, deleteResults = (ids) => Object.fromEntries(ids.map((id) => [id, "deleted"]))) => {
	const calls = { deleted: [], writes: [] };
	let readIndex = 0;
	return {
		calls,
		options: {
			read: async () => structuredClone(reads[Math.min(readIndex++, reads.length - 1)]),
			deleteImages: async (ids) => {
				calls.deleted.push(ids);
				return deleteResults(ids);
			},
			write: async (next, previous) => calls.writes.push({ next, previous }),
		},
	};
};

test("never deletes an original that a live photo still shows", () => {
	const content = document({
		items: [photo("live-1", "shared/one")],
		trash: [trashed("t1", "shared/one"), trashed("t2", "gone/two"), trashed("t3", "gone/two")],
	});
	assert.deepEqual(planTrashPurge(content), { deletable: ["gone/two"], keptInUse: 1 });
});

test("deletes trashed originals, clears their entries and saves with a backup", async () => {
	const start = document({ trash: [trashed("t1", "x/1"), trashed("t2", "x/2"), trashed("t3", "portfolio-admin/a/live-1")] });
	const { calls, options } = harness([start, start]);
	const result = await emptyTrashBatch(5, options);
	assert.deepEqual(calls.deleted, [["x/1", "x/2"]]);
	assert.equal(result.deleted, 2);
	assert.equal(result.remaining, 0);
	assert.equal(calls.writes.length, 1);
	assert.equal(calls.writes[0].next.revision, 6);
	assert.equal(calls.writes[0].previous.revision, 5, "previous content is handed over for the history backup");
	assert.equal(calls.writes[0].next.albums[0].items.length, 1, "live photos are untouched");
});

test("keeps entries whose file could not be deleted, and drops ones already gone", async () => {
	const start = document({ trash: [trashed("t1", "x/1"), trashed("t2", "x/2"), trashed("t3", "x/3")] });
	const { options } = harness([start, start], () => ({ "x/1": "deleted", "x/2": "not_found", "x/3": "error" }));
	const result = await emptyTrashBatch(5, options);
	assert.deepEqual([result.deleted, result.alreadyGone, result.failed, result.remaining], [1, 1, 1, 1]);
	assert.equal(result.content.trash[0].item.publicId, "x/3");
});

test("refuses to run against stale content and deletes nothing", async () => {
	const { calls, options } = harness([document({ revision: 9, trash: [trashed("t1", "x/1")] })]);
	await assert.rejects(emptyTrashBatch(5, options), (error) => error.statusCode === 409);
	assert.equal(calls.deleted.length, 0);
	assert.equal(calls.writes.length, 0);
});

test("keeps edits saved while files were being deleted", async () => {
	const start = document({ trash: [trashed("t1", "x/1")] });
	const meanwhile = document({
		revision: 6,
		items: [photo("live-1"), photo("new-upload")],
		trash: [trashed("t1", "x/1"), trashed("t9", "x/9")],
	});
	const { calls, options } = harness([start, meanwhile]);
	const result = await emptyTrashBatch(5, options);
	assert.equal(calls.writes[0].next.revision, 7);
	assert.equal(result.content.albums[0].items.length, 2, "the new upload survives");
	assert.deepEqual(result.content.trash.map((entry) => entry.item.publicId), ["x/9"], "a newly trashed photo stays");
});

test("works through a large Trash in batches", async () => {
	const start = document({ trash: [trashed("t1", "x/1"), trashed("t2", "x/2"), trashed("t3", "x/3")] });
	const { calls, options } = harness([start, start]);
	const result = await emptyTrashBatch(5, { ...options, batchSize: 2 });
	assert.deepEqual(calls.deleted, [["x/1", "x/2"]]);
	assert.equal(result.remaining, 1);
});

test("admin asks for typed confirmation before emptying Trash", () => {
	assert.match(adminScript, /Type DELETE to confirm/);
	assert.match(adminScript, /request\("\/api\/admin\/empty-trash"/);
	assert.match(adminScript, /Save your other changes before emptying Trash/);
});
