const { requireSession } = require("../_lib/auth");
const { allowedOrigin, json } = require("../_lib/http");

const DEFAULT_REPOSITORY = "atishaycn/c_portfolio";
const DEFAULT_WORKFLOW = "portfolio-shop-sync.yml";
const DEFAULT_REF = "main";

const configurationError = (message) => {
	const error = new Error(message);
	error.statusCode = 503;
	return error;
};

const dispatchShopSync = async ({
	fetchImpl = fetch,
	token = process.env.GITHUB_SHOP_SYNC_TOKEN,
	repository = process.env.GITHUB_SHOP_SYNC_REPOSITORY || DEFAULT_REPOSITORY,
	workflow = process.env.GITHUB_SHOP_SYNC_WORKFLOW || DEFAULT_WORKFLOW,
	ref = process.env.GITHUB_SHOP_SYNC_REF || DEFAULT_REF,
} = {}) => {
	if (!token) throw configurationError("Shop sync is not configured yet.");
	if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
		throw configurationError("Shop sync repository is invalid.");
	}
	const response = await fetchImpl(
		`https://api.github.com/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
		{
			method: "POST",
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				"User-Agent": "claire-portfolio-admin",
				"X-GitHub-Api-Version": "2022-11-28",
			},
			body: JSON.stringify({ ref }),
			signal: AbortSignal.timeout(15_000),
		},
	);
	if (!response.ok) {
		const error = new Error("Unable to start shop sync.");
		error.statusCode = 502;
		throw error;
	}
	return { status: "started" };
};

const handler = async (request, response) => {
	try {
		requireSession(request);
		if (request.method !== "POST") {
			response.setHeader("Allow", "POST");
			return json(response, 405, { error: "Method not allowed" });
		}
		if (!allowedOrigin(request)) return json(response, 403, { error: "Invalid origin" });
		return json(response, 202, await dispatchShopSync());
	} catch (error) {
		if (!error.statusCode) console.error(error);
		return json(response, error.statusCode || 500, {
			error: error.statusCode ? error.message : "Unable to start shop sync",
		});
	}
};

module.exports = handler;
module.exports.dispatchShopSync = dispatchShopSync;
