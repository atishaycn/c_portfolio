#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const ROOT = resolve(import.meta.dirname, "..");
const SITE_FILE = resolve(ROOT, "site.js");
const ENV_FILE = resolve(ROOT, ".env.gelato.local");
const MANIFEST_FILE = resolve(ROOT, ".gelato-product-manifest.json");
const STATE_FILE = resolve(ROOT, ".gelato-product-state.json");
const STALE_FILE = resolve(ROOT, ".gelato-stale-products.json");
const CATALOG_AUDIT_FILE = resolve(ROOT, ".gelato-catalog-audit.json");
const DEFAULT_STORE_ID = "6d03ca64-de8a-4764-bc46-8bd014a1b271";
const CLOUD_NAME = "dpmdkrggj";
const API_BASE = "https://ecommerce.gelatoapis.com/v1";

const MEDIA = {
	"fine-art": {
		env: "GELATO_FINE_ART_TEMPLATE_ID",
		label: "Fine Art Print",
		productType: "Fine Art Print",
		fitMethod: "meet",
		description:
			"<p>Fine art photography by Claire Thomas, printed on archival-quality 200 gsm enhanced matte paper.</p><p>Choose from three sizes selected to preserve the photograph's original composition. Printed on demand and shipped by Gelato.</p>",
	},
	framed: {
		env: "GELATO_FRAMED_TEMPLATE_ID",
		label: "Framed Fine Art Print",
		productType: "Framed Fine Art Print",
		fitMethod: "meet",
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

const parseArgs = (argv) => {
	const args = {
		execute: false,
		validateTemplates: false,
		audit: false,
		strictAudit: false,
		visible: false,
		repairCreated: false,
		repairBatchPhotos: 8,
		limit: Infinity,
		concurrency: 3,
		only: null,
		media: Object.keys(MEDIA),
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
		else if (arg === "--visible") args.visible = true;
		else if (arg === "--repair-created") args.repairCreated = true;
		else if (arg === "--repair-batch-photos") args.repairBatchPhotos = Number(argv[++index]);
		else if (arg === "--limit") args.limit = Number(argv[++index]);
		else if (arg === "--concurrency") args.concurrency = Number(argv[++index]);
		else if (arg === "--only") args.only = new Set(argv[++index].split(",").filter(Boolean));
		else if (arg === "--media") args.media = argv[++index].split(",").filter(Boolean);
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
	for (const medium of args.media) assert(MEDIA[medium], `Unknown medium: ${medium}`);
	return args;
};

const printHelp = () => {
	console.log(`Usage:
  node scripts/gelato-products.mjs
  node scripts/gelato-products.mjs --validate-templates
  node scripts/gelato-products.mjs --audit
  node scripts/gelato-products.mjs --strict-audit
  node scripts/gelato-products.mjs --execute [--visible] [--limit N] [--concurrency N] [--only id,id] [--media fine-art,framed,canvas]
  node scripts/gelato-products.mjs --execute --visible --repair-created [--repair-batch-photos N]

The default command reads the current portfolio and writes a dry-run manifest.
--audit reports managed products whose photograph is no longer in the portfolio.
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
	const source = readFileSync(SITE_FILE, "utf8");
	const marker = "\nconst portfolioLinks = [";
	const markerIndex = source.indexOf(marker);
	assert(markerIndex > 0, "Could not locate gallery data boundary in site.js");

	const context = {};
	const dataSource = `${source.slice(0, markerIndex)}
globalThis.__gelatoGalleryPages = galleryPages;`;
	vm.runInNewContext(dataSource, context, { filename: SITE_FILE });
	return context.__gelatoGalleryPages;
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

const buildManifest = () => {
	const photos = loadGalleryPages()
		.filter((page) => page.key !== "commissioned-work")
		.flatMap((page) =>
			page.items.map((item) => {
				assert(item.publicId, `Missing Cloudinary public ID for ${item.id}`);
				const printId = item.id;
				const aspectGroup = aspectGroupFor(item.width, item.height);
				return {
					printId,
					series: page.key,
					seriesLabel: SERIES_LABELS[page.key] ?? page.label,
					referenceLabel: referenceLabelFor(printId, page.key),
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
				signal: options.signal ?? AbortSignal.timeout(5 * 60 * 1000),
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
	const title = product.title.toLowerCase();
	const expectedTitle = `${photo.seriesLabel} ${photo.referenceLabel} - ${MEDIA[medium].label}`.toLowerCase();
	const tags = Array.isArray(product.tags) ? product.tags : [];
	return (
		(tags.includes(photo.printId) && tags.includes(`format-${medium}`)) ||
		title === expectedTitle
	);
};

const selectExistingProduct = (products, photo, medium, recordedId) => {
	const matches = products.filter((product) => isExistingMatch(product, photo, medium));
	return (
		matches.find((product) => product.id === recordedId && product.status === "active") ??
		matches.find((product) => product.status === "active") ??
		matches.find((product) => product.id === recordedId) ??
		matches[0]
	);
};

const createPayload = (template, photo, medium, visible = false) => {
	const media = MEDIA[medium];
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
		title: `${photo.seriesLabel} ${photo.referenceLabel} - ${media.label}`,
		description: `${media.description}<p>Artwork reference: ${photo.printId}</p>`,
		isVisibleInTheOnlineStore: visible,
		salesChannels: ["web"],
		tags: [
			photo.printId,
			`series-${photo.series}`,
			`format-${medium}`,
			"claire-thomas",
			"fine-art-photography",
			"wall-art",
		],
		productType: media.productType,
		vendor: "Claire Thomas",
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
	const printId = tags.find((tag) => !tag.startsWith("series-") && !tag.startsWith("format-") && tag !== "claire-thomas" && tag !== "fine-art-photography" && tag !== "wall-art");
	const formatTag = tags.find((tag) => tag.startsWith("format-"));
	if (!tags.includes("claire-thomas") || !printId || !formatTag) return null;
	const medium = formatTag.slice("format-".length);
	return MEDIA[medium] ? productKey(printId, medium) : null;
};

const buildCatalogAudit = (photos, existingProducts, selectedMedia = Object.keys(MEDIA)) => {
	const expected = expectedProductKeys(photos, selectedMedia);
	const groups = new Map([...expected].map((key) => [key, []]));
	const unmanagedProducts = [];
	const staleProducts = [];

	for (const product of existingProducts) {
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
		const active = products.filter((product) => product.status === "active");
		if (!active.length) missingActiveKeys.push(key);
		if (active.length > 1) duplicateActiveKeys.push({ key, productIds: active.map((product) => product.id) });
		nonActiveProducts.push(...products.filter((product) => product.status !== "active"));
	}

	return {
		expectedKeys: expected.size,
		uniqueRemoteProducts: new Set(existingProducts.map((product) => product.id)).size,
		activeExpectedProducts: [...groups.values()].flat().filter((product) => product.status === "active").length,
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
		if (!expected.has(key)) staleByKey.set(key, { key, ...record, source: "state" });
	}

	for (const product of existingProducts) {
		const key = managedProductKey(product);
		if (!key || expected.has(key)) continue;
		staleByKey.set(key, {
			key,
			id: product.id,
			externalId: product.externalId,
			status: product.status,
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
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		printHelp();
		return;
	}

	loadEnv(ENV_FILE);
	const manifest = buildManifest();
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
				mode: args.execute ? "execute" : args.validateTemplates ? "validate-templates" : "dry-run",
				photos: manifest.photoCount,
				products: manifest.productCount,
				orientationCounts,
				aspectCounts,
				manifest: MANIFEST_FILE,
			},
			null,
			2,
		),
	);

	if (!args.execute && !args.validateTemplates && !args.audit) return;
	assert(process.env.GELATO_API_KEY, "GELATO_API_KEY is required");

	const selectedPhotos = manifest.photos.filter((photo) => !args.only || args.only.has(photo.printId));
	assert(selectedPhotos.length, "No photographs matched --only");

	const storeId = process.env.GELATO_STORE_ID || DEFAULT_STORE_ID;
	const state = readState();
	const existingProducts = await listExistingProducts(
		storeId,
		Object.values(state.products ?? {}).map((record) => record?.id),
	);
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
	buildCreatedRepairPlan,
	buildCatalogAudit,
	cloudinaryUrl,
	expectedProductKeys,
	findStaleProducts,
	managedProductKey,
	mergeProductsById,
	normalizeVariant,
	orientationFor,
	referenceLabelFor,
	selectExistingProduct,
	selectTemplateVariants,
};
