const SHOP_ORDER_APP = "claire-shop-store-v1";
const PHOTO_PIXELS_PER_INCH = 125;
const MAX_LINES = 20;

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode, publicMessage: true });
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const cartLines = (request) => {
	if (!isRecord(request) || !Array.isArray(request.lines)) throw fail("Your cart is invalid. Reload and try again.");
	if (request.lines.length === 0) throw fail("Your cart is empty.");
	if (request.lines.length > MAX_LINES) throw fail("Your cart has more than 20 items. Remove some and try again.");
	return request.lines;
};

const optionValuesMatch = (left, right) => {
	const leftKeys = Object.keys(left || {}).sort();
	const rightKeys = Object.keys(right || {}).sort();
	return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
};

const parseSize = (size) => {
	if (typeof size !== "string") return null;
	const match = size.match(/^\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*$/i);
	if (!match) return null;
	const width = Number(match[1]);
	const height = Number(match[2]);
	return width > 0 && height > 0 ? { width, height } : null;
};

const validateCrop = (crop) => {
	if (!isRecord(crop)) throw fail("The crop for one photograph is invalid. Edit it and try again.");
	const { x, y } = crop;
	if (![x, y].every((value) => typeof value === "number" && Number.isFinite(value) && value >= -50 && value <= 50)) {
		throw fail("The crop for one photograph is invalid. Edit it and try again.");
	}
	return { x, y };
};

const findPhoto = (content, photoId) => {
	if (typeof photoId !== "string" || !photoId) return null;
	for (const album of content?.albums || []) {
		const photo = (album.items || []).find((item) => item.id === photoId);
		if (photo) return { album, photo };
	}
	return null;
};

const priceCart = (request, catalog, content) => {
	const requestedLines = cartLines(request);
	if (!Array.isArray(catalog?.products)) throw fail("The product catalog is unavailable. Please try again later.", 503);
	if (!Array.isArray(content?.albums)) throw fail("Print content is unavailable. Please try again later.", 503);

	const lines = requestedLines.map((requested) => {
		if (!isRecord(requested)) throw fail("One cart item is invalid. Reload the store and try again.");
		if (!Number.isInteger(requested.quantity) || requested.quantity < 1 || requested.quantity > 10) {
			throw fail("Choose a quantity from 1 to 10.");
		}
		const crop = validateCrop(requested.crop);
		const product = catalog.products.find((entry) => entry.slug === requested.productSlug);
		if (!product) throw fail("This product or its selected options are no longer available.");
		const options = requested.options === undefined && !(product.options || []).length ? {} : requested.options;
		if (!isRecord(options)) throw fail("This product or its selected options are no longer available.");
		const optionKeys = (product.options || []).map((option) => option.key);
		if (Object.keys(options).length !== optionKeys.length || optionKeys.some((key) => typeof options[key] !== "string")) {
			throw fail("This product or its selected options are no longer available.");
		}
		const variant = (product.variants || []).find((entry) => entry.size === requested.size && optionValuesMatch(entry.options, options));
		if (!variant) throw fail("This product or its selected options are no longer available.");
		const dimensions = parseSize(variant.size);
		if (!dimensions) throw fail("This product or its selected options are no longer available.");

		const located = findPhoto(content, requested.photoId);
		if (!located || located.album.printEnabled === false || located.photo.printEnabled !== true) {
			throw fail("This photograph is not available for printing.");
		}
		const photo = located.photo;
		const width = Number(photo.width);
		const height = Number(photo.height);
		if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
			throw fail("This photograph is not available for printing.");
		}
		const orientation = width >= height ? "hor" : "ver";
		const longInches = Math.max(dimensions.width, dimensions.height);
		const shortInches = Math.min(dimensions.width, dimensions.height);
		const longPixels = Math.max(width, height);
		const shortPixels = Math.min(width, height);
		if (longPixels < longInches * PHOTO_PIXELS_PER_INCH || shortPixels < shortInches * PHOTO_PIXELS_PER_INCH) {
			throw fail("This photograph is too small for the selected size.");
		}
		const productUid = variant.productUid?.[orientation];
		const unitAmount = Math.round(Number(variant.price) * 100);
		if (typeof productUid !== "string" || !productUid || !Number.isSafeInteger(unitAmount) || unitAmount <= 0) {
			throw fail("This product or its selected options are no longer available.");
		}
		const optionLabels = {};
		for (const definition of product.options || []) {
			const selected = definition.values?.find((value) => value.value === options[definition.key]);
			if (!selected) throw fail("This product or its selected options are no longer available.");
			optionLabels[definition.label] = selected.label;
		}
		return {
			productSlug: product.slug,
			productName: product.name,
			category: product.category,
			size: variant.size,
			options: { ...options },
			optionLabels,
			variantPrice: unitAmount,
			quantity: requested.quantity,
			lineTotal: unitAmount * requested.quantity,
			orientation,
			productUid,
			photo: { id: photo.id, publicId: photo.publicId, width, height },
			crop,
		};
	});

	const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
	const shipping = lines.some((line) => line.category !== "Prints") ? 2000 : 800;
	return { lines, subtotal, shipping, total: subtotal + shipping };
};

