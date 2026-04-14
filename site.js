const siteTitle = "CLAIRE THOMAS";
const tagline = "Placeholder tagline";

const createGalleryItems = (prefix, specs) =>
	specs.map(([width, height, hasLocation], index) => ({
		id: `${prefix}-${index + 1}`,
		title: `Placeholder Image ${index + 1}`,
		width,
		height,
		location: hasLocation ? "Location Placeholder" : "",
	}));

const createLocalGalleryItems = (prefix, folder, specs) =>
	specs.map(([file, width, height], index) => ({
		id: `${prefix}-${index + 1}`,
		title: "",
		width,
		height,
		location: "",
		image: `./${folder}/${file}`,
	}));

const galleryPages = [
	{
		key: "the-natural-world",
		label: "the natural world",
		path: "./index.html",
		items: createLocalGalleryItems("the-natural-world", "The Natural World", [
			["IMG_2404 copy.JPG", 5184, 3456],
			["IMG_2410 copy.JPG", 5184, 3456],
			["IMG_2871 copy.JPG", 4384, 3197],
			["IMG_9417 copy.jpg", 5184, 3456],
			["IMG_9547 copy.jpg", 5184, 3456],
			["IMG_9707 copy.jpg", 5184, 3456],
			["IMG_9944 copy.jpg", 5184, 3456],
			["P1036451.JPG", 3888, 5184],
			["P1038431 copy.JPG", 5184, 3888],
			["P1043267 copy.JPG", 5184, 3888],
			["P1043477 copy.JPG", 5184, 3888],
			["P1053803 copy.JPG", 5184, 3888],
			["P1054309_1 copy.JPG", 5184, 3888],
			["P1054405 copy.JPG", 3888, 5184],
			["P1054959.JPG", 5184, 3888],
			["P1055059.JPG", 5011, 3758],
			["P1055075.JPG", 5125, 3844],
			["P1055152.JPG", 5184, 3888],
			["P1055381.JPG", 5184, 3710],
			["P1056673 copy.JPG", 3888, 5184],
			["P1057399 copy.JPG", 5184, 3888],
			["P1070555_1.JPG", 3888, 3974],
			["P1071486.JPG", 3888, 3843],
			["P1071764.JPG", 3888, 5184],
			["P1071960.JPG", 5184, 3888],
			["P1072814.JPG", 3888, 5184],
			["P1073298.JPG", 4903, 3677],
			["P1073702.JPG", 5184, 3888],
			["P1083750.JPG", 5184, 3888],
			["P1086210_2.JPG", 3429, 2546],
			["P1086246.JPG", 4961, 3800],
			["P1086442.JPG", 3888, 5184],
			["P1086530_3.JPG", 2772, 3698],
			["P1086547.JPG", 3520, 4278],
			["jpgIMG_7933.jpg", 5184, 3456],
			["jpgIMG_7959.jpg", 5184, 3456],
			["jpgIMG_8054.jpg", 5184, 3456],
		]),
	},
];

const portfolioLinks = [
	...galleryPages.map((page) => ({ label: page.label, path: page.path, key: page.key })),
	{ label: "behind-the-scenes", path: "./bts.html", key: "bts" },
];

const secondaryLinks = [
	{ label: "workshops", path: "./workshops.html", key: "workshops" },
	{ label: "newsletter", path: "https://example.com/newsletter", external: true },
	{ label: "prints", path: "https://example.com/prints", external: true },
	{ label: "zines", path: "https://example.com/zines", external: true },
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
					const imageSrc = item.image ? encodeURI(item.image) : placeholderUrl(item);
					const hasCaption = item.title || item.location;
					return `
						<figure class="gallery-card">
							<img src="${imageSrc}" alt="${item.title || page.label}" width="${item.width}" height="${item.height}" loading="lazy" />
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
			<img src="https://picsum.photos/seed/about-contact/1000/1250" alt="Portrait placeholder" width="1000" height="1250" />
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
`;

document.addEventListener("submit", (event) => {
	if (!(event.target instanceof HTMLFormElement)) return;
	event.preventDefault();
});
