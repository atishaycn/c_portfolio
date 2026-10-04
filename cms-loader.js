(async () => {
	const fetchJson = async (url) => {
		try {
			const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
			return response.ok ? await response.json() : null;
		} catch {
			return null;
		}
	};

	// The bundled gallery data remains a complete offline/static fallback.
	const [content, drive] = await Promise.all([fetchJson("/api/content"), fetchJson("/api/drive-albums")]);
	const driveAlbums = drive?.albums && typeof drive.albums === "object" ? drive.albums : {};
	if (content && Array.isArray(content.albums)) {
		window.__PORTFOLIO_CONTENT__ = {
			...content,
			// Albums backed by a Drive folder show that folder's photos instead of the CMS ones.
			albums: content.albums.map((album) =>
				Array.isArray(driveAlbums[album.key]) ? { ...album, items: driveAlbums[album.key] } : album,
			),
		};
	}

	const script = document.createElement("script");
	script.src = "./site.js";
	script.defer = false;
	document.body.append(script);
})();
