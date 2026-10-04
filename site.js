const siteTitle = "CLAIRE THOMAS";
const siteLogoPath = "./assets/claire-thomas-logo.png";

const escapeHtml = (value) =>
	String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");

const cloudinaryConfig = {
	enabled: true,
	cloudName: "dpmdkrggj",
	transformation: "f_auto,q_auto",
	galleryWidth: 1200,
	lightboxWidth: 2400,
	placeholderWidth: 80,
};

const printShopConfig = {
	shopUrl: "https://shop.clairethomas.art/collections/all",
	email: "contact@clairethomas.art",
	productUrls: {
		"the-natural-world-3":
			"https://shop.clairethomas.art/products/the-natural-world-3-fine-art-print?variant=53830433439928&_pos=1&_sid=52b689322&_ss=r",
	},
};

const SHOPIFY_SERIES_HANDLES = {
	"the-natural-world": "the-natural-world",
	california: "california",
	"san-francisco": "san-francisco",
	india: "india",
	"shapes-and-shadows": "shapes-shadows",
	protests: "reportage",
};

const navLabelOverrides = {
	protests: "events",
	"special-occasion": "special occasions",
	"commissioned-work": "portraits",
};

const homeConfig = {
	// Homepage photos come from the CMS "slideshow" album; Events fills in if it's missing or empty.
	slideshowAlbumKey: "slideshow",
	slideshowFallbackAlbumKey: "protests",
	slideIntervalMs: 5000,
	portfolioLinks: [
		{ label: "Events", path: "./events.html", key: "protests" },
		{ label: "Nature", path: "./nature.html", key: "the-natural-world" },
		{ label: "Street", path: "./street.html", key: "shapes-and-shadows" },
	],
	bookingUrl: "./booking.html",
	inquiryEmail: "contact@clairethomas.art",
};

const buildCloudinaryUrl = (publicId, options = {}) => {
	if (!cloudinaryConfig.enabled || !cloudinaryConfig.cloudName || !publicId) return "";
	const encodedSegments = publicId.split("/").map(encodeURIComponent).join("/");
	const transforms = [cloudinaryConfig.transformation];
	if (options.width) transforms.push(`w_${options.width},c_limit`);
	if (options.height) transforms.push(`h_${options.height},c_limit`);
	if (options.quality) transforms.push(`q_${options.quality}`);
	if (options.effect) transforms.push(options.effect);
	return `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload/${transforms.join(",")}/${encodedSegments}`;
};

const resolveImageUrl = (itemOrPath, options = {}) => {
	if (!itemOrPath) return itemOrPath;
	if (typeof itemOrPath === "string") return encodeURI(itemOrPath);
	if (itemOrPath.publicId) return buildCloudinaryUrl(itemOrPath.publicId, options);
	return encodeURI(itemOrPath.image);
};

const localImageUrl = (itemOrPath) => {
	if (!itemOrPath) return itemOrPath;
	if (typeof itemOrPath === "string") return encodeURI(itemOrPath);
	return itemOrPath.image ? encodeURI(itemOrPath.image) : "";
};

const createGalleryItems = (prefix, specs) =>
	specs.map(([width, height, hasLocation], index) => ({
		id: `${prefix}-${index + 1}`,
		title: `Placeholder Image ${index + 1}`,
		width,
		height,
		location: hasLocation ? "Location Placeholder" : "",
	}));

const createLocalGalleryItems = (prefix, folder, specs, options = {}) =>
	specs.map(([file, width, height]) => ({
		id: `${prefix}-${pathBasename(file)}`,
		title: "",
		width,
		height,
		location: "",
		image: `./${folder}/${file}`,
		publicId: options.publicIdBase ? `${options.publicIdBase}/${pathBasename(file)}` : undefined,
	}));

const pathBasename = (file) => file.replace(/\.[^.]+$/, "");

const naturalWorldSpecs = [
	["1.jpg", 5184, 3456, "1_vnpnhf"],
	["2.jpg", 5184, 3456, "2_gaxjez"],
	["3.jpg", 4384, 3197, "3_asebdu"],
	["4.jpg", 5184, 3456, "4_auboh4"],
	["5.jpg", 5184, 3456, "5_lw9bhq"],
	["6.jpg", 5184, 3456, "6_mwivsz"],
	["7.jpg", 5184, 3456, "7_gu4xgl"],
	["8.jpg", 3888, 5184, "8_ongbmt"],
	["9.jpg", 5184, 3888, "9_wy3rcc"],
	["10.jpg", 5184, 3888, "10_dbkilq"],
	["11.jpg", 5184, 3888, "11_gaovai"],
	["12.jpg", 5184, 3888, "12_txfrr3"],
	["13.jpg", 5184, 3888, "13_vnosf7"],
	["14.jpg", 3888, 5184, "14_wxnggz"],
	["15.jpg", 5184, 3888, "15_ebnk6a"],
	["16.jpg", 5011, 3758, "16_y4smm6"],
	["17.jpg", 5125, 3844, "17_jxygsv"],
	["18.jpg", 5184, 3888, "18_nmue2y"],
	["19.jpg", 5184, 3710, "19_qyy4re"],
	["20.jpg", 3888, 5184, "20_dgcjip"],
	["21.jpg", 5184, 3888, "21_hcnksz"],
	["22.jpg", 3888, 3974, "22_s7l89m"],
	["23.jpg", 3888, 3843, "23_avb5au"],
	["24.jpg", 3888, 5184, "24_pal1ru"],
	["25.jpg", 5184, 3888, "25_ywmvg4"],
	["26.jpg", 3888, 5184, "26_vqyhbg"],
	["27.jpg", 4903, 3677, "27_cgamwb"],
	["28.jpg", 5184, 3888, "28_q8wmqr"],
	["29.jpg", 5184, 3888, "29_q9cn74"],
	["30.jpg", 3429, 2546, "30_avnqin"],
	["31.jpg", 4961, 3800, "31_r5ics0"],
	["32.jpg", 3888, 5184, "32_yzhcp9"],
	["33.jpg", 2772, 3698, "33_upfnu2"],
	["34.jpg", 3520, 4278, "34_lphoqo"],
	["35.jpg", 5184, 3456, "35_fov0c6"],
	["37.jpg", 5184, 3456, "37_dt11xh"],
];

const protestsSpecs = [
	["1.JPG", 5134, 3423],
	["2.JPG", 3636, 4706],
	["3.JPG", 5184, 3888],
	["4.JPG", 5054, 3888],
	["5.JPG", 5184, 3888],
	["6.JPG", 5131, 3634],
	["7.JPG", 5184, 3888],
	["8.JPG", 5184, 3888],
	["9.JPG", 5184, 3888],
	["10.JPG", 5011, 3758],
	["11.JPG", 5184, 3888],
	["12.JPG", 2986, 4071],
	["13.JPG", 5184, 3888],
	["14.JPG", 3709, 4948],
	["15.JPG", 5184, 3888],
	["16.JPG", 5184, 3888],
	["17.JPG", 3427, 5184],
	["18.JPG", 4755, 3601],
	["19.JPG", 5184, 3888],
	["20.JPG", 5119, 3888],
	["21.JPG", 5093, 3791],
	["22.JPG", 5184, 3888],
	["23.JPG", 5056, 3757],
	["24.JPG", 5184, 3888],
	["25.JPG", 5133, 3888],
	["26.JPG", 5184, 3888],
	["27.JPG", 5184, 3888],
	["28.JPG", 5131, 3888],
	["29.JPG", 4963, 3765],
	["30.JPG", 3774, 4894],
	["31.JPG", 5125, 3844],
	["32.JPG", 3888, 4899],
	["33.JPG", 4870, 3888],
	["34.JPG", 5116, 3811],
];

