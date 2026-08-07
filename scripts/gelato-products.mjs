#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const CONTENT_FILE = resolve(ROOT, "content", "portfolio.json");
const ENV_FILE = resolve(ROOT, ".env.gelato.local");
const SHOPIFY_ENV_FILE = resolve(ROOT, ".env.shopify.local");
const MANIFEST_FILE = resolve(ROOT, ".gelato-product-manifest.json");
const STATE_FILE = resolve(ROOT, ".gelato-product-state.json");
const STALE_FILE = resolve(ROOT, ".gelato-stale-products.json");
const CATALOG_AUDIT_FILE = resolve(ROOT, ".gelato-catalog-audit.json");
const RECONCILE_PLAN_FILE = resolve(ROOT, ".gelato-reconcile-plan.json");
const DEFAULT_STORE_ID = "6d03ca64-de8a-4764-bc46-8bd014a1b271";
const CLOUD_NAME = "dpmdkrggj";
const API_BASE = "https://ecommerce.gelatoapis.com/v1";
const DEFAULT_SHOPIFY_API_VERSION = "2026-07";
let shopifyAccessTokenCache = null;

const MEDIA = {
	"fine-art": {
		env: "GELATO_FINE_ART_TEMPLATE_ID",
		label: "Fine Art Print",
		productType: "Fine Art Print",
		fitMethod: "slice",
		description:
			"<p>Fine art photography by Claire Thomas, printed on archival-quality 200 gsm enhanced matte paper.</p><p>Choose from three sizes selected to preserve the photograph's original composition. Printed on demand and shipped by Gelato.</p>",
	},
	framed: {
		env: "GELATO_FRAMED_TEMPLATE_ID",
		label: "Framed Fine Art Print",
		productType: "Framed Fine Art Print",
		fitMethod: "slice",
		description:
			"<p>Fine art photography by Claire Thomas on archival-quality 200 gsm enhanced matte paper, finished in a ready-to-hang frame with plexiglass.</p><p>Choose Black or Natural Wood and one of three composition-matched sizes. Printed, framed, and shipped on demand by Gelato.</p>",
	},
	canvas: {
		env: "GELATO_CANVAS_TEMPLATE_ID",
		label: "Canvas Print",
		productType: "Canvas Print",
		fitMethod: "slice",
		description:
			"<p>Fine art photography by Claire Thomas, printed on canvas and stretched over an FSC-certified wood frame.</p><p>Choose from three sizes matched to the photograph's aspect ratio. Printed and shipped on demand by Gelato.</p>",
	},
};

const CATALOG_VERSION = "edge-to-edge-v1";
const catalogVersionTag = `catalog-${CATALOG_VERSION}`;

const SIZE_GROUPS = {
	"fine-art": {
		square: ["10x10", "12x12", "16x16"],
		classic: ["8x10", "12x16", "16x20"],
		wide: ["8x12", "12x18", "16x24"],
	},
	framed: {
		square: ["12x12", "16x16", "20x20"],
		classic: ["8x10", "12x16", "16x20"],
		wide: ["8x12", "12x18", "16x24"],
	},
	canvas: {
		square: ["8x8", "12x12", "16x16"],
		classic: ["8x10", "12x16", "16x20"],
		wide: ["8x12", "12x18", "16x24"],
	},
};
const ALL_SIZES = [...new Set(Object.values(SIZE_GROUPS).flatMap((groups) => Object.values(groups).flat()))];

const SERIES_LABELS = {
	"the-natural-world": "The Natural World",
	california: "California",
	"san-francisco": "San Francisco",
	india: "India",
	"shapes-and-shadows": "Shapes & Shadows",
	protests: "Reportage",
};

const SHOPIFY_SERIES_HANDLES = {
	"the-natural-world": "the-natural-world",
	california: "california",
	"san-francisco": "san-francisco",
	india: "india",
	"shapes-and-shadows": "shapes-shadows",
	protests: "reportage",
};

const parseArgs = (argv) => {
	const args = {
		execute: false,
		validateTemplates: false,
		audit: false,
		strictAudit: false,
		reconcile: false,
		visible: false,
		repairCreated: false,
		repairBatchPhotos: 8,
		limit: Infinity,
		concurrency: 3,
		only: null,
		media: Object.keys(MEDIA),
		contentFile: process.env.PORTFOLIO_CONTENT_FILE || CONTENT_FILE,
		contentUrl: process.env.PORTFOLIO_CONTENT_URL || null,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--execute") args.execute = true;
		else if (arg === "--validate-templates") args.validateTemplates = true;
		else if (arg === "--audit") args.audit = true;
		else if (arg === "--strict-audit") {
			args.audit = true;
			args.strictAudit = true;
		}
		else if (arg === "--reconcile") args.reconcile = true;
		else if (arg === "--visible") args.visible = true;
		else if (arg === "--repair-created") args.repairCreated = true;
		else if (arg === "--repair-batch-photos") args.repairBatchPhotos = Number(argv[++index]);
		else if (arg === "--limit") args.limit = Number(argv[++index]);
		else if (arg === "--concurrency") args.concurrency = Number(argv[++index]);
		else if (arg === "--only") args.only = new Set(argv[++index].split(",").filter(Boolean));
		else if (arg === "--media") args.media = argv[++index].split(",").filter(Boolean);
		else if (arg === "--content-file") args.contentFile = resolve(argv[++index]);
		else if (arg === "--content-url") args.contentUrl = argv[++index];
		else if (arg === "--help") args.help = true;
		else throw new Error(`Unknown argument: ${arg}`);
	}

	assert(Number.isFinite(args.limit) || args.limit === Infinity, "--limit must be a number");
	assert(args.limit > 0, "--limit must be greater than zero");
	assert(Number.isInteger(args.concurrency) && args.concurrency > 0, "--concurrency must be a positive integer");
	assert(args.concurrency <= 10, "--concurrency must be 10 or less");
	assert(
		Number.isInteger(args.repairBatchPhotos) && args.repairBatchPhotos > 0,
		"--repair-batch-photos must be a positive integer",
	);
	assert(!args.visible || args.execute, "--visible requires --execute");
	assert(!args.repairCreated || (args.execute && args.visible), "--repair-created requires --execute --visible");
	assert(!args.reconcile || !args.repairCreated, "--reconcile cannot be combined with --repair-created");
	for (const medium of args.media) assert(MEDIA[medium], `Unknown medium: ${medium}`);
	return args;
};

