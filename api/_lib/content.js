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

// A quote needs text; name and context are optional. Blank text leaves the photo without a quote key.
const quoteFieldFor = (quote) => {
	const text = cleanText(quote?.text, 2_000);
	if (!text) return {};
	return { quote: { text, name: cleanText(quote.name, 200), context: cleanText(quote.context, 200) } };
};

const cleanKey = (value) =>
	cleanText(value, 80)
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");

const SHOP_SETTING_DEFAULTS = Object.freeze({ markup: 2.5, shippingPrints: 8, shippingWallArt: 20 });

const shopSettingError = (message) => {
	const error = new Error(message);
	error.statusCode = 400;
	return error;
};

const shopSettingValue = (value, fallback, isValid, message) => {
	if (value === undefined || value === null) return fallback;
	if (typeof value !== "number" || !Number.isFinite(value) || !isValid(value)) throw shopSettingError(message);
	return value;
};

const isWholeDollarRate = (value) => Number.isInteger(value) && value >= 0 && value <= 100;

const validateShopSettings = (candidate) => {
	if (candidate === undefined || candidate === null) return { ...SHOP_SETTING_DEFAULTS };
	if (typeof candidate !== "object" || Array.isArray(candidate)) {
		throw shopSettingError("Shop settings must be an object");
	}
	return {
		markup: shopSettingValue(
			candidate.markup,
			SHOP_SETTING_DEFAULTS.markup,
			(value) => value >= 1.5 && value <= 5,
			"Markup must be a number from 1.5 to 5",
		),
		shippingPrints: shopSettingValue(
			candidate.shippingPrints,
			SHOP_SETTING_DEFAULTS.shippingPrints,
			isWholeDollarRate,
			"Prints shipping must be a whole number of dollars from 0 to 100",
		),
		shippingWallArt: shopSettingValue(
			candidate.shippingWallArt,
			SHOP_SETTING_DEFAULTS.shippingWallArt,
			isWholeDollarRate,
			"Wall Art shipping must be a whole number of dollars from 0 to 100",
		),
	};
};

// Effective settings for pricing. Content from validateContent always has all three values.
const shopSettings = (content) => validateShopSettings(content?.shopSettings);

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
	const groupIds = new Set();
	const groups = candidate.groups.map((group, index) => {
		const id = cleanKey(group.id);
		if (!id || groupIds.has(id)) {
			const error = new Error("Group IDs must be valid and unique");
			error.statusCode = 400;
			throw error;
		}
		groupIds.add(id);
		return {
			id,
			label: cleanText(group.label, 100),
			order: Number.isFinite(group.order) ? group.order : index,
			parentId: group.parentId ? cleanKey(group.parentId) : null,
		};
	});

	const albums = candidate.albums.map((album, albumIndex) => {
		const id = cleanKey(album.id);
		const key = cleanKey(album.key || id);
		if (!id || !key || groupIds.has(id) || albumIds.has(id) || albumKeys.has(key)) {
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
						...quoteFieldFor(item.quote),
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
	const parentById = new Map([...groups, ...albums].map((node) => [node.id, node.parentId]));
	for (const nodeId of parentById.keys()) {
		const visited = new Set();
		let currentId = nodeId;
		while (currentId) {
			if (visited.has(currentId)) {
				const error = new Error("Album hierarchy cannot contain cycles");
				error.statusCode = 400;
				throw error;
			}
			visited.add(currentId);
			currentId = parentById.get(currentId) || null;
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
					...quoteFieldFor(entry.item?.quote),
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
		shopSettings: validateShopSettings(candidate.shopSettings),
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

module.exports = { getContent, saveContent, shopSettings, validateContent, validateShopSettings };