const shapesAndShadowsSpecs = [
	["1.JPG", 3396, 4753],
	["2.JPG", 5125, 3844],
	["3.JPG", 4714, 3552],
	["4.JPG", 3800, 5067],
	["5.JPG", 3888, 5184],
	["6.JPG", 5057, 3844],
	["7.JPG", 3242, 1862],
	["9.JPG", 5184, 3888],
	["10.JPG", 3888, 4978],
	["11.JPG", 3845, 4962],
	["12.JPG", 5184, 3888],
	["13.JPG", 5184, 3888],
	["14.JPG", 3888, 5184],
	["15.JPG", 3888, 5184],
	["16.JPG", 3843, 4651],
	["17.JPG", 3888, 5103],
	["18.JPG", 4130, 3256],
	["19.JPG", 3721, 4976],
];

const californiaSpecs = [
	["1.jpg", 5184, 3456],
	["3.jpg", 3888, 5184],
	["4.jpg", 5026, 3888],
	["5.jpg", 5051, 3888],
	["6.jpg", 5184, 3888],
	["7.jpg", 5184, 3888],
	["8.jpg", 3888, 4770],
	["11.jpg", 5184, 3888],
	["12.jpg", 4618, 3456],
	["15.jpg", 5184, 3888],
	["16.jpg", 5184, 3888],
	["17.jpg", 3673, 5038],
	["18.jpg", 3844, 5125],
	["19.jpg", 5184, 3888],
	["20.jpg", 5184, 3888],
	["22.jpg", 5125, 3844],
	["23.jpg", 5184, 3456],
	["24.jpg", 3888, 5184],
	["25.jpg", 3888, 5184],
	["26.jpg", 3456, 5184],
	["27.jpg", 5184, 3456],
	["28.jpg", 5184, 3456],
	["29.jpg", 5184, 3456],
	["30.jpg", 5184, 3456],
	["31.jpg", 5184, 3456],
	["32.jpg", 5184, 3456],
];
const sanFranciscoSpecs = [
	["1.jpg", 5031, 3456],
	["2.jpg", 5184, 3056],
	["3.jpg", 3844, 5125],
	["4.jpg", 5184, 3888],
	["5.jpg", 5184, 3888],
	["6.jpg", 4956, 3717],
	["7.jpg", 3888, 5184],
	["8.jpg", 3888, 5184],
	["9.jpg", 5184, 3888],
	["10.jpg", 3844, 5125],
	["11.jpg", 5184, 3888],
	["12.jpg", 3830, 5184],
	["13.jpg", 4515, 3456],
	["14.jpg", 3888, 5184],
	["15.jpg", 5105, 3834],
	["24.jpg", 4925, 3304],
	["25.jpg", 5184, 3888],
	["26.jpg", 3604, 5132],
	["27.jpg", 3888, 5184],
	["28.jpg", 3888, 5184],
	["29.jpg", 5184, 3888],
	["32.jpg", 3888, 5184],
	["42.jpg", 4852, 3639],
	["43.jpg", 5011, 3758],
	["44.jpg", 5184, 3888],
	["46.jpg", 5184, 3456],
	["47.jpg", 4482, 3298],
	["49.jpg", 5184, 3456],
	["51.jpg", 5184, 3456],
	["52.jpg", 3785, 5119],
	["54.jpg", 4785, 3373],
	["55.jpg", 3321, 4117],
	["56.jpg", 3642, 4492],
	["57.jpg", 5038, 3888],
	["58.jpg", 3774, 5071],
	["59.jpg", 5062, 3747],
	["60.jpg", 3477, 5072],
	["61.jpg", 5011, 3758],
	["62.jpg", 5184, 3888],
	["63.jpg", 4916, 3567],
	["64.jpg", 3888, 5184],
	["65.jpg", 5126, 3456],
	["66.jpg", 3888, 5184],
	["67.jpg", 3598, 4749],
	["68.jpg", 5184, 3888],
	["69.jpg", 3888, 5184],
	["70.jpg", 3800, 5029],
	["71.jpg", 3681, 5057],
	["72.jpg", 5184, 3888],
	["73.jpg", 5184, 3888],
	["74.jpg", 3888, 5184],
	["75.jpg", 3888, 5184],
	["76.jpg", 5184, 3456],
	["77.jpg", 5184, 3424],
	["78.jpg", 3888, 5184],
	["79.jpg", 3596, 4784],
	["80.jpg", 5011, 3758],
	["81.jpg", 3888, 5184],
	["82.jpg", 5184, 3888],
	["83.jpg", 3888, 5184],
	["84.jpg", 5184, 3888],
	["85.jpg", 3888, 5184],
	["86.jpg", 3888, 5184],
	["87.jpg", 5117, 3411],
	["88.jpg", 3888, 5184],
	["89.jpg", 5011, 3758],
	["90.jpg", 3888, 5184],
	["91.jpg", 3844, 5125],
	["92.jpg", 3888, 5184],
	["93.jpg", 3888, 5184],
	["94.jpg", 3888, 5184],
	["95.jpg", 3888, 5184],
	["98.jpg", 5184, 3456],
	["99.jpg", 5184, 3888],
	["100.jpg", 3888, 4965],
	["101.jpg", 3888, 4319],
	["102.jpg", 5184, 3888],
	["103.jpg", 3888, 5184],
	["104.jpg", 3888, 5184],
	["105.jpg", 3888, 5184],
	["106.jpg", 5184, 3888],
	["107.jpg", 4754, 3676],
	["108.jpg", 3888, 5184],
	["109.jpg", 3603, 3121],
	["110.jpg", 3743, 4799],
	["111.jpg", 5125, 3844],
	["112.jpg", 5184, 3888],
	["113.jpg", 5067, 3800],
	["114.jpg", 4895, 3572],
	["115.jpg", 3888, 5085],
	["119.jpg", 3844, 5125],
	["120.jpg", 3456, 5184],
	["121.jpg", 3888, 5184],
	["122.jpg", 3888, 5184],
	["123.jpg", 3888, 4998],
	["124.jpg", 3888, 5184],
	["125.jpg", 3888, 5184],
	["126.jpg", 5011, 3758],
	["127.jpg", 5184, 3888],
	["128.jpg", 3888, 5184],
	["129.jpg", 4341, 2883],
	["130.jpg", 3888, 5005],
	["131.jpg", 3456, 5184],
	["132.jpg", 3830, 5107],
	["133.jpg", 3888, 5184],
	["134.jpg", 3888, 5184],
	["135.jpg", 3888, 5116],
	["136.jpg", 3802, 4970],
	["137.jpg", 5184, 3825],
	["138.jpg", 3888, 5184],
	["139.jpg", 5184, 3888],
	["140.jpg", 5011, 3758],
	["141.jpg", 5125, 3844],
];

const sanFranciscoReportageSpecs = [
	["16.jpg", 4995, 3585],
	["17.jpg", 2297, 2513],
	["18.jpg", 5184, 3888],
	["19.jpg", 3322, 2498],
	["20.jpg", 5107, 3888],
	["21.jpg", 2822, 2058],
	["22.jpg", 3715, 5038],
	["23.jpg", 3758, 5011],
	["38.jpg", 5184, 3888],
	["39.jpg", 3822, 5184],
	["116.jpg", 5127, 3821],
	["117.jpg", 5184, 3888],
	["118.jpg", 5184, 3888],
];

const indiaSpecs = [
	["1.JPG", 3404, 4934],
	["2.JPG", 5184, 3456],
	["3.JPG", 5184, 3456],
	["4.JPG", 5184, 3456],
	["5.JPG", 3888, 5067],
	["6.JPG", 3527, 2788],
	["7.JPG", 3695, 5130],
	["8.JPG", 3888, 5184],
	["9.JPG", 5184, 3888],
	["10.JPG", 4309, 3888],
	["11.JPG", 3888, 5184],
	["12.JPG", 3888, 5184],
	["14.JPG", 3853, 5028],
	["15.JPG", 5184, 3888],
	["16.JPG", 5184, 3888],
	["17.JPG", 5125, 3844],
	["19.JPG", 5184, 3888],
	["20.JPG", 5151, 3888],
	["21.JPG", 5184, 3888],
	["23.JPG", 4956, 3608],
	["24.JPG", 3888, 5184],
	["25.JPG", 3888, 5184],
	["26.JPG", 3888, 5184],
	["27.JPG", 3766, 4765],
	["29.JPG", 5184, 3888],
	["30.JPG", 5125, 3844],
	["31.JPG", 3730, 5067],
	["32.JPG", 5011, 3758],
	["33.JPG", 5125, 3844],
	["34.JPG", 3800, 4185],
];

