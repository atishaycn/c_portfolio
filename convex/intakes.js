// Claire's side of intakes: create, link, edit the intake copy, and read results.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
	CLEANUP_DAYS_AFTER_SHOOT,
	DAY_MS,
	cleanQuestion,
	cleanText,
	computeLeanings,
	describeScore,
	isLinkOpen,
	linkClosesAt,
	newKey,
	orderDeck,
	statusAfterClaireAdds,
} from "./lib/logic";
import { assertSecret, secretArg } from "./lib/secret";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const cleanDetails = (fields) => {
	const details = {
		clientName: cleanText(fields.clientName, 120),
		clientEmail: cleanText(fields.clientEmail, 200),
		shootDate: cleanText(fields.shootDate, 10),
		welcome: cleanText(fields.welcome, 2000),
	};
	if (!details.clientName) throw new Error("Client needs a name");
	if (!DATE_PATTERN.test(details.shootDate) || !Number.isFinite(Date.parse(details.shootDate))) throw new Error("Shoot date must be a date");
	return details;
};

/** Build a fresh intake copy (questions and deck) from the current templates. */
const copyFromTemplates = async (ctx, eventType, now) => {
	const templates = (await ctx.db.query("questions").collect())
		.filter((question) => !question.archived && (!question.eventTypeId || question.eventTypeId === eventType._id))
		// Shared questions first, then the event type's own.
		.sort((a, b) => Number(Boolean(a.eventTypeId)) - Number(Boolean(b.eventTypeId)) || a.order - b.order);
	const poses = (await ctx.db.query("poses").collect()).filter((pose) => !pose.archived && pose.eventTypeIds.includes(eventType._id));
	return {
		questions: templates.map((question) => ({
			key: newKey("q"),
			prompt: question.prompt,
			help: question.help,
			kind: question.kind,
			options: question.options,
			required: question.required,
			revision: 1,
			addedAt: now,
		})),
		deck: orderDeck(poses, eventType.deckLimit).map((pose) => ({ key: newKey("c"), poseId: pose._id, addedAt: now })),
	};
};

const loadIntake = async (ctx, id) => {
	const intake = await ctx.db.get(id);
	if (!intake) throw new Error("Intake not found");
	return intake;
};

export const list = query({
	args: secretArg,
	handler: async (ctx, { secret }) => {
		assertSecret(secret);
		const now = Date.now();
		const intakes = await ctx.db.query("intakes").withIndex("by_created").order("desc").collect();
		return Promise.all(
			intakes.map(async (intake) => {
				const swipes = await ctx.db.query("swipes").withIndex("by_intake", (q) => q.eq("intakeId", intake._id)).collect();
				const cards = intake.deck.filter((card) => !card.removedAt);
				const live = new Set(cards.map((card) => card.key));
				return {
					_id: intake._id,
					clientName: intake.clientName,
					eventTypeName: intake.eventTypeName,
					shootDate: intake.shootDate,
					status: intake.status,
					revoked: intake.revoked,
					linkOpen: isLinkOpen(intake, now),
					cleanupDue: !intake.cleanedAt && now > Date.parse(intake.shootDate) + CLEANUP_DAYS_AFTER_SHOOT * DAY_MS,
					createdAt: intake.createdAt,
					submittedAt: intake.submittedAt,
					swiped: swipes.filter((swipe) => live.has(swipe.deckKey)).length,
					cards: cards.length,
				};
			}),
		);
	},
});

