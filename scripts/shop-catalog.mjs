#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const ENV_FILE = resolve(ROOT, ".env.gelato.local");
const CATALOG_FILE = resolve(ROOT, "content", "shop-catalog.json");
const COSTS_FILE = resolve(ROOT, "scripts", "shop-catalog-costs.json");
const API_BASE = "https://product.gelatoapis.com/v3";
const PAGE_SIZE = 100;
const MAX_REQUEST_ATTEMPTS = 7;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;
const PRICE_CALL_GAP_MS = 150;
// Sample markup until Claire sets prices.
export const MARKUP = 2.5;

export const SIZE_SPECS = [
	"8x10",
	"8x12",
	"11x14",
	"12x12",
	"12x16",
	"12x18",
	"16x16",
	"16x20",
	"16x24",
	"18x24",
	"20x20",
	"20x30",
	"24x36",
	"28x40",
	"30x40",
].map((key, index) => {
	const [first, second] = key.split("x").map(Number);
	const width = Math.min(first, second);
	const height = Math.max(first, second);
	return {
		key: `${width}x${height}`,
		width,
		height,
		label: `${width} x ${height}`,
		area: width * height,
		index,
	};
});

const option = (key, label, attribute, values) => ({ key, label, attribute, values });
const optionValue = (value, label, gelatoValue) => ({ value, label, gelatoValue });

export const PRODUCTS = [
	{
		slug: "print",
		name: "Print",
		category: "Prints",
		gelatoCatalog: "posters",
		fixed: {},
		sizeAttribute: "UnifiedPaperFormat",
		options: [
			option("paper", "Paper", "UnifiedPaperType", [
				optionValue("semi-gloss", "Semi-gloss", "200-gsm-80lb-coated-silk"),
				optionValue("matte", "Matte", "200-gsm-80lb-uncoated"),
				optionValue(
					"archival-matte",
					"Archival matte",
					"250-gsm-100lb-uncoated-offwhite-archival",
				),
			]),
		],
	},
	{
		slug: "fine-art-print",
		name: "Fine Art Print",
		category: "Prints",
		gelatoCatalog: "fine-art",
		fixed: { UnifiedPaperType: "200-gsm-80lb-enhanced-uncoated" },
		sizeAttribute: "UnifiedPaperFormat",
		options: [],
	},
	{
		slug: "canvas",
		name: "Canvas",
		category: "Wall Art",
		gelatoCatalog: "canvas",
		fixed: {},
		sizeAttribute: "UnifiedCanvasFormat",
		options: [
			option("depth", "Depth", "CanvasThicknessType", [
				optionValue("slim", "Slim", "wood-fsc-slim"),
				optionValue("thick", "Thick", "wood-fsc-thick"),
			]),
		],
	},
	{
		slug: "framed-canvas",
		name: "Framed Canvas",
		category: "Wall Art",
		gelatoCatalog: "framed-canvas",
		fixed: { FrameProperties: "w14xt42-mm" },
		sizeAttribute: "UnifiedCanvasFormat",
		options: [
			option("frame", "Frame", "FrameColor", [
				optionValue("black", "Black", "black"),
				optionValue("natural-wood", "Natural wood", "natural-wood"),
				optionValue("dark-wood", "Dark wood", "dark-wood"),
			]),
		],
	},
	{
		slug: "metal-print",
		name: "Metal Print",
		category: "Wall Art",
		gelatoCatalog: "metallic",
		fixed: {},
		sizeAttribute: "UnifiedMetallicFormat",
		options: [
			option("finish", "Finish", "MetallicProperties", [
				optionValue("white-matte", "White matte", "3-mm"),
				optionValue("brushed-silver", "Brushed silver", "3-mm-silver-brushed"),
			]),
		],
	},
	{
		slug: "acrylic-print",
		name: "Acrylic Print",
		category: "Wall Art",
		gelatoCatalog: "acrylic",
		fixed: {},
		sizeAttribute: "UnifiedAcrylicFormat",
		options: [],
	},
	{
		slug: "wood-print",
		name: "Wood Print",
		category: "Wall Art",
		gelatoCatalog: "wood-prints",
		fixed: {},
		sizeAttribute: "UnifiedWoodFormat",
		options: [
			option("thickness", "Thickness", "WoodThickness", [
				optionValue("10-mm", "10 mm", "10-mm"),
				optionValue("20-mm", "20 mm", "20-mm"),
			]),
		],
	},
	{
		slug: "foam-print",
		name: "Foam Print",
		category: "Wall Art",
		gelatoCatalog: "foam-print-product",
		fixed: {},
		sizeAttribute: "UnifiedFoamFormat",
		options: [
			option("edge", "Edge", "FoamColor", [
				optionValue("black", "Black", "black"),
				optionValue("white", "White", "white"),
			]),
		],
	},
	{
		slug: "wood-frame",
		name: "Wood Frame",
		category: "Wall Art",
		gelatoCatalog: "mounted-fine-art",
		fixed: { FrameMaterial: "wood", FrameProperties: "w12xt22-mm" },
		sizeAttribute: "UnifiedFrameSize",
		options: [
			option("frame", "Frame", "FrameColor", [
				optionValue("black", "Black", "black"),
				optionValue("white", "White", "white"),
				optionValue("natural-wood", "Natural wood", "natural-wood"),
				optionValue("dark-wood", "Dark wood", "dark-wood"),
			]),
		],
	},
	{
		slug: "metal-frame",
		name: "Metal Frame",
		category: "Wall Art",
		gelatoCatalog: "mounted-fine-art",
		fixed: { FrameMaterial: "aluminum", FrameColor: "black" },
		sizeAttribute: "UnifiedFrameSize",
		options: [],
	},
];

