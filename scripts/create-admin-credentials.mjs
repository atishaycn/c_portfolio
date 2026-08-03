import { chmodSync, writeFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const email = "contact@clairethomas.art";
const password = randomBytes(18).toString("base64url");
const salt = randomBytes(16).toString("hex");
const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
const sessionSecret = randomBytes(48).toString("base64url");

const credentialsPath = resolve(root, ".admin-credentials.local.json");
const environmentPath = resolve(root, ".env.local");

writeFileSync(
	credentialsPath,
	`${JSON.stringify(
		{
			adminUrl: "https://clairethomas.art/admin.html",
			email,
			password,
		},
		null,
		2,
	)}\n`,
	{ mode: 0o600 },
);
chmodSync(credentialsPath, 0o600);

writeFileSync(
	environmentPath,
	[
		`ADMIN_EMAIL=${email}`,
		`ADMIN_PASSWORD_HASH=${passwordHash}`,
		`ADMIN_SESSION_SECRET=${sessionSecret}`,
		"",
	].join("\n"),
	{ mode: 0o600 },
);
chmodSync(environmentPath, 0o600);

console.log(`Created local admin credentials at ${credentialsPath}`);
console.log(`Created local admin environment at ${environmentPath}`);
