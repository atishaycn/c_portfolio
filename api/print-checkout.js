const prints = require("./_lib/prints");
const { reply, method, errorReply, smallJson } = require("./_lib/print-http");

const createHandler = (deps = prints) => async (request, response) => {
	if (!method(request, response, "POST")) return;
	try {
		if (!deps.checkoutReady()) throw deps.fail("Test checkout is not configured", 503);
		const stripe = deps.getStripe();
		const origin = deps.siteOrigin();
		// Host and forwarded-host headers are not trusted as checkout origins.
		if (request.headers.origin !== origin) throw deps.fail("Untrusted checkout origin", 403);
		const body = await smallJson(request);
		if (!body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).some((key) => !["photoId", "size", "requestId"].includes(key)) || body.photoId !== deps.PILOT.photoId || body.size !== deps.PILOT.size || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.requestId || "")) {
			throw deps.fail("Choose the pilot photograph and size", 400);
		}
		const photo = await deps.loadPilot();
		const printFile = await deps.originalUrl(photo);
		const session = await stripe.checkout.sessions.create(deps.checkoutParameters(photo, printFile, origin), { idempotencyKey: `${deps.APP}-${body.requestId}` });
		if (session.livemode !== false || !/^https:\/\/checkout\.stripe\.com\//.test(session.url || "")) throw deps.fail("Unexpected checkout response", 503);
		reply(response, 200, { url: session.url });
	} catch (error) { errorReply(response, error); }
};
module.exports = createHandler();
module.exports.createHandler = createHandler;
