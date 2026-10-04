// Albums whose photos come from a public Google Drive folder instead of the CMS.
// Only folders listed here are ever read, so the API key cannot be pointed elsewhere.
const DRIVE_ALBUM_FOLDERS = {
	"the-natural-world": "1t9kqpEiqrdvaISH3Z7ZHi0WT8eNU8_d4",
};

const FILE_FIELDS = "nextPageToken,files(id,name,description,mimeType,imageMediaMetadata(width,height,rotation))";

/** List the images directly inside one Drive folder, sorted by file name (01-…, 02-…). */
const listDriveFolder = async ({ folderId, apiKey, fetchImpl = fetch }) => {
	const files = [];
	let pageToken = "";
	do {
		const params = new URLSearchParams({
			q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
			fields: FILE_FIELDS,
			orderBy: "name_natural",
			pageSize: "1000",
			supportsAllDrives: "true",
			includeItemsFromAllDrives: "true",
			key: apiKey,
		});
		if (pageToken) params.set("pageToken", pageToken);
		const response = await fetchImpl(`https://www.googleapis.com/drive/v3/files?${params}`);
		if (!response.ok) {
			const detail = await response.text().catch(() => "");
			throw new Error(`Drive responded ${response.status}: ${detail.slice(0, 300)}`);
		}
		const body = await response.json();
		files.push(...(body.files || []));
		pageToken = body.nextPageToken || "";
	} while (pageToken && files.length < 5000);
	return files;
};

/** Turn Drive files into gallery items. Files Drive has no dimensions for are skipped. */
const toAlbumItems = (albumKey, files) =>
	files
		.filter((file) => /^[a-zA-Z0-9_-]+$/.test(file.id || "") && file.imageMediaMetadata?.width && file.imageMediaMetadata?.height)
		.map((file, index) => {
			const { width, height, rotation } = file.imageMediaMetadata;
			// Drive reports the stored size; quarter turns swap the displayed width and height.
			const turned = rotation === 1 || rotation === 3;
			return {
				id: `${albumKey}-drive-${file.id}`,
				driveFileId: file.id,
				title: String(file.description || "").trim().slice(0, 2_000),
				location: "",
				width: turned ? height : width,
				height: turned ? width : height,
				order: index,
			};
		});

/** Read every configured album. An album that fails is left out so the site keeps its CMS photos. */
const getDriveAlbums = async ({ apiKey, folders = DRIVE_ALBUM_FOLDERS, fetchImpl = fetch }) => {
	if (!apiKey) return {};
	const entries = await Promise.all(
		Object.entries(folders).map(async ([albumKey, folderId]) => {
			try {
				const items = toAlbumItems(albumKey, await listDriveFolder({ folderId, apiKey, fetchImpl }));
				return items.length ? [albumKey, items] : null;
			} catch (error) {
				console.error(`Drive album ${albumKey} unavailable:`, error.message);
				return null;
			}
		}),
	);
	return Object.fromEntries(entries.filter(Boolean));
};

module.exports = { DRIVE_ALBUM_FOLDERS, getDriveAlbums, listDriveFolder, toAlbumItems };
