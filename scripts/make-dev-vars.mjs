import { chmod, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Writes .dev.vars for wrangler dev from the local env files. Prints only the variable count, never values.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sources = [".env", ".env.local", ".env.stripe.local", ".env.gelato.local"];
const target = join(root, ".dev.vars");

const values = new Map();
for (const name of sources) {
	let source;
	try {
		source = await readFile(join(root, name), "utf8");
	} catch (error) {
		if (error.code === "ENOENT") continue;
		throw error;
	}
	for (const rawLine of source.replace(/^﻿/, "").split(/\r?\n/)) {
		const match = rawLine.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
		if (!match || values.has(match[1])) continue;
		let value = match[2];
		if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		} else {
			value = value.replace(/\s+#.*$/, "").trim();
		}
		values.set(match[1], value);
	}
}

const body = [...values].map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n");
await writeFile(target, `${body}\n`, { mode: 0o600 });
await chmod(target, 0o600);
console.log(`Wrote .dev.vars with ${values.size} variables.`);
