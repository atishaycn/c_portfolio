(async () => {
	let content = null;
	try {
		const response = await fetch("/api/content", {
			cache: "no-store",
			headers: { Accept: "application/json" },
		});
		if (response.ok) content = await response.json();
	} catch {
		// Fall through to the bundled content below.
	}

	if (!content) {
		try {
			const response = await fetch("./content/portfolio.json", {
				cache: "no-store",
				headers: { Accept: "application/json" },
			});
			if (response.ok) content = await response.json();
		} catch {
			// The bundled gallery data in site.js remains the final fallback.
		}
	}

	try {
		const response = await fetch("./google-drive-manifest.json", {
			cache: "no-store",
			headers: { Accept: "application/json" },
		});
		const manifest = response.ok ? await response.json() : null;
		const mappings = manifest?.items && typeof manifest.items === "object" ? manifest.items : {};
		if (content && Object.keys(mappings).length) {
			content = {
				...content,
				albums: content.albums.map((album) => ({
					...album,
					items: (album.items || []).map((item) =>
						mappings[item.id] ? { ...item, driveFileId: mappings[item.id] } : item,
					),
				})),
			};
		}
	} catch {
		// A missing or invalid manifest never blocks the normal CMS path.
	}

	if (content) window.__PORTFOLIO_CONTENT__ = content;

	const script = document.createElement("script");
	script.src = "./site.js";
	script.defer = false;
	document.body.append(script);
})();
