import assert from "node:assert/strict";
import test from "node:test";
import driveLib from "../api/_lib/drive.js";
import handlerModule from "../api/drive-albums.js";

const { getDriveAlbums, listDriveFolder, toAlbumItems } = driveLib;
const { createHandler } = handlerModule;

const file = (id, extra = {}) => ({
	id,
	name: `${id}.jpg`,
	mimeType: "image/jpeg",
	imageMediaMetadata: { width: 3000, height: 2000, rotation: 0 },
	...extra,
});

const fakeDrive = (pages) => {
	const urls = [];
	const fetchImpl = async (url) => {
		urls.push(new URL(url));
		const page = pages[urls.length - 1];
		if (page instanceof Error) return { ok: false, status: 403, text: async () => page.message };
		return { ok: true, json: async () => page };
	};
	return { urls, fetchImpl };
};

const response = () => {
	const res = { statusCode: 0, headers: {}, body: "" };
	res.setHeader = (name, value) => (res.headers[name.toLowerCase()] = value);
	res.end = (chunk) => (res.body = chunk);
	return res;
};

test("listDriveFolder asks for images in one folder by name and follows pages", async () => {
	const drive = fakeDrive([{ files: [file("a")], nextPageToken: "next" }, { files: [file("b")] }]);
	const files = await listDriveFolder({ folderId: "folder1", apiKey: "key1", fetchImpl: drive.fetchImpl });
	assert.deepEqual(files.map((entry) => entry.id), ["a", "b"]);
	const [first, second] = drive.urls;
	assert.equal(first.searchParams.get("q"), "'folder1' in parents and trashed = false and mimeType contains 'image/'");
	assert.equal(first.searchParams.get("orderBy"), "name_natural");
	assert.equal(first.searchParams.get("key"), "key1");
	assert.equal(second.searchParams.get("pageToken"), "next");
});

test("toAlbumItems keeps file order, uses the description as caption, and swaps sides for quarter turns", () => {
	const items = toAlbumItems("nature", [
		file("first", { description: "  Fog over the bay " }),
		file("turned", { imageMediaMetadata: { width: 3000, height: 2000, rotation: 1 } }),
	]);
	assert.deepEqual(items[0], {
		id: "nature-drive-first",
		driveFileId: "first",
		title: "Fog over the bay",
		location: "",
		width: 3000,
		height: 2000,
		order: 0,
	});
	assert.deepEqual([items[1].width, items[1].height, items[1].order], [2000, 3000, 1]);
});

test("toAlbumItems skips files without dimensions or with unexpected IDs", () => {
	const items = toAlbumItems("nature", [file("ok"), file("no-size", { imageMediaMetadata: {} }), file("bad/id")]);
	assert.deepEqual(items.map((item) => item.driveFileId), ["ok"]);
});

test("getDriveAlbums leaves out a failing album and needs an API key", async () => {
	const drive = fakeDrive([{ files: [file("a")] }, new Error("forbidden")]);
	const albums = await getDriveAlbums({ apiKey: "key1", folders: { nature: "f1", street: "f2" }, fetchImpl: drive.fetchImpl });
	assert.deepEqual(Object.keys(albums), ["nature"]);
	assert.deepEqual(await getDriveAlbums({ apiKey: "", folders: { nature: "f1" }, fetchImpl: drive.fetchImpl }), {});
});

test("handler returns cached album lists and refuses other methods", async () => {
	const drive = fakeDrive([{ files: [file("a")] }]);
	const handler = createHandler({ fetchImpl: drive.fetchImpl, env: { GOOGLE_DRIVE_API_KEY: "key1" } });
	const res = response();
	await handler({ method: "GET", headers: {} }, res);
	assert.equal(res.statusCode, 200);
	assert.match(res.headers["cache-control"], /s-maxage=300/);
	assert.equal(JSON.parse(res.body).albums["the-natural-world"][0].driveFileId, "a");

	const post = response();
	await handler({ method: "POST", headers: {} }, post);
	assert.equal(post.statusCode, 405);
});
