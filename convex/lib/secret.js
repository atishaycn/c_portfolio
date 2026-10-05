// Every public function is called only by the site's Vercel functions (ADR 0001),
// which pass the shared secret as the first argument.
import { v } from "convex/values";

export const secretArg = { secret: v.string() };

const sameText = (a, b) => {
	if (a.length !== b.length) return false;
	let difference = 0;
	for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
	return difference === 0;
};

export const assertSecret = (secret) => {
	const expected = process.env.INTAKE_CONVEX_SECRET || "";
	if (expected.length < 32 || !sameText(String(secret || ""), expected)) throw new Error("Not allowed");
};
