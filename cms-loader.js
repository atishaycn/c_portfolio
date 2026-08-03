(async () => {
	try {
		const response = await fetch("/api/content", {
			cache: "no-store",
			headers: { Accept: "application/json" },
		});
		if (response.ok) window.__PORTFOLIO_CONTENT__ = await response.json();
	} catch {
		// The bundled gallery data remains a complete offline/static fallback.
	}

	const script = document.createElement("script");
	script.src = "./site.js";
	script.defer = false;
	document.body.append(script);
})();
