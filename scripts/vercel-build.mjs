// Vercel build step (ADR 0002). Production builds deploy the Convex functions with
// CONVEX_DEPLOY_KEY so the site and its backend ship together. Previews use Convex dev.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.env.VERCEL_ENV === "production") {
	if (!process.env.CONVEX_DEPLOY_KEY) {
		console.error("CONVEX_DEPLOY_KEY is not set for Production; refusing to ship the site without its Convex functions.");
		process.exit(1);
	}
	execFileSync("npx", ["convex", "deploy"], { stdio: "inherit" });
} else {
	console.log(`Skipping Convex deploy for VERCEL_ENV=${process.env.VERCEL_ENV || "local"}; previews use the Convex dev deployment.`);
}

// Never serve the repository root: dependency installation adds node_modules,
// and the build inputs include backend code. Vercel builds api/ separately.
const output = path.resolve("public");
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output);
for (const entry of fs.readdirSync(".", { withFileTypes: true })) {
	if (entry.isFile() && !entry.name.startsWith(".") && /\.(html|js|css|JPG)$/.test(entry.name)) {
		fs.copyFileSync(entry.name, path.join(output, entry.name));
	} else if (entry.isDirectory() && ["assets", "content"].includes(entry.name)) {
		fs.cpSync(entry.name, path.join(output, entry.name), { recursive: true });
	}
}
console.log("Copied public site files into public/.");
