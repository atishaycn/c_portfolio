import assert from "node:assert/strict";
import test from "node:test";

import {
	apiRequest,
	applyReconcilePlan,
	aspectGroupFor,
	buildManifest,
	buildReconcilePlan,
	buildShopifyProductUpdate,
	artworkMediaAltFor,
	artworkMediaInput,
	buildShopifyVariantMediaUpdates,
	buildCatalogAudit,
	buildCreatedRepairPlan,
	catalogVersionTag,
	canonicalFineArtUrlFor,
	canonicalHandleFor,
	cloudinaryUrl,
	expectedProductKeys,
	extraArtworkMediaIds,
	findStaleProducts,
	gelato429MaxAttempts,
	isStalledCreatedProduct,
	hasRetiredShopifyProduct,
	managedProductKey,
	managedIdentityTags,
	hasExactManagedIdentity,
	mergeProductsById,
	mergeShopifyProductState,
	normalizeVariant,
	orientationFor,
	productMetadata,
	productNeedsShopifyMediaRepair,
	isShopifyThrottled,
	shopifyGraphql,
	shopifyRetryDelayMs,
	updateShopifyProduct,
	recoverCanonicalHandleBlocker,
	runWithRetryableDeferral,
	publishingPollIntervalMs,
	reconcileCreateActions,
	reconcileCreateBatches,
	reconcileCreateBatchSize,
	safelyPublishShopifyProduct,
	shouldUploadArtworkMedia,
	waitForShopifyArtworkBindings,
	waitForShopifyArtworkMedia,
	waitForShopifyJob,
	waitForProducts,
	archivedProductHandle,
	referenceLabelFor,
	selectExistingProduct,
	selectTemplateVariants,
} from "./gelato-products.mjs";

const response = ({ status, body, contentType = "text/html", retryAfter = null }) => ({
	ok: status >= 200 && status < 300,
	status,
	text: async () => body,
	headers: {
		get: (name) => {
			if (name.toLowerCase() === "content-type") return contentType;
			if (name.toLowerCase() === "retry-after") return retryAfter;
			return null;
		},
	},
});

test("retries a non-JSON Gelato GET response and returns recovered JSON", async () => {
	const responses = [
		response({ status: 502, body: "<!DOCTYPE html><title>Bad gateway</title>" }),
		response({ status: 200, body: JSON.stringify({ status: "active" }), contentType: "application/json" }),
	];
	const delays = [];

	assert.deepEqual(
		await apiRequest("/stores/store-1/products/product-1", {}, {
			fetchImpl: async () => responses.shift(),
			sleepImpl: async (delay) => delays.push(delay),
		}),
		{ status: "active" },
	);
	assert.deepEqual(delays, [1000]);
});

test("marks exhausted non-JSON Gelato responses retryable without exposing HTML", async () => {
	let calls = 0;
	await assert.rejects(
		apiRequest("/stores/store-1/products/product-1", {}, {
			fetchImpl: async () => {
				calls += 1;
				return response({ status: 502, body: "<!DOCTYPE html><script>internal gateway details</script>" });
			},
			sleepImpl: async () => {},
		}),
		(error) =>
			error.retryableReconcile === true &&
			error.status === 502 &&
			/non-JSON/.test(error.message) &&
			!error.message.includes("internal gateway details"),
	);
	assert.equal(calls, 7);
});

test("defers a non-JSON successful Gelato POST without replaying it", async () => {
	let calls = 0;
	await assert.rejects(
		apiRequest("/stores/store-1/products:create-from-template", { method: "POST" }, {
			fetchImpl: async () => {
				calls += 1;
				return response({ status: 200, body: "<html>upstream proxy</html>" });
			},
			sleepImpl: async () => {},
		}),
		(error) => error.retryableReconcile === true && error.status === 200,
	);
	assert.equal(calls, 1);
});

test("retries an empty successful Gelato GET response", async () => {
	const responses = [
		response({ status: 200, body: "" }),
		response({ status: 200, body: JSON.stringify({ id: "product-1" }), contentType: "application/json" }),
	];
	assert.deepEqual(
		await apiRequest("/stores/store-1/products/product-1", {}, {
			fetchImpl: async () => responses.shift(),
			sleepImpl: async () => {},
		}),
		{ id: "product-1" },
	);
});

test("defers an empty successful Gelato POST without replaying it", async () => {
	let calls = 0;
	await assert.rejects(
		apiRequest("/stores/store-1/products:create-from-template", { method: "POST" }, {
			fetchImpl: async () => {
				calls += 1;
				return response({ status: 200, body: "" });
			},
			sleepImpl: async () => {},
		}),
		(error) => error.retryableReconcile === true && error.status === 200,
	);
	assert.equal(calls, 1);
});

test("keeps ordinary Gelato 4xx responses nonretryable", async () => {
	await assert.rejects(
		apiRequest("/stores/store-1/products/missing", {}, {
			fetchImpl: async () =>
				response({
					status: 400,
					body: JSON.stringify({ error: "bad request" }),
					contentType: "application/json",
				}),
			sleepImpl: async () => {},
		}),
		(error) => error.status === 400 && error.retryableReconcile !== true,
	);
});

test("deduplicates overlapping Gelato product pages by exact ID", () => {
	assert.deepEqual(
		mergeProductsById(
			[{ id: "one", status: "created" }, { id: "two", status: "created" }],
			[{ id: "two", status: "active" }, { id: "three", status: "active" }],
		),
		[
			{ id: "one", status: "created" },
			{ id: "two", status: "active" },
			{ id: "three", status: "active" },
		],
	);
});

test("waits for publishing products before requesting more Gelato products", () => {
	const creates = [{ key: "photo-2:fine-art" }];
	assert.deepEqual(reconcileCreateActions({ pending: [{ key: "photo-1:fine-art" }], creates }), []);
	assert.deepEqual(reconcileCreateActions({ pending: [], creates }), creates);
});

test("bounds each reconcile create batch", () => {
	const creates = Array.from({ length: 30 }, (_, index) => ({ key: `photo-${index}:fine-art` }));
	assert.deepEqual(reconcileCreateActions({ pending: [], creates }), creates);
	assert.deepEqual(reconcileCreateBatches({ pending: [], creates }, 3), [
		creates.slice(0, 3),
		creates.slice(3, 6),
		creates.slice(6, 9),
		creates.slice(9, 12),
		creates.slice(12, 15),
		creates.slice(15, 18),
		creates.slice(18, 21),
		creates.slice(21, 24),
		creates.slice(24, 27),
		creates.slice(27, 30),
	]);
	const previous = process.env.GELATO_RECONCILE_CREATE_BATCH;
	try {
		delete process.env.GELATO_RECONCILE_CREATE_BATCH;
		assert.equal(reconcileCreateBatchSize(), 24);
		process.env.GELATO_RECONCILE_CREATE_BATCH = "6";
		assert.equal(reconcileCreateBatchSize(), 6);
		process.env.GELATO_RECONCILE_CREATE_BATCH = "100";
		assert.equal(reconcileCreateBatchSize(), 24);
	} finally {
		if (previous === undefined) delete process.env.GELATO_RECONCILE_CREATE_BATCH;
		else process.env.GELATO_RECONCILE_CREATE_BATCH = previous;
	}
});

