// Claire's templates: event types, tag groups, question templates, and the pose library.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { cleanQuestion, cleanText } from "./lib/logic";
import { assertSecret, secretArg } from "./lib/secret";

const byOrder = (a, b) => a.order - b.order || a._creationTime - b._creationTime;

const SEED_EVENT_TYPES = ["Wedding", "Engagement / couple", "Family", "Portrait / headshot", "Birthday / celebration", "Corporate event", "Graduation"];

const SEED_TAG_GROUPS = [
	["Style", ["Candid", "Posed"]],
	["Framing", ["Close-up", "Half", "Full body", "Wide"]],
	["Mood", ["Playful", "Romantic", "Calm", "Formal"]],
	["Setting", ["Indoor", "Outdoor", "Either"]],
	["People", ["Solo", "Couple", "Small group", "Large group"]],
];

const SEED_QUESTIONS = [
	["Who will be in the photos?", "Names and how they're related to you, so I can greet everyone.", "long", [], true],
	["What does the day look like?", "Rough times for arrivals, key moments, and when you'd like photos.", "long", [], false],
	["Is there anyone I must make sure to photograph?", "", "long", [], false],
	["Anything I should avoid?", "Angles you dislike, people who shouldn't be photographed together, topics to steer clear of.", "long", [], false],
	["Any accessibility needs I should plan for?", "", "long", [], false],
	["How do you feel in front of a camera?", "", "single", ["Love it", "It's fine", "A bit nervous", "Very camera-shy"], true],
];

/** Everything the intake admin page needs to manage templates, in one call. */
export const overview = query({
	args: secretArg,
	handler: async (ctx, { secret }) => {
		assertSecret(secret);
		const [eventTypes, tagGroups, questions, poses] = await Promise.all([
			ctx.db.query("eventTypes").collect(),
			ctx.db.query("tagGroups").collect(),
			ctx.db.query("questions").collect(),
			ctx.db.query("poses").collect(),
		]);
		return {
			eventTypes: eventTypes.sort(byOrder),
			tagGroups: tagGroups.sort(byOrder),
			questions: questions.sort(byOrder),
			poses: poses.sort((a, b) => a.rank - b.rank || a._creationTime - b._creationTime),
		};
	},
});

/** Fill an empty deployment with the starting event types, tag groups, and shared questions. */
export const seed = mutation({
	args: secretArg,
	handler: async (ctx, { secret }) => {
		assertSecret(secret);
		const created = { eventTypes: 0, tagGroups: 0, questions: 0 };
		if (!(await ctx.db.query("eventTypes").first())) {
			for (const [order, name] of SEED_EVENT_TYPES.entries()) {
				await ctx.db.insert("eventTypes", { name, deckLimit: 40, order, active: true });
				created.eventTypes += 1;
			}
		}
		if (!(await ctx.db.query("tagGroups").first())) {
			for (const [order, [name, labels]] of SEED_TAG_GROUPS.entries()) {
				const values = labels.map((label) => ({ key: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label }));
				await ctx.db.insert("tagGroups", { name, order, values });
				created.tagGroups += 1;
			}
		}
		if (!(await ctx.db.query("questions").first())) {
			for (const [order, [prompt, help, kind, options, required]] of SEED_QUESTIONS.entries()) {
				await ctx.db.insert("questions", { prompt, help, kind, options, required, order, archived: false });
				created.questions += 1;
			}
		}
		return created;
	},
});

export const saveEventType = mutation({
	args: { ...secretArg, id: v.optional(v.id("eventTypes")), name: v.string(), deckLimit: v.number(), order: v.number(), active: v.boolean() },
	handler: async (ctx, { secret, id, ...fields }) => {
		assertSecret(secret);
		const values = {
			name: cleanText(fields.name, 80),
			deckLimit: Math.min(100, Math.max(1, Math.round(fields.deckLimit) || 40)),
			order: fields.order,
			active: fields.active,
		};
		if (!values.name) throw new Error("Event type needs a name");
		if (id) {
			await ctx.db.patch(id, values);
			return id;
		}
		return ctx.db.insert("eventTypes", values);
	},
});