const commissionedWorkSpecs = [
	["1.jpg", 5184, 3888],
	["2.jpg", 5184, 3834],
	["3.jpg", 4990, 3747],
	["4.jpg", 5125, 3756],
	["5.jpg", 5184, 3888],
	["6.jpg", 3756, 3848],
	["7.jpg", 4862, 3758],
	["8.jpg", 3888, 5184],
	["9.jpg", 3888, 5184],
	["10.jpg", 5184, 3888],
	["11.jpg", 3717, 4956],
	["12.jpg", 733, 1100],
	["13.jpg", 1650, 1100],
	["14.jpg", 733, 1100],
	["15.jpg", 960, 640],
	["16.jpg", 733, 1100],
	["17.jpg", 1650, 1100],
	["18.jpg", 733, 1100],
	["19.jpg", 733, 1100],
	["20.jpg", 1650, 1100],
	["21.jpg", 1650, 1100],
	["22.jpg", 733, 1100],
	["23.jpg", 1650, 1100],
];

const reportageCaptionForIndex = (index) => {
	if (index >= 5 && index <= 10) return "No Kings Day protest in San Francisco’s Dolores Park on June 14, 2025";
	if (index === 11) return "The second No Kings Day protest in downtown San Francisco on October 18, 2025";
	if (index >= 12 && index <= 33) return "The third No Kings Day protest in downtown San Francisco on March 28, 2026";
	return "";
};

let galleryPages = [
	{
		key: "the-natural-world",
		label: "the natural world",
		path: "./nature.html",
		items: naturalWorldSpecs.map(([file, width, height, publicId]) => ({
			id: `the-natural-world-${pathBasename(file)}`,
			title: "",
			width,
			height,
			location: "",
			image: `./The Natural World/${file}`,
			publicId,
		})),
	},
	{
		key: "california",
		label: "California",
		path: "./california.html",
		items: createLocalGalleryItems("california", "Place/California", californiaSpecs, { publicIdBase: "place/california" }),
	},
	{
		key: "san-francisco",
		label: "San Francisco",
		path: "./san-francisco.html",
		items: createLocalGalleryItems("san-francisco", "Place/California/San Francisco", sanFranciscoSpecs, { publicIdBase: "place/california/san-francisco" }),
	},
	{
		key: "india",
		label: "India",
		path: "./india.html",
		items: createLocalGalleryItems("india", "Place/India", indiaSpecs, { publicIdBase: "place/india" }),
	},
	{
		key: "shapes-and-shadows",
		label: "shapes & shadows",
		path: "./street.html",
		items: createLocalGalleryItems("shapes-and-shadows", "Shapes & Shadows", shapesAndShadowsSpecs, {
			publicIdBase: "shapes-and-shadows",
		}),
	},
	{
		key: "protests",
		label: "events",
		path: "./events.html",
		items: [
			...createLocalGalleryItems("protests", "Protests", protestsSpecs, { publicIdBase: "protests" }).map((item, index) => ({
				...item,
				title: reportageCaptionForIndex(index),
			})),
			...createLocalGalleryItems("protests-san-francisco", "Place/California/San Francisco", sanFranciscoReportageSpecs, {
				publicIdBase: "place/california/san-francisco",
			}),
		],
	},
	{
		key: "commissioned-work",
		label: "portraits",
		path: "./commissioned-work.html",
		items: commissionedWorkSpecs.map(([file, width, height], index) => ({
			id: `commissioned-work-${index + 1}`,
			title: "",
			width,
			height,
			location: "",
			image: `./Commissioned Work/${file}`,
			publicId: `commissioned-work/${index + 1}`,
		})),
	},
];

const applyCmsContent = (content) => {
	if (!content || !Array.isArray(content.albums) || !content.albums.length) return;
	const albums = content.albums
		.map((album) => ({
			...album,
			items: [...(album.items || [])]
				.sort((left, right) => left.order - right.order)
				.map((item) => ({
					...item,
					title: item.title || "",
					location: item.location || "",
				})),
		}))
		.sort((left, right) => left.order - right.order);
	galleryPages = albums;
};

applyCmsContent(window.__PORTFOLIO_CONTENT__);

const placeholderUrl = (item) => {
	if (item.publicId) {
		return resolveImageUrl(item, {
			width: cloudinaryConfig.placeholderWidth,
			quality: 20,
			effect: "e_blur:1200",
		});
	}
	const width = Math.max(32, Math.round(item.width / 16));
	const height = Math.max(32, Math.round(item.height / 16));
	return `https://picsum.photos/seed/${item.id}/${width}/${height}`;
};

