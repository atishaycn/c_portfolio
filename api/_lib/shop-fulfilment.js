const { cropRectangle, printFileUrl } = require("./shop-order");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fail = (message) => new Error(message);

// Confirms each original once and returns one cropped print file URL per line.
const printFiles = async ({ cloudName, confirmOriginal }, pricedCart) => {
	const resources = new Map();
	const files = [];
	for (const line of pricedCart.lines) {
		let resource = resources.get(line.photo.publicId);
		if (!resource) {
			resource = await confirmOriginal(line.photo);
			if (resource.public_id !== line.photo.publicId || resource.width !== line.photo.width || resource.height !== line.photo.height) {
				throw Object.assign(new Error("Original print file changed."), { statusCode: 409, publicMessage: true });
			}
			resources.set(line.photo.publicId, resource);
		}
		files.push(printFileUrl(cloudName, line.photo, resource, cropRectangle(line.photo, line.size, line.crop)));
	}
	return files;
};
const trimmed = (value) => typeof value === "string" ? value.trim() : "";
const shippingDetails = (session) => session?.collected_information?.shipping_details || session?.shipping_details;
const customerName = (session) => trimmed(shippingDetails(session)?.name) || trimmed(session?.customer_details?.name);
const money = (cents) => Number.isSafeInteger(cents) ? `$${(cents / 100).toFixed(2)}` : "unknown";

const buildGelatoOrder = (session, pricedCart, files) => {
	const shipping = shippingDetails(session);
	const address = shipping?.address;
	const name = customerName(session);
	const email = trimmed(session?.customer_details?.email) || trimmed(session?.customer_email);
	const sessionId = trimmed(session?.id);
	const country = trimmed(address?.country).toUpperCase();
	const addressParts = [address?.line1, address?.city, address?.state, address?.postal_code];
	if (!sessionId || !name || !addressParts.every((part) => trimmed(part)) || country !== "US") {
		throw fail("A complete US shipping address is required for Shop fulfillment.");
	}
	if (!EMAIL_PATTERN.test(email)) throw fail("A valid customer email is required for Shop fulfillment.");
	if (!Array.isArray(pricedCart?.lines) || pricedCart.lines.length < 1 || !Array.isArray(files) || files.length !== pricedCart.lines.length) {
		throw fail("Shop order lines and print files do not match.");
	}
	if (files.some((file) => typeof file !== "string" || !file.trim())) throw fail("Every Shop order line needs a print file.");

	const [firstName, ...lastNameParts] = name.split(/\s+/);
	const customer = typeof session.customer === "string" ? session.customer : trimmed(session.customer?.id);
	return {
		orderType: "draft",
		orderReferenceId: sessionId,
		customerReferenceId: customer || sessionId,
		currency: "USD",
		items: pricedCart.lines.map((line, index) => ({
			itemReferenceId: `${sessionId}-${index + 1}`,
			productUid: line.productUid,
			files: [{ type: "default", url: files[index] }],
			quantity: line.quantity,
		})),
		shippingAddress: {
			firstName,
			lastName: lastNameParts.join(" ") || firstName,
			addressLine1: trimmed(address.line1),
			addressLine2: trimmed(address.line2),
			city: trimmed(address.city),
			state: trimmed(address.state),
			postCode: trimmed(address.postal_code),
			country: "US",
			email,
			phone: trimmed(session?.customer_details?.phone),
		},
	};
};

const lineDescription = (line) => {
	const options = Object.entries(line.optionLabels || {}).map(([label, value]) => `${label}: ${value}`);
	return [line.productName, line.size, ...options].join(" · ");
};

const buildShopOrderEmail = ({ session, pricedCart, gelatoOrderId }) => {
	const name = customerName(session);
	const city = trimmed(shippingDetails(session)?.address?.city);
	const lines = pricedCart.lines.map((line) => `- ${lineDescription(line)} × ${line.quantity} — ${money(line.lineTotal)}`);
	return {
		subject: `Shop order paid — ${money(pricedCart.total)}`,
		text: [
			"Paid Shop order",
			`Customer: ${name}`,
			`City: ${city}`,
			"Items:",
			...lines,
			`Total: ${money(pricedCart.total)}`,
			`Sales tax: ${money(session?.total_details?.amount_tax ?? 0)}`,
			`Paid: ${money(session?.amount_total)}`,
			`Gelato order: ${gelatoOrderId}`,
			"Draft order: check it and submit it in the Gelato dashboard (Orders → Drafts).",
		].join("\n"),
	};
};

const buildShopOrderMismatchEmail = ({ session, pricedCart }) => {
	const currency = trimmed(session?.currency).toUpperCase() || "unknown currency";
	const beforeTax = session?.amount_total == null ? null : session.amount_total - (session.total_details?.amount_tax ?? 0);
	return {
		subject: `Shop order total mismatch — paid ${money(beforeTax)} ${currency} before tax, current ${money(pricedCart?.total)} USD`,
		text: [
			"A paid Shop checkout does not match the current catalog total.",
			`Stripe session: ${trimmed(session?.id) || "unknown"}`,
			`Paid total: ${money(session?.amount_total)} ${currency}`,
			`Paid before tax: ${money(beforeTax)} ${currency}`,
			`Current catalog total: ${money(pricedCart?.total)} USD`,
			"No Gelato draft order was created. Please review this payment.",
		].join("\n"),
	};
};

const buildShopOrderRefusalEmail = ({ session, error }) => {
	const currency = trimmed(session?.currency).toUpperCase() || "unknown currency";
	return {
		subject: `Shop order cannot be fulfilled automatically — ${money(session?.amount_total)} ${currency}`,
		text: [
			"Paid Shop order cannot be fulfilled automatically.",
			`Stripe session: ${trimmed(session?.id) || "unknown"}`,
			`Paid total: ${money(session?.amount_total)} ${currency}`,
			`Reason: ${trimmed(error?.message) || "Order details could not be verified."}`,
			"No Gelato draft order was created. Please review this payment.",
		].join("\n"),
	};
};

module.exports = { buildGelatoOrder, buildShopOrderEmail, buildShopOrderMismatchEmail, buildShopOrderRefusalEmail, printFiles };