test("recovers only aged created products without Shopify mappings", () => {
	const now = Date.parse("2026-08-07T18:00:00Z");
	assert.equal(
		isStalledCreatedProduct(
			{ status: "created", externalId: null, createdAt: "2026-08-07T15:00:00Z" },
			now,
		),
		true,
	);
	assert.equal(
		isStalledCreatedProduct(
			{ status: "created", externalId: null, createdAt: "2026-08-07T17:00:01Z" },
			now,
		),
		false,
	);
	assert.equal(
		isStalledCreatedProduct(
			{ status: "created", externalId: "123", createdAt: "2026-08-07T15:00:00Z" },
			now,
		),
		false,
	);
});

test("drains pending products without creating more and requests a retryable continuation", async () => {
	const key = "photo-1:fine-art";
	const desired = { handle: "photo-1-fine-art-print", description: "Photo 1", tags: ["photo-id:photo-1"] };
	const photo = { printId: "photo-1", publicId: "photo/1" };
	const plan = {
		archives: [],
		blocked: [],
		creates: [{ key: "photo-2:fine-art", medium: "fine-art", photo: { printId: "photo-2" } }],
		pending: [{
			key,
			desired,
			photo,
			product: { id: "gelato-pending", externalId: null, status: "publishing" },
		}],
		recoveries: [],
		unarchives: [],
		updates: [],
	};
	const state = { products: {} };
	const apiCalls = [];
	const updates = [];
	const repairs = [];

	await assert.rejects(
		applyReconcilePlan({
			plan,
			state,
			storeId: "store-1",
			templates: {},
			apiRequestImpl: async (path, options = {}) => {
				apiCalls.push({ path, method: options.method || "GET" });
				assert.notEqual(options.method, "POST");
				return { id: "gelato-pending", externalId: "123", status: "active" };
			},
			updateShopifyProductImpl: async (product, metadata, status) => {
				updates.push({ product, metadata, status });
				return product;
			},
			safelyPublishShopifyProductImpl: async (product, metadata) => {
				repairs.push({ product, metadata });
				return product;
			},
			waitForProductsImpl: async (_storeId, jobs, currentState, { onActive }) => {
				assert.deepEqual(jobs, [{ key }]);
				const active = { id: "gelato-pending", externalId: "123", status: "active" };
				currentState.products[key].externalId = active.externalId;
				currentState.products[key].status = active.status;
				await onActive(active, jobs[0]);
				return [active];
			},
			writeStateImpl() {},
		}),
		(error) =>
			error.retryableReconcile === true &&
			error.message === "Deferred 1 new products until 1 publishing products finish",
	);
	assert.deepEqual(apiCalls, [{ path: "/stores/store-1/products/gelato-pending", method: "GET" }]);
	assert.equal(updates.some((update) => update.status === "DRAFT"), true);
	assert.equal(repairs.length, 1);
});

test("processes every create through sequential bounded publishing batches", async () => {
	const variants = ["8x12", "12x18", "16x24"].map((size) =>
		normalizeVariant({
			id: size,
			title: `${size} - Horizontal`,
			productUid: `product_hor_${size}-inch`,
			imagePlaceholders: [{ name: "Artwork" }],
		}),
	);
	const creates = Array.from({ length: 5 }, (_, index) => {
		const printId = `photo-${index + 1}`;
		return {
			key: `${printId}:fine-art`,
			medium: "fine-art",
			photo: {
				printId,
				series: "album",
				seriesLabel: "Album",
				seriesPath: "Album",
				referenceLabel: String(index + 1),
				publicId: `album/${index + 1}`,
				fileUrl: `https://example.com/${index + 1}.jpg`,
				orientation: "horizontal",
				aspectGroup: "wide",
				sizesByMedium: { "fine-art": ["8x12", "12x18", "16x24"] },
			},
		};
	});
	const plan = {
		archives: [],
		blocked: [],
		creates,
		pending: [],
		recoveries: [],
		unarchives: [],
		updates: [],
	};
	const state = { products: {} };
	const batchSizes = [];
	let postCount = 0;

	const result = await applyReconcilePlan({
		plan,
		state,
		storeId: "store-1",
		templates: { "fine-art": { id: "template-1", variants } },
		createBatchSize: 2,
		apiRequestImpl: async (path, options = {}) => {
			if (options.method === "POST") {
				postCount += 1;
				return { id: `gelato-${postCount}`, externalId: null, status: "created" };
			}
			const id = path.split("/").at(-1);
			return { id, externalId: `shopify-${id}`, status: "active" };
		},
		updateShopifyProductImpl: async (product) => product,
		safelyPublishShopifyProductImpl: async (product) => product,
		waitForProductsImpl: async (_storeId, jobs, currentState, { onActive }) => {
			batchSizes.push(jobs.length);
			for (const job of jobs) {
				const record = currentState.products[job.key];
				record.externalId = `shopify-${record.id}`;
				record.status = "active";
				await onActive({ id: record.id, externalId: record.externalId, status: "active" }, job);
			}
		},
		writeStateImpl() {},
	});

	assert.deepEqual(batchSizes, [2, 2, 1]);
	assert.equal(postCount, 5);
	assert.equal(result.created, 5);
	assert.equal(Object.values(state.products).every((record) => record.mediaSynced === true), true);
});

test("requires exactly one active managed product for every catalog key", () => {
	const photos = [{ printId: "photo-1" }];
	const cleanProducts = ["fine-art", "framed", "canvas"].map((medium) => ({
		id: medium,
		externalId: medium,
		status: "active",
		tags: ["photo-1", `format-${medium}`, "claire-thomas"],
	}));
	assert.equal(buildCatalogAudit(photos, cleanProducts).clean, true);

	const broken = buildCatalogAudit(photos, [
		...cleanProducts,
		{ ...cleanProducts[0], id: "fine-art-copy" },
		{
			id: "draft",
			status: "created",
			tags: ["photo-1", "format-canvas", "claire-thomas"],
		},
		{ id: "unmanaged", status: "created", tags: [] },
	]);
	assert.equal(broken.clean, false);
	assert.equal(broken.duplicateActiveKeys.length, 1);
	assert.equal(broken.nonActiveProducts.length, 1);
	assert.equal(broken.unmanagedProducts.length, 1);
});

