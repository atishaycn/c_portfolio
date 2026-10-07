const prints = require("./_lib/prints");
const { reply, method, errorReply } = require("./_lib/print-http");

const createHandler = (deps = prints) => async (request, response) => {
	if (!method(request, response, "GET")) return;
	if (!deps.pilotEnabled()) return reply(response, 200, { enabled: false, testOnly: true });
	try {
		const photo = await deps.loadPilot();
		const cloud = process.env.CLOUDINARY_CLOUD_NAME;
		if (!cloud) throw deps.fail("Cloudinary is not configured", 503);
		const path = photo.publicId.split("/").map(encodeURIComponent).join("/");
		reply(response, 200, {
			enabled: true, testOnly: true, checkoutReady: deps.checkoutReady(),
			photo: { id: photo.id, title: photo.title || "Nature photograph", width: photo.width, height: photo.height, image: `https://res.cloudinary.com/${encodeURIComponent(cloud)}/image/upload/f_auto,q_auto,w_1200,c_limit/${path}` },
			size: deps.PILOT.size, label: deps.PILOT.label, amount: deps.PILOT.amount, currency: deps.PILOT.currency,
		});
	} catch (error) { errorReply(response, error); }
};
module.exports = createHandler();
module.exports.createHandler = createHandler;
