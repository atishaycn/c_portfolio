const prints = require("./_lib/prints");
const { reply, method, errorReply } = require("./_lib/print-http");

const createHandler = (deps = prints) => async (request, response) => {
	if (!method(request, response, "GET")) return;
	try {
		const id = new URL(request.url, "http://localhost").searchParams.get("session_id");
		if (!/^cs_test_[a-zA-Z0-9]{16,240}$/.test(id || "")) throw deps.fail("Invalid test session", 400);
		const session = await deps.getStripe().checkout.sessions.retrieve(id);
		if (!deps.isPilotSession(session)) throw deps.fail("Test session not found", 404);
		const paid = session.payment_status === "paid" && session.status === "complete";
		if (paid) deps.buildDraftOrder(session);
		reply(response, 200, { testOnly: true, paid, validated: paid && session.metadata.pilot_validation === "passed", fulfilment: "dry-run" });
	} catch (error) { errorReply(response, error); }
};
module.exports = createHandler();
module.exports.createHandler = createHandler;
