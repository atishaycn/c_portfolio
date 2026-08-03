const { requireSession } = require("../_lib/auth");
const { getContent, saveContent } = require("../_lib/content");
const { allowedOrigin, json, readJson } = require("../_lib/http");

module.exports = async (request, response) => {
	try {
		requireSession(request);
		if (request.method === "GET") {
			return json(response, 200, await getContent({ authoritative: true }));
		}
		if (request.method !== "PUT") {
			response.setHeader("Allow", "GET, PUT");
			return json(response, 405, { error: "Method not allowed" });
		}
		if (!allowedOrigin(request)) return json(response, 403, { error: "Invalid origin" });
		const candidate = await readJson(request);
		return json(response, 200, await saveContent(candidate));
	} catch (error) {
		if (!error.statusCode) console.error(error);
		return json(response, error.statusCode || 500, {
			error: error.statusCode ? error.message : "Unable to save content",
		});
	}
};
