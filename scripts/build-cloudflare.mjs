import { execFileSync } from "node:child_process";
import { cp, readFile, readdir, rm, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist");

// Served from .vercelignore's allowlist, minus what the Worker runs or what is config only.
const notStaticEntries = new Set(["/api", "/vercel.json", "/package.json"]);

const allowlist = (await readFile(join(root, ".vercelignore"), "utf8"))
	.split(/\r?\n/)
	.map((line) => line.trim())
	.filter((line) => line.startsWith("!/"))
	.map((line) => line.slice(1))
	.filter((entry) => !notStaticEntries.has(entry));

const hasDotSegment = (path) => relative(root, path).split(sep).some((segment) => segment.startsWith("."));
const globToRegExp = (glob) => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`);

await rm(out, { recursive: true, force: true });
await mkdir(out);

let copied = 0;
for (const entry of allowlist) {
	if (entry.includes("*")) {
		const matcher = globToRegExp(entry.slice(1));
		for (const name of await readdir(root)) {
			if (!matcher.test(name) || hasDotSegment(join(root, name))) continue;
			if (!(await stat(join(root, name))).isFile()) continue;
			await cp(join(root, name), join(out, name));
			copied += 1;
		}
		continue;
	}
	const source = join(root, entry.slice(1));
	await cp(source, join(out, entry.slice(1)), {
		recursive: true,
		filter: (path) => !hasDotSegment(path),
	});
	copied += 1;
}

const vercel = JSON.parse(await readFile(join(root, "vercel.json"), "utf8"));
const headerRules = vercel.headers.map((rule) => [
	rule.source.replace("(.*)", "*"),
	...rule.headers.map((header) => `  ${header.key}: ${header.value}`),
].join("\n"));
await writeFile(join(out, "_headers"), `${headerRules.join("\n\n")}\n`);

// The build copies the working tree, so this is the commit under release only when the tree is clean.
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("git rev-parse HEAD did not return a 40-character commit SHA");
await writeFile(join(out, "version.txt"), `${sha}\n`);

const redirectRules = (vercel.redirects || []).map((rule) => `${rule.source} ${rule.destination} ${rule.permanent ? 308 : 302}`);
if (redirectRules.length) await writeFile(join(out, "_redirects"), `${redirectRules.join("\n")}\n`);

console.log(`dist: ${copied} allowlist entries, ${headerRules.length} header rules, ${redirectRules.length} redirects`);