const galleryImageUrl = (item) => resolveImageUrl(item, { width: cloudinaryConfig.galleryWidth });
const lightboxImageUrl = (item) => resolveImageUrl(item, { width: cloudinaryConfig.lightboxWidth });
const printInquiryUrl = (item, page) => {
	const printId = item && page ? item.id : "";
	const subject = encodeURIComponent(printId ? `Print inquiry: ${printId}` : "Print inquiry");
	const body = encodeURIComponent(
		printId
			? `Hi Claire,\n\nI would like to order a print of ${printId}.\n\nPreferred size:\nShipping country:\n`
			: "Hi Claire,\n\nI would like to order a print.\n\nPreferred photo:\nPreferred size:\nShipping country:\n",
	);
	return `mailto:${printShopConfig.email}?subject=${subject}&body=${body}`;
};
const referenceLabelFor = (printId, albumKey) => {
	const prefix = `${albumKey}-`;
	const reference = printId.startsWith(prefix) ? printId.slice(prefix.length) : printId;
	return reference
		.split("-")
		.map((part) => (/^\d+$/.test(part) ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
		.join(" ");
};

const shopifyHandleize = (value) =>
	value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

const shopifyFineArtHandleFor = (item, album) => {
	if (!item?.id || !album?.key) return "";
	const seriesHandle = SHOPIFY_SERIES_HANDLES[album.key] || shopifyHandleize(album.key);
	const referenceHandle = shopifyHandleize(referenceLabelFor(item.id, album.key));
	return seriesHandle && referenceHandle ? `${seriesHandle}-${referenceHandle}-fine-art-print` : "";
};

const printOrderUrl = (item, page) => {
	const printId = item && page ? item.id : "";
	if (!printShopConfig.shopUrl) return printInquiryUrl(item, page);
	if (printId) {
		if (printShopConfig.productUrls[printId]) return printShopConfig.productUrls[printId];
		const productHandle = shopifyFineArtHandleFor(item, page);
		if (productHandle) return `https://shop.clairethomas.art/products/${productHandle}`;
	}
	return printShopConfig.shopUrl;
};
const responsiveWidths = [400, 800, 1200, 1600, 2400];
const imageSrcSet = (item, widths = responsiveWidths) => {
	if (!item?.publicId) return "";
	return widths.map((width) => `${resolveImageUrl(item, { width })} ${width}w`).join(", ");
};
const lightboxImageSizes = "100vw";

const currentPageKey = document.body.dataset.page || "the-natural-world";

const galleryTitleFor = (page) =>
	homeConfig.portfolioLinks.find((link) => link.key === page.key)?.label || navLabelOverrides[page.key] || page.label;

// Albums nested under a portfolio section in the CMS (e.g. Special occasions under
// Events) are reached from that section's switcher rather than the Portfolio menu.
const sectionRootFor = (page) =>
	(page?.parentId && galleryPages.find((candidate) => candidate.id === page.parentId)) || page;

const sectionFamilyFor = (page) => {
	const root = sectionRootFor(page);
	if (!root) return [];
	const children = galleryPages.filter((candidate) => candidate.parentId === root.id && candidate.items.length);
	return children.length ? [root, ...children] : [];
};

const albumPathFor = (page) =>
	homeConfig.portfolioLinks.find((link) => link.key === page.key)?.path || `./gallery.html?album=${encodeURIComponent(page.key)}`;

const renderAlbumSwitcher = (page) => {
	const family = sectionFamilyFor(page);
	if (family.length < 2) return "";
	return `
		<nav class="album-switcher" aria-label="${escapeHtml(galleryTitleFor(family[0]))} albums">
			${family
				.map(
					(album) => `
						<a class="album-switcher-link" href="${albumPathFor(album)}" ${album.key === page.key ? 'aria-current="page"' : ""}>
							<span>${escapeHtml(galleryTitleFor(album))}</span>
							<small>${album.items.length}</small>
						</a>
					`,
				)
				.join("")}
		</nav>
	`;
};

// Portfolio sections open with their first photo full width (like the homepage)
// and continue in either a spacious two-column grid or a full-width stream.
const galleryConfig = {
	layout: "grid",
	// Which photo opens each section (0 = first in the album); defaults to the first.
	coverIndex: {
		protests: 1,
	},
};

const galleryHeroSizes = "100vw";
const galleryLayoutSizes = {
	grid: "(max-width: 820px) 100vw, 50vw",
	stream: "100vw",
};

const renderGalleryCard = (page, item, index, className, sizes) => {
	const highResSrc = item.publicId || item.image ? galleryImageUrl(item) : placeholderUrl(item);
	const highResSrcSet = item.publicId ? imageSrcSet(item) : "";
	const hasCaption = item.title || item.location;
	const eager = index < 3;
	return `
		<figure class="${className}">
			<button
				class="gallery-trigger"
				type="button"
				data-gallery-key="${page.key}"
				data-gallery-index="${index}"
				aria-label="Open image ${index + 1} from ${escapeHtml(galleryTitleFor(page))}"
			>
				<img class="progressive-image" src="${placeholderUrl(item)}" data-high-src="${highResSrc}" data-high-srcset="${highResSrcSet}" data-sizes="${sizes}" data-local-src="${localImageUrl(item)}" alt="${escapeHtml(item.title || galleryTitleFor(page))}" width="${item.width}" height="${item.height}" loading="${eager ? "eager" : "lazy"}" fetchpriority="${eager ? "high" : "low"}" decoding="async" />
			</button>
			${
				hasCaption
					? `<figcaption>
						${item.title ? `<span>${escapeHtml(item.title)}</span>` : ""}
						${item.location ? `<small>${escapeHtml(item.location)}</small>` : ""}
					</figcaption>`
					: ""
			}
		</figure>
	`;
};

const renderGallery = (page) => {
	const title = galleryTitleFor(page);
	if (!page.items.length) {
		return `
			<section class="gallery-page">
				<header class="page-title"><h1 class="${page.preserveCase ? "preserve-case" : ""}">${escapeHtml(title)}</h1></header>
				<div class="empty-gallery"><p>No images added yet.</p></div>
			</section>
		`;
	}
	const requestedCover = galleryConfig.coverIndex[page.key] ?? 0;
	const coverIndex = page.items[requestedCover] ? requestedCover : 0;
	const hero = page.items[coverIndex];
	// Keep each photo's album position so the lightbox still steps through the album in order.
	const rest = page.items.map((item, index) => ({ item, index })).filter(({ index }) => index !== coverIndex);
	const count = page.items.length;
	return `
		<section class="section-page" data-layout="${galleryConfig.layout}">
			<header class="section-hero">
				${renderGalleryCard(page, hero, coverIndex, "section-hero-photo", galleryHeroSizes)}
				<div class="section-hero-caption">
					<p class="section-hero-eyebrow">Portfolio</p>
					<h1 class="${page.preserveCase ? "preserve-case" : ""}">${escapeHtml(title)}</h1>
					<p class="section-hero-count">${count} photograph${count === 1 ? "" : "s"}</p>
				</div>
			</header>
			${renderAlbumSwitcher(page)}
			${
				rest.length
					? `<div class="section-photos">
						${rest.map(({ item, index }) => renderGalleryCard(page, item, index, "section-photo", galleryLayoutSizes[galleryConfig.layout] || galleryLayoutSizes.grid)).join("")}
					</div>`
					: ""
			}
		</section>
	`;
};

const renderWorkshops = () => `
	<section class="detail-page workshops-page">
		<div class="workshops-copy">
			<p>There are no scheduled events in the near future. Subscribe to my newsletter to receive updates:</p>
			<form class="newsletter-form">
				<input type="email" placeholder="Email Address" aria-label="Email Address" />
				<button type="submit">Submit</button>
			</form>
		</div>
	</section>
`;

const aboutPortrait = { image: "./fqs 2025-12-19 161703.086.jpg", publicId: "about/portrait" };

const renderAbout = () => `
	<section class="detail-page about-page">
		<div class="about-image-wrap">
			<img src="${resolveImageUrl(aboutPortrait, { width: 1200 })}" srcset="${imageSrcSet(aboutPortrait)}" sizes="(max-width: 1100px) 100vw, 520px" data-local-src="${localImageUrl(aboutPortrait.image)}" alt="Claire Thomas portrait" width="3024" height="4536" loading="eager" fetchpriority="high" decoding="async" />
		</div>
		<div class="about-copy">
			<p class="about-eyebrow">About</p>
			<h1>Hi! I’m Claire.</h1>
			<p>I’m a San Francisco based event photographer. I’ve loved being behind a camera since I first picked up my mom’s DSLR at age 14. When I’m not shooting events, I’m out capturing beauty as it unfolds through nature and street photography.</p>
			<p>With every project, I bring a candid documentary approach, an easygoing energy, and a dedication to ensuring your vision is realized.</p>
			<p>If you’d like to work with me, please get in touch at the email below!</p>
			<div class="about-actions">
				<a class="brand-button" href="${homeConfig.bookingUrl}">Book a shoot</a>
				<a class="about-email" href="mailto:contact@clairethomas.art?subject=Inquiry">contact@clairethomas.art</a>
			</div>
		</div>
	</section>
`;

// Packages and what's included are Claire's event pricing. The testimonials are still
// sample content and stay hidden (showTestimonials) until real ones exist.
const bookingConfig = {
	showPackages: true,
	showTestimonials: false,
	packages: [
		{ name: "Standard Event", duration: "3 hrs", price: "$450", features: ["150+ digital images"] },
		{ name: "Half Day Event", duration: "4 hrs", price: "$600", features: ["200+ digital images"] },
		{ name: "Full Day Event", duration: "8 hrs", price: "$1200", features: ["400+ digital images"] },
	],
	// Applies to every package; shown under the package cards.
	included: [
		"Sneak peeks for immediate social media use within 24 hrs",
		"Full gallery of professionally edited, high resolution images delivered within 5 business days",
		"On average, I deliver 50 edited photos per hour of coverage",
	],
	notes: ["A travel fee of $0.76 per mile will be applied if the event is beyond the limits of SF"],
	testimonials: [
		{
			quote: "Claire blended into the room and still caught every moment that mattered. Our team keeps asking where the photos came from.",
			name: "Sample Client",
			context: "Company launch, San Francisco",
			// Photo shown beside the quote: an album and the photo's position in it (0 = first).
			photo: { album: "protests", index: 4 },
		},
		{
			quote: "Easygoing, fast, and incredibly thoughtful. The gallery arrived early and told the story of the whole day.",
			name: "Sample Client",
			context: "Community event, Oakland",
			photo: { album: "protests", index: 9 },
		},
		{
			quote: "She captured the energy of the march without ever getting in the way. These images are now part of our archive.",
			name: "Sample Client",
			context: "Advocacy organization",
			photo: { album: "protests", index: 14 },
		},
	],
};

const renderPackages = () => `
	<div class="package-grid">
		${bookingConfig.packages
			.map(
				(item) => `
					<article class="package-card ${item.featured ? "is-featured" : ""}">
						${item.featured ? `<p class="package-badge">Most booked</p>` : ""}
						<h2>${escapeHtml(item.name)}</h2>
						${item.duration ? `<p class="package-duration">${escapeHtml(item.duration)}</p>` : ""}
						<p class="package-price">${escapeHtml(item.price)}</p>
						${item.summary ? `<p class="package-summary">${escapeHtml(item.summary)}</p>` : ""}
						<ul>${item.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul>
						<a class="${item.featured ? "brand-button" : "outline-button"}" href="#booking-form" data-package="${escapeHtml(item.name)}">Inquire</a>
					</article>
				`,
			)
			.join("")}
	</div>
	${
		bookingConfig.included?.length || bookingConfig.notes?.length
			? `<section class="package-included" aria-labelledby="package-included-heading">
				<h2 id="package-included-heading" class="section-eyebrow">What’s included</h2>
				${bookingConfig.included?.length ? `<ul class="package-included-list">${bookingConfig.included.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : ""}
				${bookingConfig.notes?.length ? `<div class="package-notes">${bookingConfig.notes.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>` : ""}
			</section>`
			: ""
	}
`;

const testimonialPhoto = (photo) => {
	if (!photo) return null;
	const album = galleryPages.find((page) => page.key === photo.album);
	return album?.items[photo.index] ?? null;
};

const renderTestimonial = (item) => {
	const photo = testimonialPhoto(item.photo);
	return `
		<figure class="testimonial ${photo ? "has-photo" : ""}">
			${
				photo
					? `<div class="testimonial-photo">
						<img src="${resolveImageUrl(photo, { width: 900 })}" srcset="${imageSrcSet(photo, [400, 800, 1200])}" sizes="(max-width: 820px) 100vw, 40vw" data-local-src="${localImageUrl(photo)}" alt="${escapeHtml(item.context ? `Photograph from ${item.context}` : "Photograph by Claire Thomas")}" width="${photo.width}" height="${photo.height}" loading="lazy" decoding="async" />
					</div>`
					: ""
			}
			<div class="testimonial-body">
				<blockquote>${escapeHtml(item.quote)}</blockquote>
				<figcaption><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.context)}</span></figcaption>
			</div>
		</figure>
	`;
};

const renderTestimonials = () => `
	<section class="testimonials" aria-labelledby="testimonials-heading">
		<h2 id="testimonials-heading" class="section-eyebrow">Kind words</h2>
		<div class="testimonial-list">
			${bookingConfig.testimonials.map(renderTestimonial).join("")}
		</div>
	</section>
`;

const bookingProjectTypes = ["Corporate", "Personal", "Special occasion", "Other"];
const bookingReferralSources = ["Google", "Instagram", "Referral", "Other"];

const renderSelectOptions = (options, placeholder) =>
	`<option value="">${escapeHtml(placeholder)}</option>${options.map((option) => `<option>${escapeHtml(option)}</option>`).join("")}`;

const renderBookingForm = () => `
	<section class="booking-form-section" aria-labelledby="booking-form-heading">
		<div class="booking-form-intro">
			<h2 id="booking-form-heading">I'd love to hear from you!</h2>
			<p>Use the form below or email me at <a href="mailto:${homeConfig.inquiryEmail}">${homeConfig.inquiryEmail}</a></p>
			<p>I usually get back to you within 24 hours.</p>
		</div>
		<form class="booking-form" id="booking-form" novalidate>
			<label class="booking-honeypot" aria-hidden="true">
				Leave this empty
				<input name="website" type="text" tabindex="-1" autocomplete="off" />
			</label>
			<label class="booking-field">
				<span>Name <abbr class="booking-required" title="required" aria-hidden="true">*</abbr></span>
				<input name="name" type="text" autocomplete="name" required />
			</label>
			<label class="booking-field">
				<span>Email or phone number <abbr class="booking-required" title="required" aria-hidden="true">*</abbr></span>
				<input name="contact" type="text" inputmode="email" autocomplete="email" required />
			</label>
			<label class="booking-field">
				<span>Project date</span>
				<input name="date" type="date" />
			</label>
			<label class="booking-field">
				<span>Project location</span>
				<input name="location" type="text" autocomplete="address-level2" />
			</label>
			<label class="booking-field">
				<span>What type of project is this?</span>
				<select name="projectType">${renderSelectOptions(bookingProjectTypes, "Choose one")}</select>
			</label>
			<label class="booking-field">
				<span>How did you find me? <abbr class="booking-required" title="required" aria-hidden="true">*</abbr></span>
				<select name="referral" required>${renderSelectOptions(bookingReferralSources, "Choose one")}</select>
			</label>
			<label class="booking-field booking-field-wide" data-other-project hidden>
				<span>Tell me what kind of project</span>
				<input name="projectTypeOther" type="text" />
			</label>
			<label class="booking-field booking-field-wide">
				<span>Tell me more!</span>
				<textarea name="message" rows="5"></textarea>
			</label>
			<div class="booking-form-actions booking-field-wide">
				<button class="brand-button" type="submit">Send inquiry</button>
				<p class="booking-form-legend"><span aria-hidden="true">*</span> Required</p>
			</div>
			<p class="booking-form-status booking-field-wide" role="status" aria-live="polite" hidden></p>
		</form>
	</section>
`;

const renderBooking = () => {
	const { showPackages, showTestimonials } = bookingConfig;
	return `
		<section class="detail-page booking-page">
			<header class="page-title">
				<h1>Booking</h1>
				<p class="page-intro">My standard event rate is $150 per hour. For special occasions such as proposals or courthouse weddings, please fill out my <a href="#booking-form">contact form</a> to get a quote!</p>
			</header>
			${showPackages ? renderPackages() : ""}
			${showTestimonials ? renderTestimonials() : ""}
			${renderBookingForm()}
		</section>
	`;
};

const renderPrints = () => `
	<section class="detail-page prints-page">
		<div class="prints-copy">
			<p class="prints-eyebrow">Prints</p>
			<h2>Order photography prints.</h2>
			<p>Choose a photograph, use the order link, and complete payment and delivery through the print shop.</p>
			<div class="prints-actions">
				<a class="print-button" href="${printOrderUrl()}">Open print shop</a>
				<a href="mailto:${printShopConfig.email}?subject=Print%20Inquiry">Ask about a print</a>
			</div>
			<ol class="prints-steps">
				<li>Pick a photograph from any portfolio gallery.</li>
				<li>Open it and select <span>Order print</span>.</li>
				<li>Complete size, payment, printing, and delivery in the shop.</li>
			</ol>
		</div>
	</section>
`;

const renderBts = () => {
	const items = createGalleryItems("bts", [
		[1600, 1100, true],
		[1333, 2000, true],
		[2000, 1333, true],
		[1500, 2000, true],
	]);
	return `
		<section class="gallery-page">
			<header class="section-header"><h2>PRODUCTION STILLS + BEHIND-THE-SCENES</h2></header>
			<div class="masonry-grid">
				${items
					.map(
						(item) => `
							<figure class="gallery-card">
								<img src="${placeholderUrl(item)}" alt="${item.title}" width="${item.width}" height="${item.height}" loading="lazy" />
								<figcaption>
									<span>${item.title}</span>
									<small>${item.location} // © Placeholder</small>
								</figcaption>
							</figure>
						`,
					)
					.join("")}
			</div>
		</section>
	`;
};

const renderMain = () => {
	const galleryPage = galleryPages.find((page) => page.key === currentPageKey);
	if (galleryPage) return renderGallery(galleryPage);
	if (currentPageKey === "workshops") return renderWorkshops();
	if (currentPageKey === "prints") return renderPrints();
	if (currentPageKey === "about-contact") return renderAbout();
	if (currentPageKey === "booking") return renderBooking();
	if (currentPageKey === "bts") return renderBts();
	return renderGallery(galleryPages[0]);
};

const albumItems = (key) => galleryPages.find((page) => page.key === key)?.items ?? [];
const homeSlides = () => {
	const slides = albumItems(homeConfig.slideshowAlbumKey);
	return slides.length ? slides : albumItems(homeConfig.slideshowFallbackAlbumKey);
};

const renderHomeSlide = (item, index) => {
	const src = resolveImageUrl(item, { width: 1600 });
	const srcset = imageSrcSet(item);
	// Only the first slide loads up front; the slideshow fills in the rest just before each one shows.
	const sourceAttributes =
		index === 0
			? `src="${src}" srcset="${srcset}" sizes="100vw" fetchpriority="high"`
			: `data-src="${src}" data-srcset="${srcset}" data-sizes="100vw"`;
	return `
		<figure class="home-slide ${index === 0 ? "is-active" : ""}" aria-hidden="${index !== 0}">
			<img class="home-slide-image" ${sourceAttributes} data-local-src="${localImageUrl(item)}" alt="${escapeHtml(item.title || "Photograph by Claire Thomas")}" width="${item.width}" height="${item.height}" decoding="async" />
		</figure>
	`;
};

const footerIcon = (paths) =>
	`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const footerLinks = [
	{
		label: "Email",
		path: "mailto:contact@clairethomas.art?subject=Inquiry",
		icon: footerIcon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>'),
	},
	{
		label: "Writing",
		path: "https://clarityincatastrophe.substack.com/",
		external: true,
		icon: footerIcon('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
	},
	{
		label: "Photos of the Week on Substack",
		path: "https://photosoftheweek.substack.com/",
		external: true,
		// Substack's mark is a filled shape, so it skips the outline icon wrapper.
		icon: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor"><path d="M22.54 8.24H1.46V5.41h21.08v2.83ZM1.46 10.81V24L12 18.11 22.54 24V10.81H1.46ZM22.54 0H1.46v2.84h21.08V0Z"/></svg>',
	},
	{
		label: "Instagram",
		path: "https://www.instagram.com/cet.samoht/",
		external: true,
		icon: footerIcon('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/>'),
	},
];

const currentSectionKey = sectionRootFor(galleryPages.find((page) => page.key === currentPageKey))?.key || currentPageKey;
const isPortfolioPage = homeConfig.portfolioLinks.some((link) => link.key === currentSectionKey);
const currentAttribute = (isCurrent) => (isCurrent ? 'aria-current="page"' : "");

const renderSiteHeader = () => `
	<header class="home-header">
		<nav class="home-nav home-nav-left" aria-label="Primary">
			<a href="./about-contact.html" ${currentAttribute(currentPageKey === "about-contact")}>About</a>
			<div class="home-dropdown ${isPortfolioPage ? "is-current" : ""}">
				<button class="home-dropdown-toggle" type="button" aria-expanded="false" aria-controls="home-portfolio-menu">
					Portfolio <span class="home-dropdown-caret" aria-hidden="true"></span>
				</button>
				<ul class="home-dropdown-menu" id="home-portfolio-menu">
					${homeConfig.portfolioLinks
						.map((link) => `<li><a href="${link.path}" ${currentAttribute(link.key === currentSectionKey)}>${escapeHtml(link.label)}</a></li>`)
						.join("")}
				</ul>
			</div>
		</nav>
		<a class="home-logo" href="./index.html"><img src="${siteLogoPath}" alt="${siteTitle}" /></a>
		<nav class="home-nav home-nav-right" aria-label="Secondary">
			<a href="${homeConfig.bookingUrl}" ${currentAttribute(currentPageKey === "booking")}>Booking</a>
			<a href="${printShopConfig.shopUrl}" target="_blank" rel="noreferrer">Shop</a>
		</nav>
	</header>
`;

const renderSiteFooter = () => `
	<footer class="site-footer">
		<nav class="site-footer-links" aria-label="Elsewhere">
			${footerLinks
				.map(
					(link) =>
						`<a href="${link.path}" aria-label="${link.label}" title="${link.label}" ${link.external ? 'target="_blank" rel="noreferrer"' : ""}>${link.icon}</a>`,
				)
				.join("")}
		</nav>
		<p>© ${new Date().getFullYear()} Claire Thomas</p>
	</footer>
`;

const renderHome = () => {
	const slides = homeSlides();
	return `
		<div class="home-shell">
			${renderSiteHeader()}
			<main class="home-slideshow" aria-roledescription="carousel" aria-label="Featured photographs">
				${slides.map(renderHomeSlide).join("")}
				${
					slides.length > 1
						? `<button class="home-slide-nav home-slide-prev" type="button" aria-label="Previous photograph">‹</button>
							<button class="home-slide-nav home-slide-next" type="button" aria-label="Next photograph">›</button>`
						: ""
				}
			</main>
			${renderSiteFooter()}
		</div>
	`;
};

const renderPage = () => `
	<div class="page-shell">
		${renderSiteHeader()}
		<main class="page-main">${renderMain()}</main>
		${renderSiteFooter()}
	</div>
`;

const app = document.getElementById("app");
const isHomePage = currentPageKey === "home";

app.innerHTML = `
	${isHomePage ? renderHome() : renderPage()}
	<div class="lightbox" hidden aria-hidden="true">
		<button class="lightbox-dismiss" type="button" aria-label="Close expanded image">Close</button>
		<button class="lightbox-nav lightbox-prev" type="button" aria-label="Previous image">‹</button>
		<div class="lightbox-stage">
			<div class="lightbox-image-frame">
				<img class="lightbox-image" alt="" />
				<div class="lightbox-loading" hidden aria-live="polite">Loading image…</div>
			</div>
			<div class="lightbox-meta-row">
				<div class="lightbox-meta-copy">
					<div class="lightbox-meta"></div>
					<div class="lightbox-caption" hidden></div>
				</div>
				<a class="lightbox-print-link" href="${printOrderUrl()}" target="_blank" rel="noreferrer" hidden>Order print</a>
			</div>
		</div>
		<button class="lightbox-nav lightbox-next" type="button" aria-label="Next image">›</button>
	</div>
`;

document.addEventListener("submit", (event) => {
	if (!(event.target instanceof HTMLFormElement)) return;
	event.preventDefault();
});

const lightbox = document.querySelector(".lightbox");
const lightboxImage = document.querySelector(".lightbox-image");
if (lightboxImage instanceof HTMLImageElement) {
	lightboxImage.addEventListener("error", () => {
		const items = getCurrentLightboxItems();
		const item = items[lightboxState.index];
		if (!item) return;
		const fallbackSrc = localImageUrl(item);
		if (lightboxImage.src !== fallbackSrc) lightboxImage.src = fallbackSrc;
	});
}
const lightboxMeta = document.querySelector(".lightbox-meta");
const lightboxCaption = document.querySelector(".lightbox-caption");
const lightboxPrintLink = document.querySelector(".lightbox-print-link");
const lightboxDismiss = document.querySelector(".lightbox-dismiss");
const lightboxPrev = document.querySelector(".lightbox-prev");
const lightboxNext = document.querySelector(".lightbox-next");
const lightboxLoading = document.querySelector(".lightbox-loading");

const lightboxState = {
	page: null,
	index: 0,
	requestId: 0,
	isLoading: false,
};

const lightboxImageCache = new Map();

const getCurrentLightboxItems = () => lightboxState.page?.items ?? [];
const getLightboxItemSources = (item) => ({
	src: item.publicId || item.image ? lightboxImageUrl(item) : placeholderUrl(item),
	srcset: item.publicId ? imageSrcSet(item) : "",
	sizes: item.publicId ? lightboxImageSizes : "",
	fallbackSrc: localImageUrl(item),
});
const getLightboxCacheKey = ({ src, srcset, sizes }) => [src, srcset, sizes].join("|");

const setLightboxLoading = (isLoading, message = "Loading image…") => {
	lightboxState.isLoading = isLoading;
	lightbox?.classList.toggle("lightbox-is-loading", isLoading);
	if (lightboxLoading) {
		lightboxLoading.hidden = !isLoading;
		lightboxLoading.textContent = message;
	}
	lightboxPrev?.toggleAttribute("aria-busy", isLoading);
	lightboxNext?.toggleAttribute("aria-busy", isLoading);
};

const preloadLightboxSource = ({ src, srcset, sizes, fallbackSrc }) => {
	const cacheKey = getLightboxCacheKey({ src, srcset, sizes });
	if (lightboxImageCache.has(cacheKey)) return lightboxImageCache.get(cacheKey);

	const promise = new Promise((resolve) => {
		const loader = new Image();
		if (srcset) loader.srcset = srcset;
		if (sizes) loader.sizes = sizes;
		loader.decoding = "async";
		loader.onload = () => resolve({ src, srcset, sizes });
		loader.onerror = () => {
			if (!fallbackSrc) {
				resolve({ src, srcset, sizes });
				return;
			}
			const fallbackLoader = new Image();
			fallbackLoader.decoding = "async";
			fallbackLoader.onload = () => resolve({ src: fallbackSrc, srcset: "", sizes: "" });
			fallbackLoader.onerror = () => resolve({ src: fallbackSrc, srcset: "", sizes: "" });
			fallbackLoader.src = fallbackSrc;
		};
		loader.src = src;
	});

	lightboxImageCache.set(cacheKey, promise);
	return promise;
};

const preloadAdjacentLightboxImages = () => {
	const items = getCurrentLightboxItems();
	if (items.length < 2) return;
	[-1, 1, 2].forEach((offset) => {
		const item = items[(lightboxState.index + offset + items.length) % items.length];
		if (!item) return;
		preloadLightboxSource(getLightboxItemSources(item));
	});
};

const updateLightboxMeta = (state = "") => {
	if (!lightboxMeta) return;
	const items = getCurrentLightboxItems();
	if (!items.length) {
		lightboxMeta.textContent = "";
		if (lightboxCaption instanceof HTMLElement) {
			lightboxCaption.textContent = "";
			lightboxCaption.hidden = true;
		}
		if (lightboxPrintLink instanceof HTMLAnchorElement) lightboxPrintLink.href = printOrderUrl();
		return;
	}
	const item = items[lightboxState.index];
	lightboxMeta.textContent = `${lightboxState.index + 1} / ${items.length}${state ? ` — ${state}` : ""}`;
	if (lightboxCaption instanceof HTMLElement) {
		lightboxCaption.textContent = item.title || "";
		lightboxCaption.hidden = !item.title;
	}
	if (lightboxPrintLink instanceof HTMLAnchorElement) {
		const printEnabled = item.printEnabled === true;
		lightboxPrintLink.hidden = !printEnabled;
		lightboxPrintLink.href = printEnabled ? printOrderUrl(item, lightboxState.page) : printOrderUrl();
	}
};

const renderLightboxImage = async () => {
	if (!lightbox || !lightboxImage || !lightboxMeta) return;
	const items = getCurrentLightboxItems();
	const item = items[lightboxState.index];
	if (!item) return;

	const requestId = ++lightboxState.requestId;
	lightboxImage.alt = item.title || lightboxState.page.label;
	updateLightboxMeta("loading");
	setLightboxLoading(true);

	const resolvedSource = await preloadLightboxSource(getLightboxItemSources(item));
	if (requestId !== lightboxState.requestId) return;

	lightboxImage.srcset = resolvedSource.srcset;
	lightboxImage.sizes = resolvedSource.sizes;
	lightboxImage.src = resolvedSource.src;
	updateLightboxMeta();
	setLightboxLoading(false);
	preloadAdjacentLightboxImages();
};

const setLightboxOpen = (isOpen) => {
	if (!lightbox) return;
	lightbox.hidden = !isOpen;
	lightbox.setAttribute("aria-hidden", String(!isOpen));
	document.body.classList.toggle("lightbox-open", isOpen);
};

const openLightbox = (pageKey, index) => {
	const page = galleryPages.find((entry) => entry.key === pageKey);
	if (!page) return;
	lightboxState.page = page;
	lightboxState.index = index;
	renderLightboxImage();
	setLightboxOpen(true);
};

const stepLightbox = (direction) => {
	const items = getCurrentLightboxItems();
	if (!items.length) return;
	lightboxState.index = (lightboxState.index + direction + items.length) % items.length;
	renderLightboxImage();
};

document.addEventListener("click", (event) => {
	const trigger = event.target instanceof Element ? event.target.closest(".gallery-trigger") : null;
	if (trigger instanceof HTMLButtonElement) {
		openLightbox(trigger.dataset.galleryKey, Number(trigger.dataset.galleryIndex));
		return;
	}

	if (event.target === lightbox || event.target === lightboxDismiss) {
		setLightboxOpen(false);
	}
});

lightboxPrev?.addEventListener("click", () => stepLightbox(-1));
lightboxNext?.addEventListener("click", () => stepLightbox(1));

document.addEventListener("keydown", (event) => {
	if (!lightbox || lightbox.hidden) return;
	if (event.key === "Escape") setLightboxOpen(false);
	if (event.key === "ArrowLeft") stepLightbox(-1);
	if (event.key === "ArrowRight") stepLightbox(1);
});

const progressiveImages = Array.from(document.querySelectorAll(".progressive-image"));

const upgradeImage = (image) => {
	if (!(image instanceof HTMLImageElement)) return;
	const nextSrc = image.dataset.highSrc;
	if (!nextSrc || image.dataset.upgraded === "true") return;
	const loader = new Image();
	loader.onload = () => {
		if (image.dataset.highSrcset) image.srcset = image.dataset.highSrcset;
		if (image.dataset.sizes) image.sizes = image.dataset.sizes;
		image.src = nextSrc;
		image.dataset.upgraded = "true";
		image.classList.add("is-loaded");
	};
	loader.onerror = () => {
		const fallbackSrc = image.dataset.localSrc;
		if (fallbackSrc) {
			image.srcset = "";
			image.sizes = "";
			image.src = fallbackSrc;
			image.dataset.upgraded = "true";
			image.classList.add("is-loaded");
		}
	};
	loader.src = nextSrc;
};

progressiveImages.slice(0, 4).forEach(upgradeImage);

if ("IntersectionObserver" in window) {
	const progressiveObserver = new IntersectionObserver(
		(entries, observer) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				upgradeImage(entry.target);
				observer.unobserve(entry.target);
			});
		},
		{ rootMargin: "400px 0px" },
	);

	progressiveImages.slice(4).forEach((image) => progressiveObserver.observe(image));
} else {
	progressiveImages.forEach(upgradeImage);
}