const printHelp = () => {
	console.log(`Usage:
  node scripts/gelato-products.mjs
  node scripts/gelato-products.mjs --validate-templates
  node scripts/gelato-products.mjs --audit
  node scripts/gelato-products.mjs --strict-audit
  node scripts/gelato-products.mjs --reconcile [--only id,id] [--media fine-art,framed,canvas]
  node scripts/gelato-products.mjs --reconcile --execute [--only id,id] [--media fine-art,framed,canvas]
  node scripts/gelato-products.mjs --reconcile --content-file /tmp/claire-live-content.json
  node scripts/gelato-products.mjs --execute [--visible] [--limit N] [--concurrency N] [--only id,id] [--media fine-art,framed,canvas]
  node scripts/gelato-products.mjs --execute --visible --repair-created [--repair-batch-photos N]

The default command reads the current portfolio and writes a dry-run manifest.
--audit reports managed products whose photograph is no longer in the portfolio.
--reconcile plans a CMS-authoritative catalog sync; it is dry-run by default.
--reconcile --execute creates enabled products, updates customer-facing metadata, and archives disabled/stale products without deleting them.
--execute creates hidden Shopify products by default and records progress after every item.
--visible makes newly created products visible in Shopify.`);
};

const loadEnv = (file) => {
	if (!existsSync(file)) return;
	for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const separator = line.indexOf("=");
		if (separator < 1) continue;
		const key = line.slice(0, separator).trim();
		const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
		if (!(key in process.env)) process.env[key] = value;
	}
};

const loadGalleryPages = () => {
	return readPortfolioContent().albums;
};

const readPortfolioContent = (file = process.env.PORTFOLIO_CONTENT_FILE || CONTENT_FILE) => {
	assert(existsSync(file), `Portfolio CMS snapshot not found: ${file}`);
	const content = JSON.parse(readFileSync(file, "utf8"));
	assert(Array.isArray(content.albums), "Portfolio CMS content must contain albums");
	return content;
};

const loadPortfolioContent = async ({ file, url } = {}) => {
	if (url) {
		const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30 * 1000) });
		if (!response.ok) throw new Error(`Portfolio CMS ${response.status}: ${await response.text()}`);
		const content = await response.json();
		assert(Array.isArray(content.albums), "Portfolio CMS response must contain albums");
		return content;
	}
	return readPortfolioContent(file || process.env.PORTFOLIO_CONTENT_FILE || CONTENT_FILE);
};

const albumMetadata = (content) => {
	const nodes = new Map([
		...(content.groups || []).map((group) => [group.id, { ...group, kind: "group" }]),
		...content.albums.map((album) => [album.id, { ...album, kind: "album" }]),
	]);
	const pathCache = new Map();
	const pathFor = (album) => {
		if (pathCache.has(album.id)) return pathCache.get(album.id);
		const seen = new Set();
		const labels = [];
		let current = album;
		while (current) {
			assert(!seen.has(current.id), `CMS hierarchy cycle at ${current.id}`);
			seen.add(current.id);
			labels.unshift(current.label || current.key || current.id);
			current = current.parentId ? nodes.get(current.parentId) : null;
		}
		const path = labels.join(" / ");
		pathCache.set(album.id, path);
		return path;
	};
	return { nodes, pathFor };
};

const aspectGroupFor = (width, height) => {
	const ratio = Math.max(width, height) / Math.min(width, height);
	if (ratio <= 1.12) return "square";
	if (ratio <= 1.42) return "classic";
	return "wide";
};

const orientationFor = (width, height) => (width >= height ? "horizontal" : "vertical");