test("uses Shopify status to ignore archived Gelato records on fresh runners", () => {
	const products = [
		{
			id: "old",
			externalId: "101",
			status: "active",
			tags: ["photo-1", "format-fine-art", "claire-thomas"],
		},
		{
			id: "current",
			externalId: "102",
			status: "active",
			tags: ["photo-1", "format-fine-art", "claire-thomas"],
		},
	];
	const enriched = mergeShopifyProductState(products, [
		{ id: "gid://shopify/Product/101", status: "ARCHIVED", handle: "archived-101", tags: products[0].tags },
		{ id: "gid://shopify/Product/102", status: "ACTIVE", handle: "photo-1-fine-art-print", tags: products[1].tags },
	]);
	assert.equal(enriched[0].shopifyStatus, "archived");
	assert.equal(enriched[1].shopifyStatus, "active");
	const audit = buildCatalogAudit([{ printId: "photo-1" }], enriched, ["fine-art"]);
	assert.equal(audit.clean, true);
	assert.equal(audit.uniqueRemoteProducts, 1);
	assert.equal(audit.activeExpectedProducts, 1);
});

test("Shopify active stale products still fail strict audit", () => {
	const products = [
		{
			id: "current",
			externalId: "102",
			status: "active",
			shopifyStatus: "active",
			tags: ["photo-1", "format-fine-art", "claire-thomas"],
		},
		{
			id: "stale",
			externalId: "103",
			status: "active",
			shopifyStatus: "active",
			tags: ["removed", "format-fine-art", "claire-thomas"],
		},
	];
	const audit = buildCatalogAudit([{ printId: "photo-1" }], products, ["fine-art"]);
	assert.equal(audit.clean, false);
	assert.equal(audit.staleProducts.map((product) => product.id).includes("stale"), true);
});

test("missing Shopify nodes are treated as inactive", () => {
	const products = [
		{
			id: "current",
			externalId: "101",
			status: "active",
			tags: ["photo-1", "format-fine-art", "claire-thomas"],
		},
	];
	const enriched = mergeShopifyProductState(products, []);
	assert.equal(enriched[0].shopifyStatus, "missing");
	const audit = buildCatalogAudit([{ printId: "photo-1" }], enriched, ["fine-art"]);
	assert.equal(audit.clean, false);
	assert.deepEqual(audit.missingActiveKeys, ["photo-1:fine-art"]);
});

test("builds a dynamic non-commissioned catalog", () => {
	const manifest = buildManifest();
	assert(manifest.photoCount > 0);
	assert.equal(manifest.productCount, manifest.photoCount * 3);
	assert.equal(new Set(manifest.photos.map((photo) => photo.printId)).size, manifest.photoCount);
	assert.equal(manifest.photos.some((photo) => photo.series === "commissioned-work"), false);
	assert.equal(manifest.photos.find((photo) => photo.printId === "the-natural-world-3")?.publicId, "3_asebdu");
	assert.equal(manifest.photos.find((photo) => photo.printId === "san-francisco-24")?.publicId, "place/california/san-francisco/24");
	assert.deepEqual(manifest.photos.find((photo) => photo.aspectGroup === "square")?.sizesByMedium, {
		"fine-art": ["10x10", "12x12", "16x16"],
		framed: ["12x12", "16x16", "20x20"],
		canvas: ["8x8", "12x12", "16x16"],
	});
	assert.equal(
		manifest.photos.find((photo) => photo.printId === "protests-san-francisco-16")?.publicId,
		"place/california/san-francisco/16",
	);
});

test("uses CMS printEnabled and stable item IDs, including renamed nested albums", () => {
	const manifest = buildManifest({
		groups: [{ id: "place", label: "place", parentId: null }],
		albums: [{
			id: "animals",
			key: "animals",
			label: "wildlife",
			parentId: "place",
			order: 3,
			items: [
				{ id: "animals-stable-1", publicId: "animals/1", width: 4000, height: 3000, order: 0, printEnabled: false },
				{ id: "animals-stable-2", publicId: "animals/2", width: 3000, height: 4000, order: 1, printEnabled: true },
			],
		}],
	});
	assert.deepEqual(manifest.photos.map((photo) => photo.printId), ["animals-stable-2"]);
	assert.equal(manifest.photos[0].seriesLabel, "wildlife");
	assert.equal(manifest.photos[0].seriesPath, "place / wildlife");
	assert.equal(manifest.photos[0].photoOrder, 1);
});

test("classifies orientation and aspect ratios", () => {
	assert.equal(orientationFor(5184, 3456), "horizontal");
	assert.equal(orientationFor(3888, 5184), "vertical");
	assert.equal(aspectGroupFor(4000, 3900), "square");
	assert.equal(aspectGroupFor(4000, 3000), "classic");
	assert.equal(aspectGroupFor(4500, 3000), "wide");
});

test("creates Gelato-compatible Cloudinary JPG URLs", () => {
	assert.equal(
		cloudinaryUrl("place/california/1"),
		"https://res.cloudinary.com/dpmdkrggj/image/upload/f_jpg,q_95/place/california/1.jpg",
	);
});

test("builds stable customer-facing reference labels", () => {
	assert.equal(referenceLabelFor("the-natural-world-3", "the-natural-world"), "3");
	assert.equal(referenceLabelFor("protests-san-francisco-16", "protests"), "San Francisco 16");
});

test("normalizes and selects exact template variants", () => {
	const photo = {
		orientation: "horizontal",
		aspectGroup: "wide",
		sizesByMedium: {
			"fine-art": ["8x12", "12x18", "16x24"],
		},
	};
	const template = {
		variants: ["8x12", "12x18", "16x24"].map((size) =>
			normalizeVariant({
				id: size,
				title: `${size} - Horizontal`,
				productUid: `product_hor_${size}-inch`,
				imagePlaceholders: [{ name: "Artwork" }],
			}),
		),
	};
	assert.deepEqual(
		selectTemplateVariants(template, photo, "fine-art").map((variant) => variant.id),
		["8x12", "12x18", "16x24"],
	);
});

test("uses product-specific square sizes and Gelato wood frame labels", () => {
	const photo = {
		orientation: "vertical",
		aspectGroup: "square",
		sizesByMedium: {
			framed: ["12x12", "16x16", "20x20"],
			canvas: ["8x8", "12x12", "16x16"],
		},
	};
	const framedTemplate = {
		variants: ["12x12", "16x16", "20x20"].flatMap((size) =>
			["Wood frame", "Black frame"].map((frame) =>
				normalizeVariant({
					id: `${size}-${frame}`,
					title: `${size} - Vertical - ${frame}`,
					productUid: `product_ver_${size}-inch_${frame === "Wood frame" ? "wood" : "black"}_`,
					imagePlaceholders: [{ name: "Artwork" }],
				}),
			),
		),
	};
	assert.equal(selectTemplateVariants(framedTemplate, photo, "framed").length, 6);

	const canvasTemplate = {
		variants: ["8x8", "12x12", "16x16"].map((size) =>
			normalizeVariant({
				id: size,
				title: `${size} - Vertical - Slim`,
				productUid: `canvas_ver_${size}-inch`,
				imagePlaceholders: [{ name: "Artwork" }],
			}),
		),
	};
	assert.equal(selectTemplateVariants(canvasTemplate, photo, "canvas").length, 3);
	assert.equal(
		normalizeVariant({
			title: "20x20 cm / 8x8″ - Vertical - Slim",
			productUid: "canvas_200x200-mm-8x8-inch_canvas_wood-fsc-slim_4-0_ver",
		}).size,
		"8x8",
	);
});

