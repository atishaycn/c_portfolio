#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ENV_FILE = resolve(ROOT, ".env.shopify.local");
const mode = process.argv[2];
const settings = {
	"--client-id": {
		key: "SHOPIFY_CLIENT_ID",
		validate: (value) => /^[a-f0-9]{32}$/i.test(value),
	},
	"--client-secret": {
		key: "SHOPIFY_CLIENT_SECRET",
		validate: (value) => /^shpss_[A-Za-z0-9]+$/.test(value),
	},
};

assert(settings[mode], "Usage: node scripts/capture-shopify-credential.mjs --client-id|--client-secret");
const value = execFileSync("/usr/bin/pbpaste", { encoding: "utf8" }).trim();
assert(settings[mode].validate(value), `Clipboard does not contain a valid ${settings[mode].key}`);

const values = new Map([
	["SHOPIFY_STORE_DOMAIN", "esf4bj-wk.myshopify.com"],
	["SHOPIFY_API_VERSION", "2026-07"],
]);
if (existsSync(ENV_FILE)) {
	for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
		const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
		if (match) values.set(match[1], match[2]);
	}
}
values.set(settings[mode].key, value);

writeFileSync(ENV_FILE, `${[...values].map(([key, entry]) => `${key}=${entry}`).join("\n")}\n`, { mode: 0o600 });
chmodSync(ENV_FILE, 0o600);
console.log(`Saved ${settings[mode].key} to ignored .env.shopify.local.`);
