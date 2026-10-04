import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import inquiryLib from "../api/_lib/inquiry.js";
import handlerModule from "../api/inquiry.js";

const { buildInquiryEmail, createRateLimiter, parseInquiry } = inquiryLib;
const { createHandler } = handlerModule;

const valid = {
	name: "Ada Lovelace",
	contact: "ada@example.com",
	date: "2026-11-14",
	location: "Mission District",
	projectType: "Corporate",
	referral: "Instagram",
	message: "Launch party for 80 people.",
};

const request = (body, headers = {}) => {
	const stream = Readable.from([JSON.stringify(body)]);
	stream.method = "POST";
	stream.headers = { host: "clairethomas.art", origin: "https://clairethomas.art", "x-forwarded-for": "203.0.113.9", ...headers };
	return stream;
};

const response = () => {
	const res = { statusCode: 0, headers: {}, body: "" };
	res.setHeader = (name, value) => (res.headers[name.toLowerCase()] = value);
	res.end = (chunk) => (res.body = chunk);
	return res;
};

const fakeResend = (status = 200) => {
	const calls = [];
	const fetchImpl = async (url, options) => {
		calls.push({ url, options, payload: JSON.parse(options.body) });
		return { ok: status < 300, status, json: async () => ({ id: "email_1" }), text: async () => "upstream says no" };
	};
	return { calls, fetchImpl };
};

const handlerWith = (resend, env = { RESEND_API_KEY: "re_test" }) =>
	createHandler({ fetchImpl: resend.fetchImpl, env, rateLimit: () => true });

test("parseInquiry accepts a complete inquiry and a phone number as contact", () => {
	assert.equal(parseInquiry(valid).ok, true);
	assert.equal(parseInquiry({ ...valid, contact: "(415) 555-0134" }).ok, true);
});

test("parseInquiry requires name, a usable contact, and a known referral", () => {
	const result = parseInquiry({ name: " ", contact: "hello", referral: "Billboard" });
	assert.equal(result.ok, false);
	assert.deepEqual(Object.keys(result.errors).sort(), ["contact", "name", "referral"]);
});

test("parseInquiry rejects unknown project types and drops the Other detail unless Other is chosen", () => {
	assert.equal(parseInquiry({ ...valid, projectType: "Wedding" }).ok, false);
	const { inquiry } = parseInquiry({ ...valid, projectType: "Personal", projectTypeOther: "ignored" });
	assert.equal(inquiry.projectTypeOther, "");
});

test("parseInquiry keeps header-bound fields on one line", () => {
	const { inquiry } = parseInquiry({ ...valid, name: "Ada\nBcc: spam@example.com" });
	assert.equal(inquiry.name, "Ada Bcc: spam@example.com");
});

test("buildInquiryEmail lists only answered fields and replies to email contacts", () => {
	const { inquiry } = parseInquiry({ ...valid, date: "", projectType: "Other", projectTypeOther: "Book launch" });
	const email = buildInquiryEmail(inquiry);
	assert.equal(email.subject, "Inquiry from Ada Lovelace (Other: Book launch)");
	assert.equal(email.replyTo, "ada@example.com");
	assert.match(email.text, /^Launch party for 80 people\.\n\nName: Ada Lovelace/);
	assert.doesNotMatch(email.text, /Project date/);
	assert.match(email.text, /Found me through: Instagram/);
});

test("buildInquiryEmail has no reply-to when the contact is a phone number", () => {
	const { inquiry } = parseInquiry({ ...valid, contact: "415 555 0134", message: "" });
	const email = buildInquiryEmail(inquiry);
	assert.equal(email.replyTo, undefined);
	assert.match(email.text, /^Name: Ada Lovelace/);
});

test("rate limiter allows a burst then blocks until the window passes", () => {
	let now = 0;
	const allow = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });
	assert.equal(allow("ip"), true);
	assert.equal(allow("ip"), true);
	assert.equal(allow("ip"), false);
	assert.equal(allow("other-ip"), true);
	now = 1001;
	assert.equal(allow("ip"), true);
});

test("handler sends a valid inquiry through Resend", async () => {
	const resend = fakeResend();
	const res = response();
	await handlerWith(resend)(request(valid), res);
	assert.equal(res.statusCode, 200);
	assert.deepEqual(JSON.parse(res.body), { sent: true });
	assert.equal(resend.calls.length, 1);
	const { url, options, payload } = resend.calls[0];
	assert.equal(url, "https://api.resend.com/emails");
	assert.equal(options.headers.Authorization, "Bearer re_test");
	assert.deepEqual(payload.to, ["contact@clairethomas.art"]);
	assert.equal(payload.from, "Claire Thomas website <website@clairethomas.art>");
	assert.equal(payload.reply_to, "ada@example.com");
});

test("handler returns field errors without sending", async () => {
	const resend = fakeResend();
	const res = response();
	await handlerWith(resend)(request({ ...valid, contact: "nope" }), res);
	assert.equal(res.statusCode, 400);
	assert.ok(JSON.parse(res.body).fields.contact);
	assert.equal(resend.calls.length, 0);
});

test("handler quietly accepts honeypot submissions without sending", async () => {
	const resend = fakeResend();
	const res = response();
	await handlerWith(resend)(request({ ...valid, website: "http://spam.example" }), res);
	assert.equal(res.statusCode, 200);
	assert.equal(resend.calls.length, 0);
});

test("handler refuses other origins and non-POST methods", async () => {
	const resend = fakeResend();
	const crossSite = response();
	await handlerWith(resend)(request(valid, { origin: "https://evil.example" }), crossSite);
	assert.equal(crossSite.statusCode, 403);
	const get = response();
	const getRequest = request(valid);
	getRequest.method = "GET";
	await handlerWith(resend)(getRequest, get);
	assert.equal(get.statusCode, 405);
	assert.equal(resend.calls.length, 0);
});

test("handler asks the page to fall back to email when sending is unavailable", async () => {
	const missingKey = response();
	await handlerWith(fakeResend(), {})(request(valid), missingKey);
	assert.equal(missingKey.statusCode, 503);
	assert.equal(JSON.parse(missingKey.body).fallback, true);

	const upstreamError = response();
	await handlerWith(fakeResend(422))(request(valid), upstreamError);
	assert.equal(upstreamError.statusCode, 502);
	assert.equal(JSON.parse(upstreamError.body).fallback, true);
});

test("handler rate-limits repeat submissions", async () => {
	const resend = fakeResend();
	const res = response();
	await createHandler({ fetchImpl: resend.fetchImpl, env: { RESEND_API_KEY: "re_test" }, rateLimit: () => false })(request(valid), res);
	assert.equal(res.statusCode, 429);
	assert.equal(resend.calls.length, 0);
});