const cloudinaryUrl = (publicId) => {
	const encodedId = publicId.split("/").map(encodeURIComponent).join("/");
	return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_jpg,q_95/${encodedId}.jpg`;
};

const referenceLabelFor = (printId, series) =>
	printId
		.replace(new RegExp(`^${series}-`), "")
		.split("-")
		.map((part) => (/^\d+$/.test(part) ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
		.join(" ");

const slugify = (value) => String(value || "")
	.normalize("NFKD")
	.replace(/[\u0300-\u036f]/g, "")
	.replace(/&/g, " and ")
	.toLowerCase()
	.replace(/[^a-z0-9]+/g, "-")
	.replace(/^-+|-+$/g, "");

const referenceHandleFor = (printId, series) => {
	const prefix = `${series}-`;
	return printId.startsWith(prefix) ? printId.slice(prefix.length) : printId;
};

const canonicalHandleFor = (photo, medium) => {
	const seriesHandle = SHOPIFY_SERIES_HANDLES[photo.series] || slugify(photo.series || photo.seriesLabel);
	const referenceHandle = referenceHandleFor(photo.printId, photo.series);
	return slugify(`${seriesHandle}-${referenceHandle}-${MEDIA[medium].label}`);
};

const canonicalFineArtUrlFor = (photo) =>
	`https://shop.clairethomas.art/products/${canonicalHandleFor(photo, "fine-art")}`;

const buildManifest = (content = readPortfolioContent()) => {
	const { pathFor } = albumMetadata(content);
	const photos = content.albums.flatMap((album) =>
		(album.items || [])
			.filter((item) => item.printEnabled === true)
			.sort((left, right) => left.order - right.order)
			.map((item) => {
				assert(item.publicId, `Missing Cloudinary public ID for ${item.id}`);
				assert(item.id, "CMS print-enabled photo is missing a stable id");
				const printId = item.id;
				const aspectGroup = aspectGroupFor(item.width, item.height);
				return {
					printId,
					albumId: album.id,
					series: album.key || album.id,
					seriesLabel: album.label || SERIES_LABELS[album.key] || album.key || album.id,
					seriesPath: pathFor(album),
					referenceLabel: referenceLabelFor(printId, album.key || album.id),
					albumOrder: album.order,
					photoOrder: item.order,
					fineArtHandle: canonicalHandleFor({
						printId,
						series: album.key || album.id,
						seriesLabel: album.label || SERIES_LABELS[album.key] || album.key || album.id,
					}, "fine-art"),
					fineArtUrl: canonicalFineArtUrlFor({
						printId,
						series: album.key || album.id,
						seriesLabel: album.label || SERIES_LABELS[album.key] || album.key || album.id,
					}),
					width: item.width,
					height: item.height,
					orientation: orientationFor(item.width, item.height),
					aspectGroup,
					sizesByMedium: Object.fromEntries(
						Object.keys(MEDIA).map((medium) => [medium, SIZE_GROUPS[medium][aspectGroup]]),
					),
					publicId: item.publicId,
					fileUrl: cloudinaryUrl(item.publicId),
				};
			}),
	);

	return {
		generatedAt: new Date().toISOString(),
		photoCount: photos.length,
		productCount: photos.length * Object.keys(MEDIA).length,
		photos,
	};
};

const apiRequest = async (path, options = {}) => {
	for (let attempt = 0; ; attempt += 1) {
		const method = (options.method ?? "GET").toUpperCase();
		let response;
		try {
			response = await fetch(`${API_BASE}${path}`, {
				...options,
				signal:
					options.signal ??
					AbortSignal.timeout((method === "POST" ? 15 : 5) * 60 * 1000),
				headers: {
					"Content-Type": "application/json",
					"X-API-KEY": process.env.GELATO_API_KEY,
					...options.headers,
				},
			});
		} catch (error) {
			const retryableNetworkRequest = method === "GET" || method === "DELETE";
			if (!retryableNetworkRequest || attempt + 1 >= 7) throw error;
			const retryDelay = Math.min(30 * 1000, 1000 * 2 ** attempt);
			console.warn(
				`Gelato ${method} network retry in ${Math.ceil(retryDelay / 1000)}s ` +
				`(attempt ${attempt + 1}/7): ${error.message}`,
			);
			await new Promise((resolvePromise) => setTimeout(resolvePromise, retryDelay));
			continue;
		}
		const text = await response.text();
		const body = text ? JSON.parse(text) : null;
		if (method === "DELETE" && response.status === 404) return null;
		if (response.ok) return body;

		const retryable = response.status === 429 || response.status >= 500;
		const maxAttempts = response.status === 429 ? 432 : 7;
		if (!retryable || attempt + 1 >= maxAttempts) {
			const error = new Error(`Gelato ${response.status}: ${JSON.stringify(body)}`);
			error.status = response.status;
			throw error;
		}
		const retryAfterSeconds = Number(response.headers.get("retry-after"));
		const retryDelay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
			? retryAfterSeconds * 1000
			: Math.min(5 * 60 * 1000, 1000 * 2 ** attempt);
		if (response.status === 429) {
			console.warn(
				`Gelato rate limit: retrying in ${Math.ceil(retryDelay / 1000)}s (attempt ${attempt + 1}/${maxAttempts}).`,
			);
		}
		await new Promise((resolvePromise) => setTimeout(resolvePromise, retryDelay));
	}
};

const normalizeVariant = (variant) => {
	const uid = variant.productUid.toLowerCase();
	const title = variant.title.toLowerCase();
	const orientation = uid.includes("_hor_") || title.includes("horizontal") ? "horizontal" : "vertical";
	const size =
		ALL_SIZES.find((candidate) => {
			const [width, height] = candidate.split("x");
			return (
				uid.includes(`${width}x${height}-inch`) ||
				uid.includes(`${height}x${width}-inch`)
			);
		}) ??
		ALL_SIZES.find((candidate) => {
			const [width, height] = candidate.split("x");
			return title.includes(`/ ${width}x${height}`) || title.includes(`/ ${height}x${width}`);
		});
	const isBlackFrame = uid.includes("black") || title.includes("black frame");
	const isNaturalWoodFrame =
		(uid.includes("natural-wood") || uid.includes("_wood_") || title.includes("wood frame")) &&
		!uid.includes("dark-wood") &&
		!title.includes("dark wood");
	const frameColor = isBlackFrame ? "black" : isNaturalWoodFrame ? "natural-wood" : undefined;
	return { ...variant, orientation, size, frameColor };
};

const loadTemplates = async (selectedMedia) => {
	const templates = {};
	for (const medium of selectedMedia) {
		const templateId = process.env[MEDIA[medium].env];
		assert(templateId, `${MEDIA[medium].env} is required`);
		const template = await apiRequest(`/templates/${templateId}`);
		templates[medium] = {
			...template,
			variants: template.variants.map(normalizeVariant),
		};
	}
	return templates;
};

const selectTemplateVariants = (template, photo, medium) => {
	const sizes = photo.sizesByMedium?.[medium] ?? SIZE_GROUPS[medium][photo.aspectGroup];
	const wantedSizes = new Set(sizes);
	const selected = template.variants.filter((variant) => {
		if (variant.orientation !== photo.orientation || !wantedSizes.has(variant.size)) return false;
		if (medium === "framed") return variant.frameColor === "black" || variant.frameColor === "natural-wood";
		return true;
	});
	const expected = medium === "framed" ? sizes.length * 2 : sizes.length;
	assert.equal(
		selected.length,
		expected,
		`${medium} template has ${selected.length}/${expected} variants for ${photo.orientation} ${photo.aspectGroup}: ${sizes.join(", ")}`,
	);
	return selected;
};

const validateTemplates = (templates, photos, selectedMedia) => {
	for (const medium of selectedMedia) {
		const seen = new Set();
		for (const photo of photos) {
			const key = `${photo.orientation}:${photo.aspectGroup}`;
			if (seen.has(key)) continue;
			selectTemplateVariants(templates[medium], photo, medium);
			seen.add(key);
		}
	}
};

const readState = () => {
	if (!existsSync(STATE_FILE)) return { version: 1, products: {} };
	return JSON.parse(readFileSync(STATE_FILE, "utf8"));
};

const writeState = (state) => {
	writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
};

const mergeProductsById = (...productLists) =>
	[...new Map(productLists.flat().map((product) => [product.id, product])).values()];

const listExistingProducts = async (storeId, knownIds = [], sweepCount = 3) => {
	let products = [];
	for (let sweep = 0; sweep < sweepCount; sweep += 1) {
		for (let offset = 0; ; offset += 100) {
			const page = await apiRequest(`/stores/${storeId}/products?offset=${offset}&limit=100&order=desc&orderBy=createdAt`);
			products = mergeProductsById(products, page.products);
			if (page.products.length < 100) break;
		}
	}
	for (const id of new Set(knownIds.filter(Boolean))) {
		if (products.some((product) => product.id === id)) continue;
		try {
			const product = await apiRequest(`/stores/${storeId}/products/${id}`);
			if (product?.id) products = mergeProductsById(products, [product]);
		} catch (error) {
			if (error.status !== 404) throw error;
		}
	}
	return products;
};

const productKey = (printId, medium) => `${printId}:${medium}`;
const splitProductKey = (key) => {
	const separator = key.lastIndexOf(":");
	return {
		printId: key.slice(0, separator),
		medium: key.slice(separator + 1),
	};
};

const isExistingMatch = (product, photo, medium) => {
	const tags = Array.isArray(product.tags) ? product.tags : [];
	return (tags.includes(photo.printId) || tags.includes(`photo-id:${photo.printId}`)) && tags.includes(`format-${medium}`);
};

const selectExistingProduct = (products, photo, medium, recordedId) => {
	const matches = products.filter((product) => isExistingMatch(product, photo, medium));
	return (
		matches.find((product) => product.id === recordedId && product.status === "active" && product.tags?.includes(catalogVersionTag)) ??
		matches.find((product) => product.status === "active" && product.tags?.includes(catalogVersionTag)) ??
		matches.find((product) => product.id === recordedId && product.status === "active") ??
		matches.find((product) => product.status === "active") ??
		matches.find((product) => product.id === recordedId) ??
		matches[0]
	);
};

const productMetadata = (photo, medium) => {
	const media = MEDIA[medium];
	const position = Number.isInteger(photo.photoOrder) ? ` Portfolio position: ${photo.photoOrder + 1}.` : "";
	const collectionPosition = Number.isInteger(photo.albumOrder) ? ` Collection position: ${photo.albumOrder + 1}.` : "";
	const collection = photo.seriesPath || photo.seriesLabel;
	return {
		title: `${photo.seriesLabel} ${photo.referenceLabel} - ${media.label}`,
		handle: canonicalHandleFor(photo, medium),
		description: `${media.description}<p>Collection: ${collection}.${collectionPosition}</p><p>Artwork reference: ${photo.printId}.${position}</p>`,
		tags: [
			photo.printId,
			`photo-id:${photo.printId}`,
			`series-${photo.series}`,
			`album-${photo.albumId || photo.series}`,
			`format-${medium}`,
			catalogVersionTag,
			"claire-thomas",
			"fine-art-photography",
			"wall-art",
		],
		productType: media.productType,
		vendor: "Claire Thomas",
	};
};

const createPayload = (template, photo, medium, visible = false) => {
	const media = MEDIA[medium];
	const { handle: _handle, ...metadata } = productMetadata(photo, medium);
	const variants = selectTemplateVariants(template, photo, medium).map((variant, position) => {
		assert.equal(variant.imagePlaceholders.length, 1, `${variant.title} must contain exactly one image placeholder`);
		return {
			templateVariantId: variant.id,
			position,
			imagePlaceholders: [
				{
					name: variant.imagePlaceholders[0].name,
					fileUrl: photo.fileUrl,
					fitMethod: media.fitMethod,
				},
			],
		};
	});

	return {
		templateId: template.id,
		...metadata,
		isVisibleInTheOnlineStore: visible,
		salesChannels: ["web"],
		variants,
	};
};

const waitForProducts = async (
	storeId,
	queuedJobs,
	state,
	timeoutMs = 3 * 60 * 60 * 1000,
	pollIntervalMs = 30 * 1000,
	stallTimeoutMs = 60 * 60 * 1000,
) => {
	const pending = new Map(queuedJobs.map((job) => [state.products[job.key].id, job]));
	const completedProducts = [];
	const deadline = Date.now() + timeoutMs;
	let lastProgressAt = Date.now();
	let previousPendingSize = pending.size;
	while (
		pending.size &&
		Date.now() < deadline &&
		Date.now() - lastProgressAt < stallTimeoutMs
	) {
		const errors = [];

		for (const [productId, job] of pending) {
			let product;
			try {
				product = await apiRequest(`/stores/${storeId}/products/${productId}`);
			} catch (error) {
				if (error.status === 404) continue;
				throw error;
			}
			state.products[job.key] = {
				...state.products[job.key],
				externalId: product.externalId,
				status: product.status,
				updatedAt: new Date().toISOString(),
			};
			if (product.status === "active") {
				state.products[job.key].activeAt = new Date().toISOString();
				completedProducts.push(product);
				pending.delete(productId);
			} else if (product.status === "publishing_error") {
				errors.push(`${product.title}: ${product.publishingErrorCode ?? "unknown error"}`);
				pending.delete(productId);
			}
		}
		writeState(state);
		console.log(`Publishing: ${queuedJobs.length - pending.size}/${queuedJobs.length} complete.`);
		if (errors.length) throw new Error(`Publishing failed:\n${errors.join("\n")}`);
		if (pending.size < previousPendingSize) {
			lastProgressAt = Date.now();
			previousPendingSize = pending.size;
		}
		if (pending.size) await new Promise((resolvePromise) => setTimeout(resolvePromise, pollIntervalMs));
	}
	if (pending.size) {
		const reason = Date.now() >= deadline ? "Timed out" : "Publishing stalled";
		throw new Error(`${reason} waiting for ${pending.size} Gelato products`);
	}
	return completedProducts;
};

const expectedProductKeys = (photos, selectedMedia = Object.keys(MEDIA)) =>
	new Set(photos.flatMap((photo) => selectedMedia.map((medium) => productKey(photo.printId, medium))));

const managedProductKey = (product) => {
	const tags = Array.isArray(product.tags) ? product.tags : [];
	const explicitPrintId = tags.find((tag) => typeof tag === "string" && tag.startsWith("photo-id:"));
	const printId = explicitPrintId
		? explicitPrintId.slice("photo-id:".length)
		: tags.find((tag) => typeof tag === "string" &&
		!tag.startsWith("series-") &&
		!tag.startsWith("format-") &&
		!tag.startsWith("album-") &&
		!tag.startsWith("catalog-") &&
		!tag.startsWith("photo-id:") &&
		tag !== "claire-thomas" &&
		tag !== "fine-art-photography" &&
		tag !== "wall-art",
	);
	const formatTag = tags.find((tag) => tag.startsWith("format-"));
	if (!tags.includes("claire-thomas") || !printId || !formatTag) return null;
	const medium = formatTag.slice("format-".length);
	return MEDIA[medium] ? productKey(printId, medium) : null;
};

const isArchivedProduct = (product) =>
	["archived", "deleted"].includes(String(product.status).toLowerCase()) ||
	["archived", "deleted", "missing"].includes(String(product.shopifyStatus).toLowerCase());

const isReadyActiveProduct = (product) =>
	product.status === "active" &&
	Boolean(productShopifyId(product)) &&
	(!product.shopifyStatus || String(product.shopifyStatus).toLowerCase() === "active");

const sameStringArray = (left, right) =>
	JSON.stringify([...(left || [])].map(String).sort()) === JSON.stringify([...(right || [])].map(String).sort());

const productNeedsMetadataUpdate = (product, desired) =>
	product.title !== desired.title ||
	(product.description ?? product.descriptionHtml) !== desired.description ||
	product.handle !== desired.handle ||
	!sameStringArray(product.tags, desired.tags);

const productShopifyId = (product) => {
	const externalId = product?.externalId;
	if (!externalId) return null;
	return String(externalId).startsWith("gid://shopify/Product/")
		? String(externalId)
		: `gid://shopify/Product/${externalId}`;
};

const archivedProductHandle = (product) => {
	const source = String(product.externalId || product.id || "product");
	return `archived-${source.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`.slice(0, 255);
};

const buildShopifyProductUpdate = (product, desired = null, status = null, { archive = false } = {}) => {
	const input = { id: productShopifyId(product) };
	if (archive) {
		input.handle = archivedProductHandle(product);
		input.redirectNewHandle = false;
	} else if (desired) {
		input.title = desired.title;
		input.descriptionHtml = desired.description;
		input.tags = desired.tags;
		input.handle = desired.handle;
		input.redirectNewHandle = false;
	}
	if (status) input.status = status.toUpperCase();
	return input;
};

const buildReconcilePlan = (
	photos,
	state,
	existingProducts,
	selectedMedia = Object.keys(MEDIA),
	{ includeStale = true } = {},
) => {
	const selectedMediaSet = new Set(selectedMedia);
	const expected = new Map(
		photos.flatMap((photo) => selectedMedia.map((medium) => [productKey(photo.printId, medium), { photo, medium }])),
	);
	const groups = new Map([...expected.keys()].map((key) => [key, []]));
	const staleProducts = [];
	for (const product of existingProducts) {
		const key = managedProductKey(product);
		if (!key) continue;
		const { medium } = splitProductKey(key);
		if (expected.has(key)) groups.get(key).push(product);
		else if (includeStale && selectedMediaSet.has(medium)) staleProducts.push({ key, product, reason: "not-in-cms" });
	}

	const plan = {
		creates: [],
		updates: [],
		unarchives: [],
		pending: [],
		archives: [],
		blocked: [],
		unchanged: [],
	};
	const addArchive = (key, product, reason) => {
		if (isArchivedProduct(product)) return;
		if (plan.archives.some((entry) => entry.product.id === product.id) || plan.blocked.some((entry) => entry.productId === product.id)) return;
		if (!productShopifyId(product)) {
			plan.blocked.push({ action: "archive", key, productId: product.id, reason: "missing-shopify-external-id" });
			return;
		}
		plan.archives.push({ key, product, reason, archivedHandle: archivedProductHandle(product) });
	};

	for (const [key, target] of expected) {
		const matches = groups.get(key);
		const current = matches.filter((product) => product.tags?.includes(catalogVersionTag));
		const canonical =
			current.find(isReadyActiveProduct) ??
			current.find((product) => product.status === "active") ??
			current[0];
		const desired = productMetadata(target.photo, target.medium);
		const recorded = state.products?.[key] || {};
		const recordedMetadata = recorded.metadataSynced ? recorded : {};
		const observed = canonical
			? {
				...canonical,
				title: canonical.shopifyTitle ?? canonical.title,
				handle: canonical.shopifyHandle ?? canonical.handle ?? recordedMetadata.handle,
				description:
					canonical.shopifyDescription ??
					canonical.description ??
					recordedMetadata.description,
				tags: canonical.shopifyTags ?? canonical.tags ?? recordedMetadata.tags,
			}
			: null;
		if (!canonical) {
			const replacement = matches.find((product) => product.status === "active") ?? matches[0];
			if (replacement) addArchive(key, replacement, "catalog-version-replacement");
			plan.creates.push({ key, photo: target.photo, medium: target.medium, replacementId: replacement?.id ?? null });
		} else if (isArchivedProduct(canonical)) {
			if (!productShopifyId(canonical)) {
				plan.blocked.push({ action: "unarchive", key, productId: canonical.id, reason: "missing-shopify-external-id" });
			} else {
				plan.unarchives.push({ key, product: canonical, desired });
			}
		} else if (
			["created", "publishing", "publishing_queued"].includes(canonical.status) ||
			(canonical.status === "active" && !productShopifyId(canonical))
		) {
			plan.pending.push({ key, product: canonical, desired });
		} else if (canonical.status !== "active") {
			plan.blocked.push({ action: "inspect", key, productId: canonical.id, reason: `unsupported-status:${canonical.status}` });
		} else if (productNeedsMetadataUpdate(observed, desired)) {
			if (!productShopifyId(canonical)) {
				plan.blocked.push({ action: "update", key, productId: canonical.id, reason: "missing-shopify-external-id" });
			} else {
				plan.updates.push({ key, product: canonical, desired });
			}
		} else {
			plan.unchanged.push(key);
		}
		for (const duplicate of matches) {
			if (duplicate.id !== canonical?.id) addArchive(key, duplicate, "duplicate-managed-product");
		}
	}
	for (const stale of staleProducts) addArchive(stale.key, stale.product, stale.reason);

	for (const [key, record] of Object.entries(state.products || {})) {
		if (includeStale && !expected.has(key)) {
			const { medium } = splitProductKey(key);
			if (selectedMediaSet.has(medium) && !existingProducts.some((product) => product.id === record?.id)) {
				plan.unchanged.push(`${key}:state-only`);
			}
		}
	}
	return plan;
};

const shopifyGraphql = async (query, variables) => {
	const domain = normalizedShopifyDomain();
	const token = await getShopifyAdminAccessToken();
	const version = process.env.SHOPIFY_API_VERSION || DEFAULT_SHOPIFY_API_VERSION;
	const response = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Shopify-Access-Token": token,
		},
		body: JSON.stringify({ query, variables }),
		signal: AbortSignal.timeout(60 * 1000),
	});
	const body = await response.json();
	if (!response.ok || body.errors?.length) {
		throw new Error(`Shopify GraphQL ${response.status}: ${JSON.stringify(body.errors || body)}`);
	}
	return body.data;
};

