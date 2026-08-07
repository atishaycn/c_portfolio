import assert from "node:assert/strict";
import test from "node:test";

import {
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
	findStaleProducts,
	gelato429MaxAttempts,
	managedProductKey,
	mergeProductsById,
	mergeShopifyProductState,
	normalizeVariant,
	orientationFor,
	productMetadata,
	productNeedsShopifyMediaRepair,
	isShopifyThrottled,
	shopifyGraphql,
	shopifyRetryDelayMs,
	waitForShopifyArtworkBindings,
	waitForShopifyArtworkMedia,
	waitForShopifyJob,
	archivedProductHandle,
	referenceLabelFor,
	selectExistingProduct,
	selectTemplateVariants,
} from "./gelato-products.mjs";

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
