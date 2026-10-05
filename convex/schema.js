import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const choice = v.union(v.literal("like"), v.literal("dislike"), v.literal("must"), v.literal("skip"));
const questionKind = v.union(v.literal("short"), v.literal("long"), v.literal("single"), v.literal("multiple"), v.literal("datetime"));
const status = v.union(v.literal("draft"), v.literal("sent"), v.literal("started"), v.literal("submitted"), v.literal("needs update"));

export default defineSchema({
	eventTypes: defineTable({
		name: v.string(),
		deckLimit: v.number(),
		order: v.number(),
		active: v.boolean(),
	}),

	// A scored way of describing poses, e.g. Style: candid / posed.
	tagGroups: defineTable({
		name: v.string(),
		order: v.number(),
		values: v.array(v.object({ key: v.string(), label: v.string() })),
	}),

	poses: defineTable({
		storageId: v.id("_storage"),
		width: v.number(),
		height: v.number(),
		title: v.string(),
		source: v.union(v.literal("own"), v.literal("reference")),
		credit: v.string(),
		tags: v.array(v.object({ group: v.id("tagGroups"), value: v.string() })),
		notes: v.array(v.string()),
		eventTypeIds: v.array(v.id("eventTypes")),
		rank: v.number(),
		archived: v.boolean(),
	}),

	// Question templates. No event type means the question is shared by every intake.
	questions: defineTable({
		prompt: v.string(),
		help: v.string(),
		kind: questionKind,
		options: v.array(v.string()),
		required: v.boolean(),
		eventTypeId: v.optional(v.id("eventTypes")),
		order: v.number(),
		archived: v.boolean(),
	}),

	intakes: defineTable({
		clientName: v.string(),
		clientEmail: v.string(),
		shootDate: v.string(),
		eventTypeId: v.id("eventTypes"),
		eventTypeName: v.string(),
		welcome: v.string(),
		// The link token itself is never stored: only its hash (for lookup) and a copy
		// encrypted with a key that lives in Vercel, so Claire can copy the link again.
		tokenHash: v.string(),
		tokenCipher: v.string(),
		revoked: v.boolean(),
		status,
		createdAt: v.number(),
		sentAt: v.optional(v.number()),
		startedAt: v.optional(v.number()),
		submittedAt: v.optional(v.number()),
		updatedAt: v.number(),
		cleanedAt: v.optional(v.number()),
		posesNote: v.string(),
		// The intake copy: frozen from the templates at creation, edited only on this intake.
		questions: v.array(
			v.object({
				key: v.string(),
				prompt: v.string(),
				help: v.string(),
				kind: questionKind,
				options: v.array(v.string()),
				required: v.boolean(),
				revision: v.number(),
				addedAt: v.number(),
				removedAt: v.optional(v.number()),
			}),
		),
		deck: v.array(
			v.object({
				key: v.string(),
				poseId: v.id("poses"),
				addedAt: v.number(),
				removedAt: v.optional(v.number()),
			}),
		),
	})
		.index("by_token", ["tokenHash"])
		.index("by_created", ["createdAt"]),

	answers: defineTable({
		intakeId: v.id("intakes"),
		questionKey: v.string(),
		value: v.union(v.string(), v.array(v.string())),
		// The question revision the client answered; lower than the current one means "earlier wording".
		revision: v.number(),
		updatedAt: v.number(),
	}).index("by_intake", ["intakeId", "questionKey"]),

	swipes: defineTable({
		intakeId: v.id("intakes"),
		deckKey: v.string(),
		poseId: v.id("poses"),
		choice,
		at: v.number(),
	})
		.index("by_intake", ["intakeId", "deckKey"])
		.index("by_pose", ["poseId"]),
});
