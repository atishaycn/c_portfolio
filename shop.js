(function (global) {
	"use strict";

	const option = (value, label, description, swatch) => ({
		value,
		label: label || value,
		description: description || "",
		swatch: swatch || "",
	});
	const optionGroup = (key, label, options, config = {}) => ({
		key,
		label,
		options,
		kind: config.kind || "buttons",
		required: Boolean(config.required),
		defaultValue: config.defaultValue || "",
	});

	const PRODUCT_PRESENTATION = {
		print: {
			description: "Choose 200 gsm semi-gloss or matte poster paper, or 250 gsm off-white archival matte paper.",
			heroDescription: "Semi-gloss, matte, or off-white archival matte poster paper.",
			productInfo: "200 gsm poster paper (semi-gloss or matte) or 250 gsm off-white archival matte paper.",
			optionDescriptions: {
				paper: {
					"semi-gloss": "200 gsm poster paper with a semi-gloss surface.",
					matte: "200 gsm poster paper with a matte surface.",
					"archival-matte": "250 gsm off-white archival matte paper.",
				},
			},
		},
		"fine-art-print": {
			description: "200 gsm enhanced matte fine art paper, printed in 12 colours.",
			heroDescription: "Enhanced matte fine art paper with 12-colour printing.",
			productInfo: "200 gsm enhanced matte fine art paper, 12-colour printing.",
		},
		canvas: {
			description: "Stretched on FSC wood bars, 2 cm or 4 cm deep.",
			heroDescription: "FSC wood bars in 2 cm or 4 cm depth.",
			productInfo: "Stretched on FSC wood bars, 2 cm (slim) or 4 cm (thick) deep.",
			optionDescriptions: { depth: { slim: "2 cm deep.", thick: "4 cm deep." } },
		},
		"framed-canvas": {
			description: "Slim canvas in a wood floater frame.",
			heroDescription: "Slim canvas in a wood floater frame.",
			productInfo: "Slim canvas in a wood floater frame.",
			optionDescriptions: {
				frame: {
					black: "Black wood floater frame.",
					"natural-wood": "Natural wood floater frame.",
					"dark-wood": "Dark wood floater frame.",
				},
			},
			swatches: { frame: { black: "#242424", "natural-wood": "#c8a77d", "dark-wood": "#543d2c" } },
		},
		"metal-print": {
			description: "3 mm aluminium with a white matte or brushed silver surface.",
			heroDescription: "3 mm aluminium with a white matte or brushed silver surface.",
			productInfo: "3 mm aluminium, white matte or brushed silver surface.",
			optionDescriptions: {
				finish: {
					"white-matte": "3 mm aluminium with a white matte surface.",
					"brushed-silver": "3 mm aluminium with a brushed silver surface.",
				},
			},
		},
		"acrylic-print": {
			description: "4 mm clear acrylic.",
			heroDescription: "4 mm clear acrylic.",
			productInfo: "4 mm clear acrylic.",
		},
		"wood-print": {
			description: "Birch-faced plywood in 10 mm or 20 mm thickness; the grain shows through light areas.",
			heroDescription: "Birch-faced plywood in 10 mm or 20 mm thickness.",
			productInfo: "Birch-faced plywood, 10 mm or 20 mm thick; the grain shows through light areas.",
			optionDescriptions: { thickness: { "10-mm": "10 mm thick.", "20-mm": "20 mm thick." } },
		},
		"foam-print": {
			description: "5 mm foam board with a black or white edge.",
			heroDescription: "5 mm foam board with a black or white edge.",
			productInfo: "5 mm foam board with a black or white edge.",
			optionDescriptions: { edge: { black: "5 mm foam board with a black edge.", white: "5 mm foam board with a white edge." } },
			swatches: { edge: { black: "#242424", white: "#f5f3ed" } },
		},
		"wood-frame": {
			description: "Fine art print behind plexiglass, delivered assembled in a wood frame with 12 mm moulding.",
			heroDescription: "Fine art print behind plexiglass in an assembled wood frame.",
			productInfo: "Fine art print behind plexiglass, delivered assembled in the wood frame. The wood moulding is 12 mm wide.",
			optionDescriptions: {
				frame: {
					black: "Black wood frame with 12 mm moulding.",
					white: "White wood frame with 12 mm moulding.",
					"natural-wood": "Natural wood frame with 12 mm moulding.",
					"dark-wood": "Dark wood frame with 12 mm moulding.",
				},
			},
			swatches: { frame: { black: "#242424", white: "#f5f3ed", "natural-wood": "#c8a77d", "dark-wood": "#543d2c" } },
		},
		"metal-frame": {
			description: "Fine art print behind plexiglass, delivered assembled in an aluminium frame with 10 mm moulding.",
			heroDescription: "Fine art print behind plexiglass in an assembled aluminium frame.",
			productInfo: "Fine art print behind plexiglass, delivered assembled in the aluminium frame. The aluminium moulding is 10 mm wide.",
		},
	};

	let SHOP_CATALOG = [];

	function sizeArea(size) {
		const dimensions = sizeDimensions(size);
		return dimensions.width * dimensions.height;
	}

	function buildProduct(productData) {
		if (!productData || typeof productData !== "object") return null;
		const presentation = PRODUCT_PRESENTATION[productData.slug];
		if (!presentation || !Array.isArray(productData.variants) || !productData.variants.length || !Array.isArray(productData.options)) return null;
		const sizes = Array.from(new Set(productData.variants.map((variant) => variant.size).filter(Boolean)));
		if (!sizes.length) return null;
		const defaultSize = sizes.reduce((smallest, size) => sizeArea(size) < sizeArea(smallest) ? size : smallest, sizes[0]);
		const options = productData.options.map((group) => ({
			key: group.key,
			label: group.label,
			values: (group.values || []).map((entry) => ({
				value: entry.value,
				label: entry.label || entry.value,
				description: presentation.optionDescriptions && presentation.optionDescriptions[group.key]
					? presentation.optionDescriptions[group.key][entry.value] || ""
					: "",
				swatch: presentation.swatches && presentation.swatches[group.key]
					? presentation.swatches[group.key][entry.value] || ""
					: "",
			})),
		}));
		const optionGroups = [
			optionGroup("size", "SIZE", sizes.map((size) => option(size)), { required: true, defaultValue: defaultSize }),
			...options.map((group) => optionGroup(group.key, group.label.toUpperCase(), group.values, {
				required: true,
				kind: group.key === "frame" || (productData.slug === "foam-print" && group.key === "edge") ? "swatch" : "buttons",
			})),
		];
		return {
			slug: productData.slug,
			name: productData.name,
			category: productData.category,
			description: presentation.description,
			heroDescription: presentation.heroDescription,
			productInfo: presentation.productInfo,
			sizes,
			options,
			optionGroups,
			variants: productData.variants.map((variant) => ({
				size: variant.size,
				options: { ...(variant.options || {}) },
				price: variant.price,
			})),
		};
	}

	function setCatalog(data) {
		const products = Array.isArray(data) ? data : data && data.products;
		const mapped = Array.isArray(products) ? products.map(buildProduct) : [];
		SHOP_CATALOG = mapped.length && mapped.every(Boolean) ? mapped : [];
		return SHOP_CATALOG;
	}
	const escapeHtml = (value) =>
		String(value === null || value === undefined ? "" : value)
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll('"', "&quot;")
			.replaceAll("'", "&#039;");
	const slugPart = (value) =>
		String(value || "")
			.toLowerCase()
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
	const categorySlug = (category) => slugPart(category);
	const productsInCategory = (category) => SHOP_CATALOG.filter((product) => product.category === category);
	const productForSlug = (slug) => SHOP_CATALOG.find((product) => product.slug === slug) || null;

	function selectStorePhotos(albums) {
		return (Array.isArray(albums) ? albums : []).flatMap((album) => {
			if (!album || album.printEnabled !== true || !Array.isArray(album.items)) return [];
			return album.items
				.filter((item) => item && item.printEnabled === true)
				.map((item) => ({ ...item, albumKey: album.key || "", albumLabel: album.label || "" }));
		});
	}

	function defaultSelections(product) {
		const selections = {};
		(product.optionGroups || []).forEach((group) => {
			if (group.defaultValue) selections[group.key] = group.defaultValue;
		});
		return selections;
	}

	function resolveSelections(product, selections) {
		return Object.assign(defaultSelections(product), selections || {});
	}

	function missingRequiredOptions(product, selections) {
		const resolved = resolveSelections(product, selections);
		return (product.optionGroups || [])
			.filter((group) => group.required && !group.options.some((entry) => entry.value === resolved[group.key]))
			.map((group) => group.key);
	}

	function fromPrice(product) {
		const prices = (product && Array.isArray(product.variants) ? product.variants : [])
			.map((variant) => Number(variant.price))
			.filter(Number.isFinite);
		return prices.length ? Math.min(...prices) : 0;
	}

	function optionGroups(product) {
		return (product && product.optionGroups ? product.optionGroups : []).filter((group) => group.key !== "size");
	}

	function matchingVariants(product, selections) {
		if (!product || !Array.isArray(product.variants)) return [];
		const resolved = resolveSelections(product, selections);
		const allowedKeys = new Set(["size", ...optionGroups(product).map((group) => group.key)]);
		if (Object.keys(resolved).some((key) => !allowedKeys.has(key))) return [];
		if (resolved.size && !product.sizes.includes(resolved.size)) return [];
		for (const group of optionGroups(product)) {
			if (resolved[group.key] && !group.options.some((entry) => entry.value === resolved[group.key])) return [];
		}
		return product.variants.filter((variant) => {
			if (resolved.size && variant.size !== resolved.size) return false;
			return optionGroups(product).every((group) => !resolved[group.key] || variant.options[group.key] === resolved[group.key]);
		});
	}

	function matchingVariant(product, selections) {
		const resolved = resolveSelections(product, selections);
		if (missingRequiredOptions(product, resolved).length) return null;
		const matches = matchingVariants(product, resolved);
		return matches.find((variant) => optionGroups(product).every((group) => variant.options[group.key] === resolved[group.key])) || null;
	}

	function priceFor(product, selections) {
		const exact = matchingVariant(product, selections);
		if (exact) return Number(exact.price);
		const matches = matchingVariants(product, selections);
		const prices = matches.map((variant) => Number(variant.price)).filter(Number.isFinite);
		return prices.length ? Math.min(...prices) : fromPrice(product);
	}

	function formatPrice(value) {
		return "$" + Number(value).toFixed(2);
	}

	function formatCents(value) {
		return formatPrice(Number(value) / 100);
	}

	const CART_STORAGE_KEY = "ct-shop-cart-v1";
	const CROP_OFFSET_LIMIT = 50;
	const PHOTO_PIXELS_PER_INCH = 125;
	const CHECKOUT_ERROR = "Checkout could not be started. Please try again.";
	const ORDER_ERROR = "We could not confirm this order yet.";

	function photoSupportsSize(photo, size) {
		const match = String(size || "").match(/^\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*$/i);
		const width = Number(photo && photo.width);
		const height = Number(photo && photo.height);
		if (!match || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false;
		const sizeWidth = Number(match[1]);
		const sizeHeight = Number(match[2]);
		return Math.max(width, height) >= Math.max(sizeWidth, sizeHeight) * PHOTO_PIXELS_PER_INCH
			&& Math.min(width, height) >= Math.min(sizeWidth, sizeHeight) * PHOTO_PIXELS_PER_INCH;
	}

	function checkoutRequest(cart) {
		return {
			lines: (Array.isArray(cart) ? cart : []).map((line) => {
				const selections = line && line.selections && typeof line.selections === "object" ? line.selections : {};
				const { size, ...options } = selections;
				return {
					productSlug: line.productSlug,
					size,
					options,
					photoId: line.photoId,
					crop: clampCrop(line.crop),
					quantity: line.quantity,
				};
			}),
		};
	}

	function readCheckoutParams(search) {
		const query = String(search || "").replace(/^\?/, "");
		const parameter = (name) => {
			const entry = query.split("&").find((part) => part.split("=", 1)[0] === name);
			if (!entry) return "";
			const value = entry.slice(entry.indexOf("=") + 1).replace(/\+/g, " ");
			try { return decodeURIComponent(value); } catch { return ""; }
		};
		return { checkout: parameter("checkout"), sessionId: parameter("session_id") };
	}

	function clampCrop(crop) {
		const offset = crop && typeof crop === "object" ? crop : {};
		const clamp = (value) => Math.max(-CROP_OFFSET_LIMIT, Math.min(CROP_OFFSET_LIMIT, Number.isFinite(Number(value)) ? Number(value) : 0));
		return { x: clamp(offset.x), y: clamp(offset.y) };
	}

	function lineTotal(line) {
		const unitPrice = Number(line && line.unitPrice);
		const quantity = Number(line && line.quantity);
		return Number.isFinite(unitPrice) && Number.isFinite(quantity) && quantity > 0
			? Math.round(unitPrice * quantity * 100) / 100
			: 0;
	}

	function cartSubtotal(cart) {
		return (Array.isArray(cart) ? cart : []).reduce((sum, line) => sum + lineTotal(line), 0);
	}

	function serializeCart(cart) {
		return JSON.stringify((Array.isArray(cart) ? cart : []).map((line) => ({
			lineId: String(line.lineId || ""),
			productSlug: String(line.productSlug || ""),
			selections: Object.assign({}, line.selections || {}),
			photoId: String(line.photoId || ""),
			crop: clampCrop(line.crop),
			quantity: Math.max(1, Math.floor(Number(line.quantity) || 1)),
			unitPrice: Math.round(Number(line.unitPrice || 0) * 100) / 100,
		})));
	}

	function parseCart(serialized, photos) {
		let entries;
		try {
			entries = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
		} catch {
			return [];
		}
		if (!Array.isArray(entries)) return [];
		const photoIds = new Set((Array.isArray(photos) ? photos : []).map(photoIdFor));
		const usedIds = new Set();
		return entries.flatMap((entry, index) => {
			if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
			const product = productForSlug(entry.productSlug);
			const photoId = String(entry.photoId || "");
			const quantity = Number(entry.quantity);
			if (!product || !photoIds.has(photoId) || !Number.isInteger(quantity) || quantity < 1) return [];
			const sourceSelections = entry.selections && typeof entry.selections === "object" && !Array.isArray(entry.selections)
				? entry.selections
				: {};
			const groups = product.optionGroups || [];
			const allowedKeys = new Set(groups.map((group) => group.key));
			if (Object.keys(sourceSelections).some((key) => !allowedKeys.has(key)) || !product.sizes.includes(sourceSelections.size)) return [];
			const selections = { size: sourceSelections.size };
			for (const group of groups.filter((entry) => entry.key !== "size")) {
				const selected = sourceSelections[group.key];
				if (!group.options.some((candidate) => candidate.value === selected)) return [];
				selections[group.key] = selected;
			}
			const variant = matchingVariant(product, selections);
			if (!variant) return [];
			let lineId = String(entry.lineId || "");
			if (!lineId || usedIds.has(lineId)) lineId = "cart-" + index + "-" + slugPart(product.slug) + "-" + slugPart(photoId);
			usedIds.add(lineId);
			return [{
				lineId,
				productSlug: product.slug,
				selections,
				photoId,
				crop: clampCrop(entry.crop),
				quantity,
				unitPrice: Number(variant.price),
			}];
		});
	}

	function photoIdFor(photo) {
		if (!photo) return "";
		return String(photo.id || photo.key || photo.url || photo.image || "");
	}

	function readCart(storage, photos) {
		try {
			return parseCart(storage ? storage.getItem(CART_STORAGE_KEY) : "[]", photos);
		} catch {
			return [];
		}
	}

	function writeCart(storage, cart) {
		try {
			if (storage) storage.setItem(CART_STORAGE_KEY, serializeCart(cart));
			return true;
		} catch {
			return false;
		}
	}

	function sizeDimensions(size) {
		const match = String(size || "").match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
		if (match) return { width: Number(match[1]), height: Number(match[2]) };
		return { width: 1, height: 1 };
	}

	function dimensionsFor(size, photo) {
		let dimensions = sizeDimensions(size);
		const photoWidth = Number(photo && photo.width) || 0;
		const photoHeight = Number(photo && photo.height) || 0;
		if (photoWidth && photoHeight) {
			const photoIsLandscape = photoWidth > photoHeight;
			const sizeIsLandscape = dimensions.width > dimensions.height;
			if ((photoIsLandscape && !sizeIsLandscape) || (!photoIsLandscape && sizeIsLandscape && photoWidth < photoHeight)) {
				dimensions = { width: dimensions.height, height: dimensions.width };
			}
		}
		return {
			...dimensions,
			ratio: dimensions.width / dimensions.height,
			orientation: dimensions.width === dimensions.height ? "square" : dimensions.width > dimensions.height ? "landscape" : "portrait",
		};
	}

	function optionValue(selections, key, fallback) {
		return (selections && selections[key]) || fallback || "";
	}

	function visualOptionValue(product, selections, key) {
		const selected = selections && selections[key];
		if (selected) return selected;
		const group = (product.options || []).find((entry) => entry.key === key);
		return group && group.values.length ? group.values[0].value : "";
	}

	function renderMockup(product, selections, photo, opts) {
		if (!product) return "";
		const settings = opts || {};
		const view = ["front", "angle", "corner", "wall"].includes(settings.view) ? settings.view : "angle";
		const selected = selections || {};
		const size = selected.size || product.sizes[0];
		const dimensions = dimensionsFor(size, photo);
		const ratio = Math.max(0.45, Math.min(2.25, dimensions.ratio));
		const frameValue = product.slug === "metal-frame" || (product.slug === "wood-frame" && !selected.frame)
			? "black"
			: visualOptionValue(product, selected, "frame");
		const finishValue = visualOptionValue(product, selected, "finish");
		const frameClass = frameValue ? "shop-finish--" + slugPart(frameValue) : "";
		const edgeValue = visualOptionValue(product, selected, "edge");
		const edgeClass = edgeValue ? "shop-edge--" + slugPart(edgeValue) : "";
		const optionClasses = (product.options || []).map((group) => {
			const value = selected[group.key];
			return value ? "shop-option--" + slugPart(group.key) + "-" + slugPart(value) : "";
		}).filter(Boolean).join(" ");
		const photoSource = typeof settings.imageUrl === "function"
			? settings.imageUrl(photo)
			: photo && (photo.url || photo.image) ? photo.url || photo.image : "";
		const photoAlt = photo && (photo.title || photo.alt) ? photo.title || photo.alt : "Photograph by Claire Thomas";
		const image = photoSource
			? '<img src="' + escapeHtml(photoSource) + '" alt="' + escapeHtml(photoAlt) + '" loading="' + (settings.eager ? "eager" : "lazy") + '" />'
			: '<span class="shop-mockup__placeholder" aria-hidden="true"></span>';
		const sideImage = photoSource
			? '<img src="' + escapeHtml(photoSource) + '" alt="" aria-hidden="true" loading="lazy" />'
			: '<span class="shop-mockup__placeholder" aria-hidden="true"></span>';
		let objectClass = "shop-mockup__object shop-mockup__object--print";
		let front = '<span class="shop-mockup__print-face">' + image + '</span>';
		let sideClass = "shop-side--paper";
		let side = "";
		let overlay = "";
		if (["metal-frame", "wood-frame"].includes(product.slug)) {
			objectClass = "shop-mockup__object shop-mockup__object--frame " + frameClass;
			front = '<span class="shop-mockup__frame-face">' + image + '</span>';
			sideClass = "shop-side--finish " + frameClass;
		} else if (product.slug === "framed-canvas") {
			objectClass = "shop-mockup__object shop-mockup__object--floater " + frameClass;
			front = '<span class="shop-mockup__floater-face"><span class="shop-mockup__canvas-face">' + image + '</span></span>';
			sideClass = "shop-side--finish " + frameClass;
		} else if (product.slug === "canvas") {
			objectClass = "shop-mockup__object shop-mockup__object--canvas";
			front = '<span class="shop-mockup__photo-face">' + image + '</span>';
			sideClass = "shop-side--photo";
			side = sideImage;
		} else if (product.slug === "metal-print") {
			const metalFinish = finishValue || visualOptionValue(product, selected, "finish");
			objectClass = "shop-mockup__object shop-mockup__object--metal shop-finish--" + slugPart(metalFinish);
			front = '<span class="shop-mockup__photo-face">' + image + '</span>';
			overlay = '<span class="shop-mockup__sheen" aria-hidden="true"></span>';
			sideClass = "shop-side--aluminium";
		} else if (product.slug === "acrylic-print") {
			objectClass = "shop-mockup__object shop-mockup__object--acrylic";
			front = '<span class="shop-mockup__photo-face">' + image + '</span>';
			overlay = '<span class="shop-mockup__sheen" aria-hidden="true"></span>';
			sideClass = "shop-side--acrylic";
		} else if (product.slug === "foam-print") {
			objectClass = "shop-mockup__object shop-mockup__object--foam " + edgeClass;
			front = '<span class="shop-mockup__photo-face">' + image + '</span>';
			sideClass = "shop-side--edge " + edgeClass;
		} else if (product.slug === "wood-print") {
			objectClass = "shop-mockup__object shop-mockup__object--wood";
			front = '<span class="shop-mockup__photo-face shop-mockup__photo-face--wood">' + image + '<span class="shop-mockup__wood-grain" aria-hidden="true"></span></span>';
			sideClass = "shop-side--grain";
		}
		const extraClass = settings.className ? " " + escapeHtml(settings.className) : "";
		const wallWidth = Math.min(78, dimensions.width / 36 * 72);
		const scene = view === "wall" ? '<span class="shop-mockup__room" aria-hidden="true"><span class="shop-mockup__furniture"></span></span>' : "";
		return '<div class="shop-mockup shop-mockup--' + escapeHtml(product.slug) + ' shop-mockup--view-' + view + (optionClasses ? " " + optionClasses : "") + extraClass +
			'" style="--shop-art-ratio:' + ratio.toFixed(4) + ';--shop-wall-art-width:' + wallWidth.toFixed(2) + '%;--shop-crop-x:' + clampCrop(settings.crop).x +
			'%;--shop-crop-y:' + clampCrop(settings.crop).y + '%" data-shop-view="' + view + '" data-shop-orientation="' + dimensions.orientation + '">' +
			scene + '<span class="shop-mockup__object ' + objectClass.replace("shop-mockup__object ", "") + '"><span class="shop-mockup__side ' + sideClass + '">' + side +
			'</span><span class="shop-mockup__front">' + front + overlay + '</span></span></div>';
	}

	function renderProductCard(product, state) {
		const productIndex = SHOP_CATALOG.indexOf(product);
		const photoCount = state.photos.length;
		const photo = photoCount ? state.photos[((productIndex % photoCount) + photoCount) % photoCount] : null;
		const secondPhoto = photoCount > 1 ? state.photos[(productIndex + 1) % photoCount] : photo;
		const selections = defaultSelections(product);
		const href = "./prints.html?product=" + encodeURIComponent(product.slug);
		return '<a class="shop-product-card" href="' + href + '" aria-label="' + escapeHtml(product.name) + ', from ' + escapeHtml(formatPrice(fromPrice(product))) + '">' +
			'<span class="shop-card-art"><span class="shop-card-composite">' +
			renderMockup(product, selections, secondPhoto, { imageUrl: state.imageUrl, className: "shop-card-piece shop-card-piece--back" }) +
			renderMockup(product, selections, photo, { imageUrl: state.imageUrl, className: "shop-card-piece shop-card-piece--front" }) +
			'</span></span>' +
			'<span class="shop-card-name">' + escapeHtml(product.name) + '</span>' +
			'<span class="shop-card-price">From ' + escapeHtml(formatPrice(fromPrice(product))) + '</span>' +
			'</a>';
	}

	function renderHeroSlide(product, index, state) {
		const photo = state.photos.length ? state.photos[(index * 3) % state.photos.length] : null;
		return '<div class="shop-hero-copy"><p class="shop-eyebrow">PRINTS AND WALL ART</p><h1>' + escapeHtml(product.name.toUpperCase()) +
			'</h1><p>' + escapeHtml(product.heroDescription || product.description) + '</p><a class="shop-hero-link" href="./prints.html?product=' +
			encodeURIComponent(product.slug) + '">EXPLORE ' + escapeHtml(product.name.toUpperCase()) + '</a></div>' +
			'<a class="shop-hero-art" href="./prints.html?product=' + encodeURIComponent(product.slug) + '" aria-label="View ' +
			escapeHtml(product.name) + '">' + renderMockup(product, defaultSelections(product), photo, { imageUrl: state.imageUrl }) + '</a>';
	}

	function renderStoreHome(state) {
		const activeIndex = state.heroIndex || 0;
		const categories = Array.from(new Set(SHOP_CATALOG.map((product) => product.category)));
		return '<section class="shop-page shop-home"><div class="shop-hero" aria-roledescription="carousel" aria-label="Featured print products">' +
			'<button class="shop-hero-arrow shop-hero-prev" type="button" data-shop-action="hero-prev" aria-label="Previous product">‹</button>' +
			'<div class="shop-hero-inner"><div class="shop-hero-slide">' + renderHeroSlide(SHOP_CATALOG[activeIndex], activeIndex, state) + '</div></div>' +
			'<button class="shop-hero-arrow shop-hero-next" type="button" data-shop-action="hero-next" aria-label="Next product">›</button>' +
			'<div class="shop-hero-dots" aria-label="Choose featured product">' + SHOP_CATALOG.map((product, index) =>
				'<button class="shop-hero-dot' + (index === activeIndex ? " is-active" : "") + '" type="button" data-shop-action="hero-go" data-shop-index="' + index +
				'" aria-label="Show ' + escapeHtml(product.name) + '" aria-pressed="' + (index === activeIndex ? "true" : "false") + '"></button>').join("") + '</div></div>' +
			'<div class="shop-shell"><nav class="shop-category-nav" aria-label="Shop categories"><span>Categories:</span>' +
			categories.map((category) => '<a href="#shop-category-' + categorySlug(category) + '">' + escapeHtml(category) + '</a>').join("") +
			'</nav>' + categories.map((category) => {
				const products = productsInCategory(category);
				return '<section class="shop-category-section" id="shop-category-' + categorySlug(category) + '">' +
					'<h2 class="shop-section-heading">' + escapeHtml(category) + '</h2><div class="shop-product-grid">' +
					products.map((product) => renderProductCard(product, state)).join("") + '</div></section>';
			}).join("") + '</div></section>';
	}

	function renderOptionGroup(product, group, state) {
		const selection = state.selections[group.key] || "";
		const invalid = state.invalid && state.invalid.has(group.key);
		const options = state.screen === "customize" && group.key === "size"
			? group.options.filter((entry) => state.lines.every((line) => photoSupportsSize(photoForId(state.photos, line.photoId), entry.value)))
			: group.options;
		const selectedOption = options.find((entry) => entry.value === selection);
		const selectedText = selectedOption ? selectedOption.label : (invalid ? "* Select an option" : "");
		const buttons = options.map((entry) => {
			const isSelected = selection === entry.value;
			const swatch = group.kind === "swatch"
				? '<span class="shop-swatch" style="--shop-swatch:' + escapeHtml(entry.swatch || "#ccc") + '" aria-hidden="true"></span>'
				: '<span class="shop-option-label">' + escapeHtml(entry.label) + '</span>';
			const previewSelections = Object.assign({}, state.selections, { [group.key]: entry.value });
			const detail = entry.description
				? '<span class="shop-option-detail" aria-hidden="true"><span class="shop-option-detail__visual">' +
					renderMockup(product, previewSelections, state.photos[state.photoIndex] || null, { imageUrl: state.imageUrl, view: "corner" }) +
					'</span><span class="shop-option-detail__title">' + escapeHtml(entry.label) + '</span><span class="shop-option-detail__description">' +
					escapeHtml(entry.description) + '</span></span>'
				: "";
			return '<button class="shop-option' + (group.kind === "swatch" ? " shop-option--swatch" : "") + (isSelected ? " is-selected" : "") +
				'" type="button" data-shop-option-group="' + escapeHtml(group.key) + '" data-shop-option-value="' + escapeHtml(entry.value) +
				'" aria-pressed="' + (isSelected ? "true" : "false") + '" aria-label="' + escapeHtml(entry.label) + '" title="' + escapeHtml(entry.label) + '">' +
				swatch + detail + '</button>';
		}).join("");
		return '<fieldset class="shop-option-group' + (invalid ? " is-invalid" : "") + '" data-shop-option-group-wrap="' + escapeHtml(group.key) + '"' +
			(invalid ? ' aria-invalid="true"' : "") + '><legend class="shop-option-heading"><span>' + escapeHtml(group.label) +
			'</span><span class="shop-option-selected" data-shop-selected-value>' + escapeHtml(selectedText) + '</span></legend>' +
			'<div class="shop-option-grid' + (group.kind === "swatch" ? " shop-option-grid--swatches" : "") + '">' + buttons + '</div></fieldset>';
	}

	function renderProductPage(product, state) {
		const categoryHref = "./prints.html#shop-category-" + categorySlug(product.category);
		const photo = state.photos[state.photoIndex] || null;
		const related = productsInCategory(product.category).filter((item) => item.slug !== product.slug).slice(0, 4);
		const views = [
			{ id: "front", label: "Front" },
			{ id: "angle", label: "Angle" },
			{ id: "corner", label: "Corner close-up" },
			{ id: "wall", label: "On the wall" },
		];
		const viewButtons = views.map((view) => '<button class="shop-view-thumb' + (state.view === view.id ? " is-active" : "") + '" type="button" data-shop-action="view-go" data-shop-view="' + view.id +
			'" aria-label="Show ' + view.label + ' view" aria-pressed="' + (state.view === view.id ? "true" : "false") + '"><span class="shop-view-thumb__preview">' +
			renderMockup(product, state.selections, photo, { imageUrl: state.imageUrl, eager: true, view: view.id }) + '</span><span class="shop-view-thumb__label">' + view.label + '</span></button>').join("");
		const priceText = missingRequiredOptions(product, state.selections).length
			? "From " + formatPrice(fromPrice(product))
			: formatPrice(priceFor(product, state.selections));
		return '<section class="shop-page shop-product-page"><div class="shop-shell">' +
			'<nav class="shop-breadcrumb" aria-label="Breadcrumb"><a href="./prints.html">HOME</a><span>/</span><a href="' + categoryHref + '">' +
			escapeHtml(product.category.toUpperCase()) + '</a><span>/</span><span aria-current="page">' + escapeHtml(product.name.toUpperCase()) + '</span></nav>' +
			'<div class="shop-product-layout"><div class="shop-product-gallery"><div class="shop-product-stage">' +
			'<button class="shop-product-arrow shop-product-prev" type="button" data-shop-action="photo-prev" aria-label="Previous photograph">‹</button>' +
			'<div class="shop-product-preview">' + renderMockup(product, state.selections, photo, { imageUrl: state.imageUrl, eager: true, view: state.view }) + '</div>' +
			'<button class="shop-product-arrow shop-product-next" type="button" data-shop-action="photo-next" aria-label="Next photograph">›</button></div>' +
			'<p class="shop-photo-counter" data-shop-photo-counter aria-live="polite">Photograph ' + (state.photoIndex + 1) + ' of ' + state.photos.length + '</p>' +
			'<div class="shop-thumbnail-strip" aria-label="Mockup views">' + viewButtons + '</div></div>' +
			'<div class="shop-product-details"><h1 class="shop-product-title">' + escapeHtml(product.name.toUpperCase()) + '</h1>' +
			'<p class="shop-product-price" data-shop-price>' + escapeHtml(priceText) + '</p><p class="shop-product-description">' + escapeHtml(product.description) + '</p>' +
			'<div class="shop-product-options">' + product.optionGroups.map((group) => renderOptionGroup(product, group, state)).join("") + '</div>' +
			'<button class="shop-primary-button" type="button" data-shop-action="open-picker">' + escapeHtml(
				["metal-frame", "wood-frame", "framed-canvas"].includes(product.slug) ? "Create your frame" : "Buy prints",
			) + '</button><p class="shop-photo-note" data-shop-photo-note role="status" aria-live="polite"></p>' +
			'<details class="shop-product-info" open><summary>Product info</summary><p>' + escapeHtml(product.productInfo) + '</p></details></div></div>' +
			'<section class="shop-related"><h2 class="shop-section-heading">You might also like</h2><div class="shop-product-grid">' +
			related.map((item) => renderProductCard(item, state)).join("") + '</div></section></div></section>';
	}

	function cartCount(cart) {
		return (cart || []).reduce((count, line) => count + line.quantity, 0);
	}

	function renderStoreBar(state) {
		const count = cartCount(state.cart);
		return '<div class="shop-storebar"><span class="shop-storebar__label">CLAIRE THOMAS ART <span>/</span> PRINT STORE</span><a class="shop-storebar__cart" href="./prints.html?view=cart" aria-label="Cart, ' + count + ' items">' +
			'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 1.9-1.4L21 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><span>Cart</span><span class="shop-storebar__count">' + count + '</span></a></div>';
	}

	function selectedOptions(product, selections) {
		return optionGroups(product).map((group) => {
			const selection = group.options.find((entry) => entry.value === selections[group.key]);
			return selection ? selection.label : "";
		}).filter(Boolean).join(" / ");
	}

	function photoForId(photos, id) {
		return photos.find((photo) => photoIdFor(photo) === String(id)) || null;
	}

	function renderCartPage(state) {
		const notice = state.checkoutNotice
			? '<p class="shop-checkout-notice" role="status">' + escapeHtml(state.checkoutNotice) + '</p>'
			: '';
		if (!state.cart.length) return '<section class="shop-page shop-cart-page"><div class="shop-shell"><header class="shop-cart-heading"><p class="shop-eyebrow">SHOPPING CART</p><h1>Your cart is empty</h1></header>' + notice + '<a class="shop-primary-button shop-cart-browse" href="./prints.html">Browse products</a></div></section>';
		const lines = state.cart.map((line) => {
			const product = productForSlug(line.productSlug);
			const photo = photoForId(state.photos, line.photoId);
			const summary = [line.selections.size, selectedOptions(product, line.selections)].filter(Boolean).join(" / ");
			return '<article class="shop-cart-line" data-shop-cart-line="' + escapeHtml(line.lineId) + '"><div class="shop-cart-line__art">' + renderMockup(product, line.selections, photo, { imageUrl: state.imageUrl, eager: true, crop: line.crop, view: "front" }) + '</div>' +
				'<div class="shop-cart-line__details"><h2>' + escapeHtml(product.name) + '</h2><p>' + escapeHtml(summary) + '</p><div class="shop-cart-line__tools"><div class="shop-quantity"><button type="button" data-shop-action="quantity-down" data-line-id="' + escapeHtml(line.lineId) + '" aria-label="Decrease quantity">−</button><input type="number" min="1" step="1" value="' + line.quantity + '" data-shop-quantity data-line-id="' + escapeHtml(line.lineId) + '" aria-label="Quantity"/><button type="button" data-shop-action="quantity-up" data-line-id="' + escapeHtml(line.lineId) + '" aria-label="Increase quantity">+</button></div>' +
				'<button class="shop-cart-remove" type="button" data-shop-action="remove-line" data-line-id="' + escapeHtml(line.lineId) + '">Remove</button></div></div><strong class="shop-cart-line__total">' + formatPrice(lineTotal(line)) + '</strong></article>';
		}).join("");
		return '<section class="shop-page shop-cart-page"><div class="shop-shell"><header class="shop-cart-heading"><p class="shop-eyebrow">SHOPPING CART</p><h1>Your cart</h1></header><div class="shop-cart-lines">' + lines + '</div>' +
			notice + '<div class="shop-cart-summary"><div><span>Subtotal</span><strong>' + formatPrice(cartSubtotal(state.cart)) + '</strong></div><p>US shipping is added at checkout.</p><button class="shop-primary-button" type="button" data-shop-action="checkout"' + (state.checkoutStarting ? ' disabled' : '') + '>' + (state.checkoutStarting ? 'Starting checkout…' : 'Checkout') + '</button>' +
			'<p class="shop-checkout-message" data-shop-checkout tabindex="-1"' + (state.checkoutMessage ? '' : ' hidden') + ' role="status">' + escapeHtml(state.checkoutMessage || '') + '</p></div></div></section>';
	}

	function renderPicker(state) {
		const tiles = state.photos.map((photo) => {
			const id = photoIdFor(photo);
			const selected = state.selectedPhotoIds.has(id);
			const eligible = photoSupportsSize(photo, state.pickerSize);
			const source = state.imageUrl(photo);
			const ratio = (Number(photo.width) || 1) / (Number(photo.height) || 1);
			return '<button class="shop-picker-photo' + (selected ? ' is-selected' : '') + (eligible ? '' : ' is-too-small') + '" type="button" data-shop-action="picker-toggle" data-photo-id="' + escapeHtml(id) + '" aria-pressed="' + selected + '" aria-label="' + escapeHtml((photo.title || photo.alt || "Photograph") + (eligible ? '' : ', Too small for this size')) + '"' + (eligible ? '' : ' disabled') + ' style="--shop-photo-ratio:' + ratio.toFixed(4) + '"><span class="shop-picker-photo__image">' +
				(source ? '<img src="' + escapeHtml(source) + '" alt="" loading="lazy"/>' : '<span class="shop-mockup__placeholder"></span>') + '</span><span class="shop-picker-photo__check" aria-hidden="true">✓</span>' + (photo.title ? '<span class="shop-picker-photo__title">' + escapeHtml(photo.title) + '</span>' : '') + (eligible ? '' : '<span class="shop-picker-photo__warning">Too small for this size</span>') + '</button>';
		}).join("");
		return '<div class="shop-picker-overlay" data-shop-picker-backdrop><section class="shop-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="shop-picker-title" tabindex="-1"><header class="shop-picker-header"><button class="shop-icon-button" type="button" data-shop-action="picker-close" aria-label="Close">×</button><div><h1 id="shop-picker-title">Select photos</h1><p data-shop-picker-count>' + state.selectedPhotoIds.size + ' ' + (state.selectedPhotoIds.size === 1 ? 'photo' : 'photos') + ' selected</p></div><a class="shop-picker-cart" href="./prints.html?view=cart" aria-label="Cart, ' + cartCount(state.cart) + ' items">Cart <span>' + cartCount(state.cart) + '</span></a><button class="shop-picker-next" type="button" data-shop-action="picker-next"' + (state.selectedPhotoIds.size ? '' : ' disabled') + '>Next</button></header>' +
			(state.photos.length ? '<div class="shop-picker-grid">' + tiles + '</div>' : '<p class="shop-picker-empty">No print-enabled photos are available yet.</p>') + '</section></div>';
	}

	function customizePrice(product, selections) {
		const options = selectedOptions(product, selections);
		return (options ? options + " - " : "") + formatPrice(priceFor(product, selections));
	}

	function renderCustomizeLine(line, state, index) {
		const product = state.product;
		const photo = photoForId(state.photos, line.photoId);
		const selections = line.selections || state.selections;
		const sizes = product.sizes.filter((size) => photoSupportsSize(photo, size)).map((size) => '<option value="' + escapeHtml(size) + '"' + (size === selections.size ? ' selected' : '') + '>' + escapeHtml(size) + '</option>').join("");
		const cropping = state.cropActiveLineId === line.lineId;
		return '<article class="shop-customize-card"><header class="shop-customize-card__heading"><p>PHOTO ' + (index + 1) + ' OF ' + state.lines.length + '</p><h2>' + escapeHtml(photo && (photo.title || photo.alt) || 'Selected photograph') + '</h2></header>' +
			'<div class="shop-customize-art-wrap"><div class="shop-customize-art' + (cropping ? ' is-crop-active' : '') + '" data-shop-crop-id="' + escapeHtml(line.lineId) + '" tabindex="0" role="group" aria-label="' + (cropping ? 'Drag or use arrow keys to adjust crop' : 'Photograph preview') + '">' + renderMockup(product, selections, photo, { imageUrl: state.imageUrl, eager: true, view: "front", crop: line.crop }) + '</div></div>' +
			'<div class="shop-customize-line-controls"><div class="shop-customize-crop-actions"><button type="button" data-shop-action="crop-toggle" data-line-id="' + escapeHtml(line.lineId) + '">' + (cropping ? 'Done cropping' : 'Edit crop') + '</button><button type="button" data-shop-action="change-photo" data-line-id="' + escapeHtml(line.lineId) + '">Change</button></div>' +
			(cropping ? '<p class="shop-crop-help">Drag the photo or use arrow keys to reposition it.</p>' : '') + '<div class="shop-customize-size-quantity"><label>Size<select data-shop-size-select data-line-id="' + escapeHtml(line.lineId) + '" aria-label="Print size">' + sizes + '</select></label>' +
			'<label class="shop-quantity-field">Quantity<span class="shop-quantity"><button type="button" data-shop-action="quantity-down" data-line-id="' + escapeHtml(line.lineId) + '" aria-label="Decrease quantity">−</button><input type="number" min="1" step="1" value="' + line.quantity + '" data-shop-quantity data-line-id="' + escapeHtml(line.lineId) + '" aria-label="Quantity"/><button type="button" data-shop-action="quantity-up" data-line-id="' + escapeHtml(line.lineId) + '" aria-label="Increase quantity">+</button></span></label></div></div></article>';
	}

	function renderEditPanel(state) {
		if (!state.editPanelOpen) return "";
		const product = state.product;
		return '<div class="shop-edit-product-backdrop"><aside class="shop-edit-product-panel" role="dialog" aria-modal="true" aria-labelledby="shop-edit-product-title" tabindex="-1"><header><div><p class="shop-eyebrow">CUSTOMIZE</p><h2 id="shop-edit-product-title">Edit product</h2></div><button class="shop-icon-button" type="button" data-shop-action="close-edit-product" aria-label="Close product options">×</button></header>' +
			'<div class="shop-product-options">' + product.optionGroups.map((group) => renderOptionGroup(product, group, state)).join("") + '</div></aside></div>';
	}

	function renderCustomize(state) {
		const product = state.product;
		const line = state.lines.find((entry) => entry.lineId === state.previewLineId) || state.lines[0];
		const selections = line && line.selections || state.selections;
		const size = selections.size || product.sizes[0];
		const photo = line && photoForId(state.photos, line.photoId);
		const preview = state.previewLineId && line ? '<div class="shop-preview-overlay" data-shop-preview-backdrop><section class="shop-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="shop-preview-title" tabindex="-1"><header><h2 id="shop-preview-title">Preview on the wall</h2><button class="shop-icon-button" type="button" data-shop-action="preview-close" aria-label="Close preview">×</button></header><div class="shop-preview-wall">' + renderMockup(product, selections, photo, { imageUrl: state.imageUrl, eager: true, view: "wall", crop: line.crop }) + '</div></section></div>' : '';
		return '<section class="shop-page shop-customize-page"><header class="shop-customize-bar"><button class="shop-customize-back" type="button" data-shop-action="customize-back" aria-label="Back to photo selection">←</button><div class="shop-customize-bar__title"><h1 tabindex="-1">' + escapeHtml(size) + '" ' + escapeHtml(product.name) + '</h1><p>' + escapeHtml(customizePrice(product, selections)) + '</p></div><div class="shop-customize-bar__actions"><button type="button" data-shop-action="preview">Preview</button><button type="button" data-shop-action="edit-product">Edit product</button><button class="shop-customize-add" type="button" data-shop-action="add-to-cart">Add to cart</button></div></header>' +
			'<div class="shop-shell shop-customize-shell"><div class="shop-customize-lines">' + state.lines.map((entry, index) => renderCustomizeLine(entry, state, index)).join("") + '</div></div>' + renderEditPanel(state) + preview + '</section>';
	}

	function renderOrderPage(state) {
		if (state.orderStatus === "loading") return '<section class="shop-page shop-order-page"><div class="shop-shell"><h1>Order confirmation</h1><p role="status">Confirming your order…</p></div></section>';
		if (state.orderStatus !== "confirmed") return '<section class="shop-page shop-order-page"><div class="shop-shell"><h1>Order confirmation</h1><p role="status">' + escapeHtml(state.orderError || ORDER_ERROR) + '</p><a href="./prints.html?view=cart">Return to your cart</a></div></section>';
		const lines = (state.order.lines || []).map((line) => {
			const options = Object.entries(line.optionLabels || {}).map(([label, value]) => label + ': ' + value).join(' · ');
			const details = [line.size, options, 'Quantity: ' + line.quantity].filter(Boolean).join(' · ');
			return '<li class="shop-order-line"><div><strong>' + escapeHtml(line.productName || 'Print') + '</strong><p>' + escapeHtml(details) + '</p></div><span>' + formatCents(line.lineTotal) + '</span></li>';
		}).join("");
		return '<section class="shop-page shop-order-page"><div class="shop-shell"><h1>Thank you. Your order is confirmed.</h1><ul class="shop-order-lines">' + lines + '</ul><p class="shop-order-total"><span>Total</span><strong>' + formatCents(state.order.total) + '</strong></p></div></section>';
	}

	function renderStoreContent(state) {
		let content;
		if (state.screen === "order") content = renderOrderPage(state);
		else if (state.screen === "cart") content = renderCartPage(state);
		else if (state.screen === "customize") content = renderCustomize(state);
		else {
			content = state.product ? renderProductPage(state.product, state) : renderStoreHome(state);
			if (state.pageNotFound) content = content.replace('<div class="shop-shell">', '<div class="shop-shell"><p class="shop-not-found">That product is unavailable. Browse all prints and wall art below.</p>');
			if (state.screen === "picker") content += renderPicker(state);
		}
		return renderStoreBar(state) + content;
	}

	let activeState = null;
	let activeRoot = null;
	let heroTimer = null;

	function renderPage(context) {
		if (!SHOP_CATALOG.length) {
			activeState = null;
			return '<div class="shop-store"><section class="shop-page shop-unavailable"><div class="shop-shell"><h1>The print store is unavailable right now</h1>' +
				'<p>For print inquiries, email <a href="mailto:contact@clairethomas.art">contact@clairethomas.art</a>.</p></div></section></div>';
		}
		const safeContext = context || {};
		const photos = selectStorePhotos(safeContext.albums || []);
		const params = global.location && global.URLSearchParams ? new global.URLSearchParams(global.location.search) : null;
		const checkout = readCheckoutParams(global.location ? global.location.search : "");
		const screen = checkout.checkout === "success"
			? "order"
			: checkout.checkout === "cancelled" || (params && params.get("view") === "cart") ? "cart" : "page";
		const url = safeContext.productSlug === undefined ? (params ? params.get("product") : "") : safeContext.productSlug;
		const product = productForSlug(url);
		let storage = null;
		try { storage = global.localStorage || null; } catch { storage = null; }
		activeState = {
			photos,
			imageUrl: typeof safeContext.imageUrl === "function"
				? safeContext.imageUrl
				: (photo) => photo && (photo.url || photo.image) ? photo.url || photo.image : "",
			heroIndex: 0,
			product,
			photoIndex: 0,
			view: "angle",
			selections: product ? resolveSelections(product, safeContext.selections) : {},
			invalid: new Set(),
			cart: readCart(storage, photos),
			storage,
			screen,
			checkoutNotice: checkout.checkout === "cancelled" ? "Checkout was cancelled. Your cart is saved." : "",
			checkoutStarting: false,
			checkoutMessage: "",
			checkoutSessionId: checkout.sessionId,
			orderStatus: checkout.checkout === "success" ? "loading" : "idle",
			orderRequestStarted: false,
			order: null,
			orderError: "",
			pickerSize: "",
			pageNotFound: Boolean(url && !product),
			selectedPhotoIds: new Set(),
			pickerMode: "new",
			pickerReturnScreen: "page",
			lines: [],
			cropActiveLineId: "",
			cropDrag: null,
			editPanelOpen: false,
			previewLineId: "",
		};
		return '<div class="shop-store">' + renderStoreContent(activeState) + '</div>';
	}

	function renderStore() {
		const store = activeRoot && activeRoot.querySelector(".shop-store");
		if (store) store.innerHTML = renderStoreContent(activeState);
	}

	function focusShop(selector) {
		const element = activeRoot && activeRoot.querySelector(selector);
		if (element && element.focus) element.focus();
	}

	async function responseJson(response) {
		try { return await response.json(); } catch { return null; }
	}

	async function startCheckout() {
		if (!activeState || activeState.screen !== "cart" || activeState.checkoutStarting) return;
		activeState.checkoutStarting = true;
		activeState.checkoutMessage = "";
		renderStore();
		try {
			const response = await global.fetch("/api/shop-checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(checkoutRequest(activeState.cart)),
			});
			const body = await responseJson(response);
			if (response.status === 200 && typeof body?.url === "string") {
				global.location.assign(body.url);
				return;
			}
			activeState.checkoutMessage = typeof body?.error === "string" && body.error.trim() ? body.error : CHECKOUT_ERROR;
		} catch {
			activeState.checkoutMessage = CHECKOUT_ERROR;
		}
		activeState.checkoutStarting = false;
		renderStore();
		focusShop("[data-shop-checkout]");
	}

	async function confirmOrder() {
		if (!activeState || activeState.screen !== "order" || activeState.orderRequestStarted) return;
		activeState.orderRequestStarted = true;
		if (!activeState.checkoutSessionId) {
			activeState.orderStatus = "failed";
			activeState.orderError = ORDER_ERROR;
			renderStore();
			return;
		}
		try {
			const response = await global.fetch("/api/shop-order?session_id=" + encodeURIComponent(activeState.checkoutSessionId));
			const body = await responseJson(response);
			if (response.status === 200 && body?.paid === true) {
				activeState.order = body;
				activeState.orderStatus = "confirmed";
				activeState.cart = [];
				saveCart();
			} else {
				activeState.orderStatus = "failed";
				activeState.orderError = typeof body?.error === "string" && body.error.trim() ? body.error : ORDER_ERROR;
			}
		} catch {
			activeState.orderStatus = "failed";
			activeState.orderError = ORDER_ERROR;
		}
		renderStore();
	}

	function openPhotoPicker(product, selections, settings) {
		if (!activeState || !product) return;
		const options = settings || {};
		activeState.product = product;
		activeState.selections = resolveSelections(product, selections || activeState.selections);
		activeState.pickerSize = options.size || activeState.selections.size;
		activeState.pickerMode = options.mode || "new";
		activeState.pickerReturnScreen = options.returnScreen || "page";
		activeState.changeLineId = options.lineId || "";
		if (activeState.pickerMode === "replace") {
			const line = activeState.lines.find((entry) => entry.lineId === activeState.changeLineId);
			activeState.selectedPhotoIds = new Set(line ? [line.photoId] : []);
		} else if (activeState.pickerMode === "review") activeState.selectedPhotoIds = new Set(activeState.lines.map((line) => line.photoId));
		else activeState.selectedPhotoIds = new Set();
		activeState.screen = "picker";
		renderStore();
		focusShop('[data-shop-action="picker-close"]');
	}

	function closePhotoPicker() {
		if (!activeState) return;
		const returnScreen = activeState.pickerReturnScreen;
		activeState.screen = returnScreen === "customize" ? "customize" : "page";
		activeState.selectedPhotoIds.clear();
		activeState.changeLineId = "";
		renderStore();
		focusShop(returnScreen === "customize" ? '[data-shop-action="change-photo"]' : '[data-shop-action="open-picker"]');
	}

	function updateHero() {
		if (!activeRoot || !activeState || activeState.product) return;
		const slide = activeRoot.querySelector(".shop-hero-slide");
		if (slide) slide.innerHTML = renderHeroSlide(SHOP_CATALOG[activeState.heroIndex], activeState.heroIndex, activeState);
		activeRoot.querySelectorAll(".shop-hero-dot").forEach((dot) => {
			const selected = Number(dot.dataset.shopIndex) === activeState.heroIndex;
			dot.classList.toggle("is-active", selected);
			dot.setAttribute("aria-pressed", selected ? "true" : "false");
		});
	}

	function updateProductPriceAndOptions() {
		if (!activeRoot || !activeState || !activeState.product) return;
		const product = activeState.product;
		const missing = new Set(missingRequiredOptions(product, activeState.selections));
		const price = activeRoot.querySelector("[data-shop-price]");
		if (price) {
			price.textContent = missing.size
				? "From " + formatPrice(fromPrice(product))
				: formatPrice(priceFor(product, activeState.selections));
		}
		activeRoot.querySelectorAll("[data-shop-option-group-wrap]").forEach((wrap) => {
			const key = wrap.dataset.shopOptionGroupWrap;
			const selected = activeState.selections[key] || "";
			const heading = wrap.querySelector("[data-shop-selected-value]");
			const invalid = activeState.invalid.has(key) && !selected;
			wrap.classList.toggle("is-invalid", invalid);
			if (invalid) wrap.setAttribute("aria-invalid", "true");
			else wrap.removeAttribute("aria-invalid");
			const group = product.optionGroups.find((entry) => entry.key === key);
			const selectedOption = group && group.options.find((entry) => entry.value === selected);
			if (heading) heading.textContent = selectedOption ? selectedOption.label : (invalid ? "* Select an option" : "");
			wrap.querySelectorAll("[data-shop-option-group]").forEach((button) => {
				const chosen = button.dataset.shopOptionValue === selected;
				button.classList.toggle("is-selected", chosen);
				button.setAttribute("aria-pressed", chosen ? "true" : "false");
				const detailVisual = button.querySelector(".shop-option-detail__visual");
				if (detailVisual) {
					const optionSelections = Object.assign({}, activeState.selections, { [key]: button.dataset.shopOptionValue });
				detailVisual.innerHTML = renderMockup(product, optionSelections, activeState.photos[activeState.photoIndex] || null, { imageUrl: activeState.imageUrl, view: "corner" });
				}
			});
		});
		updateProductGallery();
	}

	function updateProductGallery() {
		if (!activeRoot || !activeState || !activeState.product) return;
		const product = activeState.product;
		const photo = activeState.photos[activeState.photoIndex] || null;
		const preview = activeRoot.querySelector(".shop-product-preview");
		if (preview) {
			preview.innerHTML = renderMockup(product, activeState.selections, photo, {
				imageUrl: activeState.imageUrl,
				eager: true,
				view: activeState.view,
			});
		}
		activeRoot.querySelectorAll(".shop-view-thumb").forEach((button) => {
			const view = button.dataset.shopView;
			const selected = view === activeState.view;
			button.classList.toggle("is-active", selected);
			button.setAttribute("aria-pressed", selected ? "true" : "false");
			const visual = button.querySelector(".shop-view-thumb__preview");
			if (visual) {
				visual.innerHTML = renderMockup(product, activeState.selections, photo, {
					imageUrl: activeState.imageUrl,
					eager: true,
					view,
				});
			}
		});
		const counter = activeRoot.querySelector("[data-shop-photo-counter]");
		if (counter) counter.textContent = "Photograph " + (activeState.photoIndex + 1) + " of " + activeState.photos.length;
	}

	function updatePhoto(index) {
		if (!activeState || !activeState.photos.length) return;
		const count = activeState.photos.length;
		activeState.photoIndex = ((index % count) + count) % count;
		updateProductPriceAndOptions();
	}

	function newLineId() {
		try { if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID(); } catch { /* use fallback */ }
		return "line-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
	}

	function saveCart() {
		try { if (activeState.storage) activeState.storage.setItem(CART_STORAGE_KEY, serializeCart(activeState.cart)); } catch { /* keep the in-memory cart available */ }
	}

	function focusPhoto(id) {
		const button = activeRoot && Array.from(activeRoot.querySelectorAll("[data-photo-id]")).find((entry) => entry.dataset.photoId === id);
		if (button) button.focus();
	}

	function updatePickerPhoto(id) {
		if (!activeRoot || !id) return;
		const button = Array.from(activeRoot.querySelectorAll(".shop-picker-photo")).find((entry) => entry.dataset.photoId === id);
		if (!button) return;
		const selected = activeState.selectedPhotoIds.has(id);
		button.classList.toggle("is-selected", selected);
		button.setAttribute("aria-pressed", selected ? "true" : "false");
	}

	function updatePickerSelectionSummary() {
		if (!activeRoot) return;
		const count = activeState.selectedPhotoIds.size;
		const counter = activeRoot.querySelector("[data-shop-picker-count]");
		if (counter) counter.textContent = count + " " + (count === 1 ? "photo" : "photos") + " selected";
		const next = activeRoot.querySelector('[data-shop-action="picker-next"]');
		if (next) next.disabled = count === 0;
	}

	function finishPhotoSelection() {
		if (!activeState.selectedPhotoIds.size) return;
		const ids = Array.from(activeState.selectedPhotoIds);
		if (activeState.pickerMode === "replace") {
			const line = activeState.lines.find((entry) => entry.lineId === activeState.changeLineId);
			if (line) line.photoId = ids[0];
		} else if (activeState.pickerMode === "review") {
			const oldLines = activeState.lines.slice();
			activeState.lines = ids.map((photoId) => {
				const existing = oldLines.find((line) => line.photoId === photoId);
				return existing
					? Object.assign({}, existing, { selections: Object.assign({}, existing.selections || activeState.selections) })
					: { lineId: newLineId(), photoId, selections: Object.assign({}, activeState.selections), crop: { x: 0, y: 0 }, quantity: 1 };
			});
		} else activeState.lines = ids.map((photoId) => ({ lineId: newLineId(), photoId, selections: Object.assign({}, activeState.selections), crop: { x: 0, y: 0 }, quantity: 1 }));
		activeState.screen = "customize";
		activeState.cropActiveLineId = "";
		activeState.editPanelOpen = false;
		activeState.previewLineId = "";
		activeState.selectedPhotoIds.clear();
		activeState.changeLineId = "";
		renderStore();
		focusShop(".shop-customize-bar__title h1");
	}

	function changeQuantity(lineId, delta, value) {
		const line = activeState.screen === "cart"
			? activeState.cart.find((entry) => entry.lineId === lineId)
			: activeState.lines.find((entry) => entry.lineId === lineId);
		if (!line) return;
		line.quantity = Math.max(1, Math.floor(value === undefined ? Number(line.quantity) + delta : Number(value) || 1));
		if (activeState.screen === "cart") saveCart();
		renderStore();
	}

	function addToCart() {
		const product = activeState.product;
		const items = activeState.lines.map((line) => {
			const selections = Object.assign({}, activeState.selections, line.selections || {});
			return {
				lineId: line.lineId,
				productSlug: product.slug,
				selections,
				photoId: line.photoId,
				crop: clampCrop(line.crop),
				quantity: Math.max(1, Math.floor(Number(line.quantity) || 1)),
				unitPrice: priceFor(product, selections),
			};
		});
		activeState.cart = activeState.cart.concat(items);
		saveCart();
		activeState.screen = "cart";
		activeState.checkoutStarting = false;
		activeState.checkoutMessage = "";
		activeState.checkoutNotice = "";
		try {
			const url = new URL(global.location.href);
			url.searchParams.delete("product");
			url.searchParams.set("view", "cart");
			global.history.pushState({}, "", url.toString());
		} catch { /* cart screen stays available if History API is unavailable */ }
		renderStore();
		focusShop(".shop-cart-heading h1");
	}

	function updateCrop(lineId, x, y) {
		const line = activeState.lines.find((entry) => entry.lineId === lineId);
		if (!line) return;
		line.crop = clampCrop({ x, y });
		const surface = activeRoot && Array.from(activeRoot.querySelectorAll("[data-shop-crop-id]")).find((entry) => entry.dataset.shopCropId === lineId);
		const mockup = surface && surface.querySelector(".shop-mockup");
		if (mockup) {
			mockup.style.setProperty("--shop-crop-x", line.crop.x + "%");
			mockup.style.setProperty("--shop-crop-y", line.crop.y + "%");
		}
	}

	function trapDialogTab(event, dialog) {
		const items = Array.from(dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'));
		if (!items.length) { event.preventDefault(); dialog.focus(); return; }
		const first = items[0];
		const last = items[items.length - 1];
		if (event.shiftKey && (global.document.activeElement === first || !dialog.contains(global.document.activeElement))) { event.preventDefault(); last.focus(); }
		else if (!event.shiftKey && (global.document.activeElement === last || !dialog.contains(global.document.activeElement))) { event.preventDefault(); first.focus(); }
	}

	function handleKeyDown(event) {
		const dialog = activeRoot && activeRoot.querySelector(".shop-picker-dialog, .shop-preview-dialog, .shop-edit-product-panel");
		if (dialog && event.key === "Escape") {
			event.preventDefault();
			if (dialog.classList.contains("shop-picker-dialog")) closePhotoPicker();
			else if (dialog.classList.contains("shop-preview-dialog")) { activeState.previewLineId = ""; renderStore(); focusShop('[data-shop-action="preview"]'); }
			else { activeState.editPanelOpen = false; renderStore(); focusShop('[data-shop-action="edit-product"]'); }
			return;
		}
		if (dialog && event.key === "Tab") { trapDialogTab(event, dialog); return; }
		const surface = event.target && event.target.closest ? event.target.closest("[data-shop-crop-id]") : null;
		if (!surface || surface.dataset.shopCropId !== activeState.cropActiveLineId) return;
		if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
		const line = activeState.lines.find((entry) => entry.lineId === activeState.cropActiveLineId);
		if (!line) return;
		event.preventDefault();
		updateCrop(line.lineId, line.crop.x + (event.key === "ArrowLeft" ? 2 : event.key === "ArrowRight" ? -2 : 0), line.crop.y + (event.key === "ArrowUp" ? 2 : event.key === "ArrowDown" ? -2 : 0));
	}

	function handlePointerDown(event) {
		if (!activeState.cropActiveLineId || !event.target || !event.target.closest) return;
		const surface = event.target.closest("[data-shop-crop-id]");
		if (!surface || surface.dataset.shopCropId !== activeState.cropActiveLineId) return;
		const line = activeState.lines.find((entry) => entry.lineId === surface.dataset.shopCropId);
		if (!line) return;
		const rect = surface.getBoundingClientRect();
		activeState.cropDrag = { lineId: line.lineId, startX: event.clientX, startY: event.clientY, width: rect.width, height: rect.height, crop: clampCrop(line.crop) };
		if (surface.setPointerCapture) surface.setPointerCapture(event.pointerId);
		event.preventDefault();
	}

	function handlePointerMove(event) {
		const drag = activeState.cropDrag;
		if (!drag) return;
		updateCrop(drag.lineId, drag.crop.x - (event.clientX - drag.startX) / Math.max(1, drag.width) * 100, drag.crop.y - (event.clientY - drag.startY) / Math.max(1, drag.height) * 100);
	}

	function handlePointerUp() { if (activeState) activeState.cropDrag = null; }

	function handleClick(event) {
		const target = event.target && event.target.closest ? event.target : null;
		if (!target || !activeRoot || !activeState) return;
		const pickerDialog = activeRoot.querySelector(".shop-picker-dialog");
		if (pickerDialog && target.matches(".shop-picker-overlay")) { closePhotoPicker(); return; }
		if (target.matches(".shop-preview-overlay")) { activeState.previewLineId = ""; renderStore(); focusShop('[data-shop-action="preview"]'); return; }
		if (target.matches(".shop-edit-product-backdrop")) { activeState.editPanelOpen = false; renderStore(); focusShop('[data-shop-action="edit-product"]'); return; }
		const action = target.closest("[data-shop-action]");
		if (action) {
			const name = action.dataset.shopAction;
			if (name === "hero-next" || name === "hero-prev") {
				activeState.heroIndex = (activeState.heroIndex + (name === "hero-next" ? 1 : SHOP_CATALOG.length - 1)) % SHOP_CATALOG.length;
				updateHero();
				return;
			}
			if (name === "hero-go") {
				activeState.heroIndex = Number(action.dataset.shopIndex) % SHOP_CATALOG.length;
				updateHero();
				return;
			}
			if (name === "photo-prev" || name === "photo-next") {
				updatePhoto(activeState.photoIndex + (name === "photo-next" ? 1 : -1));
				return;
			}
			if (name === "photo-go") {
				updatePhoto(Number(action.dataset.shopIndex));
				return;
			}
			if (name === "view-go") {
				activeState.view = action.dataset.shopView;
				updateProductGallery();
				return;
			}
			if (name === "open-picker") {
				const missing = missingRequiredOptions(activeState.product, activeState.selections);
				activeState.invalid = new Set(missing);
				updateProductPriceAndOptions();
				if (missing.length) {
					const first = activeRoot.querySelector('[data-shop-option-group-wrap="' + missing[0] + '"]');
					if (first) first.scrollIntoView({ block: "nearest", behavior: "smooth" });
					return;
				}
				openPhotoPicker(activeState.product, activeState.selections, { mode: "new", returnScreen: "page" });
				return;
			}
			if (name === "picker-close") { closePhotoPicker(); return; }
			if (name === "picker-toggle") {
				const id = action.dataset.photoId;
				const photo = photoForId(activeState.photos, id);
				if (!photoSupportsSize(photo, activeState.pickerSize)) return;
				if (activeState.pickerMode === "replace") {
					const previousId = activeState.selectedPhotoIds.values().next().value || "";
					activeState.selectedPhotoIds = activeState.selectedPhotoIds.has(id) ? new Set() : new Set([id]);
					if (previousId && previousId !== id) updatePickerPhoto(previousId);
				} else if (activeState.selectedPhotoIds.has(id)) activeState.selectedPhotoIds.delete(id);
				else activeState.selectedPhotoIds.add(id);
				updatePickerPhoto(id);
				updatePickerSelectionSummary();
				focusPhoto(id);
				return;
			}
			if (name === "picker-next") { finishPhotoSelection(); return; }
			if (name === "customize-back") { openPhotoPicker(activeState.product, activeState.selections, { mode: "review", returnScreen: "customize" }); return; }
			if (name === "change-photo") {
				const line = activeState.lines.find((entry) => entry.lineId === action.dataset.lineId);
				openPhotoPicker(activeState.product, activeState.selections, { mode: "replace", returnScreen: "customize", lineId: action.dataset.lineId, size: line && line.selections && line.selections.size });
				return;
			}
			if (name === "crop-toggle") {
				activeState.cropActiveLineId = activeState.cropActiveLineId === action.dataset.lineId ? "" : action.dataset.lineId;
				renderStore();
				const cropSurface = Array.from(activeRoot.querySelectorAll("[data-shop-crop-id]")).find((entry) => entry.dataset.shopCropId === activeState.cropActiveLineId);
				if (cropSurface) cropSurface.focus();
				return;
			}
			if (name === "quantity-down" || name === "quantity-up") { changeQuantity(action.dataset.lineId, name === "quantity-up" ? 1 : -1); return; }
			if (name === "remove-line") { activeState.cart = activeState.cart.filter((line) => line.lineId !== action.dataset.lineId); saveCart(); renderStore(); return; }
			if (name === "preview") { activeState.previewLineId = activeState.lines[0] ? activeState.lines[0].lineId : ""; renderStore(); focusShop('[data-shop-action="preview-close"]'); return; }
			if (name === "preview-close") { activeState.previewLineId = ""; renderStore(); focusShop('[data-shop-action="preview"]'); return; }
			if (name === "edit-product") { activeState.editPanelOpen = true; renderStore(); focusShop('[data-shop-action="close-edit-product"]'); return; }
			if (name === "close-edit-product") { activeState.editPanelOpen = false; renderStore(); focusShop('[data-shop-action="edit-product"]'); return; }
			if (name === "add-to-cart") { addToCart(); return; }
			if (name === "checkout") { startCheckout(); return; }
		}
		const optionButton = target.closest("[data-shop-option-group][data-shop-option-value]");
		if (!optionButton || !activeState.product) return;
		const groupKey = optionButton.dataset.shopOptionGroup;
		const value = optionButton.dataset.shopOptionValue;
		if (activeState.screen === "customize" && groupKey === "size") {
			const photos = activeState.lines.map((line) => photoForId(activeState.photos, line.photoId));
			if (!photos.every((photo) => photoSupportsSize(photo, value))) return;
			activeState.selections.size = value;
			activeState.lines.forEach((line) => {
				line.selections = Object.assign({}, activeState.selections, line.selections || {}, { size: value });
			});
		} else {
			activeState.selections[groupKey] = value;
			if (activeState.screen === "customize") {
				activeState.lines.forEach((line) => {
					line.selections = Object.assign({}, activeState.selections, line.selections || {}, { [groupKey]: value });
				});
			}
		}
		activeState.invalid.delete(groupKey);
		if (activeState.screen === "customize") renderStore();
		else updateProductPriceAndOptions();
	}

	function handleChange(event) {
		const target = event.target;
		if (!target || !target.closest) return;
		const size = target.closest("[data-shop-size-select]");
		if (size && activeState.screen === "customize") {
			const line = activeState.lines.find((entry) => entry.lineId === size.dataset.lineId);
			const photo = line && photoForId(activeState.photos, line.photoId);
			if (!line || !photoSupportsSize(photo, size.value)) return;
			line.selections = Object.assign({}, activeState.selections, line.selections || {}, { size: size.value });
			renderStore();
			return;
		}
		const quantity = target.closest("[data-shop-quantity]");
		if (quantity) changeQuantity(quantity.dataset.lineId, 0, quantity.value);
	}

	function mount(root) {
		if (!root || !activeState) return;
		activeRoot = root;
		if (root.dataset.shopBound !== "true") {
			root.addEventListener("click", handleClick);
			root.addEventListener("change", handleChange);
			root.addEventListener("keydown", handleKeyDown);
			root.addEventListener("pointerdown", handlePointerDown);
			root.addEventListener("pointermove", handlePointerMove);
			root.addEventListener("pointerup", handlePointerUp);
			root.addEventListener("pointercancel", handlePointerUp);
			root.dataset.shopBound = "true";
		}
		if (heroTimer) {
			global.clearInterval(heroTimer);
			heroTimer = null;
		}
		if (!activeState.product && typeof global.matchMedia === "function" && !global.matchMedia("(prefers-reduced-motion: reduce)").matches) {
				heroTimer = global.setInterval(() => {
					if (!activeState || activeState.product || activeState.screen !== "page") return;
				activeState.heroIndex = (activeState.heroIndex + 1) % SHOP_CATALOG.length;
				updateHero();
			}, 6500);
		}
		if (activeState.screen === "order" && activeState.orderStatus === "loading") confirmOrder();
	}

	const api = {
		get catalog() { return SHOP_CATALOG; },
		cartStorageKey: CART_STORAGE_KEY,
		cartSubtotal,
		checkoutRequest,
		clampCrop,
		dimensionsFor,
		fromPrice,
		lineTotal,
		missingRequiredOptions,
		openPhotoPicker,
		parseCart,
		photoSupportsSize,
		priceFor,
		readCheckoutParams,
		renderMockup,
		renderPage,
		selectStorePhotos,
		serializeCart,
		setCatalog,
		mount,
	};
	global.PortfolioShop = api;
})(typeof window !== "undefined" ? window : globalThis);