test("reports managed products removed from the portfolio", () => {
	const photos = [{ printId: "kept-photo" }];
	const state = {
		products: {
			"kept-photo:fine-art": { id: "kept" },
			"deleted-photo:canvas": { id: "deleted", externalId: "shopify-deleted" },
		},
	};
	const remote = [
		{
			id: "deleted",
			externalId: "shopify-deleted",
			status: "active",
			title: "Deleted",
			tags: ["deleted-photo", "format-canvas", "claire-thomas"],
		},
		{
			id: "unmanaged",
			tags: ["deleted-photo", "format-canvas"],
		},
	];
	assert.equal(expectedProductKeys(photos).size, 3);
	assert.equal(managedProductKey(remote[0]), "deleted-photo:canvas");
	assert.equal(managedProductKey(remote[1]), null);
	assert.deepEqual(findStaleProducts(state, remote, photos), [
		{
			key: "deleted-photo:canvas",
			id: "deleted",
			externalId: "shopify-deleted",
			status: "active",
			title: "Deleted",
			source: "state+gelato",
		},
	]);
});

test("plans deletion of created drafts and regeneration of unresolved products", () => {
	const photos = [{ printId: "photo-1" }, { printId: "photo-2" }];
	const products = [
		{
			id: "active-fine-art",
			status: "active",
			tags: ["photo-1", "format-fine-art", "claire-thomas"],
		},
		{
			id: "duplicate-created-fine-art",
			status: "created",
			tags: ["photo-1", "format-fine-art", "claire-thomas"],
		},
		{
			id: "created-canvas",
			status: "created",
			tags: ["photo-1", "format-canvas", "claire-thomas"],
		},
		{
			id: "queued-photo-2",
			status: "publishing_queued",
			tags: ["photo-2", "format-fine-art", "claire-thomas"],
		},
	];
	const plan = buildCreatedRepairPlan(photos, ["fine-art", "canvas"], products);
	assert.deepEqual(plan.photoIds, ["photo-1", "photo-2"]);
	assert.deepEqual(
		plan.createdProducts.map(({ product }) => product.id),
		["duplicate-created-fine-art", "created-canvas", "queued-photo-2"],
	);
	assert.deepEqual(plan.unresolvedKeys.sort(), ["photo-1:canvas", "photo-2:canvas", "photo-2:fine-art"]);
});

test("prefers an active product and treats a missing recorded product as recoverable", () => {
	const photo = { printId: "photo-1", seriesLabel: "Photo", referenceLabel: "1" };
	const products = [
		{
			id: "recorded-created",
			status: "created",
			title: "Photo 1 - Fine Art Print",
			tags: ["photo-1", "format-fine-art"],
		},
		{
			id: "active-copy",
			status: "active",
			title: "Photo 1 - Fine Art Print",
			tags: ["photo-1", "format-fine-art"],
		},
	];
	assert.equal(selectExistingProduct(products, photo, "fine-art", "recorded-created")?.id, "active-copy");
	assert.equal(selectExistingProduct([], photo, "fine-art", "recorded-created"), undefined);
});

test("reconcile archives stale products, replaces old catalog versions, and updates renamed metadata", () => {
	const photo = {
		printId: "animals-stable-2",
		albumId: "animals",
		series: "animals",
		seriesLabel: "wildlife",
		seriesPath: "place / wildlife",
		referenceLabel: "2",
		photoOrder: 1,
	};
	const desired = productMetadata(photo, "fine-art");
	const current = {
		id: "current",
		externalId: "101",
		status: "active",
		...desired,
		tags: [...desired.tags],
	};
	const old = {
		id: "old",
		externalId: "102",
		status: "active",
		title: "Old title",
		tags: [photo.printId, "series-animals", "format-framed", "claire-thomas"],
	};
	const stale = {
		id: "stale",
		externalId: "103",
		status: "active",
		title: "Removed",
		tags: ["removed-photo", "format-canvas", "claire-thomas"],
	};
	const renamed = { ...photo, seriesLabel: "new wildlife", seriesPath: "place / new wildlife" };
	const plan = buildReconcilePlan(
		[renamed],
		{ products: { "animals-stable-2:fine-art": { id: "current" } } },
		[current, old, stale],
		["fine-art", "framed", "canvas"],
	);
	assert.equal(plan.creates.length, 2);
	assert.equal(plan.creates.some((action) => action.medium === "framed"), true);
	assert.equal(plan.archives.some((action) => action.product.id === "old" && action.reason === "catalog-version-replacement"), true);
	assert.equal(plan.archives.some((action) => action.product.id === "stale" && action.reason === "not-in-cms"), true);
	assert.equal(plan.updates.length, 1);
	assert.equal(plan.updates[0].key, "animals-stable-2:fine-art");
	assert.equal(plan.updates[0].desired.title, "new wildlife 2 - Fine Art Print");
	assert.equal(plan.blocked.length, 0);
});

test("does not match products by mutable title and blocks archive without Shopify mapping", () => {
	const photo = {
		printId: "photo-1",
		series: "album",
		seriesLabel: "Renamed album",
		seriesPath: "Renamed album",
		referenceLabel: "1",
		photoOrder: 0,
	};
	const titleOnly = { id: "title-only", status: "active", title: "Renamed album 1 - Fine Art Print", tags: [] };
	const staleWithoutExternalId = {
		id: "stale-no-shopify-id",
		status: "active",
		tags: ["removed-photo", "format-fine-art", "claire-thomas"],
	};
	const plan = buildReconcilePlan([photo], { products: {} }, [titleOnly, staleWithoutExternalId], ["fine-art"]);
	assert.equal(plan.creates.length, 1);
	assert.equal(plan.archives.length, 0);
	assert.deepEqual(plan.blocked, [{ action: "archive", key: "removed-photo:fine-art", productId: staleWithoutExternalId.id, reason: "missing-shopify-external-id" }]);
	assert.equal(catalogVersionTag, "catalog-edge-to-edge-v1");
});