document.addEventListener(
	"error",
	(event) => {
		const image = event.target;
		if (!(image instanceof HTMLImageElement)) return;
		const fallbackSrc = image.dataset.localSrc;
		if (!fallbackSrc || image.src === fallbackSrc) return;
		image.srcset = "";
		image.sizes = "";
		image.src = fallbackSrc;
		image.classList.add("is-loaded");
	},
	true,
);

const startHomeSlideshow = () => {
	const slideshow = document.querySelector(".home-slideshow");
	const slides = Array.from(document.querySelectorAll(".home-slide"));
	if (!slideshow || slides.length < 2) return;

	const loadSlide = (slide) => {
		slide?.querySelectorAll("img[data-src]").forEach((image) => {
			if (image.dataset.srcset) image.srcset = image.dataset.srcset;
			if (image.dataset.sizes) image.sizes = image.dataset.sizes;
			image.src = image.dataset.src;
			image.removeAttribute("data-src");
		});
	};

	let activeIndex = 0;
	let timer = 0;
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const showSlide = (index) => {
		const nextIndex = (index + slides.length) % slides.length;
		loadSlide(slides[nextIndex]);
		slides[activeIndex].classList.remove("is-active");
		slides[activeIndex].setAttribute("aria-hidden", "true");
		slides[nextIndex].classList.add("is-active");
		slides[nextIndex].setAttribute("aria-hidden", "false");
		activeIndex = nextIndex;
		// Warm the following slide so the crossfade never reveals a blank frame.
		loadSlide(slides[(activeIndex + 1) % slides.length]);
	};

	const restartTimer = () => {
		window.clearInterval(timer);
		if (reduceMotion) return;
		timer = window.setInterval(() => {
			// Hold the current photo while someone has scrolled down to look at it.
			if (window.scrollY < 40) showSlide(activeIndex + 1);
		}, homeConfig.slideIntervalMs);
	};

	loadSlide(slides[1]);
	restartTimer();

	slideshow.querySelector(".home-slide-prev")?.addEventListener("click", () => {
		showSlide(activeIndex - 1);
		restartTimer();
	});
	slideshow.querySelector(".home-slide-next")?.addEventListener("click", () => {
		showSlide(activeIndex + 1);
		restartTimer();
	});
	document.addEventListener("keydown", (event) => {
		if (event.key === "ArrowLeft") showSlide(activeIndex - 1);
		else if (event.key === "ArrowRight") showSlide(activeIndex + 1);
		else return;
		restartTimer();
	});
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) window.clearInterval(timer);
		else restartTimer();
	});
};