const cropRectangle = (photo, size, crop = { x: 0, y: 0 }) => {
	const dimensions = parseSize(size);
	const width = Number(photo?.width);
	const height = Number(photo?.height);
	if (!dimensions || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
		throw fail("The photograph or print size is invalid.");
	}
	const offset = validateCrop(crop);
	const orientation = width >= height ? "hor" : "ver";
	const targetAspect = orientation === "hor"
		? Math.max(dimensions.width, dimensions.height) / Math.min(dimensions.width, dimensions.height)
		: Math.min(dimensions.width, dimensions.height) / Math.max(dimensions.width, dimensions.height);
	let cropWidth = width;
	let cropHeight = height;
	if (width / height > targetAspect) cropWidth = Math.round(height * targetAspect);
	else cropHeight = Math.round(width / targetAspect);
	cropWidth = Math.max(1, Math.min(width, cropWidth));
	cropHeight = Math.max(1, Math.min(height, cropHeight));
	const spareX = width - cropWidth;
	const spareY = height - cropHeight;
	// The mockup uses object-position: calc(50% + crop%), so positive crop selects the far-right/bottom end of the spare length.
	const x = Math.round(spareX * (0.5 + offset.x / 100));
	const y = Math.round(spareY * (0.5 + offset.y / 100));
	return { x: Math.max(0, Math.min(spareX, x)), y: Math.max(0, Math.min(spareY, y)), width: cropWidth, height: cropHeight };
};

const printFileUrl = (cloudName, photo, resource, rectangle) => {
	if (!cloudName || !photo?.publicId || !Number.isInteger(resource?.version) || resource.version <= 0 || !/^(jpg|png|tif|tiff)$/.test(resource.format || "")) {
		throw fail("The original print file could not be verified.", 503);
	}
	const { x, y, width, height } = rectangle || {};
	if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 || width <= 0 || height <= 0) {
		throw fail("The original print file could not be cropped.", 503);
	}
	const publicId = photo.publicId.split("/").map(encodeURIComponent).join("/");
	const crop = `c_crop,x_${x},y_${y},w_${width},h_${height}`;
	return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/${crop}/v${resource.version}/${publicId}.${resource.format}`;
};

const sessionMetadata = (pricedCart) => {
	if (!Array.isArray(pricedCart?.lines) || pricedCart.lines.length < 1 || pricedCart.lines.length > MAX_LINES) {
		throw fail("Order details cannot be saved for this cart.");
	}
	const metadata = { app: SHOP_ORDER_APP, line_count: String(pricedCart.lines.length) };
	pricedCart.lines.forEach((line, index) => {
		const value = JSON.stringify({
			p: line.productSlug,
			s: line.size,
			o: line.options,
			i: line.photo.id,
			c: [line.crop.x, line.crop.y],
			q: line.quantity,
		});
		if (Buffer.byteLength(value, "utf8") > 500) throw fail("Order details are too long to save.");
		metadata[`line_${index}`] = value;
	});
	return metadata;
};

const cartFromMetadata = (metadata) => {
	if (!isRecord(metadata) || metadata.app !== SHOP_ORDER_APP) throw fail("Order not found.", 404);
	const count = Number(metadata.line_count);
	if (!Number.isInteger(count) || count < 1 || count > MAX_LINES) throw fail("Order details could not be verified.", 409);
	const lines = [];
	for (let index = 0; index < count; index += 1) {
		const raw = metadata[`line_${index}`];
		if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > 500) throw fail("Order details could not be verified.", 409);
		let line;
		try { line = JSON.parse(raw); } catch { throw fail("Order details could not be verified.", 409); }
		if (!isRecord(line) || typeof line.p !== "string" || typeof line.s !== "string" || typeof line.i !== "string" || !isRecord(line.o) || !Array.isArray(line.c) || line.c.length !== 2 || !Number.isInteger(line.q)) {
			throw fail("Order details could not be verified.", 409);
		}
		lines.push({
			productSlug: line.p,
			size: line.s,
			options: line.o,
			photoId: line.i,
			crop: { x: line.c[0], y: line.c[1] },
			quantity: line.q,
		});
	}
	return { lines };
};

module.exports = { SHOP_ORDER_APP, cartFromMetadata, cartLines, cropRectangle, fail, parseSize, priceCart, printFileUrl, sessionMetadata };