test("allows pending publishing products to wait for Shopify mappings", () => {
	const photo = {
		printId: "photo-1",
		series: "album",
		seriesLabel: "Renamed album",
		seriesPath: "Renamed album",
		referenceLabel: "1",
		photoOrder: 0,
	};
	const pending = {
		id: "pending-no-shopify-id",
		status: "publishing_queued",
		title: "Old title",
		handle: "old-handle",
		tags: ["photo-1", "format-fine-art", "claire-thomas", "catalog-edge-to-edge-v1"],
	};
	const plan = buildReconcilePlan([photo], { products: {} }, [pending], ["fine-art"]);
	assert.equal(plan.pending.length, 1);
	assert.equal(plan.pending[0].key, "photo-1:fine-art");
	assert.equal(plan.creates.length, 0);
	assert.equal(plan.updates.length, 0);
	assert.equal(plan.blocked.length, 0);

	const activeBeforeMapping = buildReconcilePlan(
		[photo],
		{ products: {} },
		[{ ...pending, status: "active" }],
		["fine-art"],
	);
	assert.equal(activeBeforeMapping.pending.length, 1);
	assert.equal(activeBeforeMapping.blocked.length, 0);
});

test("reconcile deletes and recreates a stranded created product", () => {
	const photo = {
		printId: "photo-1",
		series: "album",
		seriesLabel: "Album",
		referenceLabel: "1",
	};
	const stalled = {
		id: "stalled-created",
		externalId: null,
		status: "created",
		createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
		tags: ["photo-1", "photo-id:photo-1", "format-fine-art", "claire-thomas", catalogVersionTag],
	};
	const plan = buildReconcilePlan([photo], { products: {} }, [stalled], ["fine-art"]);
	assert.deepEqual(
		plan.recoveries.map(({ product, reason }) => ({ id: product.id, reason })),
		[{ id: stalled.id, reason: "stalled-created" }],
	);
	assert.equal(plan.creates.length, 1);
	assert.equal(plan.pending.length, 0);
	assert.equal(plan.blocked.length, 0);
});

test("purges Gelato only after its mapped Shopify product is retired", async () => {
	const photo = {
		printId: "photo-1",
		series: "album",
		seriesLabel: "Album",
		referenceLabel: "1",
	};
	const retired = {
		id: "gelato-retired",
		externalId: "shopify-retired",
		status: "active",
		shopifyStatus: "archived",
		tags: ["photo-1", "photo-id:photo-1", "format-fine-art", "claire-thomas", catalogVersionTag],
	};
	assert.equal(hasRetiredShopifyProduct(retired), true);
	assert.equal(hasRetiredShopifyProduct({ ...retired, shopifyStatus: "active" }), false);
	assert.equal(hasRetiredShopifyProduct({ ...retired, externalId: null }), false);

	const plan = buildReconcilePlan([photo], { products: {} }, [retired], ["fine-art"]);
	assert.deepEqual(
		plan.purges.map(({ product, reason }) => ({ id: product.id, reason })),
		[{ id: retired.id, reason: "shopify-archived" }],
	);
	assert.equal(plan.creates.length, 1);
	assert.equal(plan.unarchives.length, 0);

	const calls = [];
	const purgeOnlyPlan = {
		archives: [],
		blocked: [],
		creates: [],
		pending: [],
		purges: plan.purges,
		recoveries: [],
		unarchives: [],
		updates: [],
	};
	const result = await applyReconcilePlan({
		plan: purgeOnlyPlan,
		state: { products: {} },
		storeId: "store-1",
		templates: {},
		apiRequestImpl: async (path, options = {}) => {
			calls.push({ path, method: options.method });
			return null;
		},
		writeStateImpl() {},
	});
	assert.deepEqual(calls, [{ path: "/stores/store-1/products/gelato-retired", method: "DELETE" }]);
	assert.equal(result.purged, 1);
});

test("purges retired Gelato records with bounded concurrency", async () => {
	const purges = Array.from({ length: 9 }, (_, index) => ({
		key: `photo-${index}:fine-art`,
		product: { id: `gelato-${index}`, externalId: `shopify-${index}`, shopifyStatus: "archived" },
	}));
	let active = 0;
	let maxActive = 0;
	let deleted = 0;
	const result = await applyReconcilePlan({
		plan: {
			archives: [],
			blocked: [],
			creates: [],
			pending: [],
			purges,
			recoveries: [],
			unarchives: [],
			updates: [],
		},
		state: { products: {} },
		storeId: "store-1",
		templates: {},
		purgeBatchSize: 4,
		apiRequestImpl: async (_path, options = {}) => {
			assert.equal(options.method, "DELETE");
			active += 1;
			maxActive = Math.max(maxActive, active);
			await new Promise((resolvePromise) => setImmediate(resolvePromise));
			active -= 1;
			deleted += 1;
			return null;
		},
		writeStateImpl() {},
	});
	assert.equal(deleted, 9);
	assert.equal(maxActive, 4);
	assert.equal(result.purged, 9);
});

test("recovers publishing errors by archiving their mapped Shopify product and recreating the stable key", () => {
	const photo = {
		printId: "the-natural-world-1",
		series: "the-natural-world",
		seriesLabel: "The Natural World",
		referenceLabel: "1",
		photoOrder: 0,
	};
	const failed = {
		id: "900193f2-ff1b-4bb0-9fb4-cec539e87e18",
		externalId: "10512702898360",
		status: "publishing_error",
		publishingErrorCode: "GENERAL_ERROR",
		shopifyStatus: "active",
		tags: ["the-natural-world-1", "photo-id:the-natural-world-1", "format-fine-art", "claire-thomas", catalogVersionTag],
	};
	const plan = buildReconcilePlan(
		[photo],
		{ products: { "the-natural-world-1:fine-art": { id: failed.id } } },
		[failed],
		["fine-art"],
	);
	assert.deepEqual(plan.recoveries.map(({ product }) => product.id), [failed.id]);
	assert.equal(plan.recoveries[0].desired.handle, "the-natural-world-1-fine-art-print");
	assert.equal(plan.creates.length, 1);
	assert.equal(plan.pending.length, 0);
	assert.equal(plan.blocked.length, 0);
});

test("archives old handles before replacement and exposes the canonical Fine Art URL", () => {
	const photo = {
		printId: "the-natural-world-3",
		series: "the-natural-world",
		seriesLabel: "the natural world",
		referenceLabel: "3",
	};
	const canonicalHandle = canonicalHandleFor(photo, "fine-art");
	assert.equal(canonicalHandle, "the-natural-world-3-fine-art-print");
	assert.equal(canonicalFineArtUrlFor(photo), `https://shop.clairethomas.art/products/${canonicalHandle}`);
	const oldProduct = { id: "gelato-old", externalId: "53830433439928", status: "active", handle: canonicalHandle };
	const archiveUpdate = buildShopifyProductUpdate(oldProduct, null, "ARCHIVED", { archive: true });
	assert.equal(archivedProductHandle(oldProduct), "archived-53830433439928");
	assert.deepEqual(archiveUpdate, {
		id: "gid://shopify/Product/53830433439928",
		handle: "archived-53830433439928",
		redirectNewHandle: false,
		status: "ARCHIVED",
	});
	assert.notEqual(archiveUpdate.handle, oldProduct.handle);
	assert.equal(buildShopifyProductUpdate(oldProduct, productMetadata(photo, "fine-art"), "ACTIVE").handle, canonicalHandle);
});

