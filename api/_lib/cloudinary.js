const { createHash } = require("node:crypto");

const CLOUDINARY_CONTENT_ID = "portfolio-cms/content.json";
const API_TIMEOUT_MS = 60_000;

const requireCloudinary = () => {
	const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
	const apiKey = process.env.CLOUDINARY_API_KEY;
	const apiSecret = process.env.CLOUDINARY_API_SECRET;
	if (!cloudName || !apiKey || !apiSecret) {
		const error = new Error("Cloudinary is not configured");
		error.statusCode = 503;
		throw error;
	}
	return { apiKey, apiSecret, cloudName };
};

const signParameters = (parameters, secret) => {
	const payload = Object.entries(parameters)
		.filter(([, value]) => value !== undefined && value !== "")
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, value]) => `${key}=${value}`)
		.join("&");
	return createHash("sha1").update(`${payload}${secret}`).digest("hex");
};

const publicContentUrl = () => {
	const { cloudName } = requireCloudinary();
	return `https://res.cloudinary.com/${cloudName}/raw/upload/${CLOUDINARY_CONTENT_ID}`;
};

const fetchRemoteContent = async () => {
	const response = await fetch(`${publicContentUrl()}?v=${Date.now()}`, {
		headers: { Accept: "application/json" },
		signal: AbortSignal.timeout(API_TIMEOUT_MS),
	});
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`Cloudinary content read failed (${response.status})`);
	return response.json();
};

const fetchAuthoritativeContent = async () => {
	const { apiKey, apiSecret, cloudName } = requireCloudinary();
	const resourcesUrl = new URL(
		`https://api.cloudinary.com/v1_1/${cloudName}/resources/raw/upload`,
	);
	resourcesUrl.searchParams.append("public_ids[]", CLOUDINARY_CONTENT_ID);
	const metadataResponse = await fetch(resourcesUrl, {
		headers: {
			Accept: "application/json",
			Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
		},
		signal: AbortSignal.timeout(API_TIMEOUT_MS),
	});
	if (!metadataResponse.ok) {
		const error = new Error(`Cloudinary authoritative read failed (${metadataResponse.status})`);
		error.statusCode = 503;
		throw error;
	}
	const metadata = await metadataResponse.json();
	const resource = metadata.resources?.[0];
	if (!resource) return null;
	const response = await fetch(`${resource.secure_url}?fresh=${Date.now()}`, {
		headers: { Accept: "application/json" },
		signal: AbortSignal.timeout(API_TIMEOUT_MS),
	});
	if (!response.ok) {
		const error = new Error(`Cloudinary content download failed (${response.status})`);
		error.statusCode = 503;
		throw error;
	}
	return response.json();
};

const uploadRawJson = async (publicId, content) => {
	const { apiKey, apiSecret, cloudName } = requireCloudinary();
	const timestamp = Math.floor(Date.now() / 1000);
	const parameters = {
		invalidate: "true",
		overwrite: "true",
		public_id: publicId,
		timestamp,
	};
	const form = new FormData();
	form.set("file", `data:application/json;base64,${Buffer.from(JSON.stringify(content)).toString("base64")}`);
	form.set("api_key", apiKey);
	for (const [key, value] of Object.entries(parameters)) form.set(key, String(value));
	form.set("signature", signParameters(parameters, apiSecret));
	const response = await fetch(
		`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
		{
			method: "POST",
			body: form,
			signal: AbortSignal.timeout(API_TIMEOUT_MS),
		},
	);
	const body = await response.json();
	if (!response.ok) {
		throw new Error(`Cloudinary content write failed: ${body.error?.message || response.status}`);
	}
	return body;
};

const writeRemoteContent = async (content, previousContent) => {
	if (previousContent) {
		const historyId = `portfolio-cms/history/${new Date()
			.toISOString()
			.replace(/[:.]/g, "-")}.json`;
		await uploadRawJson(historyId, previousContent);
	}
	return uploadRawJson(CLOUDINARY_CONTENT_ID, content);
};

const createImageUploadSignature = (publicId) => {
	const { apiKey, apiSecret, cloudName } = requireCloudinary();
	const timestamp = Math.floor(Date.now() / 1000);
	const parameters = {
		overwrite: "false",
		public_id: publicId,
		timestamp,
	};
	return {
		apiKey,
		cloudName,
		publicId,
		signature: signParameters(parameters, apiSecret),
		timestamp,
		uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
	};
};

module.exports = {
	createImageUploadSignature,
	fetchAuthoritativeContent,
	fetchRemoteContent,
	writeRemoteContent,
};