const setupHomeDropdown = () => {
	const dropdown = document.querySelector(".home-dropdown");
	const toggle = dropdown?.querySelector(".home-dropdown-toggle");
	if (!dropdown || !toggle) return;
	const setOpen = (isOpen) => {
		dropdown.classList.toggle("is-open", isOpen);
		toggle.setAttribute("aria-expanded", String(isOpen));
	};
	toggle.addEventListener("click", () => setOpen(!dropdown.classList.contains("is-open")));
	document.addEventListener("click", (event) => {
		if (event.target instanceof Node && !dropdown.contains(event.target)) setOpen(false);
	});
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") setOpen(false);
	});
};

const setupAutoHideHeader = () => {
	const header = document.querySelector(".home-header");
	const dropdown = header?.querySelector(".home-dropdown");
	if (!header) return;
	let lastY = window.scrollY;
	let ticking = false;
	const update = () => {
		ticking = false;
		const y = window.scrollY;
		const delta = y - lastY;
		// Hide as soon as scrolling down starts; ignore sub-pixel jitter and keep it while the menu is open.
		if (Math.abs(delta) < 2) return;
		const hide = delta > 0 && y > 0 && !dropdown?.classList.contains("is-open");
		header.classList.toggle("is-hidden", hide);
		lastY = y;
	};
	window.addEventListener(
		"scroll",
		() => {
			if (ticking) return;
			ticking = true;
			window.requestAnimationFrame(update);
		},
		{ passive: true },
	);
	// Keyboard users tabbing into the header should always see it.
	header.addEventListener("focusin", () => header.classList.remove("is-hidden"));
};

