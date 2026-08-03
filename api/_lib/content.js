const fallbackContent = require("../../content/portfolio.json");
const {
	fetchAuthoritativeContent,
	fetchRemoteContent,
	writeRemoteContent,
} = require("./cloudinary");

const cleanText = (value, maximum = 500) =>
	String(value ?? "")
		.trim()
		.slice(0, maximum);

const cleanKey = (value) =>
	cleanText(value, 80)
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");

const validateContent = (candidate) => {
	if (!candidate || !Array.isArray(candidate.albums) || !Array.isArray(candidate.groups)) {
		const error = new Error("Content must include albums and groups");
		error.statusCode = 400;
		throw error;
	}
	if (candidate.albums.length > 100) {
		const error = new Error("Album limit exceeded");
		error.statusCode = 400;
		throw error;
	}

	const albumIds = new Set();
	const albumKeys = new Set();
	const photoIds = new Set();
	let photoCount = 0;
	const groups = candidate.groups.map((group, index) => ({
		id: cleanKey(group.id),
		label: cleanText(group.label, 100),
		order: Number.isFinite(group.order) ? group.order : index,
		parentId: group.parentId ? cleanKey(group.parentId) : null,
	}));
	const groupIds = new Set(groups.map((group) => group.id));

	const albums = candidate.albums.map((album, albumIndex) => {
		const id = cleanKey(album.id);
		const key = cleanKey(album.key || id);
		if (!id || !key || albumIds.has(id) || albumKeys.has(key)) {
			const error = new Error("Album IDs and keys must be unique");
			error.statusCode = 400;
			throw error;
		}
		albumIds.add(id);
		albumKeys.add(key);
		const items = Array.isArray(album.items)
			? album.items.map((item, itemIndex) => {
					const itemId = cleanText(item.id, 140);
					const publicId = cleanText(item.publicId, 240);
					if (
						!itemId ||
						!publicId ||
						photoIds.has(itemId) ||
						!/^[a-zA-Z0-9_./-]+$/.test(publicId)
					) {
						const error = new Error("Photo IDs and Cloudinary IDs must be valid and unique");
						error.statusCode = 400;
						throw error;
					}
					photoIds.add(itemId);
					photoCount += 1;
					return {
						id: itemId,
						publicId,
						title: cleanText(item.title, 2_000),
						location: cleanText(item.location, 500),
						width: Math.max(1, Math.round(Number(item.width) || 1)),
						height: Math.max(1, Math.round(Number(item.height) || 1)),
						order: Number.isFinite(item.order) ? item.order : itemIndex,
						printEnabled: item.printEnabled === true,
					};
				})
			: [];
		return {
			id,
			key,
			label: cleanText(album.label, 100) || key,
			path: cleanText(album.path, 240) || `./gallery.html?album=${encodeURIComponent(key)}`,
			order: Number.isFinite(album.order) ? album.order : albumIndex,
			parentId: album.parentId ? cleanKey(album.parentId) : null,
			preserveCase: album.preserveCase === true,
			printEnabled: album.printEnabled !== false,
			items,
		};
	});

	if (photoCount > 5_000) {
		const error = new Error("Photo limit exceeded");
		error.statusCode = 400;
		throw error;
	}
	for (const node of [...groups, ...albums]) {
		if (
			node.parentId &&
			!groupIds.has(node.parentId) &&
			!albumIds.has(node.parentId)
		) {
			const error = new Error(`Unknown parent: ${node.parentId}`);
			error.statusCode = 400;
			throw error;
		}
	}

	const trash = Array.isArray(candidate.trash)
		? candidate.trash.slice(0, 1_000).map((entry) => ({
				albumId: cleanKey(entry.albumId),
				deletedAt: cleanText(entry.deletedAt, 64),
				item: {
					id: cleanText(entry.item?.id, 140),
					publicId: cleanText(entry.item?.publicId, 240),
					title: cleanText(entry.item?.title, 2_000),
					location: cleanText(entry.item?.location, 500),
					width: Math.max(1, Math.round(Number(entry.item?.width) || 1)),
					height: Math.max(1, Math.round(Number(entry.item?.height) || 1)),
					order: Number(entry.item?.order) || 0,
					printEnabled: entry.item?.printEnabled === true,
				},
			}))
		: [];

	return {
		version: 1,
		revision: Math.max(0, Math.floor(Number(candidate.revision) || 0)),
		updatedAt: cleanText(candidate.updatedAt, 64) || new Date().toISOString(),
		groups,
		albums,
		trash,
	};
};

const getContent = async ({ authoritative = false } = {}) => {
	try {
		const remote = authoritative
			? await fetchAuthoritativeContent()
			: await fetchRemoteContent();
		return remote ? validateContent(remote) : validateContent(fallbackContent);
	} catch (error) {
		if (authoritative) throw error;
		console.warn(`CMS fallback used: ${error.message}`);
		return validateContent(fallbackContent);
	}
};

const saveContent = async (candidate) => {
	const remote = await fetchAuthoritativeContent();
	const current = validateContent(remote || fallbackContent);
	if (Number(candidate.revision) !== Number(current.revision)) {
		const error = new Error("Content changed elsewhere. Reload before saving.");
		error.statusCode = 409;
		throw error;
	}
	const next = validateContent({
		...candidate,
		revision: current.revision + 1,
		updatedAt: new Date().toISOString(),
	});
	await writeRemoteContent(next, current);
	return next;
};

module.exports = { getContent, saveContent, validateContent };
