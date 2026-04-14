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

const galleryPages = [
	{
		key: "architectural-details",
		label: "architectural details",
		path: "./index.html",
		items: createGalleryItems("architectural-details", [
			[1666, 2000, true],
			[1000, 1500, true],
			[2000, 1333, true],
			[1333, 2000, true],
			[1333, 2000, true],
			[2000, 1333, true],
			[1600, 2000, true],
			[1500, 1000, true],
			[1333, 2000, true],
			[1200, 1500, true],
			[1600, 1100, true],
			[1400, 1800, true],
		]),
	},
	{
		key: "street-abstractions",
		label: "street abstractions",
		path: "./street-abstractions.html",
		items: createGalleryItems("street-abstractions", [
			[1500, 2000, true],
			[1800, 1200, true],
			[1333, 2000, true],
			[2000, 1333, true],
			[1500, 1000, true],
			[1200, 1600, true],
			[1700, 1100, true],
			[1400, 1900, true],
		]),
	},
	{
		key: "multiple-exposures",
		label: "multiple exposures",
		path: "./multiple-exposures.html",
		items: createGalleryItems("multiple-exposures", [
			[1333, 2000, true],
			[2000, 1333, true],
			[1500, 2000, true],
			[2000, 1333, true],
			[1200, 1600, true],
			[1700, 1100, true],
			[1400, 1900, true],
			[1600, 1100, true],
		]),
	},
	{
		key: "music",
		label: "live music",
		path: "./music.html",
		items: createGalleryItems("music", [
			[1600, 1100, true],
			[1333, 2000, true],
			[2000, 1333, true],
			[1500, 2000, true],
			[1800, 1200, true],
			[1200, 1600, true],
			[1600, 1100, true],
			[1400, 1900, true],
		]),
	},
	{
		key: "nyc",
		label: "placeholder series",
		path: "./nyc.html",
		items: createGalleryItems("nyc", [
			[1333, 2000, true],
			[2000, 1333, true],
			[1500, 2000, true],
			[1800, 1200, true],
			[1200, 1600, true],
			[1600, 1100, true],
			[1400, 1900, true],
			[1600, 1100, true],
		]),
	},
	{
		key: "out-of-town",
		label: "out of town",
		path: "./out-of-town.html",
		items: createGalleryItems("out-of-town", [
			[2000, 1333, true],
			[1333, 2000, true],
			[1500, 2000, true],
			[1800, 1200, true],
			[1600, 1100, true],
			[1200, 1600, true],
			[1400, 1900, true],
			[1600, 1100, true],
		]),
	},
	{
		key: "self-reflections",
		label: "self reflections",
		path: "./self-reflections.html",
		items: createGalleryItems("self-reflections", [
			[1333, 2000, true],
			[2000, 1333, true],
			[1500, 2000, true],
			[1800, 1200, true],
			[1200, 1600, true],
			[1600, 1100, true],
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

const currentPageKey = document.body.dataset.page || "architectural-details";

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
				.map(
					(item) => `
						<figure class="gallery-card">
							<img src="${placeholderUrl(item)}" alt="${item.title}" width="${item.width}" height="${item.height}" loading="lazy" />
							<figcaption>
								<span>${item.title}</span>
								${item.location ? `<small>${item.location} // © Placeholder</small>` : ""}
							</figcaption>
						</figure>
					`,
				)
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