export const saveTagGroup = mutation({
	args: {
		...secretArg,
		id: v.optional(v.id("tagGroups")),
		name: v.string(),
		order: v.number(),
		values: v.array(v.object({ key: v.optional(v.string()), label: v.string() })),
	},
	handler: async (ctx, { secret, id, name, order, values }) => {
		assertSecret(secret);
		const cleanName = cleanText(name, 60);
		if (!cleanName) throw new Error("Tag group needs a name");
		const used = new Set();
		const cleanValues = values
			.map((value) => ({ label: cleanText(value.label, 60), key: value.key }))
			.filter((value) => value.label)
			.map((value) => {
				// Keys stay stable once used, so renaming a value keeps old poses and swipes attached.
				let key = value.key || value.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "value";
				while (used.has(key)) key = `${key}-2`;
				used.add(key);
				return { key, label: value.label };
			});
		if (cleanValues.length < 2) throw new Error("A tag group needs at least two values");
		if (id) {
			await ctx.db.patch(id, { name: cleanName, order, values: cleanValues });
			return id;
		}
		return ctx.db.insert("tagGroups", { name: cleanName, order, values: cleanValues });
	},
});

const questionFields = {
	prompt: v.string(),
	help: v.string(),
	kind: v.string(),
	options: v.array(v.string()),
	required: v.boolean(),
};

export const saveQuestion = mutation({
	args: { ...secretArg, id: v.optional(v.id("questions")), ...questionFields, eventTypeId: v.optional(v.id("eventTypes")), order: v.number(), archived: v.boolean() },
	handler: async (ctx, { secret, id, eventTypeId, order, archived, ...fields }) => {
		assertSecret(secret);
		const values = { ...cleanQuestion(fields), eventTypeId, order, archived };
		if (id) {
			await ctx.db.replace(id, values);
			return id;
		}
		return ctx.db.insert("questions", values);
	},
});

export const generateUploadUrl = mutation({
	args: secretArg,
	handler: async (ctx, { secret }) => {
		assertSecret(secret);
		return ctx.storage.generateUploadUrl();
	},
});

const poseFields = {
	title: v.string(),
	source: v.union(v.literal("own"), v.literal("reference")),
	credit: v.string(),
	tags: v.array(v.object({ group: v.id("tagGroups"), value: v.string() })),
	notes: v.array(v.string()),
	eventTypeIds: v.array(v.id("eventTypes")),
	rank: v.number(),
};

const cleanPose = (fields) => ({
	...fields,
	title: cleanText(fields.title, 120),
	credit: cleanText(fields.credit, 200),
	notes: [...new Set(fields.notes.map((note) => cleanText(note, 40).toLowerCase()).filter(Boolean))].slice(0, 20),
	// One value per tag group.
	tags: [...new Map(fields.tags.map((tag) => [tag.group, tag])).values()],
});

export const createPose = mutation({
	args: { ...secretArg, storageId: v.id("_storage"), width: v.number(), height: v.number(), ...poseFields },
	handler: async (ctx, { secret, storageId, width, height, ...fields }) => {
		assertSecret(secret);
		return ctx.db.insert("poses", { storageId, width, height, ...cleanPose(fields), archived: false });
	},
});

export const updatePose = mutation({
	args: { ...secretArg, id: v.id("poses"), ...poseFields, archived: v.boolean() },
	handler: async (ctx, { secret, id, archived, ...fields }) => {
		assertSecret(secret);
		await ctx.db.patch(id, { ...cleanPose(fields), archived });
		return id;
	},
});

/** Delete a pose outright, but only if no intake has ever used it; otherwise it is archived. */
export const deletePose = mutation({
	args: { ...secretArg, id: v.id("poses") },
	handler: async (ctx, { secret, id }) => {
		assertSecret(secret);
		const pose = await ctx.db.get(id);
		if (!pose) return { deleted: false };
		const swiped = await ctx.db.query("swipes").withIndex("by_pose", (q) => q.eq("poseId", id)).first();
		const intakes = swiped ? [] : await ctx.db.query("intakes").collect();
		if (swiped || intakes.some((intake) => intake.deck.some((card) => card.poseId === id))) {
			await ctx.db.patch(id, { archived: true });
			return { deleted: false, archived: true };
		}
		await ctx.storage.delete(pose.storageId);
		await ctx.db.delete(id);
		return { deleted: true };
	},
});

export const poseImageUrl = query({
	args: { ...secretArg, id: v.id("poses") },
	handler: async (ctx, { secret, id }) => {
		assertSecret(secret);
		const pose = await ctx.db.get(id);
		return pose ? ctx.storage.getUrl(pose.storageId) : null;
	},
});
