const { requireSession } = require("./_lib/auth");
const { createConvex } = require("./_lib/convex");
const { allowedOrigin, json, readJson } = require("./_lib/http");
const { decryptToken, intakeUrl, issueToken } = require("./_lib/intake-link");

// Admin actions that map one-to-one onto a Convex function. The body (minus `op`) is passed
// through as the arguments; Convex validates them.
const PASS_THROUGH = {
	seed: "library:seed",
	saveEventType: "library:saveEventType",
	saveTagGroup: "library:saveTagGroup",
	saveQuestionTemplate: "library:saveQuestion",
	updatePose: "library:updatePose",
	deletePose: "library:deletePose",
	updateDetails: "intakes:updateDetails",
	revokeLink: "intakes:revokeLink",
	saveIntakeQuestion: "intakes:saveQuestion",
	setQuestionRemoved: "intakes:setQuestionRemoved",
	moveQuestion: "intakes:moveQuestion",
	addCard: "intakes:addCard",
	setCardRemoved: "intakes:setCardRemoved",
	refreshFromTemplates: "intakes:refreshFromTemplates",
	removeIntake: "intakes:remove",
};

const IMAGE_TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);
const MAX_IMAGE_BYTES = 3_000_000;

/** Pose uploads arrive as a data URL the browser already shrank (decision 18). */
const decodeImage = (dataUrl) => {
	const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
	if (!match || !IMAGE_TYPES.has(match[1])) throw Object.assign(new Error("Upload a WebP, JPEG, or PNG image"), { statusCode: 400 });
	const bytes = Buffer.from(match[2], "base64");
	if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw Object.assign(new Error("Image is too large"), { statusCode: 413 });
	return { type: match[1], bytes };
};

/** Send a stored image back to the browser so Convex storage URLs never leave the server. */
const streamImage = async (response, url, fetchImpl) => {
	if (!url) return json(response, 404, { error: "Image not found" });
	const upstream = await fetchImpl(url);
	if (!upstream.ok) return json(response, 502, { error: "Image unavailable" });
	response.statusCode = 200;
	response.setHeader("Content-Type", upstream.headers.get("content-type") || "image/webp");
	response.setHeader("Cache-Control", "private, max-age=86400");
	response.end(Buffer.from(await upstream.arrayBuffer()));
};

const createHandler = ({ fetchImpl = fetch, env = process.env } = {}) => {
	const convex = createConvex({ env, fetchImpl });

	const get = async (request, response, params) => {
		const op = params.get("op");
		if (op === "overview") return json(response, 200, await convex.query("library:overview"));
		if (op === "intakes") return json(response, 200, { intakes: await convex.query("intakes:list") });
		if (op === "intake") return json(response, 200, await convex.query("intakes:get", { id: params.get("id") }));
		if (op === "image") return streamImage(response, await convex.query("library:poseImageUrl", { id: params.get("pose") }), fetchImpl);
		return json(response, 400, { error: "Unknown action" });
	};

	const post = async (request, response) => {
		const { op, ...args } = await readJson(request, 4_000_000);
		if (PASS_THROUGH[op]) return json(response, 200, { result: (await convex.mutation(PASS_THROUGH[op], args)) ?? null });

		if (op === "uploadPose") {
			const { image, ...pose } = args;
			const { type, bytes } = decodeImage(image);
			const uploadUrl = await convex.mutation("library:generateUploadUrl");
			const stored = await fetchImpl(uploadUrl, { method: "POST", headers: { "Content-Type": type }, body: bytes });
			if (!stored.ok) return json(response, 502, { error: "Image upload failed" });
			const { storageId } = await stored.json();
			return json(response, 200, { result: await convex.mutation("library:createPose", { storageId, ...pose }) });
		}
		if (op === "createIntake") {
			const { token, tokenHash, tokenCipher } = issueToken(env);
			const id = await convex.mutation("intakes:create", { ...args, tokenHash, tokenCipher });
			return json(response, 200, { result: id, link: intakeUrl(request, token, env) });
		}
		if (op === "copyLink") {
			const { tokenCipher, linkOpen } = await convex.query("intakes:linkCipher", { id: args.id });
			if (!linkOpen) return json(response, 409, { error: "This link is closed. Make a new link to reopen it." });
			// Copying the link is how Claire sends it, so a draft becomes "sent".
			await convex.mutation("intakes:markSent", { id: args.id });
			return json(response, 200, { link: intakeUrl(request, decryptToken(tokenCipher, env), env) });
		}
		if (op === "reissueLink") {
			const { token, tokenHash, tokenCipher } = issueToken(env);
			await convex.mutation("intakes:reissueLink", { id: args.id, tokenHash, tokenCipher });
			return json(response, 200, { link: intakeUrl(request, token, env) });
		}
		return json(response, 400, { error: "Unknown action" });
	};

	return async (request, response) => {
		try {
			requireSession(request);
			if (request.method === "GET") return await get(request, response, new URL(request.url, "http://local").searchParams);
			if (request.method !== "POST") {
				response.setHeader("Allow", "GET, POST");
				return json(response, 405, { error: "Method not allowed" });
			}
			if (!allowedOrigin(request)) return json(response, 403, { error: "Invalid origin" });
			return await post(request, response);
		} catch (error) {
			if (!error.statusCode || error.statusCode >= 500) console.error("Intake admin failed:", error.message);
			return json(response, error.statusCode || 500, { error: error.statusCode ? error.message : "Something went wrong" });
		}
	};
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
