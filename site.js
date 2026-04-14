const siteTitle = "CLAIRE THOMAS";
const tagline = "Photographer based in San Francisco";

const createGalleryItems = (prefix, specs) =>
	specs.map(([title, width, height, location], index) => ({
		id: `${prefix}-${index + 1}`,
		title,
		width,
		height,
		location,
	}));

const galleryPages = [
	{
		key: "architectural-details",
		label: "architectural details",
		path: "./index.html",
		items: createGalleryItems("architectural-details", [
			["2 x 2", 1666, 2000, "Paris"],
			["Abstract Details", 1000, 1500, "New York City"],
			["Altered Perspectives", 2000, 1333, "New York City"],
			["Untitled", 1333, 2000, "New York City"],
			["Untitled", 1333, 2000, "New York City"],
			["Untitled", 2000, 1333, "New York City"],
			["Corners of New York", 1600, 2000, "New York City"],
			["Lines and Light", 1500, 1000, "New York City"],
			["Concrete Rhythm", 1333, 2000, "New York City"],
			["Grid Study", 1200, 1500, "New York City"],
			["Glass Echo", 1600, 1100, "New York City"],
			["Sky Fragments", 1400, 1800, "New York City"],
		]),
	},
	{
		key: "street-abstractions",
		label: "street abstractions",
		path: "./street-abstractions.html",
		items: createGalleryItems("street-abstractions", [
			["Crosswalk Geometry", 1500, 2000, "New York City"],
			["Window Reflection", 1800, 1200, "New York City"],
			["Midtown Layers", 1333, 2000, "New York City"],
			["Signal Blur", 2000, 1333, "New York City"],
			["Shadow Merge", 1500, 1000, "New York City"],
			["Street Grid", 1200, 1600, "New York City"],
			["Passing Light", 1700, 1100, "New York City"],
			["Color Split", 1400, 1900, "New York City"],
		]),
	},
	{
		key: "multiple-exposures",
		label: "multiple exposures",
		path: "./multiple-exposures.html",
		items: createGalleryItems("multiple-exposures", [
			["Layered City", 1333, 2000, "New York City"],
			["California Dream", 2000, 1333, "California"],
			["Double Motion", 1500, 2000, "New York City"],
			["Night Merge", 2000, 1333, "California"],
			["Paris Echo", 1200, 1600, "Paris"],
			["Transit Blend", 1700, 1100, "New York City"],
			["Palm Overlay", 1400, 1900, "California"],
			["Ghost Walk", 1600, 1100, "New York City"],
		]),
	},
	{
		key: "music",
		label: "live music",
		path: "./music.html",
		items: createGalleryItems("music", [
			["Stage Smoke", 1600, 1100, "Brooklyn"],
			["Backlight", 1333, 2000, "New York City"],
			["Crowd Energy", 2000, 1333, "Queens"],
			["Blue Notes", 1500, 2000, "New York City"],
			["Encore", 1800, 1200, "Brooklyn"],
			["Drum Burst", 1200, 1600, "New York City"],
			["Live Set", 1600, 1100, "Brooklyn"],
			["Soundcheck", 1400, 1900, "New York City"],
		]),
	},
	{
		key: "nyc",
		label: "new york city",
		path: "./nyc.html",
		items: createGalleryItems("nyc", [
			["Morning Haze", 1333, 2000, "New York City"],
			["Downtown Lines", 2000, 1333, "New York City"],
			["Rooftop Quiet", 1500, 2000, "New York City"],
			["Subway Platform", 1800, 1200, "New York City"],
			["Corner Light", 1200, 1600, "New York City"],
			["Bridge Frame", 1600, 1100, "New York City"],
			["After Rain", 1400, 1900, "New York City"],
			["Night Block", 1600, 1100, "New York City"],
		]),
	},
	{
		key: "out-of-town",
		label: "out of town",
		path: "./out-of-town.html",
		items: createGalleryItems("out-of-town", [
			["Pacific Air", 2000, 1333, "California"],
			["Lisbon Windows", 1333, 2000, "Lisbon, Portugal"],
			["Porto Alley", 1500, 2000, "Porto, Portugal"],
			["White Steps", 1800, 1200, "Greece"],
			["Coastline", 1600, 1100, "California"],
			["Old Town", 1200, 1600, "Portugal"],
			["Hilltop", 1400, 1900, "Lisbon, Portugal"],
			["Blue Hour", 1600, 1100, "California"],
		]),
	},
	{
		key: "self-reflections",
		label: "self reflections",
		path: "./self-reflections.html",
		items: createGalleryItems("self-reflections", [
			["Mirror Study", 1333, 2000, "New York City"],
			["Ghost Profile", 2000, 1333, "New York City"],
			["Window Self", 1500, 2000, "New York City"],
			["Shadow Portrait", 1800, 1200, "New York City"],
			["Fragment", 1200, 1600, "New York City"],
			["Stillness", 1600, 1100, "New York City"],
		]),
	},
];

const portfolioLinks = [
	...galleryPages.map((page) => ({ label: page.label, path: page.path, key: page.key })),
	{ label: "behind-the-scenes", path: "./bts.html", key: "bts" },
];

const secondaryLinks = [
	{ label: "workshops", path: "./workshops.html", key: "workshops" },
	{ label: "newsletter", path: "https://multipleexposures.substack.com", external: true },
	{ label: "prints", path: "https://leomascaro.darkroom.com", external: true },
	{ label: "zines", path: "https://www.blurb.com/user/leomascaro", external: true },
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
			<p>{photo courtesy of Marcelo Nava }</p>
			<p>Placeholder biography text.</p>
			<p>Placeholder services and availability text.</p>
			<p>For inquiries:<br /><a href="mailto:hello@leomascaro.com">hello@leomascaro.com</a></p>
			<p>LinkedIn:<br /><a href="https://www.linkedin.com/in/leonardo-mascaro-56024994/" target="_blank" rel="noreferrer">leonardo-mascaro-56024994</a></p>
		</div>
	</section>
`;

const renderBts = () => {
	const items = createGalleryItems("bts", [
		["Set Lighting", 1600, 1100, "New York City"],
		["Crew Moment", 1333, 2000, "Brooklyn"],
		["Monitor Glow", 2000, 1333, "Queens"],
		["Studio Pause", 1500, 2000, "New York City"],
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
					<a href="mailto:hello@leomascaro.com" aria-label="Email">Email</a>
					<a href="https://www.linkedin.com/in/leonardo-mascaro-56024994/" target="_blank" rel="noreferrer" aria-label="LinkedIn">LinkedIn</a>
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