// The booking form posts to /api/inquiry, which emails Claire through Resend.
// If that can't send, the visitor's email app opens with the inquiry instead.
// An email address or a phone number with at least seven digits.
const looksLikeContact = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.replace(/\D/g, "").length >= 7;

const setupBookingForm = () => {
	const form = document.getElementById("booking-form");
	if (!(form instanceof HTMLFormElement)) return;
	const field = (name) => form.elements.namedItem(name);
	const value = (name) => String(field(name)?.value ?? "").trim();
	const status = form.querySelector(".booking-form-status");
	const otherProject = form.querySelector("[data-other-project]");
	const contact = field("contact");
	const message = field("message");

	// "Other" project type reveals a box to describe it.
	field("projectType")?.addEventListener("change", () => {
		const isOther = value("projectType") === "Other";
		if (otherProject) otherProject.hidden = !isOther;
		if (isOther) field("projectTypeOther")?.focus();
	});

	contact?.addEventListener("input", () => contact.setCustomValidity(""));

	// Package "Inquire" buttons jump here and start the message with that package.
	document.querySelectorAll("[data-package]").forEach((link) => {
		link.addEventListener("click", (event) => {
			event.preventDefault();
			if (message instanceof HTMLTextAreaElement && !message.value.trim()) {
				message.value = `I'm interested in the ${link.dataset.package} package.`;
			}
			form.scrollIntoView({ behavior: "smooth", block: "start" });
			field("name")?.focus({ preventScroll: true });
		});
	});

	const showStatus = (text, tone = "info") => {
		if (!status) return;
		status.hidden = false;
		status.dataset.tone = tone;
		status.textContent = text;
	};

	const readForm = () => ({
		name: value("name"),
		contact: value("contact"),
		date: value("date"),
		location: value("location"),
		projectType: value("projectType"),
		projectTypeOther: value("projectTypeOther"),
		referral: value("referral"),
		message: value("message"),
		website: value("website"),
	});

	// Used only if the server can't send: opens the visitor's email app instead.
	const openEmailFallback = (inquiry) => {
		const projectType = inquiry.projectType === "Other" && inquiry.projectTypeOther ? `Other: ${inquiry.projectTypeOther}` : inquiry.projectType;
		const details = [
			["Name", inquiry.name],
			["Email or phone", inquiry.contact],
			["Project date", inquiry.date],
			["Project location", inquiry.location],
			["Project type", projectType],
			["Found me through", inquiry.referral],
		]
			.filter(([, answer]) => answer)
			.map(([label, answer]) => `${label}: ${answer}`);
		const lines = inquiry.message ? [inquiry.message, "", ...details] : details;
		const subject = `Inquiry from ${inquiry.name}${projectType ? ` (${projectType})` : ""}`;
		window.location.href = `mailto:${homeConfig.inquiryEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
	};

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (contact instanceof HTMLInputElement) {
			contact.setCustomValidity(
				value("contact") && !looksLikeContact(value("contact")) ? "Please enter an email address or a phone number." : "",
			);
		}
		if (!form.checkValidity()) {
			form.reportValidity();
			return;
		}

		const submitButton = form.querySelector('button[type="submit"]');
		const inquiry = readForm();
		if (submitButton) submitButton.disabled = true;
		showStatus("Sending…");
		try {
			const response = await fetch("/api/inquiry", {
				method: "POST",
				headers: { "Content-Type": "application/json", Accept: "application/json" },
				body: JSON.stringify(inquiry),
			});
			const result = await response.json().catch(() => ({}));
			if (response.ok && result.sent) {
				form.reset();
				if (otherProject) otherProject.hidden = true;
				showStatus("Thank you! Your inquiry is on its way, and I'll get back to you within 24 hours.", "success");
				return;
			}
			// Anything other than a clear validation answer means sending isn't available.
			if (result.fallback || response.status >= 500 || !result.error) throw new Error("send unavailable");
			const fieldName = result.fields ? Object.keys(result.fields)[0] : "";
			const fieldElement = fieldName ? field(fieldName) : null;
			if (fieldElement instanceof HTMLElement) fieldElement.focus();
			showStatus(result.fields?.[fieldName] || result.error || "Something went wrong. Please try again.", "error");
		} catch {
			showStatus(`Sorry, the form couldn't send just now. Your email app should open with your inquiry filled in; if it doesn't, write to ${homeConfig.inquiryEmail}.`, "error");
			openEmailFallback(inquiry);
		} finally {
			if (submitButton) submitButton.disabled = false;
		}
	});
};

// Photos in a portfolio section fade up gently as they scroll into view.
const setupSectionReveal = () => {
	const photos = Array.from(document.querySelectorAll(".section-photo"));
	if (!photos.length || !("IntersectionObserver" in window)) return;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	photos.forEach((photo) => photo.classList.add("is-waiting"));
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				entry.target.classList.remove("is-waiting");
				observer.unobserve(entry.target);
			});
		},
		{ rootMargin: "0px 0px -8% 0px" },
	);
	photos.forEach((photo) => observer.observe(photo));
};

setupHomeDropdown();
setupBookingForm();

const isSectionPage = Boolean(document.querySelector(".section-page"));

// The header's height varies with screen width; full-screen photos size themselves to the space below it.
const syncHeaderOffset = () => {
	const header = document.querySelector(".home-header");
	if (header) document.documentElement.style.setProperty("--header-offset", `${header.offsetHeight}px`);
};
syncHeaderOffset();
window.addEventListener("resize", syncHeaderOffset);

if (isHomePage) {
	startHomeSlideshow();
} else if (isSectionPage) {
	setupSectionReveal();
} else {
	setupAutoHideHeader();
}
