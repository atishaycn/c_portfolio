const {
	clearSessionCookie,
	createSession,
	requireSession,
	sessionCookie,
	verifyPassword,
	verifySession,
} = require("../_lib/auth");
const { allowedOrigin, json, readJson } = require("../_lib/http");

module.exports = async (request, response) => {
	try {
		if (request.method === "GET") {
			const session = verifySession(request);
			return json(response, 200, {
				authenticated: Boolean(session),
				csrf: session?.csrf || null,
				email: session?.email || null,
			});
		}
		if (request.method === "DELETE") {
			requireSession(request);
			if (!allowedOrigin(request)) return json(response, 403, { error: "Invalid origin" });
			response.setHeader("Set-Cookie", clearSessionCookie());
			return json(response, 200, { authenticated: false });
		}
		if (request.method !== "POST") {
			response.setHeader("Allow", "GET, POST, DELETE");
			return json(response, 405, { error: "Method not allowed" });
		}
		if (!allowedOrigin(request)) return json(response, 403, { error: "Invalid origin" });
		const body = await readJson(request, 20_000);
		const email = String(body.email || "").trim().toLowerCase();
		const expectedEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
		if (!expectedEmail || email !== expectedEmail || !verifyPassword(String(body.password || ""))) {
			return json(response, 401, { error: "Email or password is incorrect" });
		}
		const token = createSession(expectedEmail);
		response.setHeader("Set-Cookie", sessionCookie(token));
		const session = verifySession({
			headers: { cookie: `ct_admin=${encodeURIComponent(token)}` },
		});
		return json(response, 200, {
			authenticated: true,
			csrf: session.csrf,
			email: expectedEmail,
		});
	} catch (error) {
		console.error(error);
		return json(response, error.statusCode || 500, {
			error: error.statusCode ? error.message : "Unable to sign in",
		});
	}
};
