import assert from "node:assert/strict";
import test from "node:test";

const { default: worker } = await import("../worker/index.mjs");
const env = { SHOP_OPEN_HOSTS: "clairethomas-site.phunnysunny.workers.dev" };

test("the Shop is closed on hosts outside SHOP_OPEN_HOSTS", async () => {
	const catalog = await worker.fetch(new Request("https://clairethomas.art/api/shop-catalog"), env);
	assert.equal(catalog.status, 200);
	assert.deepEqual(await catalog.json(), { open: false });
	assert.equal(catalog.headers.get("Cache-Control"), "no-store");

	const checkout = await worker.fetch(new Request("https://clairethomas.art/api/shop-checkout", { method: "POST", body: "{}" }), env);
	assert.equal(checkout.status, 404);
	const order = await worker.fetch(new Request("https://clairethomas.art/api/shop-order?session_id=cs_test_1"), env);
	assert.equal(order.status, 404);
});

test("the Shop is closed everywhere when SHOP_OPEN_HOSTS is unset", async () => {
	const catalog = await worker.fetch(new Request("https://clairethomas-site.phunnysunny.workers.dev/api/shop-catalog"), {});
	assert.deepEqual(await catalog.json(), { open: false });
});

test("an open host reaches the real checkout handler", async () => {
	const checkout = await worker.fetch(new Request("https://clairethomas-site.phunnysunny.workers.dev/api/shop-checkout", { method: "GET" }), env);
	assert.notEqual(checkout.status, 404);
});
