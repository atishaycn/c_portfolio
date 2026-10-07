#!/usr/bin/env node
// Read-only inventory and exact matching. All artifacts stay in the ignored local directory.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { LOCAL_DIR } from "./drive-sign-in.mjs";

export const ROOT_FOLDER = "1j_p4uDzt0QPy18iu5K9uKnkoYVphUzaD";
const BACKUP = resolve(homedir(), "Developer/cloudinary-backup-2026-10-04");
const FOLDER = "application/vnd.google-apps.folder";
const SHORTCUT = "application/vnd.google-apps.shortcut";
const FILE_FIELDS = "id,name,mimeType,parents,md5Checksum,size,modifiedTime,description,thumbnailLink,imageMediaMetadata,shortcutDetails,capabilities(canAddChildren)";

export async function driveGet(path, params, { token, fetchImpl = fetch } = {}) {
	const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
	url.search = new URLSearchParams(params).toString();
	for (let attempt = 0; attempt < 4; attempt++) {
		const response = await fetchImpl(url, { method: "GET", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
		if (response.ok) return response.json();
		if ((response.status === 429 || response.status >= 500) && attempt < 3) {
			await new Promise((done) => setTimeout(done, 500 * 2 ** attempt));
			continue;
		}
		throw new Error(`Drive read failed with HTTP ${response.status}. No Drive writes occurred.`);
	}
}

export async function scanFolder(rootId, options) {
	const root = await driveGet(`files/${encodeURIComponent(rootId)}`, { fields: FILE_FIELDS, supportsAllDrives: "true" }, options);
	if (root.mimeType !== FOLDER) throw new Error("Destination must be a Drive folder.");
	const files = [];
	const folders = [{ ...root, path: root.name }];
	const seen = new Set();
	for (let index = 0; index < folders.length; index++) {
		const folder = folders[index];
		if (seen.has(folder.id)) continue;
		seen.add(folder.id);
		let pageToken = "";
		const pages = new Set();
		do {
			if (pages.has(pageToken)) throw new Error("Repeated Drive page token; inventory is incomplete.");
			pages.add(pageToken);
			const page = await driveGet("files", { q: `'${folder.id}' in parents and trashed = false`,
				fields: `nextPageToken,incompleteSearch,files(${FILE_FIELDS})`, pageSize: "1000",
				supportsAllDrives: "true", includeItemsFromAllDrives: "true", ...(pageToken ? { pageToken } : {}) }, options);
			if (page.incompleteSearch || !Array.isArray(page.files)) throw new Error("Drive returned an incomplete inventory.");
			for (const file of page.files) {
				const entry = { ...file, path: `${folder.path}/${file.name}` };
				if (file.mimeType === FOLDER) folders.push(entry);
				else files.push(entry);
			}
			if (folders.length > 2000 || files.length > 50000) throw new Error("Scan limit exceeded; inventory is incomplete.");
			pageToken = page.nextPageToken || "";
		} while (pageToken);
	}
	// Folder shortcuts are recorded but never followed outside the supplied tree.
	return { generatedAt: new Date().toISOString(), root, folders, files };
}

export function backupPath(asset, backupRoot = BACKUP) {
	if (asset.type !== "image" || !/^[a-zA-Z0-9]+$/.test(asset.format || "")) throw new Error("Unsupported backup asset.");
	const path = resolve(backupRoot, "image", `${asset.public_id}.${asset.format}`);
	if (!path.startsWith(resolve(backupRoot, "image") + sep)) throw new Error("Unsafe backup path.");
	return path;
}

export function matchExact(photo, md5, inventory, oldMap = {}) {
	const exact = inventory.files.filter((file) => file.mimeType.startsWith("image/") && file.md5Checksum === md5);
	const oldId = oldMap.items?.[photo.id];
	if (exact.length) {
		exact.sort((a, b) => a.id.localeCompare(b.id));
		const target = exact.find((f) => f.id === oldId) || exact[0];
		return { status: "exact", driveFileId: target.id, drivePath: target.path,
			md5, candidates: exact.map(({ id, path, modifiedTime }) => ({ id, path, modifiedTime })) };
	}
	const candidate = inventory.files.find((file) => file.id === oldId && file.mimeType.startsWith("image/"));
	return candidate ? { status: "needs-visual-review", candidate: { id: candidate.id, path: candidate.path,
		oldVerification: oldMap.verificationDetails?.[photo.id] }, md5 } : { status: "unmatched", md5 };
}

const albumNames = { protests: "Events", "the-natural-world": "Nature", "shapes-and-shadows": "Street",
	slideshow: "Slideshow", "special-occasion": "Special occasions" };

export async function buildPlan(content, inventory, backupInventory, oldMap, backupRoot = BACKUP) {
	const assets = new Map(backupInventory.filter((asset) => asset.type === "image").map((asset) => [asset.public_id, asset]));
	const albums = [];
	for (const album of content.albums) {
		const entries = [];
		const sorted = [...album.items].sort((a, b) => (a.order || 0) - (b.order || 0));
		for (const [position, photo] of sorted.entries()) {
			const asset = assets.get(photo.publicId);
			if (!asset) throw new Error(`No backup inventory entry for photo ${photo.id}.`);
			const path = backupPath(asset, backupRoot);
			const bytes = await readFile(path);
			if (bytes.length !== asset.bytes) throw new Error(`Backup size mismatch for photo ${photo.id}.`);
			const md5 = createHash("md5").update(bytes).digest("hex");
			entries.push({ position, proposedName: `${String(position + 1).padStart(3, "0")}-${photo.id}`,
				photo, backupPath: path, match: matchExact(photo, md5, inventory, oldMap) });
		}
		albums.push({ key: album.key, name: albumNames[album.key] || album.label || album.key,
			parentId: album.parentId || null, originalAlbum: { ...album, items: undefined }, entries });
	}
	const entries = albums.flatMap((a) => a.entries);
	return { version: 1, dryRun: true, generatedAt: new Date().toISOString(),
		rootFolderId: inventory.root.id, rootFolderName: inventory.root.name,
		canAddChildren: inventory.root.capabilities?.canAddChildren ?? null,
		sourceRevision: content.revision, sourceUpdatedAt: content.updatedAt,
		contentSha256: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
		warnings: ["Visual candidates require review. Unmatched does not mean absent from Drive.",
			"No Drive write capability has been tested. Do not broaden OAuth scopes automatically.",
			"No sharing permissions will be changed without separate approval.",
			"Source shortcuts are listed but not followed outside the supplied tree."],
		summary: { photos: entries.length, exact: entries.filter((e) => e.match.status === "exact").length,
			needsVisualReview: entries.filter((e) => e.match.status === "needs-visual-review").length,
			unmatched: entries.filter((e) => e.match.status === "unmatched").length,
			printEnabled: entries.filter((e) => e.photo.printEnabled).length }, albums };
}

async function saveJson(name, value) {
	await writeFile(resolve(LOCAL_DIR, name), JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
}

async function main() {
	const credentials = JSON.parse(await readFile(resolve(LOCAL_DIR, "token.json"), "utf8"));
	if (!credentials.access_token || Date.parse(credentials.expires_at) <= Date.now()) throw new Error("Drive token has expired. Reconnect first.");
	const contentResponse = await fetch("https://clairethomas.art/api/content", { signal: AbortSignal.timeout(30_000) });
	if (!contentResponse.ok) throw new Error(`Live content read failed with HTTP ${contentResponse.status}.`);
	const content = await contentResponse.json();
	await saveJson("live-content.json", content);
	console.log(`Live revision ${content.revision}: ${content.albums.length} albums, ${content.albums.reduce((n, a) => n + a.items.length, 0)} photos.`);
	const inventory = await scanFolder(ROOT_FOLDER, { token: credentials.access_token });
	await saveJson("drive-inventory.json", inventory);
	console.log(`Drive scan: ${inventory.folders.length} folders, ${inventory.files.length} files, ${inventory.files.filter((f) => f.mimeType === SHORTCUT).length} shortcuts.`);
	const backupInventory = JSON.parse(await readFile(resolve(BACKUP, "inventory.json"), "utf8"));
	let oldMap = {};
	try { oldMap = JSON.parse(await readFile("/tmp/gdm.json", "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
	const plan = await buildPlan(content, inventory, backupInventory, oldMap);
	await saveJson("plan.json", plan);
	console.log(JSON.stringify(plan.summary));
	console.log("Dry run saved to .drive-migration.local/plan.json. No Drive writes occurred.");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
	main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