/** One intake with its copy, the client's answers, and the summary Claire reads. */
export const get = query({
	args: { ...secretArg, id: v.id("intakes") },
	handler: async (ctx, { secret, id }) => {
		assertSecret(secret);
		const intake = await loadIntake(ctx, id);
		const [answers, swipes, tagGroups] = await Promise.all([
			ctx.db.query("answers").withIndex("by_intake", (q) => q.eq("intakeId", id)).collect(),
			ctx.db.query("swipes").withIndex("by_intake", (q) => q.eq("intakeId", id)).collect(),
			ctx.db.query("tagGroups").collect(),
		]);
		const poses = (await Promise.all(intake.deck.map((card) => ctx.db.get(card.poseId)))).filter(Boolean);
		const poseById = new Map(poses.map((pose) => [String(pose._id), pose]));
		const answerByKey = new Map(answers.map((answer) => [answer.questionKey, answer]));
		const choiceByKey = new Map(swipes.map((swipe) => [swipe.deckKey, swipe.choice]));
		const valueLabel = new Map(tagGroups.flatMap((group) => group.values.map((value) => [`${group._id}:${value.key}`, value.label])));

		const deck = intake.deck.map((card) => {
			const pose = poseById.get(String(card.poseId));
			return {
				...card,
				choice: choiceByKey.get(card.key) || null,
				title: pose?.title || "",
				source: pose?.source || "own",
				notes: pose?.notes || [],
				tags: (pose?.tags || []).map((tag) => valueLabel.get(`${tag.group}:${tag.value}`)).filter(Boolean),
			};
		});
		const liked = deck.filter((card) => !card.removedAt && (card.choice === "like" || card.choice === "must"));
		const leanings = computeLeanings({ deck: intake.deck, swipes, poses, tagGroups: [...tagGroups].sort((a, b) => a.order - b.order) }).map((group) => ({
			...group,
			values: group.values.map((value) => ({ ...value, reading: describeScore(value.score) })),
		}));

		const { tokenHash, ...safe } = intake;
		return {
			intake: { ...safe, linkOpen: isLinkOpen(intake, Date.now()), linkClosesAt: linkClosesAt(intake.shootDate) },
			questions: intake.questions.map((question) => {
				const answer = answerByKey.get(question.key);
				return {
					...question,
					answer: answer?.value ?? null,
					earlierWording: Boolean(answer && answer.revision < question.revision),
				};
			}),
			deck,
			mustHaves: deck.filter((card) => !card.removedAt && card.choice === "must"),
			leanings,
			likedNotes: [...new Set(liked.flatMap((card) => card.notes))].sort(),
		};
	},
});

export const create = mutation({
	args: {
		...secretArg,
		clientName: v.string(),
		clientEmail: v.string(),
		shootDate: v.string(),
		welcome: v.string(),
		eventTypeId: v.id("eventTypes"),
		tokenHash: v.string(),
		tokenCipher: v.string(),
	},
	handler: async (ctx, { secret, eventTypeId, tokenHash, tokenCipher, ...fields }) => {
		assertSecret(secret);
		const eventType = await ctx.db.get(eventTypeId);
		if (!eventType) throw new Error("Unknown event type");
		const now = Date.now();
		return ctx.db.insert("intakes", {
			...cleanDetails(fields),
			eventTypeId,
			eventTypeName: eventType.name,
			tokenHash,
			tokenCipher,
			revoked: false,
			status: "draft",
			createdAt: now,
			updatedAt: now,
			posesNote: "",
			...(await copyFromTemplates(ctx, eventType, now)),
		});
	},
});

export const updateDetails = mutation({
	args: { ...secretArg, id: v.id("intakes"), clientName: v.string(), clientEmail: v.string(), shootDate: v.string(), welcome: v.string() },
	handler: async (ctx, { secret, id, ...fields }) => {
		assertSecret(secret);
		await loadIntake(ctx, id);
		await ctx.db.patch(id, { ...cleanDetails(fields), updatedAt: Date.now() });
	},
});

/** Encrypted copy of the link token, so the Vercel function can rebuild the link for "Copy link". */
export const linkCipher = query({
	args: { ...secretArg, id: v.id("intakes") },
	handler: async (ctx, { secret, id }) => {
		assertSecret(secret);
		const intake = await loadIntake(ctx, id);
		return { tokenCipher: intake.tokenCipher, revoked: intake.revoked, linkOpen: isLinkOpen(intake, Date.now()) };
	},
});

/** Replace the link; the old one stops working at once. */
export const reissueLink = mutation({
	args: { ...secretArg, id: v.id("intakes"), tokenHash: v.string(), tokenCipher: v.string() },
	handler: async (ctx, { secret, id, tokenHash, tokenCipher }) => {
		assertSecret(secret);
		await loadIntake(ctx, id);
		await ctx.db.patch(id, { tokenHash, tokenCipher, revoked: false, updatedAt: Date.now() });
	},
});

export const revokeLink = mutation({
	args: { ...secretArg, id: v.id("intakes") },
	handler: async (ctx, { secret, id }) => {
		assertSecret(secret);
		await loadIntake(ctx, id);
		await ctx.db.patch(id, { revoked: true, updatedAt: Date.now() });
	},
});

export const markSent = mutation({
	args: { ...secretArg, id: v.id("intakes") },
	handler: async (ctx, { secret, id }) => {
		assertSecret(secret);
		const intake = await loadIntake(ctx, id);
		if (intake.status === "draft") await ctx.db.patch(id, { status: "sent", sentAt: Date.now(), updatedAt: Date.now() });
	},
});

