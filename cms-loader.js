(async () => {
	const isShopPage = document.body.dataset.page === "prints";
	const contentRequest = fetch("/api/content", {
			cache: "no-store",
			headers: { Accept: "application/json" },
		})
		.then(async (response) => {
			if (response.ok) window.__PORTFOLIO_CONTENT__ = await response.json();
		})
		.catch(() => {
			// The bundled gallery data remains a complete offline/static fallback.
		});
	const loadCatalog = (url) =>
		fetch(url, {
			cache: "no-store",
			headers: { Accept: "application/json" },
		}).then((response) => {
			if (!response.ok) throw new Error("Shop catalog request failed");
			return response.json();
		});
	// The file fallback keeps the store up when the server price endpoint is unreachable.
	const catalogRequest = isShopPage
		? loadCatalog("/api/shop-catalog")
			.catch(() => loadCatalog("./content/shop-catalog.json"))
			.catch(() => null)
		: Promise.resolve(null);
	const [, catalogData] = await Promise.all([contentRequest, catalogRequest]);
	if (isShopPage && window.PortfolioShop && typeof window.PortfolioShop.setCatalog === "function") {
		window.PortfolioShop.setCatalog(catalogData);
	}

	const script = document.createElement("script");
	script.src = "./site.js";
	script.defer = false;
	document.body.append(script);
})();
