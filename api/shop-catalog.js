const { getContent, shopSettings } = require("./_lib/content");
const { json } = require("./_lib/http");
const { pricedCatalog } = require("./_lib/shop-order");

const createHandler = (overrides = {}) => {
	const catalog = overrides.catalog || require("../content/shop-catalog.json");
	// Cached delivery read, like /api/content: this runs on every store visit, and checkout reprices from the authoritative copy.
	const fetchContent = overrides.fetchContent || getContent;
	return async (request, response) => {
		if (request.method !== "GET") {
			response.setHeader("Allow", "GET");
			return json(response, 405, { error: "Method not allowed" });
		}
		try {
			const content = await fetchContent();
			if (!content) throw new Error("No content");
			return json(response, 200, pricedCatalog(catalog, shopSettings(content)), {
				"Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
			});
		} catch (error) {
			console.error(error);
			return json(response, 503, { error: "Shop catalog unavailable" });
		}
	};
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
