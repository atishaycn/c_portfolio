const {
	deleteImageResources,
	fetchAuthoritativeContent,
	writeRemoteContent,
} = require("./cloudinary");
const { validateContent } = require("./content");

const BATCH_SIZE = 100;

const activePublicIds = (content) =>
	new Set(content.albums.flatMap((album) => album.items.map((item) => item.publicId)).filter(Boolean));

// Splits Trash into originals that are safe to delete and entries that can simply
// be dropped: ones with no image, or whose image is still shown by a live photo.
const planTrashPurge = (content) => {
	const inUse = activePublicIds(content);
	const deletable = [];
	let keptInUse = 0;
	for (const entry of content.trash) {
		const publicId = entry.item?.publicId;
		if (!publicId) continue;
		if (inUse.has(publicId)) keptInUse += 1;
		else if (!deletable.includes(publicId)) deletable.push(publicId);
	}
	return { deletable, keptInUse };
};

// Empties Trash one batch at a time so a large Trash never outlives a single
// request. Originals are deleted first; a Trash entry is only removed once its
// file is confirmed gone (or was never needed), so failures stay recoverable.
const emptyTrashBatch = async (
	expectedRevision,
	{
		read = fetchAuthoritativeContent,
		deleteImages = deleteImageResources,
		write = writeRemoteContent,
		batchSize = BATCH_SIZE,
	} = {},
) => {
	const current = validateContent(await read());
	if (Number(expectedRevision) !== current.revision) {
		const error = new Error("Content changed elsewhere. Reload before emptying Trash.");
		error.statusCode = 409;
		throw error;
	}

	const { deletable } = planTrashPurge(current);
	const batch = deletable.slice(0, batchSize);
	const results = await deleteImages(batch);
	const deleted = batch.filter((publicId) => results[publicId] === "deleted");
	const alreadyGone = batch.filter((publicId) => results[publicId] === "not_found");
	const failed = batch.filter((publicId) => !deleted.includes(publicId) && !alreadyGone.includes(publicId));
	const purged = new Set([...deleted, ...alreadyGone]);

	// Re-read so edits saved while files were being deleted aren't overwritten.
	const latest = validateContent(await read());
	const inUseNow = activePublicIds(latest);
	const pending = new Set(deletable.filter((publicId) => !purged.has(publicId)));
	const trash = latest.trash.filter((entry) => {
		const publicId = entry.item?.publicId;
		if (!publicId) return false;
		if (purged.has(publicId)) return false;
		// Entries whose image is still used by a live photo don't need their own copy.
		if (inUseNow.has(publicId) && !pending.has(publicId)) return false;
		return true;
	});

	const next = validateContent({
		...latest,
		trash,
		revision: latest.revision + 1,
		updatedAt: new Date().toISOString(),
	});
	await write(next, latest);

	return {
		content: next,
		deleted: deleted.length,
		alreadyGone: alreadyGone.length,
		failed: failed.length,
		remaining: next.trash.length,
	};
};

module.exports = { emptyTrashBatch, planTrashPurge };
