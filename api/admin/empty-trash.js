const { requireSession } = require("../_lib/auth");
const { allowedOrigin, json, readJson } = require("../_lib/http");
const { emptyTrashBatch } = require("../_lib/trash");

module.exports = async (request, response) => {
	try {
		requireSession(request);
		if (request.method !== "POST") {
			response.setHeader("Allow", "POST");
			return json(response, 405, { error: "Method not allowed" });
		}
		if (!allowedOrigin(request)) return json(response, 403, { error: "Invalid origin" });
		const { revision } = await readJson(request, 10_000);
		return json(response, 200, await emptyTrashBatch(revision));
	} catch (error) {
		if (!error.statusCode || error.statusCode >= 500) console.error(error);
		return json(response, error.statusCode || 500, {
			error: error.statusCode ? error.message : "Unable to empty Trash",
		});
	}
};
