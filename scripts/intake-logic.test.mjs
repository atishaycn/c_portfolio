import assert from "node:assert/strict";
import test from "node:test";
import {
	DAY_MS,
	cleanAnswer,
	cleanQuestion,
	computeLeanings,
	describeScore,
	isLinkOpen,
	isNewItem,
	linkClosesAt,
	missingForSubmit,
	orderDeck,
	statusAfterClaireAdds,
	statusAfterClientSave,
} from "../convex/lib/logic.js";

const pose = (id, rank, values) => ({ _id: id, rank, tags: Object.entries(values).map(([group, value]) => ({ group, value })) });

test("orderDeck takes the lowest ranks up to the limit", () => {
	const deck = orderDeck([pose("c", 3, {}), pose("a", 1, {}), pose("b", 2, {}), pose("d", 4, {})], 3);
	assert.deepEqual(deck.map((entry) => entry._id), ["a", "b", "c"]);
});

test("orderDeck keeps a tag value from showing up three times in a row when it can", () => {
	const deck = orderDeck(
		[pose("o1", 1, { setting: "out" }), pose("o2", 2, { setting: "out" }), pose("o3", 3, { setting: "out" }), pose("i1", 4, { setting: "in" })],
		10,
	);
	assert.deepEqual(deck.map((entry) => entry._id), ["o1", "o2", "i1", "o3"]);
});

test("orderDeck falls back to rank order when every pose shares the value", () => {
	const deck = orderDeck([pose("a", 1, { s: "x" }), pose("b", 2, { s: "x" }), pose("c", 3, { s: "x" })], 10);
	assert.deepEqual(deck.map((entry) => entry._id), ["a", "b", "c"]);
});

test("computeLeanings scores must ×2, like +1, dislike −1 per swiped card and needs three cards", () => {
	const poses = ["p1", "p2", "p3", "p4"].map((id) => pose(id, 0, { style: "candid" }));
	poses[3] = pose("p4", 0, { style: "posed" });
	const deck = poses.map((entry, index) => ({ key: `k${index}`, poseId: entry._id }));
	const swipes = [
		{ deckKey: "k0", choice: "must" },
		{ deckKey: "k1", choice: "like" },
		{ deckKey: "k2", choice: "dislike" },
		{ deckKey: "k3", choice: "like" },
	];
	const tagGroups = [{ _id: "style", name: "Style", values: [{ key: "candid", label: "Candid" }, { key: "posed", label: "Posed" }] }];
	const [style] = computeLeanings({ deck, swipes, poses, tagGroups });
	assert.equal(style.group, "Style");
	// Posed has one swipe only, so it is left out.
	assert.deepEqual(style.values, [{ key: "candid", label: "Candid", count: 3, score: 0.67 }]);
});

test("computeLeanings ignores skips and removed cards", () => {
	const poses = ["a", "b", "c", "d"].map((id) => pose(id, 0, { s: "x" }));
	const deck = poses.map((entry, index) => ({ key: `k${index}`, poseId: entry._id, ...(index === 3 ? { removedAt: 1 } : {}) }));
	const swipes = [
		{ deckKey: "k0", choice: "like" },
		{ deckKey: "k1", choice: "skip" },
		{ deckKey: "k2", choice: "like" },
		{ deckKey: "k3", choice: "like" },
	];
	const tagGroups = [{ _id: "s", name: "S", values: [{ key: "x", label: "X" }] }];
	assert.deepEqual(computeLeanings({ deck, swipes, poses, tagGroups }), []);
});

test("describeScore turns scores into plain words", () => {
	assert.deepEqual([2, 0.5, 0, -1].map(describeScore), ["loves", "likes", "mixed", "avoid"]);
});

test("links close 30 days after the end of the shoot day, or when revoked", () => {
	const closes = linkClosesAt("2026-11-01");
	assert.equal(closes, Date.parse("2026-12-02T00:00:00Z"));
	const intake = { shootDate: "2026-11-01", revoked: false };
	assert.equal(isLinkOpen(intake, closes - 1), true);
	assert.equal(isLinkOpen(intake, closes), false);
	assert.equal(isLinkOpen({ ...intake, revoked: true }, closes - DAY_MS), false);
	assert.equal(isLinkOpen({ shootDate: "nonsense", revoked: false }, 0), false);
});

test("items are new only when added after the last submit", () => {
	assert.equal(isNewItem({ addedAt: 5 }, { submittedAt: 4 }), true);
	assert.equal(isNewItem({ addedAt: 3 }, { submittedAt: 4 }), false);
	assert.equal(isNewItem({ addedAt: 5 }, {}), false);
});

test("missingForSubmit counts unswiped cards and unanswered required questions", () => {
	const intake = {
		status: "started",
		deck: [{ key: "c1" }, { key: "c2" }, { key: "c3", removedAt: 1 }],
		questions: [
			{ key: "q1", required: true },
			{ key: "q2", required: false },
			{ key: "q3", required: true, removedAt: 1 },
			{ key: "q4", required: true },
		],
	};
	const missing = missingForSubmit({ intake, swipes: [{ deckKey: "c1" }], answers: [{ questionKey: "q1", value: "yes" }, { questionKey: "q4", value: "  " }] });
	assert.deepEqual(missing, { cards: 1, questions: ["q4"] });
});

test("after Claire adds items to a submitted intake, only the new ones are required", () => {
	const intake = {
		status: "needs update",
		submittedAt: 10,
		deck: [{ key: "old", addedAt: 1 }, { key: "new", addedAt: 20 }],
		questions: [{ key: "oldq", required: true, addedAt: 1 }, { key: "newq", required: true, addedAt: 20 }],
	};
	assert.deepEqual(missingForSubmit({ intake, swipes: [], answers: [] }), { cards: 1, questions: ["newq"] });
});

test("status moves to started on the client's first save and to needs update when Claire adds after submit", () => {
	assert.equal(statusAfterClientSave("sent"), "started");
	assert.equal(statusAfterClientSave("submitted"), "submitted");
	assert.equal(statusAfterClaireAdds("submitted"), "needs update");
	assert.equal(statusAfterClaireAdds("started"), "started");
});

test("cleanAnswer keeps choices to the listed options", () => {
	const single = { kind: "single", options: ["A", "B"] };
	const multiple = { kind: "multiple", options: ["A", "B"] };
	assert.equal(cleanAnswer(single, "A"), "A");
	assert.equal(cleanAnswer(single, "C"), null);
	assert.deepEqual(cleanAnswer(multiple, ["B", "A", "B"]), ["B", "A"]);
	assert.equal(cleanAnswer(multiple, ["Z"]), null);
	assert.equal(cleanAnswer({ kind: "short", options: [] }, "  hi  "), "hi");
});

test("cleanQuestion needs a prompt and at least two options for choice questions", () => {
	assert.throws(() => cleanQuestion({ prompt: " ", kind: "short", options: [], help: "", required: false }), /prompt/);
	assert.throws(() => cleanQuestion({ prompt: "Pick", kind: "single", options: ["Only"], help: "", required: false }), /two options/);
	assert.deepEqual(cleanQuestion({ prompt: "Name?", kind: "short", options: ["ignored"], help: "", required: true }).options, []);
});