const mergeShopifyProductState = (products, shopifyProducts) => {
	const byId = new Map(shopifyProducts.filter(Boolean).map((product) => [product.id, product]));
	return products.map((product) => {
		const shopifyId = productShopifyId(product);
		if (!shopifyId) return product;
		const shopifyProduct = byId.get(shopifyId);
		if (!shopifyProduct) {
			return {
				...product,
				shopifyStatus: "missing",
			};
		}
		return {
			...product,
			shopifyStatus: String(shopifyProduct.status || "").toLowerCase(),
			shopifyTitle: shopifyProduct.title,
			shopifyHandle: shopifyProduct.handle,
			shopifyDescription: shopifyProduct.descriptionHtml,
			shopifyTags: shopifyProduct.tags,
		};
	});
};

const enrichProductsWithShopifyState = async (products) => {
	const ids = [...new Set(products.map(productShopifyId).filter(Boolean))];
	if (!ids.length) return products;
	const shopifyProducts = [];
	for (let index = 0; index < ids.length; index += 100) {
		const data = await shopifyGraphql(
			`query CatalogProductState($ids: [ID!]!) {
				nodes(ids: $ids) {
					... on Product {
						id
						status
						title
						handle
						descriptionHtml
						tags
					}
				}
			}`,
			{ ids: ids.slice(index, index + 100) },
		);
		shopifyProducts.push(...data.nodes.filter(Boolean));
	}
	return mergeShopifyProductState(products, shopifyProducts);
};

