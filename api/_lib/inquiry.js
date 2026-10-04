const PROJECT_TYPES = ["Corporate", "Personal", "Other"];
const REFERRAL_SOURCES = ["Google", "Instagram", "Referral", "Other"];

const LIMITS = {
	name: 120,
	contact: 200,
	date: 40,
	location: 200,
	projectTypeOther: 200,
	message: 5000,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value, limit) =>
	String(value ?? "")
		.replace(/\r\n?/g, "\n")
		.trim()
		.slice(0, limit);

// Header-bound values must stay on one line.
const singleLine = (value) => value.replace(/\s+/g, " ").trim();

const isEmail = (value) => EMAIL_PATTERN.test(value);
const looksLikeContact = (value) => isEmail(value) || value.replace(/\D/g, "").length >= 7;

/**
 * Validate and normalize a booking inquiry from the public form.
 * Returns `{ ok: true, inquiry }` or `{ ok: false, errors }` keyed by field name.
 */
const parseInquiry = (body = {}) => {
	const inquiry = {
		name: singleLine(clean(body.name, LIMITS.name)),
		contact: singleLine(clean(body.contact, LIMITS.contact)),
		date: singleLine(clean(body.date, LIMITS.date)),
		location: singleLine(clean(body.location, LIMITS.location)),
		projectType: singleLine(clean(body.projectType, 40)),
		projectTypeOther: singleLine(clean(body.projectTypeOther, LIMITS.projectTypeOther)),
		referral: singleLine(clean(body.referral, 40)),
		message: clean(body.message, LIMITS.message),
	};
	const errors = {};
	if (!inquiry.name) errors.name = "Please enter your name.";
	if (!inquiry.contact) errors.contact = "Please enter an email address or a phone number.";
	else if (!looksLikeContact(inquiry.contact)) errors.contact = "Please enter an email address or a phone number.";
	if (inquiry.projectType && !PROJECT_TYPES.includes(inquiry.projectType)) errors.projectType = "Please choose a project type.";
	if (!REFERRAL_SOURCES.includes(inquiry.referral)) errors.referral = "Please tell me how you found me.";
	if (inquiry.projectType !== "Other") inquiry.projectTypeOther = "";
	return Object.keys(errors).length ? { ok: false, errors } : { ok: true, inquiry };
};

const projectTypeLabel = (inquiry) =>
	inquiry.projectType === "Other" && inquiry.projectTypeOther ? `Other: ${inquiry.projectTypeOther}` : inquiry.projectType;

/** Build the email Claire receives for a validated inquiry. */
const buildInquiryEmail = (inquiry) => {
	const projectType = projectTypeLabel(inquiry);
	const details = [
		["Name", inquiry.name],
		["Email or phone", inquiry.contact],
		["Project date", inquiry.date],
		["Project location", inquiry.location],
		["Project type", projectType],
		["Found me through", inquiry.referral],
	]
		.filter(([, answer]) => answer)
		.map(([label, answer]) => `${label}: ${answer}`);
	const opening = inquiry.message ? [inquiry.message, ""] : [];
	const text = [...opening, ...details, "", "Sent from the booking form on clairethomas.art"].join("\n");
	return {
		subject: `Inquiry from ${inquiry.name}${projectType ? ` (${projectType})` : ""}`,
		text,
		replyTo: isEmail(inquiry.contact) ? inquiry.contact : undefined,
	};
};

/**
 * Best-effort per-instance limiter. Serverless instances do not share memory,
 * so this only slows down repeated submissions hitting the same instance.
 */
const createRateLimiter = ({ limit = 5, windowMs = 10 * 60 * 1000, now = () => Date.now() } = {}) => {
	const hits = new Map();
	return (key) => {
		const time = now();
		const recent = (hits.get(key) || []).filter((stamp) => time - stamp < windowMs);
		if (recent.length >= limit) {
			hits.set(key, recent);
			return false;
		}
		recent.push(time);
		hits.set(key, recent);
		if (hits.size > 5000) hits.delete(hits.keys().next().value);
		return true;
	};
};

/** Send through Resend's REST API. Throws on any non-2xx response. */
const sendWithResend = async ({ apiKey, from, to, email, fetchImpl = fetch }) => {
	const response = await fetchImpl("https://api.resend.com/emails", {
		method: "POST",
		headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
		body: JSON.stringify({
			from,
			to: [to],
			subject: email.subject,
			text: email.text,
			...(email.replyTo ? { reply_to: email.replyTo } : {}),
		}),
	});
	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		const error = new Error(`Resend responded ${response.status}: ${detail.slice(0, 300)}`);
		error.statusCode = 502;
		throw error;
	}
	return response.json().catch(() => ({}));
};

module.exports = {
	PROJECT_TYPES,
	REFERRAL_SOURCES,
	buildInquiryEmail,
	createRateLimiter,
	looksLikeContact,
	parseInquiry,
	sendWithResend,
};
