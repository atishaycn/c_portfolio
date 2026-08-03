const { randomUUID } = require("node:crypto");
const { requireSession } = require("../_lib/auth");
const { createImageUploadSignature } = require("../_lib/cloudinary");
const { allowedOrigin, json, readJson } = require("../_lib/http");

module.exports = async (request, response) => {
	try {
		requireSession(request);
		if (request.method !== "POST") {
			response.setHeader("Allow", "POST");
			return json(response, 405, { error: "Method not allowed" });
		}
		if (!allowedOrigin(request)) return json(response, 403, { error: "Invalid origin" });
		const body = await readJson(request, 20_000);
		const albumKey = String(body.albumKey || "")
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 80);
		if (!albumKey) return json(response, 400, { error: "Album is required" });
		const publicId = `portfolio-admin/${albumKey}/${randomUUID()}`;
		return json(response, 200, createImageUploadSignature(publicId));
	} catch (error) {
		if (!error.statusCode) console.error(error);
		return json(response, error.statusCode || 500, {
			error: error.statusCode ? error.message : "Unable to prepare upload",
		});
	}
};
