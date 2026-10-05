// Vercel build step (ADR 0002). Production builds deploy the Convex functions with
// CONVEX_DEPLOY_KEY so the site and its backend ship together. Previews use Convex dev.
import { execFileSync } from "node:child_process";

if (process.env.VERCEL_ENV === "production") {
	if (!process.env.CONVEX_DEPLOY_KEY) {
		console.error("CONVEX_DEPLOY_KEY is not set for Production; refusing to ship the site without its Convex functions.");
		process.exit(1);
	}
	execFileSync("npx", ["convex", "deploy"], { stdio: "inherit" });
} else {
	console.log(`Skipping Convex deploy for VERCEL_ENV=${process.env.VERCEL_ENV || "local"}; previews use the Convex dev deployment.`);
}