const canonicalHandleFixture = () => {
	const desired = {
		title: "Animals 17 - Fine Art Print",
		handle: "animals-17-fine-art-print",
		description: "Photo",
		tags: [
			"photo-id:animals-17",
			"format-fine-art",
			catalogVersionTag,
			"claire-thomas",
			"album-animals",
		],
	};
	const blocker = {
		id: "gid://shopify/Product/999",
		status: "DRAFT",
		handle: desired.handle,
		tags: [...desired.tags],
	};
	return {
		product: { id: "gelato-current", externalId: "101" },
		desired,
		blocker,
	};
};

test("archives an exact managed orphan Draft before assigning its canonical handle", async () => {
	const { product, desired, blocker } = canonicalHandleFixture();
	const mutations = [];
	let handleOwner = blocker;
	const result = await updateShopifyProduct(product, desired, "DRAFT", {
		shopifyGraphqlImpl: async (query, variables) => {
			if (query.includes("CanonicalHandleProduct")) {
				return { products: { nodes: handleOwner ? [handleOwner] : [] } };
			}
			mutations.push(variables.product);
			if (query.includes("ArchiveCanonicalHandleBlocker")) {
				handleOwner = null;
				return { productUpdate: { product: { ...blocker, status: "ARCHIVED" }, userErrors: [] } };
			}
			return {
				productUpdate: {
					product: { id: "gid://shopify/Product/101", status: "DRAFT" },
					userErrors: [],
				},
			};
		},
	});

	assert.equal(result.id, "gid://shopify/Product/101");
	assert.deepEqual(mutations, [
		{
			id: blocker.id,
			handle: "archived-gid---shopify-product-999",
			redirectNewHandle: false,
			status: "ARCHIVED",
		},
		{
			id: "gid://shopify/Product/101",
			title: desired.title,
			descriptionHtml: desired.description,
			tags: desired.tags,
			handle: desired.handle,
			redirectNewHandle: false,
			status: "DRAFT",
		},
	]);
});

test("refuses to mutate active or differently tagged canonical-handle blockers", async () => {
	const { product, desired, blocker } = canonicalHandleFixture();
	assert.deepEqual(managedIdentityTags(desired.tags), [
		"catalog-edge-to-edge-v1",
		"claire-thomas",
		"format-fine-art",
		"photo-id:animals-17",
	]);
	assert.equal(hasExactManagedIdentity(blocker, desired), true);
	for (const protectedBlocker of [
		{ ...blocker, status: "ACTIVE" },
		{ ...blocker, tags: blocker.tags.map((tag) => tag === "photo-id:animals-17" ? "photo-id:animals-18" : tag) },
		{ ...blocker, tags: blocker.tags.filter((tag) => tag !== catalogVersionTag) },
	]) {
		let mutationCount = 0;
		await assert.rejects(
			updateShopifyProduct(product, desired, "DRAFT", {
				shopifyGraphqlImpl: async (query) => {
					if (query.includes("CanonicalHandleProduct")) {
						return { products: { nodes: [protectedBlocker] } };
					}
					mutationCount += 1;
					throw new Error("must not mutate protected blocker");
				},
			}),
			/refusing to modify it/,
		);
		assert.equal(mutationCount, 0);
	}
});

test("retries canonical assignment once after a handle-taken race", async () => {
	const { product, desired, blocker } = canonicalHandleFixture();
	let queryCount = 0;
	let reconcileMutations = 0;
	let archiveMutations = 0;
	await assert.rejects(
		updateShopifyProduct(product, desired, "DRAFT", {
			shopifyGraphqlImpl: async (query) => {
				if (query.includes("CanonicalHandleProduct")) {
					queryCount += 1;
					return { products: { nodes: queryCount === 1 ? [] : [blocker] } };
				}
				if (query.includes("ArchiveCanonicalHandleBlocker")) {
					archiveMutations += 1;
					return { productUpdate: { product: { ...blocker, status: "ARCHIVED" }, userErrors: [] } };
				}
				reconcileMutations += 1;
				return {
					productUpdate: {
						product: null,
						userErrors: [{ field: ["product", "handle"], message: "Handle has already been taken" }],
					},
				};
			},
		}),
		/Shopify product update failed/,
	);
	assert.equal(queryCount, 2);
	assert.equal(archiveMutations, 1);
	assert.equal(reconcileMutations, 2);
});

test("canonical orphan recovery is restart-idempotent and never archives twice", async () => {
	const { product, desired, blocker } = canonicalHandleFixture();
	let handleOwner = blocker;
	let archiveMutations = 0;
	const shopifyGraphqlImpl = async (query) => {
		if (query.includes("CanonicalHandleProduct")) {
			return { products: { nodes: handleOwner ? [handleOwner] : [] } };
		}
		archiveMutations += 1;
		handleOwner = null;
		return { productUpdate: { product: { ...blocker, status: "ARCHIVED" }, userErrors: [] } };
	};
	assert.equal(await recoverCanonicalHandleBlocker(product, desired, { shopifyGraphqlImpl }), true);
	assert.equal(await recoverCanonicalHandleBlocker(product, desired, { shopifyGraphqlImpl }), false);
	assert.equal(archiveMutations, 1);
});

test("plans a deterministic full-bleed artwork media repair for every Shopify variant", () => {
	const photo = {
		printId: "the-natural-world-1",
		fileUrl: "https://res.cloudinary.com/dpmdkrggj/image/upload/f_jpg,q_95/1_asebdu.jpg",
	};
	const artworkMedia = { id: "gid://shopify/MediaImage/artwork", alt: artworkMediaAltFor(photo), status: "READY" };
	const product = {
		shopifyMedia: { nodes: [artworkMedia, { id: "mockup", alt: "Gelato mockup" }] },
		shopifyVariants: {
			nodes: [
				{ id: "variant-1", media: { nodes: [{ id: "mockup" }] } },
				{ id: "variant-2", media: { nodes: [{ id: artworkMedia.id }] } },
			],
		},
	};

	assert.deepEqual(artworkMediaInput(photo), {
		originalSource: photo.fileUrl,
		alt: "Claire Thomas artwork: the-natural-world-1",
		mediaContentType: "IMAGE",
	});
	assert.equal(shouldUploadArtworkMedia(null, photo), true);
	assert.equal(shouldUploadArtworkMedia(product, photo), false);
	assert.equal(productNeedsShopifyMediaRepair(product, photo), true);
	assert.deepEqual(buildShopifyVariantMediaUpdates(product, artworkMedia), [
		{ id: "variant-1", mediaId: artworkMedia.id },
	]);
	assert.equal(
		productNeedsShopifyMediaRepair(
			{ ...product, shopifyMedia: { nodes: [{ id: "mockup", alt: "Gelato mockup" }, artworkMedia] } },
			photo,
		),
		true,
	);

	const repaired = {
		...product,
		shopifyVariants: {
			nodes: product.shopifyVariants.nodes.map((variant) => ({
				...variant,
				media: { nodes: [{ id: artworkMedia.id }] },
			})),
		},
	};
	assert.equal(productNeedsShopifyMediaRepair(repaired, photo), false);
});

