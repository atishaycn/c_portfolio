const prints = require("./_lib/prints");
const { reply, method, rawBody } = require("./_lib/print-http");

const createHandler = (deps = prints) => async (request, response) => {
	if (!method(request, response, "POST")) return;
	let stripe;
	try { stripe = deps.getStripe(); } catch { return reply(response, 503, { error: "Test webhook is not configured" }); }
	const secret = process.env.STRIPE_WEBHOOK_SECRET;
	if (!secret?.startsWith("whsec_")) return reply(response, 503, { error: "Test webhook is not configured" });
	let event;
	try {
		event = stripe.webhooks.constructEvent(await rawBody(request), request.headers["stripe-signature"], secret);
	} catch { return reply(response, 400, { error: "Invalid webhook signature or body" }); }
	if (event.livemode !== false || !["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return reply(response, 200, { ignored: true });
	if (!deps.isPilotSession(event.data.object)) return reply(response, 200, { ignored: true });
	try {
		// Always check Stripe's current state. Browser redirects never validate an order.
		const session = await stripe.checkout.sessions.retrieve(event.data.object.id);
		if (!deps.isPilotSession(session)) return reply(response, 200, { ignored: true });
		if (session.payment_status !== "paid") return reply(response, 200, { pending: true });
		const draft = deps.buildDraftOrder(session);
		// Dry run only. No Gelato request, order, or PII persistence is made here.
		// Repeated/concurrent deliveries produce the same metadata and cannot print twice.
		await stripe.checkout.sessions.update(session.id, { metadata: { pilot_validation: "passed", pilot_order_reference: draft.orderReferenceId } }, { idempotencyKey: `${deps.APP}-validate-${session.id}` });
		return reply(response, 200, { validated: true, fulfilment: "dry-run" });
	} catch {
		// No address/email or provider error body in logs or the response. Stripe retries.
		return reply(response, 500, { error: "Pilot validation failed; retry required" });
	}
};
module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.config = { api: { bodyParser: false } };
