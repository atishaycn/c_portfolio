// The client's side of an intake. Every call names the intake by the hash of its link token.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { cleanAnswer, cleanText, isLinkOpen, isNewItem, missingForSubmit, statusAfterClientSave } from "./lib/logic";
import { assertSecret, secretArg } from "./lib/secret";

const tokenArgs = { ...secretArg, tokenHash: v.string() };

/** The intake behind a link, or null when the link is unknown, revoked, or closed. */
const openIntake = async (ctx, tokenHash) => {
	const intake = await ctx.db.query("intakes").withIndex("by_token", (q) => q.eq("tokenHash", tokenHash)).unique();
	return intake && isLinkOpen(intake, Date.now()) ? intake : null;
};

const requireOpen = async (ctx, tokenHash) => {
	const intake = await openIntake(ctx, tokenHash);
	if (!intake) throw new Error("This intake has closed");
	return intake;
};

const markStarted = async (ctx, intake) => {
	const now = Date.now();
	await ctx.db.patch(intake._id, {
		status: statusAfterClientSave(intake.status),
		...(intake.startedAt ? {} : { startedAt: now }),
		updatedAt: now,
	});
};

export const view = query({
	args: tokenArgs,
	handler: async (ctx, { secret, tokenHash }) => {
		assertSecret(secret);
		const intake = await openIntake(ctx, tokenHash);
		if (!intake) return null;
		const [answers, swipes] = await Promise.all([
			ctx.db.query("answers").withIndex("by_intake", (q) => q.eq("intakeId", intake._id)).collect(),
			ctx.db.query("swipes").withIndex("by_intake", (q) => q.eq("intakeId", intake._id)).collect(),
		]);
		const answerByKey = new Map(answers.map((answer) => [answer.questionKey, answer.value]));
		const choiceByKey = new Map(swipes.map((swipe) => [swipe.deckKey, swipe.choice]));
		const cards = [];
		for (const card of intake.deck) {
			if (card.removedAt) continue;
			const pose = await ctx.db.get(card.poseId);
			if (!pose) continue;
			cards.push({
				key: card.key,
				poseId: card.poseId,
				title: pose.title,
				inspiration: pose.source === "reference",
				credit: pose.source === "reference" ? pose.credit : "",
				width: pose.width,
				height: pose.height,
				choice: choiceByKey.get(card.key) || null,
				isNew: isNewItem(card, intake),
			});
		}
		return {
			clientName: intake.clientName,
			eventTypeName: intake.eventTypeName,
			shootDate: intake.shootDate,
			welcome: intake.welcome,
			status: intake.status,
			submittedAt: intake.submittedAt || null,
			posesNote: intake.posesNote,
			cards,
			questions: intake.questions
				.filter((question) => !question.removedAt)
				.map((question) => ({
					key: question.key,
					prompt: question.prompt,
					help: question.help,
					kind: question.kind,
					options: question.options,
					required: question.required,
					answer: answerByKey.get(question.key) ?? null,
					isNew: isNewItem(question, intake),
				})),
			missing: missingForSubmit({ intake, answers, swipes }),
		};
	},
});

export const swipe = mutation({
	args: { ...tokenArgs, deckKey: v.string(), choice: v.union(v.literal("like"), v.literal("dislike"), v.literal("must"), v.literal("skip"), v.null()) },
	handler: async (ctx, { secret, tokenHash, deckKey, choice }) => {
		assertSecret(secret);
		const intake = await requireOpen(ctx, tokenHash);
		const card = intake.deck.find((entry) => entry.key === deckKey && !entry.removedAt);
		if (!card) throw new Error("That card is no longer in the deck");
		const existing = await ctx.db.query("swipes").withIndex("by_intake", (q) => q.eq("intakeId", intake._id).eq("deckKey", deckKey)).unique();
		// A null choice is an undo.
		if (choice === null) {
			if (existing) await ctx.db.delete(existing._id);
		} else if (existing) {
			await ctx.db.patch(existing._id, { choice, at: Date.now() });
		} else {
			await ctx.db.insert("swipes", { intakeId: intake._id, deckKey, poseId: card.poseId, choice, at: Date.now() });
		}
		await markStarted(ctx, intake);
	},
});

export const answer = mutation({
	args: { ...tokenArgs, questionKey: v.string(), value: v.union(v.string(), v.array(v.string())) },
	handler: async (ctx, { secret, tokenHash, questionKey, value }) => {
		assertSecret(secret);
		const intake = await requireOpen(ctx, tokenHash);
		const question = intake.questions.find((entry) => entry.key === questionKey && !entry.removedAt);
		if (!question) throw new Error("That question is no longer on this intake");
		const clean = cleanAnswer(question, value);
		if (clean === null) throw new Error("Please choose one of the options");
		const existing = await ctx.db.query("answers").withIndex("by_intake", (q) => q.eq("intakeId", intake._id).eq("questionKey", questionKey)).unique();
		const fields = { value: clean, revision: question.revision, updatedAt: Date.now() };
		if (existing) await ctx.db.patch(existing._id, fields);
		else await ctx.db.insert("answers", { intakeId: intake._id, questionKey, ...fields });
		await markStarted(ctx, intake);
	},
});

export const posesNote = mutation({
	args: { ...tokenArgs, text: v.string() },
	handler: async (ctx, { secret, tokenHash, text }) => {
		assertSecret(secret);
		const intake = await requireOpen(ctx, tokenHash);
		await ctx.db.patch(intake._id, { posesNote: cleanText(text, 5000) });
		await markStarted(ctx, intake);
	},
});

/** Submit, if everything required is done. Returns what the notification email needs. */
export const submit = mutation({
	args: tokenArgs,
	handler: async (ctx, { secret, tokenHash }) => {
		assertSecret(secret);
		const intake = await requireOpen(ctx, tokenHash);
		const [answers, swipes] = await Promise.all([
			ctx.db.query("answers").withIndex("by_intake", (q) => q.eq("intakeId", intake._id)).collect(),
			ctx.db.query("swipes").withIndex("by_intake", (q) => q.eq("intakeId", intake._id)).collect(),
		]);
		const missing = missingForSubmit({ intake, answers, swipes });
		if (missing.cards || missing.questions.length) return { ok: false, missing };
		const now = Date.now();
		await ctx.db.patch(intake._id, { status: "submitted", submittedAt: now, startedAt: intake.startedAt || now, updatedAt: now });
		return {
			ok: true,
			intakeId: intake._id,
			resubmitted: Boolean(intake.submittedAt),
			clientName: intake.clientName,
			eventTypeName: intake.eventTypeName,
			shootDate: intake.shootDate,
			mustHaves: swipes.filter((entry) => entry.choice === "must").length,
		};
	},
});

/** Storage URL for a pose, but only if it is a live card on this intake. */
export const poseImageUrl = query({
	args: { ...tokenArgs, poseId: v.string() },
	handler: async (ctx, { secret, tokenHash, poseId }) => {
		assertSecret(secret);
		const intake = await openIntake(ctx, tokenHash);
		const card = intake?.deck.find((entry) => String(entry.poseId) === poseId && !entry.removedAt);
		if (!card) return null;
		const pose = await ctx.db.get(card.poseId);
		return pose ? ctx.storage.getUrl(pose.storageId) : null;
	},
});