test("recognizes direct Shopify media query results and keeps one ready artwork marker", () => {
	const photo = {
		printId: "photo-direct",
		fileUrl: "https://res.cloudinary.com/dpmdkrggj/image/upload/photo-direct.jpg",
	};
	const processing = {
		id: "gid://shopify/MediaImage/processing",
		alt: artworkMediaAltFor(photo),
		status: "PROCESSING",
	};
	const ready = {
		id: "gid://shopify/MediaImage/ready",
		alt: artworkMediaAltFor(photo),
		status: "READY",
	};
	const directProduct = {
		media: { nodes: [ready, { id: "mockup", alt: "Gelato mockup", status: "READY" }] },
		variants: {
			nodes: [
				{ id: "variant-1", media: { nodes: [{ id: ready.id }] } },
				{ id: "variant-2", media: { nodes: [{ id: ready.id }] } },
			],
		},
	};

	assert.equal(shouldUploadArtworkMedia(directProduct, photo), false);
	assert.equal(productNeedsShopifyMediaRepair(directProduct, photo), false);
	assert.deepEqual(buildShopifyVariantMediaUpdates(directProduct, ready), []);

	const duplicateProduct = {
		...directProduct,
		media: { nodes: [processing, ready, { id: "mockup", alt: "Gelato mockup", status: "READY" }] },
	};
	assert.equal(shouldUploadArtworkMedia(duplicateProduct, photo), false);
	assert.equal(productNeedsShopifyMediaRepair(duplicateProduct, photo), true);
	assert.deepEqual(extraArtworkMediaIds(duplicateProduct, photo), [processing.id]);
});

test("reconcile updates a metadata-clean active product when its artwork media is missing", () => {
	const photo = {
		printId: "photo-1",
		albumId: "album",
		series: "album",
		seriesLabel: "Album",
		seriesPath: "Album",
		referenceLabel: "1",
		photoOrder: 0,
		fileUrl: "https://res.cloudinary.com/dpmdkrggj/image/upload/f_jpg,q_95/photo-1.jpg",
	};
	const desired = productMetadata(photo, "fine-art");
	const plan = buildReconcilePlan(
		[photo],
		{ products: { "photo-1:fine-art": { id: "gelato-1" } } },
		[{ id: "gelato-1", externalId: "101", status: "active", ...desired }],
		["fine-art"],
	);
	assert.deepEqual(plan.updates.map(({ key, photo: target }) => [key, target.printId]), [["photo-1:fine-art", "photo-1"]]);
});

test("keeps Shopify products hidden until artwork repair succeeds", async () => {
	const calls = [];
	const updateProduct = async (_product, _desired, status, options = {}) => {
		calls.push({ status, hasPhoto: Boolean(options.photo) });
		return { id: "gid://shopify/Product/101" };
	};
	await safelyPublishShopifyProduct(
		{ id: "gelato-1", externalId: "101" },
		{ title: "Photo 1" },
		{ photo: { printId: "photo-1" }, updateProduct },
	);
	assert.deepEqual(calls, [
		{ status: "DRAFT", hasPhoto: true },
		{ status: "ACTIVE", hasPhoto: false },
	]);
});

test("quarantines each published Gelato product before waiting for the rest", async () => {
	const state = { products: { first: { id: "gelato-first" }, second: { id: "gelato-second" } } };
	const responses = new Map([
		["gelato-first", [{ id: "gelato-first", externalId: "101", status: "active" }]],
		[
			"gelato-second",
			[
				{ id: "gelato-second", status: "active" },
				{ id: "gelato-second", externalId: "102", status: "active" },
			],
		],
	]);
	const quarantined = [];
	await waitForProducts(
		"store",
		[{ key: "first" }, { key: "second" }],
		state,
		{
			pollIntervalMs: 0,
			onActive: async (product, job) => quarantined.push([job.key, product.externalId]),
			apiRequestImpl: async (path) => {
				const productId = path.split("/").at(-1);
				const queue = responses.get(productId);
				return queue.length > 1 ? queue.shift() : queue[0];
			},
		},
	);
	assert.deepEqual(quarantined, [
		["first", "101"],
		["second", "102"],
	]);
	assert.equal(
		publishingPollIntervalMs(
			[{ key: "first" }, { key: "second" }],
			{ products: { first: { visible: true }, second: { visible: false } } },
		),
		5_000,
	);
	assert.equal(
		publishingPollIntervalMs(
			[{ key: "first" }, { key: "second" }],
			{ products: { first: { visible: false }, second: { visible: false } } },
		),
		30_000,
	);
});

test("resumes a repaired Shopify draft and republishes it", () => {
	const photo = {
		printId: "photo-draft",
		albumId: "album",
		series: "album",
		seriesLabel: "Album",
		seriesPath: "Album",
		referenceLabel: "1",
		photoOrder: 0,
		fileUrl: "https://res.cloudinary.com/dpmdkrggj/image/upload/photo-draft.jpg",
	};
	const desired = productMetadata(photo, "fine-art");
	const artwork = { id: "artwork", alt: artworkMediaAltFor(photo), status: "READY" };
	const draft = {
		id: "gelato-draft",
		externalId: "101",
		status: "active",
		shopifyStatus: "draft",
		...desired,
		shopifyMedia: { nodes: [artwork] },
		shopifyVariants: { nodes: [{ id: "variant-1", media: { nodes: [artwork] } }] },
	};
	const plan = buildReconcilePlan(
		[photo],
		{ products: { "photo-draft:fine-art": { id: draft.id } } },
		[draft],
		["fine-art"],
	);
	assert.deepEqual(plan.unarchives.map(({ key }) => key), ["photo-draft:fine-art"]);
	assert.equal(plan.creates.length, 0);
	assert.equal(plan.blocked.length, 0);
});

test("strict audit detects variants that can still fall back to Gelato mockups", () => {
	const photo = {
		printId: "photo-1",
		fileUrl: "https://res.cloudinary.com/dpmdkrggj/image/upload/f_jpg,q_95/photo-1.jpg",
	};
	const product = {
		id: "gelato-1",
		externalId: "101",
		status: "active",
		shopifyStatus: "active",
		tags: ["photo-1", "format-fine-art", "claire-thomas"],
		shopifyMedia: { nodes: [{ id: "artwork", alt: artworkMediaAltFor(photo), status: "READY" }] },
		shopifyVariants: { nodes: [{ id: "variant-1", media: { nodes: [{ id: "gelato-mockup" }] } }] },
	};
	const audit = buildCatalogAudit([photo], [product], ["fine-art"]);
	assert.equal(audit.clean, false);
	assert.deepEqual(audit.mediaRepairKeys, ["photo-1:fine-art"]);
});