export function parseGelatoSize(format) {
	if (typeof format !== "string") return null;
	const match = format.match(/(\d+)x(\d+)-inch(?:-|$)/i);
	if (!match) return null;
	const first = Number(match[1]);
	const second = Number(match[2]);
	const width = Math.min(first, second);
	const height = Math.max(first, second);
	return {
		key: `${width}x${height}`,
		width,
		height,
		label: `${width} x ${height}`,
		area: width * height,
	};
}

function formatOrder(format) {
	if (/^\d+x\d+-inch(?:-|$)/i.test(format)) return 0;
	if (/^\d+x\d+-mm-.*\d+x\d+-inch(?:-|$)/i.test(format)) return 1;
	return 2;
}

function getOptionCombinations(product) {
	let combinations = [{ options: {}, attributes: {}, indexes: [] }];
	for (const productOption of product.options) {
		combinations = combinations.flatMap((combination) =>
			productOption.values.map((value, index) => ({
				options: { ...combination.options, [productOption.key]: value.value },
				attributes: {
					...combination.attributes,
					[productOption.attribute]: value.gelatoValue,
				},
				indexes: [...combination.indexes, index],
			})),
		);
	}
	return combinations;
}

function compareIndexes(left, right) {
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		const difference = (left[index] ?? -1) - (right[index] ?? -1);
		if (difference !== 0) return difference;
	}
	return 0;
}

function describeOptions(options) {
	const entries = Object.entries(options);
	return entries.length ? entries.map(([key, value]) => `${key}=${value}`).join(", ") : "no options";
}

export function selectVariants(product, apiProducts, sizes = SIZE_SPECS) {
	const rows = [];
	const omitted = [];
	const combinations = getOptionCombinations(product);
	const orderedSizes = [...sizes].sort((left, right) => left.area - right.area || left.index - right.index);

	for (const size of orderedSizes) {
		for (const combination of combinations) {
			const matchesByOrientation = { hor: [], ver: [] };
			for (const apiProduct of apiProducts) {
				const attributes = apiProduct.attributes;
				if (!attributes || attributes.ProductStatus !== "activated") continue;
				if (attributes.Orientation !== "hor" && attributes.Orientation !== "ver") continue;
				if (parseGelatoSize(attributes[product.sizeAttribute])?.key !== size.key) continue;

				const matchesFixed = Object.entries(product.fixed).every(
					([attribute, value]) => attributes[attribute] === value,
				);
				if (!matchesFixed) continue;
				const matchesOptions = Object.entries(combination.attributes).every(
					([attribute, value]) => attributes[attribute] === value,
				);
				if (!matchesOptions) continue;
				matchesByOrientation[attributes.Orientation].push({
					product: apiProduct,
					formatOrder: formatOrder(attributes[product.sizeAttribute]),
				});
			}

			for (const orientation of ["hor", "ver"]) {
				const matches = matchesByOrientation[orientation];
				const preferredFormatOrder = matches.some((match) => match.formatOrder === 0)
					? 0
					: matches.some((match) => match.formatOrder === 1)
						? 1
						: 2;
				matchesByOrientation[orientation] = matches.filter(
					(match) => match.formatOrder === preferredFormatOrder,
				);
				const preferredMatches = matchesByOrientation[orientation];
				if (preferredMatches.length > 1) {
					const uids = preferredMatches.map((match) => match.product.productUid).join(", ");
					throw new Error(
						`Ambiguous Gelato match for ${product.slug} ${size.label} (${describeOptions(combination.options)}): ${orientation} matched ${preferredMatches.length} products: ${uids}`,
					);
				}
			}

			const missing = ["hor", "ver"].filter((orientation) => matchesByOrientation[orientation].length === 0);
			if (missing.length) {
				omitted.push({
					slug: product.slug,
					size: size.label,
					options: combination.options,
					reason: `no ${missing.join(" or ")} product`,
				});
				continue;
			}

			rows.push({
				variant: {
					size: size.label,
					options: combination.options,
					productUid: {
							hor: matchesByOrientation.hor[0].product.productUid,
							ver: matchesByOrientation.ver[0].product.productUid,
					},
				},
				area: size.area,
				sizeIndex: size.index,
				optionIndexes: combination.indexes,
			});
		}
	}

	rows.sort(
		(left, right) =>
			left.area - right.area ||
			compareIndexes(left.optionIndexes, right.optionIndexes) ||
			left.sizeIndex - right.sizeIndex,
	);
	return { variants: rows.map((row) => row.variant), omitted };
}