/** Add a question to one intake, or edit one. Changing the wording bumps its revision. */
export const saveQuestion = mutation({
	args: {
		...secretArg,
		id: v.id("intakes"),
		key: v.optional(v.string()),
		prompt: v.string(),
		help: v.string(),
		kind: v.string(),
		options: v.array(v.string()),
		required: v.boolean(),
	},
	handler: async (ctx, { secret, id, key, ...fields }) => {
		assertSecret(secret);
		const intake = await loadIntake(ctx, id);
		const now = Date.now();
		const values = cleanQuestion(fields);
		if (!key) {
			await ctx.db.patch(id, {
				questions: [...intake.questions, { key: newKey("q"), ...values, revision: 1, addedAt: now }],
				status: statusAfterClaireAdds(intake.status),
				updatedAt: now,
			});
			return;
		}
		const questions = intake.questions.map((question) => {
			if (question.key !== key) return question;
			const reworded =
				question.prompt !== values.prompt || question.kind !== values.kind || question.options.join("\n") !== values.options.join("\n");
			return { ...question, ...values, revision: question.revision + (reworded ? 1 : 0) };
		});
		await ctx.db.patch(id, { questions, updatedAt: now });
	},
});

/** Hide or restore a question. Answers are kept either way. */
export const setQuestionRemoved = mutation({
	args: { ...secretArg, id: v.id("intakes"), key: v.string(), removed: v.boolean() },
	handler: async (ctx, { secret, id, key, removed }) => {
		assertSecret(secret);
		const intake = await loadIntake(ctx, id);
		const now = Date.now();
		const questions = intake.questions.map((question) => {
			if (question.key !== key) return question;
			const { removedAt, ...rest } = question;
			return removed ? { ...rest, removedAt: now } : rest;
		});
		await ctx.db.patch(id, { questions, updatedAt: now });
	},
});

export const moveQuestion = mutation({
	args: { ...secretArg, id: v.id("intakes"), key: v.string(), direction: v.number() },
	handler: async (ctx, { secret, id, key, direction }) => {
		assertSecret(secret);
		const intake = await loadIntake(ctx, id);
		const questions = [...intake.questions];
		const from = questions.findIndex((question) => question.key === key);
		const to = from + Math.sign(direction);
		if (from < 0 || to < 0 || to >= questions.length) return;
		[questions[from], questions[to]] = [questions[to], questions[from]];
		await ctx.db.patch(id, { questions, updatedAt: Date.now() });
	},
});

export const addCard = mutation({
	args: { ...secretArg, id: v.id("intakes"), poseId: v.id("poses") },
	handler: async (ctx, { secret, id, poseId }) => {
		assertSecret(secret);
		const intake = await loadIntake(ctx, id);
		if (!(await ctx.db.get(poseId))) throw new Error("Unknown pose");
		if (intake.deck.some((card) => card.poseId === poseId && !card.removedAt)) throw new Error("That pose is already in this deck");
		const now = Date.now();
		await ctx.db.patch(id, {
			deck: [...intake.deck, { key: newKey("c"), poseId, addedAt: now }],
			status: statusAfterClaireAdds(intake.status),
			updatedAt: now,
		});
	},
});

export const setCardRemoved = mutation({
	args: { ...secretArg, id: v.id("intakes"), key: v.string(), removed: v.boolean() },
	handler: async (ctx, { secret, id, key, removed }) => {
		assertSecret(secret);
		const intake = await loadIntake(ctx, id);
		const now = Date.now();
		const deck = intake.deck.map((card) => {
			if (card.key !== key) return card;
			const { removedAt, ...rest } = card;
			return removed ? { ...rest, removedAt: now } : rest;
		});
		await ctx.db.patch(id, { deck, updatedAt: now });
	},
});

/** Rebuild the copy from the current templates. Only before the client has started. */
export const refreshFromTemplates = mutation({
	args: { ...secretArg, id: v.id("intakes") },
	handler: async (ctx, { secret, id }) => {
		assertSecret(secret);
		const intake = await loadIntake(ctx, id);
		if (intake.status !== "draft" && intake.status !== "sent") throw new Error("The client has already started this intake");
		const eventType = await ctx.db.get(intake.eventTypeId);
		if (!eventType) throw new Error("This intake's event type no longer exists");
		const now = Date.now();
		await ctx.db.patch(id, { ...(await copyFromTemplates(ctx, eventType, now)), eventTypeName: eventType.name, updatedAt: now });
	},
});

/** Delete an intake the client never touched. */
export const remove = mutation({
	args: { ...secretArg, id: v.id("intakes") },
	handler: async (ctx, { secret, id }) => {
		assertSecret(secret);
		const intake = await loadIntake(ctx, id);
		if (intake.status !== "draft" && intake.status !== "sent") throw new Error("Only intakes the client hasn't started can be deleted");
		await ctx.db.delete(id);
	},
});
