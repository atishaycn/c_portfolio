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
	const catalogRequest = isShopPage
		? fetch("./content/shop-catalog.json", {
			cache: "no-store",
			headers: { Accept: "application/json" },
		})
			.then((response) => {
				if (!response.ok) throw new Error("Shop catalog request failed");
				return response.json();
			})
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
