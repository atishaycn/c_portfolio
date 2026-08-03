import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import cloudinary from "../api/_lib/cloudinary.js";

const root = resolve(import.meta.dirname, "..");
const environment = Object.fromEntries(
	readFileSync(resolve(root, ".env"), "utf8")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#") && line.includes("="))
		.map((line) => {
			const separator = line.indexOf("=");
			return [line.slice(0, separator), line.slice(separator + 1)];
		}),
);
Object.assign(process.env, environment);

const content = JSON.parse(readFileSync(resolve(root, "content", "portfolio.json"), "utf8"));
await cloudinary.writeRemoteContent(content, null);
console.log(
	`Seeded ${content.albums.length} albums and ${content.albums.reduce((sum, album) => sum + album.items.length, 0)} photos to Cloudinary.`,
);