export function calculateRetailPrice(horCost, verCost, markup = MARKUP) {
	const costs = [Number(horCost), Number(verCost)];
	if (costs.some((cost) => !Number.isFinite(cost) || cost <= 0)) {
		throw new Error("Both orientation costs must be positive numbers.");
	}
	const price = Math.ceil(Math.max(...costs) * markup);
	if (!Number.isInteger(price) || price <= 0) {
		throw new Error("Calculated retail price must be a positive integer.");
	}
	return price;
}

function parseEnvValue(name, content) {
	for (const line of content.split(/\r?\n/)) {
		const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
		if (!match || match[1] !== name) continue;
		const raw = match[2];
		if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
			return raw.slice(1, -1);
		}
		return raw.replace(/\s+#.*$/, "");
	}
	return undefined;
}

function loadApiKey() {
	const fileValue = existsSync(ENV_FILE) ? parseEnvValue("GELATO_API_KEY", readFileSync(ENV_FILE, "utf8")) : undefined;
	const apiKey = process.env.GELATO_API_KEY || fileValue;
	if (!apiKey) throw new Error("GELATO_API_KEY is missing from .env.gelato.local.");
	return apiKey;
}

function retryDelay(response, attempt) {
	const exponential = Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** attempt);
	const retryAfter = response.headers.get("retry-after");
	if (!retryAfter) return exponential;
	const seconds = Number(retryAfter);
	const retryAt = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
	return Number.isFinite(retryAt) && retryAt > 0
		? Math.min(MAX_RETRY_DELAY_MS, Math.max(exponential, retryAt))
		: exponential;
}

async function requestJson(url, options, label, apiKey, sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))) {
	for (let attempt = 0; attempt < MAX_REQUEST_ATTEMPTS; attempt += 1) {
		let response;
		try {
			response = await fetch(url, {
				...options,
				signal: options.signal ?? AbortSignal.timeout((options.method === "POST" ? 15 : 5) * 60 * 1000),
				headers: {
					"Content-Type": "application/json",
					"X-API-KEY": apiKey,
					...options.headers,
				},
			});
		} catch (error) {
			throw new Error(`${label} request failed: ${error.message}`);
		}

		if (response.ok) {
			try {
				return await response.json();
			} catch {
				throw new Error(`${label} returned invalid JSON.`);
			}
		}

		if ((response.status === 429 || response.status >= 500) && attempt + 1 < MAX_REQUEST_ATTEMPTS) {
			const delay = retryDelay(response, attempt);
			await response.body?.cancel();
			await sleep(delay);
			continue;
		}
		await response.body?.cancel();
		throw new Error(`${label} failed with HTTP ${response.status}.`);
	}
	throw new Error(`${label} failed after ${MAX_REQUEST_ATTEMPTS} attempts.`);
}

async function fetchCatalogProducts(catalog, apiKey) {
	const products = [];
	for (let offset = 0; ; offset += PAGE_SIZE) {
		const url = `${API_BASE}/catalogs/${encodeURIComponent(catalog)}/products:search`;
		const payload = await requestJson(
			url,
			{ method: "POST", body: JSON.stringify({ limit: PAGE_SIZE, offset }) },
			`Gelato catalog ${catalog} offset ${offset}`,
			apiKey,
		);
		const page = Array.isArray(payload) ? payload : payload?.products;
		if (!Array.isArray(page)) {
			throw new Error(`Gelato catalog ${catalog} offset ${offset} returned no product list.`);
		}
		for (const product of page) {
			if (typeof product.productUid !== "string" || !product.attributes || typeof product.attributes !== "object") {
				throw new Error(`Gelato catalog ${catalog} returned a product without productUid and attributes.`);
			}
			products.push({ productUid: product.productUid, attributes: product.attributes });
		}
		if (page.length < PAGE_SIZE) return products;
	}
}