test("retries HTTP 429 and GraphQL THROTTLED responses with bounded backoff", async () => {
	const originalDomain = process.env.SHOPIFY_STORE_DOMAIN;
	const originalToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
	process.env.SHOPIFY_STORE_DOMAIN = "shop.test";
	process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = "test-token";
	let calls = 0;
	const responses = [
		{ status: 429, ok: false, headers: { get: () => "0" }, text: async () => "{}" },
		{
			status: 200,
			ok: true,
			headers: { get: () => null },
			text: async () => JSON.stringify({ errors: [{ extensions: { code: "THROTTLED" } }] }),
		},
		{ status: 200, ok: true, headers: { get: () => null }, text: async () => JSON.stringify({ data: { ok: true } }) },
	];
	try {
		const result = await shopifyGraphql("query Test { shop { id } }", {}, {
			fetchImpl: async () => responses[calls++],
			sleepImpl: async () => {},
			retryDelayImpl: () => 0,
		});
		assert.deepEqual(result, { ok: true });
		assert.equal(calls, 3);
	} finally {
		if (originalDomain === undefined) delete process.env.SHOPIFY_STORE_DOMAIN;
		else process.env.SHOPIFY_STORE_DOMAIN = originalDomain;
		if (originalToken === undefined) delete process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
		else process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = originalToken;
	}
	assert.equal(isShopifyThrottled({ status: 429 }, null), true);
	assert.equal(isShopifyThrottled({ status: 200 }, { errors: [{ extensions: { code: "THROTTLED" } }] }), true);
	assert.equal(shopifyRetryDelayMs(99), 5 * 60 * 1000);
});

test("bounds each Gelato 429 retry window and accepts a positive override", () => {
	const original = process.env.GELATO_429_MAX_ATTEMPTS;
	try {
		delete process.env.GELATO_429_MAX_ATTEMPTS;
		assert.equal(gelato429MaxAttempts(), 48);
		process.env.GELATO_429_MAX_ATTEMPTS = "12";
		assert.equal(gelato429MaxAttempts(), 12);
		process.env.GELATO_429_MAX_ATTEMPTS = "0";
		assert.equal(gelato429MaxAttempts(), 48);
	} finally {
		if (original === undefined) delete process.env.GELATO_429_MAX_ATTEMPTS;
		else process.env.GELATO_429_MAX_ATTEMPTS = original;
	}
});

test("polls Shopify media until the stable artwork marker is READY", async () => {
	const photo = { printId: "photo-1" };
	const processing = {
		id: "gid://shopify/Product/1",
		shopifyMedia: { nodes: [{ id: "artwork", alt: artworkMediaAltFor(photo), status: "PROCESSING" }] },
	};
	const ready = {
		...processing,
		shopifyMedia: { nodes: [{ id: "artwork", alt: artworkMediaAltFor(photo), status: "READY" }] },
	};
	let fetches = 0;
	let sleeps = 0;
	const observed = await waitForShopifyArtworkMedia(processing, photo, {
		fetchProduct: async () => (fetches++ === 0 ? processing : ready),
		sleepImpl: async () => { sleeps += 1; },
		timeoutMs: 100,
		pollIntervalMs: 1,
	});
	assert.equal(observed, ready);
	assert.equal(fetches, 2);
	assert.equal(sleeps, 1);
});

test("classifies Shopify asynchronous timeouts as retryable reconcile failures", async () => {
	const photo = { printId: "photo-1" };
	const processing = {
		id: "gid://shopify/Product/1",
		shopifyMedia: { nodes: [{ id: "artwork", alt: artworkMediaAltFor(photo), status: "PROCESSING" }] },
		shopifyVariants: { nodes: [{ id: "variant-1", media: { nodes: [] } }] },
	};
	const expectRetryable = async (operation) => {
		await assert.rejects(operation, (error) => error.retryableReconcile === true);
	};

	await expectRetryable(() => waitForShopifyArtworkMedia(processing, photo, {
		nowImpl: () => 0,
		timeoutMs: 0,
	}));
	await expectRetryable(() => waitForShopifyJob("gid://shopify/Job/1", {
		fetchJob: async () => ({ id: "gid://shopify/Job/1", done: false }),
		nowImpl: () => 0,
		timeoutMs: 0,
	}));
	await expectRetryable(() => waitForShopifyArtworkBindings(processing, photo, {
		fetchProduct: async () => processing,
		nowImpl: () => 0,
		timeoutMs: 0,
	}));
});

test("defers retryable media actions without blocking later products", async () => {
	const deferred = new Map();
	const visited = [];
	const retryable = Object.assign(new Error("still processing"), { retryableReconcile: true });

	await runWithRetryableDeferral(
		[{ key: "one" }, { key: "two" }],
		async (action) => {
			visited.push(action.key);
			if (action.key === "one") throw retryable;
		},
		deferred,
	);
	assert.deepEqual(visited, ["one", "two"]);
	assert.deepEqual([...deferred.keys()], ["one"]);

	await runWithRetryableDeferral([{ key: "one" }], async () => {}, deferred);
	assert.equal(deferred.size, 0);
	await assert.rejects(
		() => runWithRetryableDeferral([{ key: "fatal" }], async () => { throw new Error("fatal"); }),
		/fatal/,
	);
});

test("polls asynchronous Shopify reorder jobs to completion", async () => {
	let fetches = 0;
	let sleeps = 0;
	const result = await waitForShopifyJob("gid://shopify/Job/1", {
		fetchJob: async () => ({ id: "gid://shopify/Job/1", done: fetches++ > 0 }),
		sleepImpl: async () => { sleeps += 1; },
		timeoutMs: 100,
		pollIntervalMs: 1,
	});
	assert.equal(result.done, true);
	assert.equal(fetches, 2);
	assert.equal(sleeps, 1);
});

test("waits until every Shopify variant points at the artwork media", async () => {
	const photo = { printId: "photo-1" };
	const artworkMedia = { id: "artwork", alt: artworkMediaAltFor(photo), status: "READY" };
	const pending = {
		id: "gid://shopify/Product/1",
		shopifyMedia: { nodes: [artworkMedia] },
		shopifyVariants: { nodes: [{ id: "variant-1", media: { nodes: [{ id: "mockup" }] } }] },
	};
	const complete = {
		...pending,
		shopifyVariants: { nodes: [{ id: "variant-1", media: { nodes: [{ id: "artwork" }] } }] },
	};
	let fetches = 0;
	const observed = await waitForShopifyArtworkBindings(pending, photo, {
		fetchProduct: async () => (fetches++ === 0 ? pending : complete),
		sleepImpl: async () => {},
		timeoutMs: 100,
		pollIntervalMs: 1,
	});
	assert.equal(observed, complete);
	assert.equal(fetches, 2);
});
