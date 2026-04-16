const siteTitle = "CLAIRE THOMAS";

const cloudinaryConfig = {
	enabled: true,
	cloudName: "dpmdkrggj",
	transformation: "f_auto,q_auto",
	galleryWidth: 1200,
	lightboxWidth: 2400,
	placeholderWidth: 80,
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
	return encodeURI(itemOrPath.image);
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
	specs.map(([file, width, height], index) => ({
		id: `${prefix}-${index + 1}`,
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
	["36.jpg", 5184, 3456, "36_kt2kwl"],
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
	["8.JPG", 5036, 3778],
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
	["2.jpg", 5184, 3456],
	["3.jpg", 3888, 5184],
	["4.jpg", 5026, 3888],
	["5.jpg", 5051, 3888],
	["6.jpg", 5184, 3888],
	["7.jpg", 5184, 3888],
	["8.jpg", 3888, 4770],
	["9.jpg", 5184, 3888],
	["10.jpg", 5125, 3844],
	["11.jpg", 5184, 3888],
	["12.jpg", 4618, 3456],
	["13.jpg", 4870, 3581],
	["14.jpg", 5184, 3888],
	["15.jpg", 5184, 3888],
	["16.jpg", 5184, 3888],
	["17.jpg", 3673, 5038],
	["18.jpg", 3844, 5125],
	["19.jpg", 5184, 3888],
	["20.jpg", 5184, 3888],
	["21.jpg", 5184, 3888],
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
	["16.jpg", 4995, 3585],
	["17.jpg", 2297, 2513],
	["18.jpg", 5184, 3888],
	["19.jpg", 3322, 2498],
	["20.jpg", 5107, 3888],
	["21.jpg", 2822, 2058],
	["22.jpg", 3715, 5038],
	["23.jpg", 3758, 5011],
	["24.jpg", 4925, 3304],
	["25.jpg", 5184, 3888],
	["26.jpg", 3604, 5132],
	["27.jpg", 3888, 5184],
	["28.jpg", 3888, 5184],
	["29.jpg", 5184, 3888],
	["30.jpg", 3675, 5011],
	["31.jpg", 3607, 4570],
	["32.jpg", 3888, 5184],
	["33.jpg", 3615, 4699],
	["34.jpg", 3720, 4848],
	["35.jpg", 5184, 3456],
	["36.jpg", 3888, 5184],
	["37.jpg", 5125, 3844],
	["38.jpg", 5184, 3888],
	["39.jpg", 3822, 5184],
	["40.jpg", 5078, 3888],
	["41.jpg", 5184, 3888],
	["42.jpg", 4852, 3639],
	["43.jpg", 5011, 3758],
	["44.jpg", 5184, 3888],
	["45.jpg", 5184, 3888],
	["46.jpg", 5184, 3456],
	["47.jpg", 4482, 3298],
	["48.jpg", 5184, 3456],
	["49.jpg", 5184, 3456],
	["50.jpg", 5184, 3456],
	["51.jpg", 5184, 3456],
	["52.jpg", 3785, 5119],
	["53.jpg", 5184, 3888],
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
	["96.jpg", 3844, 5125],
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
	["116.jpg", 5127, 3821],
	["117.jpg", 5184, 3888],
	["118.jpg", 5184, 3888],
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
	["13.JPG", 3735, 5040],
	["14.JPG", 3853, 5028],
	["15.JPG", 5184, 3888],
	["16.JPG", 5184, 3888],
	["17.JPG", 5125, 3844],
	["18.JPG", 5184, 3888],
	["19.JPG", 5184, 3888],
	["20.JPG", 5151, 3888],
	["21.JPG", 5184, 3888],
	["22.JPG", 5184, 3888],
	["23.JPG", 4956, 3608],
	["24.JPG", 3888, 5184],
	["25.JPG", 3888, 5184],
	["26.JPG", 3888, 5184],
	["27.JPG", 3766, 4765],
	["28.JPG", 3888, 5184],
	["29.JPG", 5184, 3888],
	["30.JPG", 5125, 3844],
	["31.JPG", 3730, 5067],
	["32.JPG", 5011, 3758],
	["33.JPG", 5125, 3844],
	["34.JPG", 3800, 4185],
];

const galleryPages = [
	{
		key: "the-natural-world",
		label: "the natural world",
		path: "./index.html",
		items: naturalWorldSpecs.map(([file, width, height, publicId], index) => ({
			id: `the-natural-world-${index + 1}`,
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
		path: "./shapes-and-shadows.html",
		items: createLocalGalleryItems("shapes-and-shadows", "Shapes & Shadows", shapesAndShadowsSpecs, {
			publicIdBase: "shapes-and-shadows",
		}),
	},
	{
		key: "protests",
		label: "protests",
		path: "./protests.html",
		items: createLocalGalleryItems("protests", "Protests", protestsSpecs, { publicIdBase: "protests" }),
	},
];

const portfolioLinks = [
	{ label: "the natural world", path: "./index.html", key: "the-natural-world" },
	{
		label: "place",
		key: "place",
		children: [
			{
				label: "California",
				path: "./california.html",
				key: "california",
				preserveCase: true,
				children: [{ label: "San Francisco", path: "./san-francisco.html", key: "san-francisco", preserveCase: true }],
			},
			{ label: "India", path: "./india.html", key: "india", preserveCase: true },
		],
	},
	{ label: "shapes & shadows", path: "./shapes-and-shadows.html", key: "shapes-and-shadows" },
	{ label: "protests", path: "./protests.html", key: "protests" },
];

const secondaryLinks = [
	{ label: "newsletter", path: "https://photosoftheweek.substack.com/", external: true },
	{ label: "prints", path: "https://example.com/prints", external: true },
	{ label: "about + contact", path: "./about-contact.html", key: "about-contact" },
];

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
const responsiveWidths = [400, 800, 1200, 1600, 2400];
const imageSrcSet = (item, widths = responsiveWidths) => {
	if (!item?.publicId) return "";
	return widths.map((width) => `${resolveImageUrl(item, { width })} ${width}w`).join(", ");
};
const galleryImageSizes = "(max-width: 820px) 100vw, (max-width: 1400px) 50vw, 33vw";
const lightboxImageSizes = "100vw";

const currentPageKey = document.body.dataset.page || "the-natural-world";

const linkHasActiveChild = (link) => link.children?.some((child) => child.key === currentPageKey || linkHasActiveChild(child));

const renderSidebarNav = (links, nested = false) => `
	<ul class="${nested ? "subnav-list" : "nav-list"}">
		${links
			.map((link) => {
				if (link.children?.length) {
					const isCurrentPage = link.key === currentPageKey;
					const isOpen = isCurrentPage || linkHasActiveChild(link);
					const hasDirectPage = Boolean(link.path);
					return `
						<li class="folder-link ${isOpen ? "active-folder" : ""} ${isCurrentPage ? "active-link" : ""}">
							<details class="sidebar-folder" ${isOpen ? "open" : ""}>
								<summary class="${link.preserveCase ? "preserve-case" : ""}">
									${hasDirectPage ? `<a class="folder-label-link ${link.preserveCase ? "preserve-case" : ""}" href="${link.path}" ${link.external ? 'target="_blank" rel="noreferrer"' : ""}>${link.label}</a>` : link.label}
								</summary>
								<div class="subnav">${renderSidebarNav(link.children, true)}</div>
							</details>
						</li>
					`;
				}

				return `
					<li class="${link.key === currentPageKey ? "active-link" : ""}">
						<a class="${link.preserveCase ? "preserve-case" : ""}" href="${link.path}" ${link.external ? 'target="_blank" rel="noreferrer"' : ""}>${link.label}</a>
					</li>
				`;
			})
			.join("")}
	</ul>
`;

const renderGallery = (page) => `
	<section class="gallery-page">
		${
			page.items.length
				? `<div class="masonry-grid">
					${page.items
						.map((item, index) => {
							const imageSrc = placeholderUrl(item);
							const highResSrc = item.image ? galleryImageUrl(item) : placeholderUrl(item);
							const highResSrcSet = item.publicId ? imageSrcSet(item) : "";
							const hasCaption = item.title || item.location;
							const eager = index < 4;
							return `
								<figure class="gallery-card">
									<button
										class="gallery-trigger"
										type="button"
										data-gallery-key="${page.key}"
										data-gallery-index="${index}"
										aria-label="Open image ${index + 1} from ${page.label}"
									>
										<img class="progressive-image" src="${imageSrc}" data-high-src="${highResSrc}" data-high-srcset="${highResSrcSet}" data-sizes="${galleryImageSizes}" data-local-src="${localImageUrl(item)}" alt="${item.title || page.label}" width="${item.width}" height="${item.height}" loading="${eager ? "eager" : "lazy"}" fetchpriority="${eager ? "high" : "low"}" decoding="async" />
									</button>
									${
										hasCaption
											? `<figcaption>
												${item.title ? `<span>${item.title}</span>` : ""}
												${item.location ? `<small>${item.location}</small>` : ""}
											</figcaption>`
											: ""
									}
								</figure>
							`;
						})
						.join("")}
				</div>`
				: `<div class="empty-gallery"><p>No images added yet.</p></div>`
		}
	</section>
`;

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

const renderAbout = () => `
	<section class="detail-page about-page">
		<div class="about-image-wrap">
			<img src="${resolveImageUrl({ image: "./fqs 2025-12-19 161703.086.jpg", publicId: "about/portrait" }, { width: 1200 })}" srcset="${imageSrcSet({ image: "./fqs 2025-12-19 161703.086.jpg", publicId: "about/portrait" })}" sizes="(max-width: 1100px) 100vw, 520px" data-local-src="${localImageUrl("./fqs 2025-12-19 161703.086.jpg")}" alt="Claire Thomas portrait" width="3024" height="4536" loading="eager" fetchpriority="high" decoding="async" />
		</div>
		<div class="about-copy">
			<p>San Francisco-based street photographer</p>
			<p>I am available for freelance opportunities. Please get in touch at the email below!</p>
			<p>For inquiries:<br /><a href="mailto:cet.samoht@proton.me">cet.samoht@proton.me</a></p>
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
	if (currentPageKey === "about-contact") return renderAbout();
	if (currentPageKey === "bts") return renderBts();
	return renderGallery(galleryPages[0]);
};

const app = document.getElementById("app");

app.innerHTML = `
	<div class="site-shell">
		<aside class="sidebar">
			<div class="sidebar-inner">
				<header class="site-header">
					<h1><a href="./index.html">${siteTitle}</a></h1>
				</header>
				<nav class="sidebar-nav" aria-label="Portfolio navigation">
					<ul class="nav-list folder-list">
						<li class="folder-link active-folder">
							<span>portfolio</span>
							<div class="subnav">${renderSidebarNav(portfolioLinks, true)}</div>
						</li>
					</ul>
					${renderSidebarNav(secondaryLinks)}
				</nav>
				<footer class="sidebar-footer">
					<a href="mailto:cet.samoht@proton.me" aria-label="Email">Email</a>
					<a href="https://clarityincatastrophe.substack.com/" aria-label="Writing" target="_blank" rel="noreferrer">Writing</a>
				</footer>
			</div>
		</aside>
		<main class="content-area">${renderMain()}</main>
	</div>
	<div class="lightbox" hidden aria-hidden="true">
		<button class="lightbox-dismiss" type="button" aria-label="Close expanded image">Close</button>
		<button class="lightbox-nav lightbox-prev" type="button" aria-label="Previous image">‹</button>
		<div class="lightbox-stage">
			<div class="lightbox-image-frame">
				<img class="lightbox-image" alt="" />
				<div class="lightbox-loading" hidden aria-live="polite">Loading image…</div>
			</div>
			<div class="lightbox-meta"></div>
		</div>
		<button class="lightbox-nav lightbox-next" type="button" aria-label="Next image">›</button>
	</div>
`;

document.addEventListener("submit", (event) => {
	if (!(event.target instanceof HTMLFormElement)) return;
	event.preventDefault();
});

document.addEventListener("click", (event) => {
	const folderLink = event.target instanceof Element ? event.target.closest(".folder-label-link") : null;
	if (!(folderLink instanceof HTMLAnchorElement)) return;
	event.stopPropagation();
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
	src: item.image ? lightboxImageUrl(item) : placeholderUrl(item),
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
		return;
	}
	lightboxMeta.textContent = `${lightboxState.index + 1} / ${items.length}${state ? ` — ${state}` : ""}`;
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
