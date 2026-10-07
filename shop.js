(function (global) {
	"use strict";

	const option = (value, description, swatch) => ({ value, description: description || "", swatch: swatch || "" });
	const optionGroup = (key, label, options, config = {}) => ({
		key,
		label,
		options,
		kind: config.kind || "buttons",
		required: Boolean(config.required),
		defaultValue: config.defaultValue || "",
	});
	const makeProduct = (product) => ({
		...product,
		prices: {
			bySize: Object.fromEntries(product.sizes.map((size, index) => [size, product.sizePrices[index]])),
			optionSurcharges: product.optionSurcharges || {},
		},
	});

	// Sample prices to replace once Claire confirms final retail pricing.
	const SHOP_CATALOG = [
		makeProduct({
			slug: "print",
			category: "Prints",
			name: "Print",
			description:
				"Bring your photos to life on the finest-quality paper designed to be enjoyed for a lifetime. Printed on Kodak or Fuji professional-grade archival paper for increased color gamut, excellent skin tones, sharpness and brilliant image quality.",
			heroDescription: "Bring your images to life with photographic prints for every occasion.",
			productInfo:
				"Prints are printed on Kodak Endura Professional Paper (Lustre, Glossy) or Fuji Crystal Archival Professional Paper (Deep Matte). These are the highest quality archival prints that have a longevity of 100 years in typical display conditions and 200 years in dark storage.",
			productionTime: "1-3 business days",
			sizes: ["8 Up Wallet", "4 x 6", "5 x 7", "8 x 10", "8 x 12", "11 x 14", "12 x 18", "16 x 20"],
			sizePrices: [3, 3, 4, 8, 9, 12, 18, 25],
			optionGroups: [
				optionGroup("size", "SIZE", ["8 Up Wallet", "4 x 6", "5 x 7", "8 x 10", "8 x 12", "11 x 14", "12 x 18", "16 x 20"].map((v) => option(v)), { required: true }),
				optionGroup("paper", "PAPER", [
					option("Lustre", "A semi-gloss paper with vibrant colors and excellent skin tones."),
					option("Glossy", "Most vibrant colors with a highly reflective, glossy finish."),
					option("Deep Matte", "True non-reflective matte paper great for skin tones, soft images, and black & whites."),
				]),
			],
			optionSurcharges: { paper: { Lustre: 0, Glossy: 0, "Deep Matte": 0 } },
		}),
		makeProduct({
			slug: "fine-art-print",
			category: "Prints",
			name: "Fine Art Print",
			description:
				"Preserve memories for future generations on the finest museum-quality papers.",
			heroDescription: "Preserve memories for future generations on the finest museum-quality papers.",
			productInfo:
				"Printed on archival fine art paper with a soft matte surface and rich tonal detail. The paper is selected to preserve subtle color and shadow in your photograph.",
			productionTime: "2-4 business days",
			sizes: ["4 x 6", "5 x 7", "8 x 10", "8 x 12", "11 x 14", "12 x 18", "16 x 20", "20 x 30"],
			sizePrices: [4, 6, 12, 15, 22, 30, 45, 68],
			optionGroups: [
				optionGroup("size", "SIZE", ["4 x 6", "5 x 7", "8 x 10", "8 x 12", "11 x 14", "12 x 18", "16 x 20", "20 x 30"].map((v) => option(v)), { required: true }),
				optionGroup("paper", "PAPER", [
					option("Photo Rag", "A smooth, matte fine art paper with a natural white finish."),
					option("Cotton Smooth", "A softly textured cotton paper for fine tonal transitions."),
					option("Baryta", "A subtle sheen with deep blacks and crisp detail."),
				], { defaultValue: "Photo Rag" }),
			],
			optionSurcharges: { paper: { "Photo Rag": 0, "Cotton Smooth": 2, Baryta: 3 } },
		}),
		makeProduct({
			slug: "large-format-print",
			category: "Prints",
			name: "Large Format Print",
			description:
				"Bring your largest photographs to life with brilliant color and archival quality, ready to display in your home.",
			heroDescription: "Give a favorite image room to make a statement.",
			productInfo:
				"Large format photographs are printed on professional archival paper for sharp detail and balanced color at a generous scale.",
			productionTime: "2-4 business days",
			sizes: ["16 x 20", "16 x 24", "20 x 30", "24 x 36", "30 x 40"],
			sizePrices: [13, 18, 25, 38, 55],
			optionGroups: [
				optionGroup("size", "SIZE", ["16 x 20", "16 x 24", "20 x 30", "24 x 36", "30 x 40"].map((v) => option(v)), { required: true }),
				optionGroup("paper", "PAPER", [
					option("Lustre", "A semi-gloss paper with vibrant colors and excellent skin tones."),
					option("Glossy", "Most vibrant colors with a highly reflective, glossy finish."),
					option("Deep Matte", "True non-reflective matte paper great for skin tones, soft images, and black & whites."),
				], { defaultValue: "Lustre" }),
			],
			optionSurcharges: { paper: { Lustre: 0, Glossy: 0, "Deep Matte": 0 } },
		}),
		makeProduct({
			slug: "canvas",
			category: "Wall Art",
			name: "Canvas",
			description:
				"Hand-crafted canvases are designed to turn any photo into a beautiful piece of art. Printed on premium fine art canvas, Canvas Prints are a contemporary way to showcase your images, with or without a frame.",
			heroDescription: "Transform any photo into a beautiful piece of art with a hand-crafted fine art canvas.",
			productInfo:
				"All canvases are printed on Premium Fine Art Canvas with Semi-Gloss Laminate. These canvases measure 1½\" in depth, are hand-made and come ready to hang with sawtooth hangers.",
			productionTime: "2-4 business days",
			sizes: ["8 x 8", "8 x 10", "11 x 14", "12 x 12", "16 x 16", "16 x 20", "16 x 24", "20 x 30", "24 x 36", "30 x 40"],
			sizePrices: [105, 112, 125, 135, 158, 175, 195, 238, 305, 395],
			optionGroups: [
				optionGroup("size", "SIZE", ["8 x 8", "8 x 10", "11 x 14", "12 x 12", "16 x 16", "16 x 20", "16 x 24", "20 x 30", "24 x 36", "30 x 40"].map((v) => option(v)), { required: true }),
				optionGroup("edge", "EDGE", [
					option("Photo wrap", "Your image continues around the canvas edge.", "#b9a999"),
					option("Black wrap", "A crisp black finish on the canvas edge.", "#292929"),
					option("White wrap", "A clean white finish on the canvas edge.", "#f7f7f5"),
				], { kind: "swatch", defaultValue: "Photo wrap" }),
			],
			optionSurcharges: { edge: { "Photo wrap": 0, "Black wrap": 0, "White wrap": 0 } },
		}),
		makeProduct({
			slug: "metal-print",
			category: "Wall Art",
			name: "Metal Print",
			description:
				"Make a statement in any space with vibrant colors printed on high quality aluminum.",
			heroDescription: "Make a statement with vibrant color printed on aluminum.",
			productInfo:
				"Your photograph is printed onto lightweight aluminum for vivid color, crisp detail and a clean contemporary finish.",
			productionTime: "3-5 business days",
			sizes: ["8 x 10", "11 x 14", "12 x 18", "16 x 20", "16 x 24", "20 x 30", "24 x 36", "30 x 40"],
			sizePrices: [60, 72, 88, 112, 128, 175, 235, 320],
			optionGroups: [
				optionGroup("size", "SIZE", ["8 x 10", "11 x 14", "12 x 18", "16 x 20", "16 x 24", "20 x 30", "24 x 36", "30 x 40"].map((v) => option(v)), { required: true }),
				optionGroup("finish", "FINISH", [
					option("Gloss", "A reflective finish that brings out vivid color.", "#c9d9dd"),
					option("Matte", "A low-reflection finish with soft, even color.", "#b8b8b3"),
				], { kind: "swatch", defaultValue: "Gloss" }),
			],
			optionSurcharges: { finish: { Gloss: 0, Matte: 8 } },
		}),
		makeProduct({
			slug: "standout-print",
			category: "Wall Art",
			name: "Standout Print",
			description:
				"A vibrant photograph mounted on a sturdy block for a clean, modern piece that arrives ready to display.",
			heroDescription: "A clean, dimensional display that stands away from the wall.",
			productInfo:
				"Your photograph is mounted to a lightweight rigid panel with a deep black edge and a rear hanger for easy display.",
			productionTime: "3-5 business days",
			sizes: ["8 x 10", "11 x 14", "12 x 18", "16 x 20", "16 x 24", "20 x 30", "24 x 36"],
			sizePrices: [50, 64, 80, 105, 122, 165, 225],
			optionGroups: [
				optionGroup("size", "SIZE", ["8 x 10", "11 x 14", "12 x 18", "16 x 20", "16 x 24", "20 x 30", "24 x 36"].map((v) => option(v)), { required: true }),
				optionGroup("edge", "EDGE", [
					option("Black edge", "A substantial black edge gives the print a crisp profile.", "#242424"),
					option("White edge", "A bright white edge keeps the profile light.", "#f7f7f5"),
				], { kind: "swatch", defaultValue: "Black edge" }),
			],
			optionSurcharges: { edge: { "Black edge": 0, "White edge": 0 } },
		}),
		makeProduct({
			slug: "gallery-frame",
			category: "Wall Art",
			name: "Gallery Frame",
			description:
				"Give your images the presentation they deserve with remarkable, handcrafted frames. With minimalistic and clean lines, Gallery frames are a classic choice for modern displays.",
			heroDescription: "Handcrafted, ready-to-hang frames for a clean and sophisticated look in any setting.",
			productInfo:
				"Gallery Frames are hand-crafted from wood and arrive ready to display with plexiglass, finished backing and hanging hardware. Moulding sizes: Gallery Frames (up to 20x24) - 3/4\"; Gallery Frames (20x30 and larger) - 1½\"; Distressed Frames - 1½\"; Ashland Frames - 1¾\".",
			productionTime: "3-5 business days",
			sizes: ["8 x 10", "10 x 10", "11 x 14", "16 x 16", "16 x 20", "16 x 24", "20 x 24", "20 x 30", "24 x 36", "30 x 40"],
			sizePrices: [82, 96, 137, 146, 154, 168, 190, 212, 275, 335],
			optionGroups: [
				optionGroup("size", "SIZE", ["8 x 10", "10 x 10", "11 x 14", "16 x 16", "16 x 20", "16 x 24", "20 x 24", "20 x 30", "24 x 36", "30 x 40"].map((v) => option(v)), { required: true, defaultValue: "8 x 10" }),
				optionGroup("frame", "FRAME", [
					option("Gallery Black", "A smooth black wood moulding with clean, minimal lines.", "#17151a"),
					option("Gallery White", "A crisp white finish with a simple contemporary profile.", "#f7f7f5"),
					option("Distressed Black", "A dark, weathered finish with visible wood grain.", "#443d35"),
					option("Distressed White", "A pale, textured finish with a softly aged character.", "#d8d8d2"),
				], { kind: "swatch", required: true }),
				optionGroup("paper", "PAPER", [
					option("Lustre", "A semi-gloss paper with vibrant colors and excellent skin tones."),
					option("Deep Matte", "True non-reflective matte paper great for skin tones, soft images, and black & whites."),
				], { required: true }),
				optionGroup("mat", "MAT", [
					option("No mat", "A clean edge-to-edge presentation."),
					option("White mat", "A bright archival mat gives the photograph room to breathe."),
					option("Black mat", "A dark mat creates a bold, gallery-style border."),
				], { defaultValue: "No mat" }),
			],
			optionSurcharges: {
				frame: { "Gallery Black": 0, "Gallery White": 0, "Distressed Black": 8, "Distressed White": 8 },
				paper: { Lustre: 0, "Deep Matte": 0 },
				mat: { "No mat": 0, "White mat": 0, "Black mat": 0 },
			},
		}),
		makeProduct({
			slug: "metal-frame",
			category: "Wall Art",
			name: "Metal Frame",
			description:
				"A clean-lined metal moulding adds a refined, contemporary finish to your photograph.",
			heroDescription: "A slim metal frame for a polished, modern display.",
			productInfo:
				"Hand-finished metal moulding surrounds a professional photographic print. Includes a protective front and hanging hardware.",
			productionTime: "3-5 business days",
			sizes: ["8 x 10", "11 x 14", "16 x 20", "16 x 24", "20 x 30", "24 x 36"],
			sizePrices: [121, 148, 185, 205, 268, 352],
			optionGroups: [
				optionGroup("size", "SIZE", ["8 x 10", "11 x 14", "16 x 20", "16 x 24", "20 x 30", "24 x 36"].map((v) => option(v)), { required: true, defaultValue: "8 x 10" }),
				optionGroup("frame", "FRAME", [
					option("Gold", "A warm brushed gold metal finish.", "#c4a34c"),
					option("Silver", "A soft brushed silver metal finish.", "#bfc2c2"),
					option("Black", "A satin black metal finish.", "#242424"),
				], { kind: "swatch", required: true }),
				optionGroup("paper", "PAPER", [
					option("Lustre", "A semi-gloss paper with vibrant colors and excellent skin tones."),
					option("Deep Matte", "True non-reflective matte paper great for skin tones, soft images, and black & whites."),
				], { required: true }),
				optionGroup("mat", "MAT", [
					option("No mat", "A clean edge-to-edge presentation."),
					option("White mat", "A bright archival mat gives the photograph room to breathe."),
					option("Black mat", "A dark mat creates a bold, gallery-style border."),
				], { defaultValue: "No mat" }),
			],
			optionSurcharges: {
				frame: { Gold: 0, Silver: 0, Black: 0 },
				paper: { Lustre: 0, "Deep Matte": 0 },
				mat: { "No mat": 0, "White mat": 15, "Black mat": 15 },
			},
		}),
		makeProduct({
			slug: "framed-canvas",
			category: "Wall Art",
			name: "Framed Canvas",
			description:
				"A hand-crafted canvas floats inside a frame, creating a subtle shadow gap and a dimensional wall display.",
			heroDescription: "Canvas artwork presented in a handcrafted floating frame.",
			productInfo:
				"Premium fine art canvas is hand stretched and set into a floater frame with a visible reveal around the artwork.",
			productionTime: "3-5 business days",
			sizes: ["8 x 10", "11 x 14", "16 x 20", "16 x 24", "20 x 30", "24 x 36"],
			sizePrices: [187, 215, 258, 285, 348, 445],
			optionGroups: [
				optionGroup("size", "SIZE", ["8 x 10", "11 x 14", "16 x 20", "16 x 24", "20 x 30", "24 x 36"].map((v) => option(v)), { required: true, defaultValue: "8 x 10" }),
				optionGroup("frame", "FRAME", [
					option("Black", "A dark frame with a crisp, modern profile.", "#242424"),
					option("Natural", "A light natural wood finish with visible grain.", "#c8a77d"),
					option("White", "A clean white finish with a quiet profile.", "#f5f3ed"),
				], { kind: "swatch", required: true }),
				optionGroup("edge", "CANVAS EDGE", [
					option("Photo wrap", "Your image continues around the canvas edge.", "#b9a999"),
					option("Black wrap", "A crisp black finish on the canvas edge.", "#292929"),
					option("White wrap", "A clean white finish on the canvas edge.", "#f7f7f5"),
				], { kind: "swatch", defaultValue: "Photo wrap" }),
			],
			optionSurcharges: { frame: { Black: 0, Natural: 0, White: 0 }, edge: { "Photo wrap": 0, "Black wrap": 0, "White wrap": 0 } },
		}),
		makeProduct({
			slug: "wood-frame",
			category: "Wall Art",
			name: "Wood Frame",
			description:
				"Naturally beautiful frames handcrafted from real wood to pair with any image.",
			heroDescription: "Naturally beautiful frames handcrafted from real wood.",
			productInfo:
				"A solid wood frame with a protective front, finished backing and hanging hardware. Each finish shows the character of the wood.",
			productionTime: "3-5 business days",
			sizes: ["8 x 10", "11 x 14", "16 x 20", "16 x 24", "20 x 30", "24 x 36"],
			sizePrices: [137, 162, 198, 220, 288, 378],
			optionGroups: [
				optionGroup("size", "SIZE", ["8 x 10", "11 x 14", "16 x 20", "16 x 24", "20 x 30", "24 x 36"].map((v) => option(v)), { required: true, defaultValue: "8 x 10" }),
				optionGroup("frame", "FRAME", [
					option("Natural", "A light natural wood with a soft, visible grain.", "#d6bd94"),
					option("Walnut", "A warm walnut stain with deep brown grain.", "#65452f"),
					option("White Oak", "A pale oak finish with subtle linear grain.", "#c9b68d"),
				], { kind: "swatch", required: true }),
				optionGroup("paper", "PAPER", [
					option("Lustre", "A semi-gloss paper with vibrant colors and excellent skin tones."),
					option("Deep Matte", "True non-reflective matte paper great for skin tones, soft images, and black & whites."),
				], { required: true }),
				optionGroup("mat", "MAT", [
					option("No mat", "A clean edge-to-edge presentation."),
					option("White mat", "A bright archival mat gives the photograph room to breathe."),
					option("Black mat", "A dark mat creates a bold, gallery-style border."),
				], { defaultValue: "No mat" }),
			],
			optionSurcharges: {
				frame: { Natural: 0, Walnut: 8, "White Oak": 8 },
				paper: { Lustre: 0, "Deep Matte": 0 },
				mat: { "No mat": 0, "White mat": 0, "Black mat": 0 },
			},
		}),
		makeProduct({
			slug: "bamboo-panel",
			category: "Wall Art",
			name: "Bamboo Panel",
			description:
				"A photograph printed on a natural bamboo panel, where the warm grain becomes part of the artwork.",
			heroDescription: "A natural bamboo surface brings warmth and texture to your photograph.",
			productInfo:
				"Your image is printed directly on a renewable bamboo panel. Natural variation in grain and tone makes every piece unique.",
			productionTime: "3-5 business days",
			sizes: ["8 x 10", "11 x 14", "16 x 20", "16 x 24", "20 x 30", "24 x 36"],
			sizePrices: [81, 98, 125, 145, 190, 255],
			optionGroups: [
				optionGroup("size", "SIZE", ["8 x 10", "11 x 14", "16 x 20", "16 x 24", "20 x 30", "24 x 36"].map((v) => option(v)), { required: true }),
				optionGroup("finish", "BAMBOO FINISH", [
					option("Natural", "Warm, pale bamboo grain remains visible around the image.", "#d6bd94"),
					option("Carbonized", "A deeper honey-brown bamboo finish.", "#9a7048"),
				], { kind: "swatch", defaultValue: "Natural" }),
			],
			optionSurcharges: { finish: { Natural: 0, Carbonized: 10 } },
		}),
		makeProduct({
			slug: "wood-print",
			category: "Wall Art",
			name: "Wood Print",
			description:
				"Bring natural warmth to your walls with a photograph printed on a wood panel.",
			heroDescription: "A warm wood surface adds natural texture to your image.",
			productInfo:
				"Your photograph is printed on a lightweight wood panel. The natural grain subtly shows through lighter areas of the image.",
			productionTime: "3-5 business days",
			sizes: ["8 x 10", "11 x 14", "16 x 20", "16 x 24", "20 x 30", "24 x 36"],
			sizePrices: [78, 94, 120, 140, 185, 248],
			optionGroups: [
				optionGroup("size", "SIZE", ["8 x 10", "11 x 14", "16 x 20", "16 x 24", "20 x 30", "24 x 36"].map((v) => option(v)), { required: true }),
				optionGroup("finish", "WOOD FINISH", [
					option("Natural", "A pale wood grain with a warm, organic finish.", "#d6bd94"),
					option("Walnut", "A rich walnut tone with deeper visible grain.", "#65452f"),
					option("White", "A soft white wash that lets the grain show through.", "#e4ded1"),
				], { kind: "swatch", defaultValue: "Natural" }),
			],
			optionSurcharges: { finish: { Natural: 0, Walnut: 8, White: 0 } },
		}),
		makeProduct({
			slug: "acrylic-print",
			category: "Wall Art",
			name: "Acrylic Print",
			description:
				"A photograph mounted beneath clear acrylic for rich color, depth and a luminous finish.",
			heroDescription: "Clear acrylic adds depth and a luminous gloss to your photograph.",
			productInfo:
				"Your image is mounted behind thick clear acrylic for a glossy, dimensional finish and a polished edge.",
			productionTime: "3-5 business days",
			sizes: ["8 x 10", "11 x 14", "16 x 20", "16 x 24", "20 x 30", "24 x 36"],
			sizePrices: [102, 125, 162, 185, 245, 325],
			optionGroups: [
				optionGroup("size", "SIZE", ["8 x 10", "11 x 14", "16 x 20", "16 x 24", "20 x 30", "24 x 36"].map((v) => option(v)), { required: true }),
				optionGroup("finish", "FINISH", [
					option("Gloss", "A reflective surface brings out vivid color and depth.", "#d9e8ec"),
					option("Matte", "A soft low-reflection finish with a clear acrylic edge.", "#c7d0d1"),
				], { kind: "swatch", defaultValue: "Gloss" }),
			],
			optionSurcharges: { finish: { Gloss: 0, Matte: 8 } },
		}),
	];

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
	const categorySlug = (category) => category === "Prints" ? "prints" : "wall-art";
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
			.filter((group) => group.required && !resolved[group.key])
			.map((group) => group.key);
	}

	function numericPrices(product) {
		return Object.values(product.prices.bySize || {}).map(Number).filter(Number.isFinite);
	}

	function fromPrice(product) {
		const sizePrices = numericPrices(product);
		const base = sizePrices.length ? Math.min(...sizePrices) : 0;
		const extras = Object.entries(product.prices.optionSurcharges || {}).reduce((sum, [key, values]) => {
			const available = Object.values(values || {}).map(Number).filter(Number.isFinite);
			return sum + (available.length ? Math.min(...available) : 0);
		}, 0);
		return Math.round((base + extras) * 100) / 100;
	}

	function priceFor(product, selections) {
		const resolved = resolveSelections(product, selections);
		const sizePrices = product.prices.bySize || {};
		const size = resolved.size;
		const base = size && Number.isFinite(Number(sizePrices[size]))
			? Number(sizePrices[size])
			: fromPrice(product) - Object.entries(product.prices.optionSurcharges || {}).reduce((sum, [, values]) => {
				const available = Object.values(values || {}).map(Number).filter(Number.isFinite);
				return sum + (available.length ? Math.min(...available) : 0);
			}, 0);
		const extras = Object.entries(product.prices.optionSurcharges || {}).reduce((sum, [key, values]) => {
			const chosen = resolved[key];
			const amount = chosen && values ? Number(values[chosen]) : 0;
			return sum + (Number.isFinite(amount) ? amount : 0);
		}, 0);
		return Math.round((base + extras) * 100) / 100;
	}

	function formatPrice(value) {
		return "$" + Number(value).toFixed(2);
	}

	function sizeDimensions(size) {
		const match = String(size || "").match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
		if (match) return { width: Number(match[1]), height: Number(match[2]) };
		if (String(size || "").toLowerCase().includes("wallet")) return { width: 3, height: 2 };
		return { width: 4, height: 5 };
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

	function renderMockup(product, selections, photo, opts) {
		const settings = opts || {};
		const view = ["front", "angle", "corner", "wall"].includes(settings.view) ? settings.view : "angle";
		const dimensions = dimensionsFor((selections || {}).size || product.sizes[0], photo);
		const ratio = Math.max(0.45, Math.min(2.25, dimensions.ratio));
		const frameValue = optionValue(selections, "frame", "");
		const fallbackFinishes = {
			"gallery-frame": "Gallery Black",
			"metal-frame": "Gold",
			"framed-canvas": "Natural",
			"wood-frame": "Natural",
		};
		const finishValue = optionValue(selections, "finish", frameValue || fallbackFinishes[product.slug]);
		const frameClass = "shop-finish--" + slugPart(finishValue || "classic");
		const matValue = optionValue(selections, "mat", "No mat");
		const matClass = "shop-mat--" + slugPart(matValue);
		const edgeValue = optionValue(selections, "edge", "Photo wrap");
		const edgeClass = "shop-edge--" + slugPart(edgeValue);
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
		if (["gallery-frame", "metal-frame", "wood-frame"].includes(product.slug)) {
			objectClass = "shop-mockup__object shop-mockup__object--frame " + frameClass;
			front = '<span class="shop-mockup__frame-face"><span class="shop-mockup__mat ' + matClass + '">' + image + '</span></span>';
			sideClass = "shop-side--finish " + frameClass;
		} else if (product.slug === "framed-canvas") {
			objectClass = "shop-mockup__object shop-mockup__object--floater " + frameClass + " " + edgeClass;
			front = '<span class="shop-mockup__floater-face"><span class="shop-mockup__canvas-face">' + image + '</span></span>';
			sideClass = "shop-side--finish " + frameClass;
		} else if (product.slug === "canvas") {
			objectClass = "shop-mockup__object shop-mockup__object--canvas " + edgeClass;
			front = '<span class="shop-mockup__photo-face">' + image + '</span>';
			sideClass = edgeValue === "Photo wrap" ? "shop-side--photo" : "shop-side--edge " + edgeClass;
			side = edgeValue === "Photo wrap" ? sideImage : "";
		} else if (product.slug === "metal-print") {
			objectClass = "shop-mockup__object shop-mockup__object--metal shop-finish--" + slugPart(finishValue || "gloss");
			front = '<span class="shop-mockup__photo-face">' + image + '</span>';
			overlay = '<span class="shop-mockup__sheen" aria-hidden="true"></span>';
			sideClass = "shop-side--aluminium";
		} else if (product.slug === "acrylic-print") {
			objectClass = "shop-mockup__object shop-mockup__object--acrylic shop-finish--" + slugPart(finishValue || "gloss");
			front = '<span class="shop-mockup__photo-face">' + image + '</span>';
			overlay = '<span class="shop-mockup__sheen" aria-hidden="true"></span>';
			sideClass = "shop-side--acrylic";
		} else if (product.slug === "standout-print") {
			objectClass = "shop-mockup__object shop-mockup__object--standout " + edgeClass;
			front = '<span class="shop-mockup__photo-face">' + image + '</span>';
			sideClass = edgeValue === "White edge" ? "shop-side--edge " + edgeClass : "shop-side--black";
		} else if (product.slug === "bamboo-panel") {
			objectClass = "shop-mockup__object shop-mockup__object--bamboo " + frameClass;
			front = '<span class="shop-mockup__photo-face shop-mockup__photo-face--wood">' + image + '<span class="shop-mockup__wood-grain" aria-hidden="true"></span></span>';
			sideClass = "shop-side--grain " + frameClass;
		} else if (product.slug === "wood-print") {
			objectClass = "shop-mockup__object shop-mockup__object--wood " + frameClass;
			front = '<span class="shop-mockup__photo-face shop-mockup__photo-face--wood">' + image + '<span class="shop-mockup__wood-grain" aria-hidden="true"></span></span>';
			sideClass = "shop-side--grain " + frameClass;
		}
		const extraClass = settings.className ? " " + escapeHtml(settings.className) : "";
		const wallWidth = Math.min(78, dimensions.width / 36 * 72);
		const scene = view === "wall" ? '<span class="shop-mockup__room" aria-hidden="true"><span class="shop-mockup__furniture"></span></span>' : "";
		return '<div class="shop-mockup shop-mockup--' + escapeHtml(product.slug) + ' shop-mockup--view-' + view + extraClass + '" style="--shop-art-ratio:' + ratio.toFixed(4) + ';--shop-wall-art-width:' + wallWidth.toFixed(2) + '%" data-shop-view="' + view + '" data-shop-orientation="' + dimensions.orientation + '">' +
			scene + '<span class="shop-mockup__object ' + objectClass.replace("shop-mockup__object ", "") + '"><span class="shop-mockup__side ' + sideClass + '">' + side + '</span><span class="shop-mockup__front">' + front + overlay + '</span></span></div>';
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
		const categories = ["Prints", "Wall Art"];
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
		const selectedText = selection || (invalid ? "* Select an option" : "");
		const buttons = group.options.map((entry) => {
			const isSelected = selection === entry.value;
			const swatch = group.kind === "swatch"
				? '<span class="shop-swatch" style="--shop-swatch:' + escapeHtml(entry.swatch || "#ccc") + '" aria-hidden="true"></span>'
				: '<span class="shop-option-label">' + escapeHtml(entry.value) + '</span>';
			const previewSelections = Object.assign({}, state.selections, { [group.key]: entry.value });
			const detail = entry.description
				? '<span class="shop-option-detail" aria-hidden="true"><span class="shop-option-detail__visual">' +
					renderMockup(product, previewSelections, state.photos[state.photoIndex] || null, { imageUrl: state.imageUrl, view: "corner" }) +
					'</span><span class="shop-option-detail__title">' + escapeHtml(entry.value) + '</span><span class="shop-option-detail__description">' +
					escapeHtml(entry.description) + '</span></span>'
				: "";
			return '<button class="shop-option' + (group.kind === "swatch" ? " shop-option--swatch" : "") + (isSelected ? " is-selected" : "") +
				'" type="button" data-shop-option-group="' + escapeHtml(group.key) + '" data-shop-option-value="' + escapeHtml(entry.value) +
				'" aria-pressed="' + (isSelected ? "true" : "false") + '" aria-label="' + escapeHtml(entry.value) + '" title="' + escapeHtml(entry.value) + '">' +
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
				product.slug === "gallery-frame" || ["metal-frame", "wood-frame", "framed-canvas"].includes(product.slug) ? "Create your frame" : "Buy prints",
			) + '</button><p class="shop-photo-note" data-shop-photo-note role="status" aria-live="polite"></p>' +
			'<details class="shop-product-info" open><summary>Product info</summary><p>' + escapeHtml(product.productInfo) + '</p>' +
			'<p>This product will ship after a print production time of ' + escapeHtml(product.productionTime) + '.</p></details></div></div>' +
			'<section class="shop-related"><h2 class="shop-section-heading">You might also like</h2><div class="shop-product-grid">' +
			related.map((item) => renderProductCard(item, state)).join("") + '</div></section></div></section>';
	}

	let activeState = null;
	let activeRoot = null;
	let heroTimer = null;

	function renderPage(context) {
		const safeContext = context || {};
		const photos = selectStorePhotos(safeContext.albums || []);
		const url = safeContext.productSlug === undefined
			? (global.location ? new URLSearchParams(global.location.search).get("product") : "")
			: safeContext.productSlug;
		const product = productForSlug(url);
		activeState = {
			photos,
			imageUrl: typeof safeContext.imageUrl === "function"
				? safeContext.imageUrl
				: (photo) => photo && (photo.url || photo.image) ? photo.url || photo.image : "",
			heroIndex: 0,
			product,
			photoIndex: 0,
			view: "angle",
			selections: product ? defaultSelections(product) : {},
			invalid: new Set(),
		};
		const page = product ? renderProductPage(product, activeState) : renderStoreHome(activeState);
		if (url && !product) {
			return page.replace('<div class="shop-shell">', '<div class="shop-shell"><p class="shop-not-found">That product is unavailable. Browse all prints and wall art below.</p>');
		}
		return page;
	}

	function openPhotoPicker(product, selections) {
		void product;
		void selections;
		const note = activeRoot && activeRoot.querySelector("[data-shop-photo-note]");
		if (note) note.textContent = "Photo selection is coming in the next step.";
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
			if (heading) heading.textContent = selected || (invalid ? "* Select an option" : "");
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

	function handleClick(event) {
		const target = event.target instanceof Element ? event.target : null;
		if (!target || !activeRoot || !activeState) return;
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
				openPhotoPicker(activeState.product, activeState.selections);
				return;
			}
		}
		const optionButton = target.closest("[data-shop-option-group][data-shop-option-value]");
		if (!optionButton || !activeState.product) return;
		const groupKey = optionButton.dataset.shopOptionGroup;
		activeState.selections[groupKey] = optionButton.dataset.shopOptionValue;
		activeState.invalid.delete(groupKey);
		updateProductPriceAndOptions();
	}

	function mount(root) {
		if (!root || !activeState) return;
		activeRoot = root;
		if (root.dataset.shopBound !== "true") {
			root.addEventListener("click", handleClick);
			root.dataset.shopBound = "true";
		}
		if (heroTimer) {
			global.clearInterval(heroTimer);
			heroTimer = null;
		}
		if (!activeState.product && typeof global.matchMedia === "function" && !global.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			heroTimer = global.setInterval(() => {
				if (!activeState || activeState.product) return;
				activeState.heroIndex = (activeState.heroIndex + 1) % SHOP_CATALOG.length;
				updateHero();
			}, 6500);
		}
	}

	const api = {
		catalog: SHOP_CATALOG,
		dimensionsFor,
		fromPrice,
		missingRequiredOptions,
		openPhotoPicker,
		priceFor,
		renderMockup,
		renderPage,
		selectStorePhotos,
		mount,
	};
	global.PortfolioShop = api;
})(typeof window !== "undefined" ? window : globalThis);