const normalizedShopifyDomain = () => (process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_SHOP_DOMAIN || "")
	.replace(/^https?:\/\//, "")
	.replace(/\/$/, "");

const requestShopifyClientCredentialsToken = async ({
	domain = normalizedShopifyDomain(),
	clientId = process.env.SHOPIFY_CLIENT_ID,
	clientSecret = process.env.SHOPIFY_CLIENT_SECRET,
	fetchImpl = fetch,
} = {}) => {
	assert(domain && clientId && clientSecret, "Shopify client credentials require store domain, client ID, and client secret");
	const response = await fetchImpl(`https://${domain}/admin/oauth/access_token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "client_credentials",
			client_id: clientId,
			client_secret: clientSecret,
		}),
		signal: AbortSignal.timeout(30 * 1000),
	});
	if (!response.ok) throw new Error(`Shopify client-credentials request failed with HTTP ${response.status}`);
	const body = await response.json();
	assert(body?.access_token, "Shopify client-credentials response did not include an access token");
	return body.access_token;
};

const getShopifyAdminAccessToken = async () => {
	if (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) return process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
	if (!shopifyAccessTokenCache) {
		shopifyAccessTokenCache = await requestShopifyClientCredentialsToken();
	}
	return shopifyAccessTokenCache;
};

const updateShopifyProduct = async (product, desired, status, options = {}) => {
	const id = productShopifyId(product);
	assert(id, `Product ${product.id} has no Shopify externalId`);
	const data = await shopifyGraphql(
		`mutation ReconcileProduct($product: ProductUpdateInput!) {
			productUpdate(product: $product) {
				product { id title status }
				userErrors { field message }
			}
		}`,
		{
			product: buildShopifyProductUpdate(product, desired, status, options),
		},
	);
	const result = data.productUpdate;
	if (result.userErrors?.length) {
		throw new Error(`Shopify product update failed for ${id}: ${JSON.stringify(result.userErrors)}`);
	}
	return result.product;
};

const applyReconcilePlan = async ({ plan, state, storeId, templates, visible = true }) => {
	assert(!plan.blocked.length, `Reconcile has ${plan.blocked.length} unmappable product actions; inspect the dry-run plan first`);
	for (const action of plan.archives) {
		await updateShopifyProduct(action.product, null, "ARCHIVED", { archive: true });
		const record = state.products[action.key];
		if (record?.id === action.product.id) {
			state.products[action.key] = {
				...record,
				status: "archived",
				archivedAt: new Date().toISOString(),
			};
			writeState(state);
		}
	}
	for (const action of [...plan.updates, ...plan.unarchives]) {
		const status = plan.unarchives.includes(action) ? "ACTIVE" : null;
		await updateShopifyProduct(action.product, action.desired, status);
		state.products[action.key] = {
			...(state.products[action.key] || {}),
			id: action.product.id,
			externalId: action.product.externalId,
			status: "active",
			catalogVersion: CATALOG_VERSION,
			handle: action.desired.handle,
			description: action.desired.description,
			tags: action.desired.tags,
			metadataSynced: true,
			metadataUpdatedAt: new Date().toISOString(),
		};
		writeState(state);
	}

	const jobs = [];
	const createdActions = new Map();
	const pendingActions = new Map();
	const createdWithShopifyMapping = new Set();
	for (const action of plan.pending) {
		state.products[action.key] = {
			...(state.products[action.key] || {}),
			id: action.product.id,
			externalId: action.product.externalId,
			status: action.product.status,
			catalogVersion: CATALOG_VERSION,
			handle: action.desired.handle,
			description: action.desired.description,
			tags: action.desired.tags,
		};
		writeState(state);
		jobs.push({ key: action.key });
		pendingActions.set(action.key, action);
	}
	for (const action of plan.creates) {
		const key = action.key;
		const payload = createPayload(templates[action.medium], action.photo, action.medium, visible);
		const createdProduct = await apiRequest(`/stores/${storeId}/products:create-from-template`, {
			method: "POST",
			body: JSON.stringify(payload),
		});
		state.products[key] = {
			id: createdProduct.id,
			externalId: createdProduct.externalId,
			status: createdProduct.status,
			visible,
			catalogVersion: CATALOG_VERSION,
			handle: productMetadata(action.photo, action.medium).handle,
			description: productMetadata(action.photo, action.medium).description,
			tags: productMetadata(action.photo, action.medium).tags,
			createdAt: new Date().toISOString(),
		};
		writeState(state);
		createdActions.set(key, action);
		if (productShopifyId(createdProduct)) {
			await updateShopifyProduct(createdProduct, productMetadata(action.photo, action.medium), "ACTIVE");
			state.products[key].metadataSynced = true;
			writeState(state);
			createdWithShopifyMapping.add(key);
		}
		jobs.push({ key });
	}
	if (jobs.length) {
		await waitForProducts(storeId, jobs, state);
		for (const job of jobs) {
			if (createdWithShopifyMapping.has(job.key)) continue;
			const action = createdActions.get(job.key) ?? pendingActions.get(job.key);
			if (!action) continue;
			const product = await apiRequest(`/stores/${storeId}/products/${state.products[job.key].id}`);
			const desired = action.desired ?? productMetadata(action.photo, action.medium);
			await updateShopifyProduct(product, desired, "ACTIVE");
			state.products[job.key].metadataSynced = true;
			state.products[job.key].handle = desired.handle;
			state.products[job.key].description = desired.description;
			state.products[job.key].tags = desired.tags;
			state.products[job.key].metadataUpdatedAt = new Date().toISOString();
			writeState(state);
		}
	}
	return {
		archived: plan.archives.length,
		updated: plan.updates.length,
		unarchived: plan.unarchives.length,
		created: plan.creates.length,
	};
};

const buildCatalogAudit = (photos, existingProducts, selectedMedia = Object.keys(MEDIA)) => {
	const expected = expectedProductKeys(photos, selectedMedia);
	const groups = new Map([...expected].map((key) => [key, []]));
	const unmanagedProducts = [];
	const staleProducts = [];
	const auditableProducts = existingProducts.filter((product) => !isArchivedProduct(product));

	for (const product of auditableProducts) {
		const key = managedProductKey(product);
		if (!key) {
			unmanagedProducts.push(product);
		} else if (!expected.has(key)) {
			staleProducts.push(product);
		} else {
			groups.get(key).push(product);
		}
	}

	const missingActiveKeys = [];
	const duplicateActiveKeys = [];
	const nonActiveProducts = [];
	for (const [key, products] of groups) {
		const active = products.filter(isReadyActiveProduct);
		if (!active.length) missingActiveKeys.push(key);
		if (active.length > 1) duplicateActiveKeys.push({ key, productIds: active.map((product) => product.id) });
		nonActiveProducts.push(...products.filter((product) => !isReadyActiveProduct(product)));
	}

	return {
		expectedKeys: expected.size,
		uniqueRemoteProducts: new Set(auditableProducts.map((product) => product.id)).size,
		activeExpectedProducts: [...groups.values()].flat().filter(isReadyActiveProduct).length,
		missingActiveKeys,
		duplicateActiveKeys,
		nonActiveProducts,
		staleProducts,
		unmanagedProducts,
		clean:
			missingActiveKeys.length === 0 &&
			duplicateActiveKeys.length === 0 &&
			nonActiveProducts.length === 0 &&
			staleProducts.length === 0 &&
			unmanagedProducts.length === 0,
	};
};

const buildCreatedRepairPlan = (photos, selectedMedia, existingProducts) => {
	const expected = expectedProductKeys(photos, selectedMedia);
	const activeKeys = new Set(
		existingProducts
			.filter((product) => product.status === "active")
			.map(managedProductKey)
			.filter((key) => key && expected.has(key)),
	);
	const createdProducts = existingProducts
		.map((product) => ({ product, key: managedProductKey(product) }))
		.filter(
			({ product, key }) =>
				["created", "publishing", "publishing_queued"].includes(product.status) &&
				key &&
				expected.has(key),
		);
	const unresolvedKeys = [...expected].filter((key) => !activeKeys.has(key));
	const targetedPhotoIds = new Set([
		...createdProducts.map(({ key }) => splitProductKey(key).printId),
		...unresolvedKeys.map((key) => splitProductKey(key).printId),
	]);

	return {
		activeKeys,
		createdProducts,
		unresolvedKeys,
		photoIds: photos.map((photo) => photo.printId).filter((printId) => targetedPhotoIds.has(printId)),
	};
};

const repairCreatedProducts = async ({
	storeId,
	state,
	photos,
	selectedMedia,
	templates,
	existingProducts,
	batchPhotoCount,
}) => {
	let products = existingProducts;
	let deletedCount = 0;
	let createdCount = 0;
	let batchNumber = 0;
	let queuedCleanupCount = 0;

	const expected = expectedProductKeys(photos, selectedMedia);
	const now = Date.now();
	const strandedQueuedProducts = products
		.map((product) => ({ product, key: managedProductKey(product) }))
		.filter(
			({ product, key }) =>
				["publishing", "publishing_queued"].includes(product.status) &&
				key &&
				expected.has(key) &&
				(
					state.products[key]?.repairBatch ||
					Number.isFinite(Date.parse(product.createdAt)) &&
						now - Date.parse(product.createdAt) >= 30 * 60 * 1000
				),
		);
	if (strandedQueuedProducts.length) {
		console.log(`Clearing ${strandedQueuedProducts.length} stranded queued products before repair.`);
		for (const { product, key } of strandedQueuedProducts) {
			await apiRequest(`/stores/${storeId}/products/${product.id}`, { method: "DELETE" });
			queuedCleanupCount += 1;
			if (state.products[key]?.id === product.id) {
				state.products[key] = {
					...state.products[key],
					id: null,
					externalId: null,
					status: "deleted_for_repair",
					deletedForRepairAt: new Date().toISOString(),
				};
			}
			writeState(state);
		}
		const queuedIds = new Set(strandedQueuedProducts.map(({ product }) => product.id));
		products = products.filter((product) => !queuedIds.has(product.id));
	}

	for (;;) {
		const plan = buildCreatedRepairPlan(photos, selectedMedia, products);
		if (!plan.createdProducts.length && !plan.unresolvedKeys.length) break;
		assert(plan.photoIds.length, "Repair plan has unresolved products but no photographs");

		const batchPhotoIds = plan.photoIds.slice(0, batchPhotoCount);
		const batchPhotoIdSet = new Set(batchPhotoIds);
		const productsToDelete = plan.createdProducts.filter(({ key }) =>
			batchPhotoIdSet.has(splitProductKey(key).printId),
		);
		batchNumber += 1;
		console.log(
			`Repair batch ${batchNumber}: ${batchPhotoIds.length} photos, ${productsToDelete.length} failed drafts.`,
		);

		for (const { product, key } of productsToDelete) {
			await apiRequest(`/stores/${storeId}/products/${product.id}`, { method: "DELETE" });
			deletedCount += 1;
			if (state.products[key]?.id === product.id) {
				state.products[key] = {
					...state.products[key],
					id: null,
					externalId: null,
					status: "deleted_for_repair",
					deletedForRepairAt: new Date().toISOString(),
				};
			}
			writeState(state);
		}
		const deletedIds = new Set(productsToDelete.map(({ product }) => product.id));
		products = products.filter((product) => !deletedIds.has(product.id));

		const activeKeys = new Set(
			products
				.filter((product) => product.status === "active")
				.map(managedProductKey)
				.filter(Boolean),
		);
		const jobs = [];
		for (const photo of photos) {
			if (!batchPhotoIdSet.has(photo.printId)) continue;
			for (const medium of selectedMedia) {
				const key = productKey(photo.printId, medium);
				if (activeKeys.has(key)) continue;
				const payload = createPayload(templates[medium], photo, medium, true);
				const createdProduct = await apiRequest(`/stores/${storeId}/products:create-from-template`, {
					method: "POST",
					body: JSON.stringify(payload),
				});
				state.products[key] = {
					id: createdProduct.id,
					externalId: createdProduct.externalId,
					status: createdProduct.status,
					visible: true,
					createdAt: new Date().toISOString(),
					repairBatch: batchNumber,
				};
				writeState(state);
				jobs.push({ key });
				createdCount += 1;
			}
		}

		if (jobs.length) {
			const completedProducts = await waitForProducts(storeId, jobs, state);
			products = mergeProductsById(products, completedProducts);
		}
		const refreshedPlan = buildCreatedRepairPlan(photos, selectedMedia, products);
		console.log(
			`Repair progress: deleted ${deletedCount}, regenerated ${createdCount}, unresolved ${refreshedPlan.unresolvedKeys.length}, failed drafts ${refreshedPlan.createdProducts.length}.`,
		);
	}

	return { products, deletedCount, createdCount, batches: batchNumber, queuedCleanupCount };
};

const findStaleProducts = (state, existingProducts, photos) => {
	const expected = expectedProductKeys(photos);
	const staleByKey = new Map();

	for (const [key, record] of Object.entries(state.products ?? {})) {
		if (!expected.has(key) && !isArchivedProduct(record)) staleByKey.set(key, { key, ...record, source: "state" });
	}

	for (const product of existingProducts) {
		const key = managedProductKey(product);
		if (!key || expected.has(key)) continue;
		if (isArchivedProduct(product)) continue;
		staleByKey.set(key, {
			key,
			id: product.id,
			externalId: product.externalId,
			status: product.status,
			...(product.shopifyStatus ? { shopifyStatus: product.shopifyStatus } : {}),
			title: product.title,
			source: staleByKey.has(key) ? "state+gelato" : "gelato",
		});
	}

	return [...staleByKey.values()].sort((left, right) => left.key.localeCompare(right.key));
};

const writeStaleReport = (staleProducts) => {
	writeFileSync(
		STALE_FILE,
		`${JSON.stringify({ generatedAt: new Date().toISOString(), count: staleProducts.length, products: staleProducts }, null, 2)}\n`,
	);
};

const run = async () => {
	loadEnv(ENV_FILE);
	loadEnv(SHOPIFY_ENV_FILE);
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		printHelp();
		return;
	}

	const content = await loadPortfolioContent({ file: args.contentFile, url: args.contentUrl });
	const manifest = buildManifest(content);
	writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);

	const orientationCounts = manifest.photos.reduce(
		(counts, photo) => ({ ...counts, [photo.orientation]: counts[photo.orientation] + 1 }),
		{ horizontal: 0, vertical: 0 },
	);
	const aspectCounts = manifest.photos.reduce(
		(counts, photo) => ({ ...counts, [photo.aspectGroup]: counts[photo.aspectGroup] + 1 }),
		{ square: 0, classic: 0, wide: 0 },
	);

	console.log(
		JSON.stringify(
			{
				mode: args.reconcile ? (args.execute ? "reconcile-execute" : "reconcile-dry-run") : args.execute ? "execute" : args.validateTemplates ? "validate-templates" : "dry-run",
				photos: manifest.photoCount,
				products: manifest.productCount,
				cmsRevision: content.revision ?? null,
				cmsUpdatedAt: content.updatedAt ?? null,
				orientationCounts,
				aspectCounts,
				manifest: MANIFEST_FILE,
			},
			null,
			2,
		),
	);

	if (!args.execute && !args.validateTemplates && !args.audit && !args.reconcile) return;
	assert(process.env.GELATO_API_KEY, "GELATO_API_KEY is required");

	const selectedPhotos = manifest.photos.filter((photo) => !args.only || args.only.has(photo.printId));
	assert(selectedPhotos.length, "No photographs matched --only");

	const storeId = process.env.GELATO_STORE_ID || DEFAULT_STORE_ID;
	const state = readState();
	const existingProducts = await enrichProductsWithShopifyState(await listExistingProducts(
		storeId,
		Object.values(state.products ?? {}).map((record) => record?.id),
	));
	const existingStatusCounts = Object.fromEntries(
		Object.entries(
			existingProducts.reduce((counts, product) => {
				counts[product.status] = (counts[product.status] ?? 0) + 1;
				return counts;
			}, {}),
		).sort(([left], [right]) => left.localeCompare(right)),
	);
	console.log(`Gelato store products: ${existingProducts.length}. Statuses: ${JSON.stringify(existingStatusCounts)}`);
	const staleProducts = findStaleProducts(state, existingProducts, manifest.photos);
	writeStaleReport(staleProducts);
	console.log(`Stale managed products: ${staleProducts.length}. Report: ${STALE_FILE}`);
	if (args.reconcile) {
		const selectedPhotos = manifest.photos.filter((photo) => !args.only || args.only.has(photo.printId));
		assert(selectedPhotos.length, "No photographs matched --only");
		const plan = buildReconcilePlan(
			selectedPhotos,
			state,
			existingProducts,
			args.media,
			{ includeStale: !args.only },
		);
		const planReport = {
			generatedAt: new Date().toISOString(),
			cmsRevision: content.revision ?? null,
			cmsUpdatedAt: content.updatedAt ?? null,
			catalogVersion: CATALOG_VERSION,
			photoCount: selectedPhotos.length,
			...plan,
		};
		writeFileSync(RECONCILE_PLAN_FILE, `${JSON.stringify(planReport, null, 2)}\n`);
		console.log(JSON.stringify({
			creates: plan.creates.length,
			updates: plan.updates.length,
			unarchives: plan.unarchives.length,
			pending: plan.pending.length,
			archives: plan.archives.length,
			blocked: plan.blocked.length,
			unchanged: plan.unchanged.length,
			plan: RECONCILE_PLAN_FILE,
		}, null, 2));
		if (!args.execute) return;
		assert(!plan.blocked.length, `Reconcile blocked by ${plan.blocked.length} product mappings; dry-run plan: ${RECONCILE_PLAN_FILE}`);
		let templates = {};
		if (plan.creates.length) {
			templates = await loadTemplates(args.media);
			validateTemplates(templates, selectedPhotos, args.media);
		}
		const result = await applyReconcilePlan({
			plan,
			state,
			storeId,
			templates,
			visible: true,
		});
		console.log(`Reconcile complete: ${result.created} created, ${result.updated} updated, ${result.unarchived} unarchived, ${result.archived} archived.`);
		return;
	}
	if (args.audit) {
		const catalogAudit = buildCatalogAudit(manifest.photos, existingProducts);
		writeFileSync(
			CATALOG_AUDIT_FILE,
			`${JSON.stringify(
				{
					generatedAt: new Date().toISOString(),
					...catalogAudit,
				},
				null,
				2,
			)}\n`,
		);
		console.log(
			JSON.stringify(
				{
					clean: catalogAudit.clean,
					expectedKeys: catalogAudit.expectedKeys,
					uniqueRemoteProducts: catalogAudit.uniqueRemoteProducts,
					activeExpectedProducts: catalogAudit.activeExpectedProducts,
					missingActiveKeys: catalogAudit.missingActiveKeys.length,
					duplicateActiveKeys: catalogAudit.duplicateActiveKeys.length,
					nonActiveProducts: catalogAudit.nonActiveProducts.length,
					staleProducts: catalogAudit.staleProducts.length,
					unmanagedProducts: catalogAudit.unmanagedProducts.length,
					report: CATALOG_AUDIT_FILE,
				},
				null,
				2,
			),
		);
		if (args.strictAudit) assert(catalogAudit.clean, "Gelato catalog strict audit failed");
	}
	if (args.audit && !args.execute && !args.validateTemplates) return;

	const templates = await loadTemplates(args.media);
	validateTemplates(templates, selectedPhotos, args.media);
	console.log(`Validated ${args.media.length} templates for ${selectedPhotos.length} photographs.`);
	if (!args.execute) return;
	if (args.repairCreated) {
		const result = await repairCreatedProducts({
			storeId,
			state,
			photos: selectedPhotos,
			selectedMedia: args.media,
			templates,
			existingProducts,
			batchPhotoCount: args.repairBatchPhotos,
		});
		console.log(
			`Repair complete: ${result.deletedCount} failed drafts deleted, ${result.queuedCleanupCount} stranded queued products cleared, ${result.createdCount} products regenerated in ${result.batches} batches.`,
		);
		return;
	}

	const jobs = [];
	const previouslyQueuedJobs = [];
	for (const photo of selectedPhotos) {
		for (const medium of args.media) {
			const key = productKey(photo.printId, medium);
			const recorded = state.products[key];
			const existing = selectExistingProduct(existingProducts, photo, medium, recorded?.id);
			if (existing) {
				state.products[key] = {
					...recorded,
					id: existing.id,
					externalId: existing.externalId,
					status: existing.status,
					recoveredAt: new Date().toISOString(),
				};
				if (existing.status !== "active") previouslyQueuedJobs.push({ key });
				continue;
			}
			if (jobs.length < args.limit) jobs.push({ key, photo, medium });
		}
	}
	writeState(state);

	let nextJob = 0;
	let queued = 0;
	const worker = async () => {
		while (nextJob < jobs.length) {
			const job = jobs[nextJob++];
			const payload = createPayload(templates[job.medium], job.photo, job.medium, args.visible);
			const createdProduct = await apiRequest(`/stores/${storeId}/products:create-from-template`, {
				method: "POST",
				body: JSON.stringify(payload),
			});
			state.products[job.key] = {
				id: createdProduct.id,
				externalId: createdProduct.externalId,
				status: createdProduct.status,
				visible: args.visible,
				createdAt: new Date().toISOString(),
			};
			writeState(state);
			queued += 1;
			if (queued === jobs.length || queued % 25 === 0) console.log(`Queued ${queued}/${jobs.length} products.`);
		}
	};

	await Promise.all(Array.from({ length: Math.min(args.concurrency, jobs.length) }, () => worker()));
	const productsToMonitor = [...previouslyQueuedJobs, ...jobs];
	if (productsToMonitor.length) await waitForProducts(storeId, productsToMonitor, state);
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	run().catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
}

export {
	aspectGroupFor,
	buildManifest,
	buildReconcilePlan,
	buildShopifyProductUpdate,
	buildCreatedRepairPlan,
	buildCatalogAudit,
	cloudinaryUrl,
	canonicalHandleFor,
	canonicalFineArtUrlFor,
	catalogVersionTag,
	expectedProductKeys,
	findStaleProducts,
	managedProductKey,
	mergeProductsById,
	mergeShopifyProductState,
	normalizeVariant,
	orientationFor,
	productMetadata,
	archivedProductHandle,
	requestShopifyClientCredentialsToken,
	referenceLabelFor,
	selectExistingProduct,
	selectTemplateVariants,
};
