import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");

const parseEnvironment = (path) => {
	if (!existsSync(path)) throw new Error(`Missing ${path}`);
	return Object.fromEntries(
		readFileSync(path, "utf8")
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#") && line.includes("="))
			.map((line) => {
				const separator = line.indexOf("=");
				return [line.slice(0, separator), line.slice(separator + 1)];
			}),
	);
};

const values = {
	...parseEnvironment(resolve(root, ".env")),
	...parseEnvironment(resolve(root, ".env.local")),
};

const requiredNames = [
	"CLOUDINARY_CLOUD_NAME",
	"CLOUDINARY_API_KEY",
	"CLOUDINARY_API_SECRET",
	"ADMIN_EMAIL",
	"ADMIN_PASSWORD_HASH",
	"ADMIN_SESSION_SECRET",
];

for (const name of requiredNames) {
	const value = values[name];
	if (!value) throw new Error(`${name} is missing`);
	const result = spawnSync(
		"vercel",
		["env", "add", name, "production", "--force", "--yes"],
		{
			cwd: root,
			encoding: "utf8",
			input: `${value}\n`,
			stdio: ["pipe", "pipe", "pipe"],
		},
	);
	if (result.status !== 0) {
		throw new Error(`Failed to configure ${name}: ${result.stderr || result.stdout}`);
	}
	console.log(`Configured ${name} for production`);
}
