const { getContent } = require("./_lib/content");
const { json } = require("./_lib/http");

module.exports = async (request, response) => {
	if (request.method !== "GET") {
		response.setHeader("Allow", "GET");
		return json(response, 405, { error: "Method not allowed" });
	}
	try {
		const content = await getContent();
		return json(response, 200, content, {
			"Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=300",
		});
	} catch (error) {
		console.error(error);
		return json(response, 500, { error: "Content unavailable" });
	}
};