async function fetchUsCost(productUid, apiKey) {
	const params = new URLSearchParams({ country: "US", currency: "USD" });
	const payload = await requestJson(
		`${API_BASE}/products/${encodeURIComponent(productUid)}/prices?${params}`,
		{ method: "GET" },
		`Gelato US price for ${productUid}`,
		apiKey,
	);
	if (!Array.isArray(payload)) {
		throw new Error(`Gelato US price for ${productUid} returned no price list.`);
	}
	const entries = payload.filter((entry) => Number(entry?.quantity) === 1);
	if (entries.length > 1) throw new Error(`Gelato returned multiple quantity-1 prices for ${productUid}.`);
	if (entries.length === 0) return null;
	const cost = Number(entries[0].price);
	return Number.isFinite(cost) && cost > 0 ? cost : null;
}

function formatOptionValues(product) {
	return product.options.map(({ key, label, values }) => ({
		key,
		label,
		values: values.map(({ value, label: valueLabel }) => ({ value, label: valueLabel })),
	}));
}

function makeOutputProduct(product, variants, valueKey) {
	return {
		slug: product.slug,
		name: product.name,
		category: product.category,
		gelatoCatalog: product.gelatoCatalog,
		options: formatOptionValues(product),
		variants: variants.map((variant) => ({
			size: variant.size,
			options: variant.options,
			productUid: variant.productUid,
			[valueKey]: variant[valueKey],
		})),
	};
}

function printSummary(products, omitted) {
	console.log("Shop catalog summary:");
	for (const product of products) {
		const sizes = [...new Set(product.variants.map((variant) => variant.size))];
		console.log(
			`- ${product.product.slug}: ${product.variants.length} variants; sizes: ${sizes.join(", ") || "none"}`,
		);
	}
	if (omitted.length === 0) {
		console.log("Omitted variants: none");
		return;
	}
	console.log(`Omitted variants (${omitted.length}):`);
	for (const item of omitted) {
		console.log(`- ${item.slug} ${item.size} (${describeOptions(item.options)}): ${item.reason}`);
	}
}

export async function generateCatalog({
	apiKey = loadApiKey(),
	sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms)),
	now = () => new Date(),
	writeOutput = true,
} = {}) {
	const catalogProducts = new Map();
	const catalogs = [...new Set(PRODUCTS.map((product) => product.gelatoCatalog))];
	for (const catalog of catalogs) {
		catalogProducts.set(catalog, await fetchCatalogProducts(catalog, apiKey));
	}

	const selected = PRODUCTS.map((product) => {
		const selection = selectVariants(product, catalogProducts.get(product.gelatoCatalog));
		return { product, ...selection };
	});
	const omitted = selected.flatMap(({ omitted: missing }) => missing);
	const priceVariants = [];
	let priceCallCount = 0;
	for (const item of selected) {
		for (const variant of item.variants) {
			const cost = {};
			for (const orientation of ["hor", "ver"]) {
				if (priceCallCount > 0) await sleep(PRICE_CALL_GAP_MS);
				priceCallCount += 1;
				cost[orientation] = await fetchUsCost(variant.productUid[orientation], apiKey);
			}
			const missingPrices = ["hor", "ver"].filter((orientation) => cost[orientation] === null);
			if (missingPrices.length) {
				omitted.push({
					slug: item.product.slug,
					size: variant.size,
					options: variant.options,
					reason: `no US quantity-1 price for ${missingPrices.join(" or ")}`,
				});
				continue;
			}
			const costs = { hor: cost.hor, ver: cost.ver };
			priceVariants.push({
				product: item.product,
				variant: { ...variant, cost: costs, price: calculateRetailPrice(cost.hor, cost.ver) },
			});
		}
	}

	const pricedProducts = PRODUCTS.map((product) => ({
		product,
		variants: priceVariants.filter((item) => item.product.slug === product.slug).map((item) => item.variant),
	}));
	const metadata = {
		generatedAt: now().toLocaleDateString("en-CA"),
		country: "US",
		currency: "USD",
		markup: MARKUP,
		markupIsSample: true,
	};
	const catalogOutput = {
		...metadata,
		products: pricedProducts.map(({ product, variants }) =>
			makeOutputProduct(
				product,
				variants.map(({ cost, price, ...variant }) => ({ ...variant, price })),
				"price",
			),
		),
	};
	const costsOutput = {
		...metadata,
		products: pricedProducts.map(({ product, variants }) =>
			makeOutputProduct(
				product,
				variants.map(({ price, ...variant }) => variant),
				"cost",
			),
		),
	};

	if (writeOutput) {
		writeFileSync(CATALOG_FILE, `${JSON.stringify(catalogOutput, null, 2)}\n`);
		writeFileSync(COSTS_FILE, `${JSON.stringify(costsOutput, null, 2)}\n`);
	}
	printSummary(pricedProducts, omitted);
	return { catalog: catalogOutput, costs: costsOutput, omitted };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	generateCatalog().catch((error) => {
		console.error(`Shop catalog generation failed: ${error.message}`);
		process.exitCode = 1;
	});
}
