const { getDriveAlbums } = require("./_lib/drive");
const { json } = require("./_lib/http");

const createHandler = ({ fetchImpl = fetch, env = process.env } = {}) =>
	async (request, response) => {
		if (request.method !== "GET") {
			response.setHeader("Allow", "GET");
			return json(response, 405, { error: "Method not allowed" });
		}
		const albums = await getDriveAlbums({ apiKey: env.GOOGLE_DRIVE_API_KEY, fetchImpl });
		// New photos show up within about five minutes; a stale list is served while refreshing.
		return json(response, 200, { albums }, {
			"Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
		});
	};

module.exports = createHandler();
module.exports.createHandler = createHandler;
