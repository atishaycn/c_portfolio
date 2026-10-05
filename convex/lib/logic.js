// Pure intake rules shared by the Convex functions. No database access here,
// so `scripts/intake-logic.test.mjs` can test them directly.

export const CHOICES = ["like", "dislike", "must", "skip"];
export const QUESTION_KINDS = ["short", "long", "single", "multiple", "datetime"];
export const DAY_MS = 24 * 60 * 60 * 1000;
export const LINK_DAYS_AFTER_SHOOT = 30;
export const CLEANUP_DAYS_AFTER_SHOOT = 365;
export const MIN_LEANING_EVIDENCE = 3;

/** Shoot dates are calendar days (YYYY-MM-DD); a link closes 30 days after the end of that day (UTC). */
export const linkClosesAt = (shootDate) => {
	const start = Date.parse(`${shootDate}T00:00:00Z`);
	return Number.isFinite(start) ? start + (1 + LINK_DAYS_AFTER_SHOOT) * DAY_MS : 0;
};

export const isLinkOpen = (intake, now) => !intake.revoked && !intake.cleanedAt && now < linkClosesAt(intake.shootDate);

/** An item is "new from Claire" when she added it after the client's last submit. */
export const isNewItem = (item, intake) => Boolean(intake.submittedAt && item.addedAt > intake.submittedAt);

const valuesOf = (pose) => (pose?.tags || []).map((tag) => `${tag.group}:${tag.value}`);

/**
 * Pick the deck for an event type: lowest rank first, at most `limit` cards, then spread
 * so no tag value shows up more than twice in a row when another order allows it.
 */
export const orderDeck = (poses, limit) => {
	const remaining = [...poses].sort((a, b) => a.rank - b.rank || String(a._id).localeCompare(String(b._id))).slice(0, limit);
	const deck = [];
	while (remaining.length) {
		const [last, previous] = [deck.at(-1), deck.at(-2)];
		const blocked = new Set(last && previous ? valuesOf(last).filter((value) => valuesOf(previous).includes(value)) : []);
		let index = remaining.findIndex((pose) => !valuesOf(pose).some((value) => blocked.has(value)));
		if (index === -1) index = 0;
		deck.push(remaining.splice(index, 1)[0]);
	}
	return deck;
};

/**
 * A client's leaning for each tag value: (2 × must + like − dislike) ÷ cards swiped with that value.
 * Skips and removed cards don't count. Values with fewer than three swiped cards are left out.
 */
export const computeLeanings = ({ deck, swipes, poses, tagGroups }) => {
	const choiceByKey = new Map(swipes.map((swipe) => [swipe.deckKey, swipe.choice]));
	const poseById = new Map(poses.map((pose) => [String(pose._id), pose]));
	const tally = new Map();
	for (const card of deck) {
		if (card.removedAt) continue;
		const choice = choiceByKey.get(card.key);
		if (!choice || choice === "skip") continue;
		const points = choice === "must" ? 2 : choice === "like" ? 1 : -1;
		for (const tag of poseById.get(String(card.poseId))?.tags || []) {
			const id = `${tag.group}:${tag.value}`;
			const entry = tally.get(id) || { points: 0, count: 0 };
			entry.points += points;
			entry.count += 1;
			tally.set(id, entry);
		}
	}
	return tagGroups
		.map((group) => ({
			group: group.name,
			values: group.values
				.map((value) => ({ ...value, ...tally.get(`${group._id}:${value.key}`) }))
				.filter((value) => value.count >= MIN_LEANING_EVIDENCE)
				.map((value) => ({
					key: value.key,
					label: value.label,
					count: value.count,
					score: Math.round((value.points / value.count) * 100) / 100,
				}))
				.sort((a, b) => b.score - a.score),
		}))
		.filter((group) => group.values.length);
};

/** Plain-words reading of a leaning score (range −1 to 2). */
export const describeScore = (score) =>
	score >= 1 ? "loves" : score >= 0.4 ? "likes" : score <= -0.4 ? "avoid" : "mixed";

/** What the client still has to do before they can submit. */
export const missingForSubmit = ({ intake, answers, swipes }) => {
	const updateOnly = intake.status === "needs update";
	const inScope = (item) => !item.removedAt && (!updateOnly || isNewItem(item, intake));
	const swiped = new Set(swipes.map((swipe) => swipe.deckKey));
	const answered = new Set(answers.filter((answer) => hasValue(answer.value)).map((answer) => answer.questionKey));
	return {
		cards: intake.deck.filter((card) => inScope(card) && !swiped.has(card.key)).length,
		questions: intake.questions.filter((question) => inScope(question) && question.required && !answered.has(question.key)).map((question) => question.key),
	};
};

export const hasValue = (value) => (Array.isArray(value) ? value.length > 0 : String(value ?? "").trim() !== "");

/** Normalise an answer for its question kind. Returns null when the value is invalid. */
export const cleanAnswer = (question, value) => {
	if (question.kind === "multiple") {
		if (!Array.isArray(value)) return null;
		const picked = [...new Set(value.map(String))];
		return picked.every((option) => question.options.includes(option)) ? picked : null;
	}
	const text = String(value ?? "").trim().slice(0, question.kind === "long" ? 5000 : 500);
	if (question.kind === "single" && text && !question.options.includes(text)) return null;
	return text;
};

/** Status after a client saves something. Submitted intakes stay submitted until Claire adds items. */
export const statusAfterClientSave = (status) => (status === "draft" || status === "sent" ? "started" : status);

/** Status after Claire adds an item to an intake. */
export const statusAfterClaireAdds = (status) => (status === "submitted" ? "needs update" : status);

export const newKey = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const cleanText = (value, limit) => String(value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, limit);

/** Shared checks for question templates and intake questions. */
export const cleanQuestion = (fields) => {
	const prompt = cleanText(fields.prompt, 300);
	if (!prompt) throw new Error("Question needs a prompt");
	if (!QUESTION_KINDS.includes(fields.kind)) throw new Error("Unknown question kind");
	const options = fields.kind === "single" || fields.kind === "multiple" ? [...new Set(fields.options.map((option) => cleanText(option, 120)).filter(Boolean))] : [];
	if ((fields.kind === "single" || fields.kind === "multiple") && options.length < 2) throw new Error("Choice questions need at least two options");
	return { prompt, help: cleanText(fields.help, 500), kind: fields.kind, options, required: fields.required };
};
