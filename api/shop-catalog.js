const { fetchAuthoritativeContent } = require("./_lib/cloudinary");
const { shopSettings, validateContent } = require("./_lib/content");
const { json } = require("./_lib/http");
const { pricedCatalog } = require("./_lib/shop-order");

const createHandler = (overrides = {}) => {
	const catalog = overrides.catalog || require("../content/shop-catalog.json");
	const fetchContent = overrides.fetchContent || fetchAuthoritativeContent;
	return async (request, response) => {
		if (request.method !== "GET") {
			response.setHeader("Allow", "GET");
			return json(response, 405, { error: "Method not allowed" });
		}
		try {
			const raw = await fetchContent();
			if (!raw) throw new Error("No authoritative content");
			const content = validateContent(raw);
			return json(response, 200, pricedCatalog(catalog, shopSettings(content)), {
				"Cache-Control": "public, max-age=60",
			});
		} catch (error) {
			console.error(error);
			return json(response, 503, { error: "Shop catalog unavailable" });
		}
	};
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
