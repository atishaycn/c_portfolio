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
			matWindows: {
				"8 x 10": "5 x 7", "10 x 10": "6 x 6", "11 x 14": "8 x 10", "16 x 16": "12 x 12",
				"16 x 20": "11 x 14", "16 x 24": "11 x 17", "20 x 24": "16 x 20", "20 x 30": "16 x 24",
				"24 x 36": "18 x 27", "30 x 40": "24 x 32",
			},
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
				mat: { "No mat": 0, "White mat": 0, "Black mat": 15 },
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
			matWindows: { "8 x 10": "5 x 7", "11 x 14": "8 x 10", "16 x 20": "11 x 14", "16 x 24": "11 x 17", "20 x 30": "16 x 24", "24 x 36": "18 x 27" },
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
			matWindows: { "8 x 10": "5 x 7", "11 x 14": "8 x 10", "16 x 20": "11 x 14", "16 x 24": "11 x 17", "20 x 30": "16 x 24", "24 x 36": "18 x 27" },
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

	const CART_STORAGE_KEY = "ct-shop-cart-v1";
	const CROP_OFFSET_LIMIT = 50;

	function matWindowFor(product, size) {
		return product && product.matWindows ? product.matWindows[size] || null : null;
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
			const selections = defaultSelections(product);
			for (const group of product.optionGroups || []) {
				const selected = sourceSelections[group.key];
				if (selected !== undefined && selected !== "") {
					if (!group.options.some((candidate) => candidate.value === selected)) return [];
					selections[group.key] = selected;
				} else if (group.required && !selections[group.key]) {
					return [];
				}
			}
			if (missingRequiredOptions(product, selections).length) return [];
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
				unitPrice: priceFor(product, selections),
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
		const matWindow = matValue && matValue !== "No mat" ? matWindowFor(product, (selections || {}).size || product.sizes[0]) : null;
		const outerDimensions = dimensionsFor((selections || {}).size || product.sizes[0], photo);
		const windowDimensions = matWindow ? dimensionsFor(matWindow, photo) : null;
		const matInsetX = windowDimensions ? Math.max(0, (1 - windowDimensions.width / outerDimensions.width) * 50) : 0;
		const matInsetY = windowDimensions ? Math.max(0, (1 - windowDimensions.height / outerDimensions.height) * 50) : 0;
		const crop = clampCrop(settings.crop);
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
		return '<div class="shop-mockup shop-mockup--' + escapeHtml(product.slug) + ' shop-mockup--view-' + view + extraClass + '" style="--shop-art-ratio:' + ratio.toFixed(4) + ';--shop-wall-art-width:' + wallWidth.toFixed(2) + '%;--shop-crop-x:' + crop.x + '%;--shop-crop-y:' + crop.y + '%;--shop-mat-inset-x:' + matInsetX.toFixed(2) + '%;--shop-mat-inset-y:' + matInsetY.toFixed(2) + '%" data-shop-view="' + view + '" data-shop-orientation="' + dimensions.orientation + '">' +
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

	function cartCount(cart) {
		return (cart || []).reduce((count, line) => count + line.quantity, 0);
	}

	function renderStoreBar(state) {
		const count = cartCount(state.cart);
		return '<div class="shop-storebar"><span class="shop-storebar__label">CLAIRE THOMAS ART <span>/</span> PRINT STORE</span><a class="shop-storebar__cart" href="./prints.html?view=cart" aria-label="Cart, ' + count + ' items">' +
			'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 1.9-1.4L21 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><span>Cart</span><span class="shop-storebar__count">' + count + '</span></a></div>';
	}

	function selectedOptions(product, selections) {
		return product.optionGroups.filter((group) => group.key !== "size" && selections[group.key]).map((group) => selections[group.key]).join(" / ");
	}

	function photoForId(photos, id) {
		return photos.find((photo) => photoIdFor(photo) === String(id)) || null;
	}

	function renderCartPage(state) {
		if (!state.cart.length) return '<section class="shop-page shop-cart-page"><div class="shop-shell"><header class="shop-cart-heading"><p class="shop-eyebrow">SHOPPING CART</p><h1>Your cart is empty</h1></header><a class="shop-primary-button shop-cart-browse" href="./prints.html">Browse products</a></div></section>';
		const lines = state.cart.map((line) => {
			const product = productForSlug(line.productSlug);
			const photo = photoForId(state.photos, line.photoId);
			const summary = [line.selections.size, selectedOptions(product, line.selections)].filter(Boolean).join(" / ");
			return '<article class="shop-cart-line" data-shop-cart-line="' + escapeHtml(line.lineId) + '"><div class="shop-cart-line__art">' + renderMockup(product, line.selections, photo, { imageUrl: state.imageUrl, eager: true, crop: line.crop, view: "front" }) + '</div>' +
				'<div class="shop-cart-line__details"><h2>' + escapeHtml(product.name) + '</h2><p>' + escapeHtml(summary) + '</p><div class="shop-cart-line__tools"><div class="shop-quantity"><button type="button" data-shop-action="quantity-down" data-line-id="' + escapeHtml(line.lineId) + '" aria-label="Decrease quantity">−</button><input type="number" min="1" step="1" value="' + line.quantity + '" data-shop-quantity data-line-id="' + escapeHtml(line.lineId) + '" aria-label="Quantity"/><button type="button" data-shop-action="quantity-up" data-line-id="' + escapeHtml(line.lineId) + '" aria-label="Increase quantity">+</button></div>' +
				'<button class="shop-cart-remove" type="button" data-shop-action="remove-line" data-line-id="' + escapeHtml(line.lineId) + '">Remove</button></div></div><strong class="shop-cart-line__total">' + formatPrice(lineTotal(line)) + '</strong></article>';
		}).join("");
		const emailText = state.cart.map((line) => {
			const product = productForSlug(line.productSlug);
			return product.name + " — " + [line.selections.size, selectedOptions(product, line.selections)].filter(Boolean).join(" / ") + " × " + line.quantity + " — " + formatPrice(lineTotal(line));
		}).join("\n");
		const mailto = "mailto:contact@clairethomas.art?subject=" + encodeURIComponent("Print order inquiry") + "&body=" + encodeURIComponent("Hello Claire,\n\nI would like to order:\n" + emailText + "\n\nSubtotal: " + formatPrice(cartSubtotal(state.cart)));
		return '<section class="shop-page shop-cart-page"><div class="shop-shell"><header class="shop-cart-heading"><p class="shop-eyebrow">SHOPPING CART</p><h1>Your cart</h1></header><div class="shop-cart-lines">' + lines + '</div>' +
			'<div class="shop-cart-summary"><div><span>Subtotal</span><strong>' + formatPrice(cartSubtotal(state.cart)) + '</strong></div><p>Shipping and taxes are confirmed by email.</p><button class="shop-primary-button" type="button" data-shop-action="checkout">Checkout</button>' +
			'<p class="shop-checkout-message" data-shop-checkout tabindex="-1"' + (state.checkoutOpen ? '' : ' hidden') + ' role="status">Checkout coming soon — email <a href="' + escapeHtml(mailto) + '">contact@clairethomas.art</a> to order.</p></div></div></section>';
	}

	function renderPicker(state) {
		const tiles = state.photos.map((photo) => {
			const id = photoIdFor(photo);
			const selected = state.selectedPhotoIds.has(id);
			const source = state.imageUrl(photo);
			const ratio = (Number(photo.width) || 1) / (Number(photo.height) || 1);
			return '<button class="shop-picker-photo' + (selected ? ' is-selected' : '') + '" type="button" data-shop-action="picker-toggle" data-photo-id="' + escapeHtml(id) + '" aria-pressed="' + selected + '" aria-label="' + escapeHtml(photo.title || photo.alt || "Photograph") + '" style="--shop-photo-ratio:' + ratio.toFixed(4) + '"><span class="shop-picker-photo__image">' +
				(source ? '<img src="' + escapeHtml(source) + '" alt="" loading="lazy"/>' : '<span class="shop-mockup__placeholder"></span>') + '</span><span class="shop-picker-photo__check" aria-hidden="true">✓</span>' + (photo.title ? '<span class="shop-picker-photo__title">' + escapeHtml(photo.title) + '</span>' : '') + '</button>';
		}).join("");
		return '<div class="shop-picker-overlay" data-shop-picker-backdrop><section class="shop-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="shop-picker-title" tabindex="-1"><header class="shop-picker-header"><button class="shop-icon-button" type="button" data-shop-action="picker-close" aria-label="Close">×</button><div><h1 id="shop-picker-title">Select photos</h1><p>' + state.selectedPhotoIds.size + ' ' + (state.selectedPhotoIds.size === 1 ? 'photo' : 'photos') + ' selected</p></div><a class="shop-picker-cart" href="./prints.html?view=cart" aria-label="Cart, ' + cartCount(state.cart) + ' items">Cart <span>' + cartCount(state.cart) + '</span></a><button class="shop-picker-next" type="button" data-shop-action="picker-next"' + (state.selectedPhotoIds.size ? '' : ' disabled') + '>Next</button></header>' +
			(state.photos.length ? '<div class="shop-picker-grid">' + tiles + '</div>' : '<p class="shop-picker-empty">No print-enabled photos are available yet.</p>') + '</section></div>';
	}

	function customizePrice(product, selections) {
		const options = selectedOptions(product, selections);
		return (options ? options + " - " : "") + formatPrice(priceFor(product, selections));
	}

	function renderCustomizeLine(line, state, index) {
		const product = state.product;
		const photo = photoForId(state.photos, line.photoId);
		const windowSize = state.selections.mat && state.selections.mat !== "No mat" ? matWindowFor(product, state.selections.size) : null;
		const window = windowSize ? dimensionsFor(windowSize, photo) : null;
		const caption = window ? 'Your photo is ' + window.width + ' x ' + window.height + '" with the ' + escapeHtml(state.selections.mat) + ' option.' : '';
		const sizes = product.sizes.map((size) => '<option value="' + escapeHtml(size) + '"' + (size === state.selections.size ? ' selected' : '') + '>' + escapeHtml(size) + '</option>').join("");
		const cropping = state.cropActiveLineId === line.lineId;
		return '<article class="shop-customize-card"><header class="shop-customize-card__heading"><p>PHOTO ' + (index + 1) + ' OF ' + state.lines.length + '</p><h2>' + escapeHtml(photo && (photo.title || photo.alt) || 'Selected photograph') + '</h2></header>' +
			'<div class="shop-customize-art-wrap"><div class="shop-customize-art' + (cropping ? ' is-crop-active' : '') + '" data-shop-crop-id="' + escapeHtml(line.lineId) + '" tabindex="0" role="group" aria-label="' + (cropping ? 'Drag or use arrow keys to adjust crop' : 'Photograph preview') + '">' + renderMockup(product, state.selections, photo, { imageUrl: state.imageUrl, eager: true, view: "front", crop: line.crop }) + '</div></div>' +
			(caption ? '<p class="shop-mat-caption">' + caption + '</p>' : '') + '<div class="shop-customize-line-controls"><div class="shop-customize-crop-actions"><button type="button" data-shop-action="crop-toggle" data-line-id="' + escapeHtml(line.lineId) + '">' + (cropping ? 'Done cropping' : 'Edit crop') + '</button><button type="button" data-shop-action="change-photo" data-line-id="' + escapeHtml(line.lineId) + '">Change</button></div>' +
			(cropping ? '<p class="shop-crop-help">Drag the photo or use arrow keys to reposition it.</p>' : '') + '<div class="shop-customize-size-quantity"><label>Size<select data-shop-size-select aria-label="Print size">' + sizes + '</select></label>' +
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
		const size = state.selections.size || product.sizes[0];
		const line = state.lines.find((entry) => entry.lineId === state.previewLineId) || state.lines[0];
		const photo = line && photoForId(state.photos, line.photoId);
		const preview = state.previewLineId && line ? '<div class="shop-preview-overlay" data-shop-preview-backdrop><section class="shop-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="shop-preview-title" tabindex="-1"><header><h2 id="shop-preview-title">Preview on the wall</h2><button class="shop-icon-button" type="button" data-shop-action="preview-close" aria-label="Close preview">×</button></header><div class="shop-preview-wall">' + renderMockup(product, state.selections, photo, { imageUrl: state.imageUrl, eager: true, view: "wall", crop: line.crop }) + '</div></section></div>' : '';
		return '<section class="shop-page shop-customize-page"><header class="shop-customize-bar"><button class="shop-customize-back" type="button" data-shop-action="customize-back" aria-label="Back to photo selection">←</button><div class="shop-customize-bar__title"><h1 tabindex="-1">' + escapeHtml(size) + '" ' + escapeHtml(product.name) + '</h1><p>' + escapeHtml(customizePrice(product, state.selections)) + '</p></div><div class="shop-customize-bar__actions"><button type="button" data-shop-action="preview">Preview</button><button type="button" data-shop-action="edit-product">Edit product</button><button class="shop-customize-add" type="button" data-shop-action="add-to-cart">Add to cart</button></div></header>' +
			'<div class="shop-shell shop-customize-shell"><div class="shop-customize-lines">' + state.lines.map((entry, index) => renderCustomizeLine(entry, state, index)).join("") + '</div></div>' + renderEditPanel(state) + preview + '</section>';
	}

	function renderStoreContent(state) {
		let content;
		if (state.screen === "cart") content = renderCartPage(state);
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
		const safeContext = context || {};
		const photos = selectStorePhotos(safeContext.albums || []);
		const params = global.location && global.URLSearchParams ? new global.URLSearchParams(global.location.search) : null;
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
			selections: product ? defaultSelections(product) : {},
			invalid: new Set(),
			cart: readCart(storage, photos),
			storage,
			screen: params && params.get("view") === "cart" ? "cart" : "page",
			pageNotFound: Boolean(url && !product),
			selectedPhotoIds: new Set(),
			pickerMode: "new",
			pickerReturnScreen: "page",
			lines: [],
			cropActiveLineId: "",
			cropDrag: null,
			editPanelOpen: false,
			previewLineId: "",
			checkoutOpen: false,
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

	function openPhotoPicker(product, selections, settings) {
		if (!activeState || !product) return;
		const options = settings || {};
		activeState.product = product;
		activeState.selections = resolveSelections(product, selections || activeState.selections);
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

	function finishPhotoSelection() {
		if (!activeState.selectedPhotoIds.size) return;
		const ids = Array.from(activeState.selectedPhotoIds);
		if (activeState.pickerMode === "replace") {
			const line = activeState.lines.find((entry) => entry.lineId === activeState.changeLineId);
			if (line) line.photoId = ids[0];
		} else if (activeState.pickerMode === "review") {
			const oldLines = activeState.lines.slice();
			activeState.lines = ids.map((photoId) => oldLines.find((line) => line.photoId === photoId) || ({ lineId: newLineId(), photoId, crop: { x: 0, y: 0 }, quantity: 1 }));
		} else activeState.lines = ids.map((photoId) => ({ lineId: newLineId(), photoId, crop: { x: 0, y: 0 }, quantity: 1 }));
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
		const items = activeState.lines.map((line) => ({
			lineId: line.lineId,
			productSlug: product.slug,
			selections: Object.assign({}, activeState.selections),
			photoId: line.photoId,
			crop: clampCrop(line.crop),
			quantity: Math.max(1, Math.floor(Number(line.quantity) || 1)),
			unitPrice: priceFor(product, activeState.selections),
		}));
		activeState.cart = activeState.cart.concat(items);
		saveCart();
		activeState.screen = "cart";
		activeState.checkoutOpen = false;
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
				if (activeState.pickerMode === "replace") {
					activeState.selectedPhotoIds = activeState.selectedPhotoIds.has(id) ? new Set() : new Set([id]);
				} else if (activeState.selectedPhotoIds.has(id)) activeState.selectedPhotoIds.delete(id);
				else activeState.selectedPhotoIds.add(id);
				renderStore(); focusPhoto(id); return;
			}
			if (name === "picker-next") { finishPhotoSelection(); return; }
			if (name === "customize-back") { openPhotoPicker(activeState.product, activeState.selections, { mode: "review", returnScreen: "customize" }); return; }
			if (name === "change-photo") { openPhotoPicker(activeState.product, activeState.selections, { mode: "replace", returnScreen: "customize", lineId: action.dataset.lineId }); return; }
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
			if (name === "checkout") { activeState.checkoutOpen = true; renderStore(); focusShop("[data-shop-checkout]"); return; }
		}
		const optionButton = target.closest("[data-shop-option-group][data-shop-option-value]");
		if (!optionButton || !activeState.product) return;
		const groupKey = optionButton.dataset.shopOptionGroup;
		activeState.selections[groupKey] = optionButton.dataset.shopOptionValue;
		activeState.invalid.delete(groupKey);
		if (activeState.screen === "customize") renderStore();
		else updateProductPriceAndOptions();
	}

	function handleChange(event) {
		const target = event.target;
		if (!target || !target.closest) return;
		const size = target.closest("[data-shop-size-select]");
		if (size && activeState.screen === "customize") { activeState.selections.size = size.value; renderStore(); return; }
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
	}

	const api = {
		catalog: SHOP_CATALOG,
		cartStorageKey: CART_STORAGE_KEY,
		cartSubtotal,
		clampCrop,
		dimensionsFor,
		fromPrice,
		lineTotal,
		matWindowFor,
		missingRequiredOptions,
		openPhotoPicker,
		parseCart,
		priceFor,
		renderMockup,
		renderPage,
		selectStorePhotos,
		serializeCart,
		mount,
	};
	global.PortfolioShop = api;
})(typeof window !== "undefined" ? window : globalThis);
