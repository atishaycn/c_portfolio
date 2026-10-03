import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { planNewPrintPhotos, runCli } from "./new-print-photos.mjs";

const photo = (id, overrides = {}) => ({
	id, publicId: `originals/${id}`, width: 3000, height: 2000, printEnabled: true, ...overrides,
});
const snapshot = (revision, items, extra = {}) => ({
	revision, albums: [{ id: "events", items }], trash: [], ...extra,
});

test("plans only new photos with item-level print enabled", () => {
	const baseline = snapshot(10, [photo("existing"), photo("disabled", { printEnabled: false })]);
	const content = snapshot(11, [
		photo("existing", { publicId: "replacement/edit", title: "Changed" }),
		photo("disabled"), photo("new-photo"), photo("not-for-sale", { printEnabled: false }),
		photo("string-flag", { printEnabled: "true" }),
	]);
	const before = JSON.stringify({ baseline, content });
	const plan = planNewPrintPhotos({ baseline, content });
	assert.equal(plan.mode, "plan-only");
	assert.equal(plan.ignoredExistingCount, 2);
	assert.equal(plan.ignoredDisabledCount, 2);
	assert.deepEqual(plan.candidates, [{
		photoId: "new-photo", albumId: "events", publicId: "originals/new-photo",
		width: 3000, height: 2000, title: "", location: "",
	}]);
	assert.equal(JSON.stringify({ baseline, content }), before);
});

test("protects restored photos and previously queued or created photos", () => {
	const baseline = snapshot(10, [], { trash: [{ item: photo("restored") }] });
	const content = snapshot(11, [photo("restored"), photo("already-queued"), photo("new-photo")]);
	assert.deepEqual(planNewPrintPhotos({ baseline, content, knownPhotoIds: ["already-queued"] })
		.candidates.map(({ photoId }) => photoId), ["new-photo"]);
});

test("never creates update or deletion actions for moved, edited or removed photos", () => {
	const baseline = snapshot(10, [photo("moved"), photo("removed")]);
	const content = snapshot(11, [photo("moved", { publicId: "replacement/edit" })]);
	content.albums[0].id = "new-album";
	assert.deepEqual(planNewPrintPhotos({ baseline, content }).candidates, []);
});

test("fails closed without baseline, with older content, or with duplicate identities", () => {
	assert.throws(() => planNewPrintPhotos({ content: snapshot(10, []) }), /Baseline snapshot is required/);
	assert.throws(() => planNewPrintPhotos({ baseline: snapshot(10, []), content: snapshot(9, []) }), /predates/);
	assert.throws(() => planNewPrintPhotos({
		baseline: snapshot(10, []), content: snapshot(11, [photo("same"), photo("same")]),
	}), /duplicate photo ID/);
	assert.throws(() => planNewPrintPhotos({
		baseline: snapshot(10, []), content: snapshot(11, []), knownPhotoIds: [null],
	}), /Known photo ID is invalid/);
});

test("blocks a new photo without an original or valid dimensions", () => {
	const plan = planNewPrintPhotos({ baseline: snapshot(10, []), content: snapshot(11, [
		photo("drive-only", { publicId: "", driveFileId: "drive-file" }),
		photo("bad-dimensions", { width: 0 }), photo("ready"),
	]) });
	assert.deepEqual(plan.blocked.map(({ photoId }) => photoId), ["drive-only", "bad-dimensions"]);
	assert.deepEqual(plan.candidates.map(({ photoId }) => photoId), ["ready"]);
});

test("repeated planning is deterministic and records both snapshot hashes", () => {
	const baseline = snapshot(10, []);
	const content = snapshot(11, [photo("new-photo")]);
	const first = planNewPrintPhotos({ baseline, content });
	assert.deepEqual(planNewPrintPhotos({ baseline, content }), first);
	assert.match(first.baselineHash, /^[a-f0-9]{64}$/);
	assert.notEqual(first.baselineHash, first.contentHash);
	assert.notEqual(planNewPrintPhotos({ baseline, content: snapshot(12, [photo("new-photo")]) }).contentHash,
		first.contentHash);
});

test("CLI is read-only, loads durable exclusions, and rejects execution flags", () => {
	const directory = mkdtempSync(join(tmpdir(), "new-print-photos-"));
	try {
		const baseline = join(directory, "baseline.json");
		const content = join(directory, "content.json");
		const known = join(directory, "known.json");
		writeFileSync(baseline, JSON.stringify(snapshot(10, [])));
		writeFileSync(content, JSON.stringify(snapshot(11, [photo("queued"), photo("new-photo")])));
		writeFileSync(known, JSON.stringify(["queued"]));
		const original = readFileSync(content, "utf8");
		const plan = JSON.parse(runCli(["--baseline", baseline, "--content", content, "--known-ids", known]));
		assert.deepEqual(plan.candidates.map(({ photoId }) => photoId), ["new-photo"]);
		assert.equal(readFileSync(content, "utf8"), original);
		assert.throws(() => runCli(["--execute"]), /Unknown argument/);
		assert.throws(() => runCli(["--content", content]), /Usage:/);
		assert.match(runCli(["--help"]), /Never creates or modifies products/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
