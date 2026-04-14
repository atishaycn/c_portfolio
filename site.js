const siteTitle = "CLAIRE THOMAS";
const tagline = "Placeholder tagline";

const cloudinaryConfig = {
	enabled: true,
	cloudName: "dpmdkrggj",
	transformation: "f_auto,q_auto",
};

const buildCloudinaryUrl = (publicId) => {
	if (!cloudinaryConfig.enabled || !cloudinaryConfig.cloudName || !publicId) return "";
	const encodedSegments = publicId.split("/").map(encodeURIComponent).join("/");
	return `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload/${cloudinaryConfig.transformation}/${encodedSegments}`;
};

const resolveImageUrl = (itemOrPath) => {
	if (!itemOrPath) return itemOrPath;
	if (typeof itemOrPath === "string") return encodeURI(itemOrPath);
	if (itemOrPath.publicId) return buildCloudinaryUrl(itemOrPath.publicId);
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
		key: "protests",
		label: "protests",
		path: "./protests.html",
		items: createLocalGalleryItems("protests", "Protests", protestsSpecs, { publicIdBase: "protests" }),
	},
	{
		key: "shapes-and-shadows",
		label: "shapes & shadows",
		path: "./shapes-and-shadows.html",
		items: createLocalGalleryItems("shapes-and-shadows", "Shapes & Shadows", shapesAndShadowsSpecs, {
			publicIdBase: "shapes-and-shadows",
		}),
	},
];

const portfolioLinks = [...galleryPages.map((page) => ({ label: page.label, path: page.path, key: page.key }))];

const secondaryLinks = [
	{ label: "newsletter", path: "https://example.com/newsletter", external: true },
	{ label: "prints", path: "https://example.com/prints", external: true },
	{ label: "about + contact", path: "./about-contact.html", key: "about-contact" },
];

const placeholderUrl = (item) => {
	const width = Math.round(item.width / 2);
	const height = Math.round(item.height / 2);
	return `https://picsum.photos/seed/${item.id}/${width}/${height}`;
};

const currentPageKey = document.body.dataset.page || "the-natural-world";

const renderSidebarNav = (links, nested = false) => `
	<ul class="${nested ? "subnav-list" : "nav-list"}">
		${links
			.map(
				(link) => `
					<li class="${link.key === currentPageKey ? "active-link" : ""}">
						<a href="${link.path}" ${link.external ? 'target="_blank" rel="noreferrer"' : ""}>${link.label}</a>
					</li>
				`,
			)
			.join("")}
	</ul>
`;

const renderGallery = (page) => `
	<section class="gallery-page">
		<div class="masonry-grid">
			${page.items
				.map((item) => {
					const imageSrc = item.image ? resolveImageUrl(item) : placeholderUrl(item);
					const hasCaption = item.title || item.location;
					return `
						<figure class="gallery-card">
							<button
								class="gallery-trigger"
								type="button"
								data-gallery-key="${page.key}"
								data-gallery-index="${page.items.indexOf(item)}"
								aria-label="Open image ${page.items.indexOf(item) + 1} from ${page.label}"
							>
								<img src="${imageSrc}" data-local-src="${localImageUrl(item)}" alt="${item.title || page.label}" width="${item.width}" height="${item.height}" loading="lazy" />
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
		</div>
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
			<img src="${resolveImageUrl({ image: "./fqs 2025-12-19 161703.086.jpg", publicId: "about/portrait" })}" data-local-src="${localImageUrl("./fqs 2025-12-19 161703.086.jpg")}" alt="Claire Thomas portrait" width="3024" height="4536" />
		</div>
		<div class="about-copy">
			<p>Photo credit placeholder.</p>
			<p>Placeholder biography text.</p>
			<p>Placeholder services and availability text.</p>
			<p>For inquiries:<br /><a href="mailto:hello@example.com">hello@example.com</a></p>
			<p>LinkedIn:<br /><a href="https://www.linkedin.com/in/placeholder/" target="_blank" rel="noreferrer">placeholder</a></p>
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
					<p>${tagline}</p>
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
					<a href="mailto:hello@example.com" aria-label="Email">Email</a>
					<a href="https://www.linkedin.com/in/placeholder/" target="_blank" rel="noreferrer" aria-label="LinkedIn">LinkedIn</a>
				</footer>
			</div>
		</aside>
		<main class="content-area">${renderMain()}</main>
	</div>
	<div class="lightbox" hidden aria-hidden="true">
		<button class="lightbox-dismiss" type="button" aria-label="Close expanded image">Close</button>
		<button class="lightbox-nav lightbox-prev" type="button" aria-label="Previous image">‹</button>
		<div class="lightbox-stage">
			<img class="lightbox-image" alt="" />
			<div class="lightbox-meta"></div>
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
const lightboxDismiss = document.querySelector(".lightbox-dismiss");
const lightboxPrev = document.querySelector(".lightbox-prev");
const lightboxNext = document.querySelector(".lightbox-next");

const lightboxState = {
	page: null,
	index: 0,
};

const getCurrentLightboxItems = () => lightboxState.page?.items ?? [];

const renderLightboxImage = () => {
	if (!lightbox || !lightboxImage || !lightboxMeta) return;
	const items = getCurrentLightboxItems();
	const item = items[lightboxState.index];
	if (!item) return;

	lightboxImage.src = item.image ? resolveImageUrl(item) : placeholderUrl(item);
	lightboxImage.alt = item.title || lightboxState.page.label;
	lightboxMeta.textContent = `${lightboxState.index + 1} / ${items.length}`;
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

document.addEventListener(
	"error",
	(event) => {
		const image = event.target;
		if (!(image instanceof HTMLImageElement)) return;
		const fallbackSrc = image.dataset.localSrc;
		if (!fallbackSrc || image.src === fallbackSrc) return;
		image.src = fallbackSrc;
	},
	true,
);
