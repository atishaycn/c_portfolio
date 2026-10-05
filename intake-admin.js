// Claire's client intake admin: intakes, the pose library, question templates, event types and tags.
// Every call goes to /api/intake-admin, behind the same login as the portfolio admin.

const elements = {
	loginView: document.getElementById("login-view"),
	loginForm: document.getElementById("login-form"),
	loginEmail: document.getElementById("login-email"),
	loginPassword: document.getElementById("login-password"),
	loginError: document.getElementById("login-error"),
	dashboardView: document.getElementById("dashboard-view"),
	logoutButton: document.getElementById("logout-button"),
	message: document.getElementById("system-message"),
	view: document.getElementById("view"),
};

const state = { csrf: null, library: null, intakes: [] };

const STATUS_LABELS = { draft: "Draft", sent: "Sent", started: "In progress", submitted: "Submitted", "needs update": "Needs update" };
const CHOICE_LABELS = { like: "Liked", dislike: "Not for them", must: "Must have", skip: "Not sure" };
const KIND_LABELS = { short: "Short answer", long: "Long answer", single: "Pick one", multiple: "Pick any", datetime: "Date and time" };
const DEFAULT_WELCOME =
	"I'm so looking forward to your shoot! Swipe through some poses so I can see what you love, then answer a few questions about the day. It takes about ten minutes.";

/** Build an element. Text always goes in as text, never as HTML. */
const h = (tag, props = {}, ...children) => {
	const element = document.createElement(tag);
	for (const [name, value] of Object.entries(props)) {
		if (value === undefined || value === null || value === false) continue;
		if (name === "class") element.className = value;
		else if (name === "text") element.textContent = value;
		else if (name.startsWith("on")) element.addEventListener(name.slice(2), value);
		else if (name in element && name !== "list" && name !== "form") element[name] = value;
		else element.setAttribute(name, value === true ? "" : value);
	}
	for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) element.append(child);
	return element;
};

const request = async (url, options = {}) => {
	const headers = { Accept: "application/json", ...(options.headers || {}) };
	if (options.body) headers["Content-Type"] = "application/json";
	if (!["GET", "HEAD"].includes(options.method || "GET") && state.csrf) headers["X-CSRF-Token"] = state.csrf;
	const response = await fetch(url, { credentials: "same-origin", ...options, headers });
	const body = await response.json().catch(() => ({}));
	if (!response.ok) throw Object.assign(new Error(body.error || `Request failed (${response.status})`), { status: response.status });
	return body;
};

const get = (params) => request(`/api/intake-admin?${new URLSearchParams(params)}`);
const post = (op, args = {}) => request("/api/intake-admin", { method: "POST", body: JSON.stringify({ op, ...args }) });

const say = (text, isError = false) => {
	elements.message.textContent = text;
	elements.message.classList.toggle("is-error", isError);
	elements.message.hidden = false;
	clearTimeout(say.timer);
	say.timer = setTimeout(() => (elements.message.hidden = true), isError ? 8000 : 3500);
};

/** Run an action, report its error, and re-render the current view afterwards. */
const act = async (fn, success) => {
	try {
		const result = await fn();
		if (success) say(success);
		await route();
		return result;
	} catch (error) {
		if (error.status === 401) return location.reload();
		say(error.message, true);
		return null;
	}
};

const imageUrl = (poseId) => `/api/intake-admin?op=image&pose=${encodeURIComponent(poseId)}`;
const formatDate = (value) => (value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");
const formatTime = (stamp) => (stamp ? new Date(stamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const statusPill = (status) => h("span", { class: `ia-pill ia-pill-${status.replace(" ", "-")}`, text: STATUS_LABELS[status] || status });
const eventTypeName = (id) => state.library.eventTypes.find((type) => type._id === id)?.name || "";
const tagLabel = (tag) => {
	const group = state.library.tagGroups.find((entry) => entry._id === tag.group);
	return group?.values.find((value) => value.key === tag.value)?.label || "";
};

const copyText = async (text) => {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		window.prompt("Copy this link:", text);
		return false;
	}
};

const field = (label, input, hint) => h("label", { class: "ia-field" }, h("span", { text: label }), input, hint ? h("small", { text: hint }) : null);

const formValues = (form) => Object.fromEntries(new FormData(form).entries());

// ── Intakes ───────────────────────────────────────────────────────────────

const renderIntakes = () => {
	const types = state.library.eventTypes.filter((type) => type.active);
	if (!state.library.eventTypes.length) {
		return h("section", { class: "ia-card" },
			h("h2", { text: "Set up the starting data" }),
			h("p", { text: "This adds the seven starting event types, the five tag groups, and the shared questions. You can change all of them afterwards." }),
			h("button", { class: "primary-button", type: "button", text: "Add starting data", onclick: () => act(() => post("seed"), "Starting data added") }),
		);
	}
	const form = h("form", {
		class: "ia-card ia-form",
		onsubmit: async (event) => {
			event.preventDefault();
			const values = formValues(event.target);
			const created = await act(() => post("createIntake", values), "Intake created");
			if (created) {
				await copyText(created.link);
				say("Intake created. The link is copied, ready to send.");
				location.hash = `#intake=${created.result}`;
			}
		},
	},
		h("h2", { text: "New intake" }),
		h("div", { class: "ia-grid-2" },
			field("Client name", h("input", { name: "clientName", required: true, maxLength: 120 })),
			field("Client email", h("input", { name: "clientEmail", type: "email", maxLength: 200 }), "Optional. Used later for sending the link."),
			field("Shoot date", h("input", { name: "shootDate", type: "date", required: true }), "The link closes 30 days after this date."),
			field("Event type", h("select", { name: "eventTypeId", required: true }, types.map((type) => h("option", { value: type._id, text: type.name })))),
		),
		field("Welcome message", h("textarea", { name: "welcome", rows: 3, maxLength: 2000, value: DEFAULT_WELCOME })),
		h("button", { class: "primary-button", type: "submit", text: "Create intake and copy link" }),
	);
	const rows = state.intakes.map((intake) =>
		h("tr", { onclick: () => (location.hash = `#intake=${intake._id}`) },
			h("td", {}, h("a", { href: `#intake=${intake._id}`, text: intake.clientName })),
			h("td", { text: intake.eventTypeName }),
			h("td", { text: formatDate(intake.shootDate) }),
			h("td", {}, statusPill(intake.status), intake.linkOpen ? null : h("span", { class: "ia-muted", text: " link closed" })),
			h("td", { text: intake.cards ? `${intake.swiped} / ${intake.cards} poses` : "No poses" }),
			h("td", {}, intake.cleanupDue ? h("span", { class: "ia-pill", text: "Due for cleanup" }) : null),
		),
	);
	return h("div", { class: "ia-stack" },
		form,
		h("section", { class: "ia-card" },
			h("h2", { text: "Intakes" }),
			rows.length
				? h("table", { class: "ia-table" },
					h("thead", {}, h("tr", {}, ["Client", "Event", "Shoot", "Status", "Progress", ""].map((label) => h("th", { text: label })))),
					h("tbody", {}, rows),
				)
				: h("p", { class: "ia-muted", text: "No intakes yet." }),
		),
	);
};

const questionForm = ({ initial = {}, submitLabel, extra = [], onSave, onCancel }) => {
	const options = h("textarea", { name: "options", rows: 3, value: (initial.options || []).join("\n"), placeholder: "One option per line" });
	const optionsField = field("Options", options, "One per line.");
	const kind = h("select", { name: "kind" }, Object.entries(KIND_LABELS).map(([value, label]) => h("option", { value, text: label, selected: value === (initial.kind || "short") })));
	const syncOptions = () => (optionsField.hidden = !["single", "multiple"].includes(kind.value));
	kind.addEventListener("change", syncOptions);
	syncOptions();
	return h("form", {
		class: "ia-form ia-inline-form",
		onsubmit: (event) => {
			event.preventDefault();
			const values = formValues(event.target);
			onSave({
				...values,
				prompt: values.prompt,
				help: values.help || "",
				kind: values.kind,
				options: String(values.options || "").split("\n").map((line) => line.trim()).filter(Boolean),
				required: event.target.elements.required.checked,
			});
		},
	},
		field("Question", h("input", { name: "prompt", required: true, maxLength: 300, value: initial.prompt || "" })),
		field("Help text", h("input", { name: "help", maxLength: 500, value: initial.help || "" }), "Optional, shown under the question."),
		h("div", { class: "ia-grid-2" }, field("Kind", kind), extra),
		optionsField,
		h("label", { class: "ia-check" }, h("input", { type: "checkbox", name: "required", checked: Boolean(initial.required) }), "Required"),
		h("div", { class: "ia-actions" },
			h("button", { class: "primary-button", type: "submit", text: submitLabel }),
			onCancel ? h("button", { class: "quiet-button", type: "button", text: "Cancel", onclick: onCancel }) : null,
		),
	);
};

const renderAnswer = (question) => {
	const value = question.answer;
	if (value === null || (Array.isArray(value) && !value.length) || value === "") return h("span", { class: "ia-muted", text: "No answer" });
	return h("span", { class: "ia-answer", text: Array.isArray(value) ? value.join(", ") : value });
};

const renderResults = (data) => {
	const { intake, mustHaves, leanings, likedNotes, questions } = data;
	return h("section", { class: "ia-card ia-results" },
		h("div", { class: "ia-heading-row" },
			h("h2", { text: "Results" }),
			h("button", { class: "secondary-button", type: "button", text: "Print shot list", onclick: () => window.print() }),
		),
		intake.submittedAt ? h("p", { class: "ia-muted", text: `Submitted ${formatTime(intake.submittedAt)}` }) : h("p", { class: "ia-muted", text: "Not submitted yet. What's below is saved as the client goes." }),
		h("h3", { text: `Must-have shot list (${mustHaves.length})` }),
		mustHaves.length
			? h("div", { class: "ia-shotlist" },
				mustHaves.map((card) =>
					h("figure", {}, h("img", { src: imageUrl(card.poseId), alt: card.title, loading: "lazy" }), h("figcaption", { text: card.title || card.tags.join(" · ") })),
				),
			)
			: h("p", { class: "ia-muted", text: "No must-haves yet." }),
		h("h3", { text: "Leanings" }),
		leanings.length
			? h("div", { class: "ia-leanings" },
				leanings.map((group) =>
					h("div", {},
						h("h4", { text: group.group }),
						h("ul", {}, group.values.map((value) =>
							h("li", { class: `ia-reading ia-reading-${value.reading}` },
								h("strong", { text: value.label }),
								` ${value.reading} `,
								h("span", { class: "ia-muted", text: `(${value.score > 0 ? "+" : ""}${value.score}, ${value.count} poses)` }),
							),
						)),
					),
				),
			)
			: h("p", { class: "ia-muted", text: "Leanings appear once a tag value has at least three swipes." }),
		likedNotes.length ? h("p", {}, h("strong", { text: "Notes on liked poses: " }), likedNotes.join(", ")) : null,
		intake.posesNote ? h("p", {}, h("strong", { text: "About the poses: " }), h("span", { class: "ia-answer", text: intake.posesNote })) : null,
		h("h3", { text: "Answers" }),
		h("dl", { class: "ia-answers" },
			questions.map((question) =>
				h("div", { class: question.removedAt ? "ia-removed" : "" },
					h("dt", {},
						question.prompt,
						question.earlierWording ? h("span", { class: "ia-pill", text: "answered under earlier wording" }) : null,
						question.removedAt ? h("span", { class: "ia-pill", text: "removed" }) : null,
					),
					h("dd", {}, renderAnswer(question)),
				),
			),
		),
	);
};

const renderIntakeQuestions = (data, editingKey) => {
	const { intake } = data;
	const items = data.questions.map((question, index) => {
		if (question.key === editingKey) {
			return h("li", {},
				questionForm({
					initial: question,
					submitLabel: "Save question",
					onSave: (values) => act(() => post("saveIntakeQuestion", { id: intake._id, key: question.key, ...values }), "Question saved"),
					onCancel: () => route(),
				}),
			);
		}
		return h("li", { class: question.removedAt ? "ia-removed" : "" },
			h("div", { class: "ia-q-text" },
				h("strong", { text: question.prompt }),
				question.required ? h("span", { class: "ia-muted", text: " required" }) : null,
				h("div", { class: "ia-muted", text: `${KIND_LABELS[question.kind]}${question.options.length ? `: ${question.options.join(" / ")}` : ""}` }),
			),
			h("div", { class: "ia-actions" },
				h("button", { class: "quiet-button", type: "button", text: "↑", "aria-label": "Move up", disabled: index === 0, onclick: () => act(() => post("moveQuestion", { id: intake._id, key: question.key, direction: -1 })) }),
				h("button", { class: "quiet-button", type: "button", text: "↓", "aria-label": "Move down", disabled: index === data.questions.length - 1, onclick: () => act(() => post("moveQuestion", { id: intake._id, key: question.key, direction: 1 })) }),
				question.removedAt ? null : h("button", { class: "quiet-button", type: "button", text: "Edit", onclick: () => renderIntakeDetail(data, question.key) }),
				h("button", {
					class: "quiet-button",
					type: "button",
					text: question.removedAt ? "Restore" : "Remove",
					onclick: () => act(() => post("setQuestionRemoved", { id: intake._id, key: question.key, removed: !question.removedAt })),
				}),
			),
		);
	});
	const adding = h("details", { class: "ia-add" },
		h("summary", { text: "Add a question to this intake" }),
		questionForm({ submitLabel: "Add question", onSave: (values) => act(() => post("saveIntakeQuestion", { id: intake._id, ...values }), "Question added") }),
	);
	return h("section", { class: "ia-card" },
		h("h2", { text: "Questions on this intake" }),
		h("p", { class: "ia-muted", text: "Changes here affect only this client. Rewording an answered question keeps their answer and flags it. Adding after they submit asks them to look again." }),
		h("ol", { class: "ia-q-list" }, items),
		adding,
	);
};

const renderIntakeDeck = (data) => {
	const { intake, deck } = data;
	const inDeck = new Set(deck.filter((card) => !card.removedAt).map((card) => card.poseId));
	const available = state.library.poses.filter((pose) => !pose.archived && !inDeck.has(pose._id));
	const picker = h("select", { "aria-label": "Pose to add" },
		h("option", { value: "", text: "Choose a pose…" }),
		available.map((pose) => h("option", { value: pose._id, text: `${pose.title || "Untitled"}${pose.eventTypeIds.includes(intake.eventTypeId) ? "" : " (other event type)"}` })),
	);
	return h("section", { class: "ia-card" },
		h("h2", { text: `Deck (${deck.filter((card) => !card.removedAt).length} poses)` }),
		h("div", { class: "ia-deck" },
			deck.map((card) =>
				h("figure", { class: card.removedAt ? "ia-removed" : "" },
					h("img", { src: imageUrl(card.poseId), alt: card.title, loading: "lazy" }),
					h("figcaption", {},
						h("span", { text: card.title || "Untitled" }),
						card.choice ? h("span", { class: `ia-pill ia-choice-${card.choice}`, text: CHOICE_LABELS[card.choice] }) : null,
						h("button", {
							class: "quiet-button",
							type: "button",
							text: card.removedAt ? "Restore" : "Remove",
							onclick: () => act(() => post("setCardRemoved", { id: intake._id, key: card.key, removed: !card.removedAt })),
						}),
					),
				),
			),
		),
		h("div", { class: "ia-actions" },
			picker,
			h("button", { class: "secondary-button", type: "button", text: "Add pose", onclick: () => picker.value && act(() => post("addCard", { id: intake._id, poseId: picker.value }), "Pose added") }),
		),
	);
};

const renderIntakeDetail = (data, editingKey) => {
	const { intake } = data;
	const notStarted = intake.status === "draft" || intake.status === "sent";
	const details = h("form", {
		class: "ia-card ia-form",
		onsubmit: (event) => {
			event.preventDefault();
			const { clientName, clientEmail, shootDate, welcome } = formValues(event.target);
			act(() => post("updateDetails", { id: intake._id, clientName, clientEmail, shootDate, welcome }), "Details saved");
		},
	},
		h("h2", { text: "Details" }),
		h("div", { class: "ia-grid-2" },
			field("Client name", h("input", { name: "clientName", required: true, value: intake.clientName })),
			field("Client email", h("input", { name: "clientEmail", type: "email", value: intake.clientEmail })),
			field("Shoot date", h("input", { name: "shootDate", type: "date", required: true, value: intake.shootDate })),
		),
		field("Welcome message", h("textarea", { name: "welcome", rows: 3, value: intake.welcome })),
		h("button", { class: "primary-button", type: "submit", text: "Save details" }),
	);
	const link = h("section", { class: "ia-card" },
		h("h2", { text: "Link" }),
		h("p", {},
			intake.linkOpen
				? `Open until ${formatDate(new Date(intake.linkClosesAt - 1).toISOString().slice(0, 10))}.`
				: intake.revoked
					? "Revoked. The client can't open it."
					: "Closed: more than 30 days after the shoot.",
		),
		h("div", { class: "ia-actions" },
			intake.linkOpen
				? h("button", {
					class: "primary-button",
					type: "button",
					text: "Copy link",
					onclick: async () => {
						const result = await act(() => post("copyLink", { id: intake._id }));
						if (result && (await copyText(result.link))) say("Link copied");
					},
				})
				: null,
			h("button", {
				class: "secondary-button",
				type: "button",
				text: "Make a new link",
				onclick: async () => {
					if (!confirm("Make a new link? The old link will stop working.")) return;
					const result = await act(() => post("reissueLink", { id: intake._id }));
					if (result && (await copyText(result.link))) say("New link copied. The old one no longer works.");
				},
			}),
			intake.linkOpen && !intake.revoked
				? h("button", { class: "quiet-button", type: "button", text: "Revoke link", onclick: () => confirm("Revoke this link? The client won't be able to open it.") && act(() => post("revokeLink", { id: intake._id }), "Link revoked") })
				: null,
		),
		notStarted
			? h("div", { class: "ia-actions" },
				h("button", { class: "quiet-button", type: "button", text: "Refresh questions and poses from the current templates", onclick: () => confirm("Replace this intake's questions and deck with the current templates?") && act(() => post("refreshFromTemplates", { id: intake._id }), "Refreshed from templates") }),
				h("button", {
					class: "quiet-button ia-danger",
					type: "button",
					text: "Delete intake",
					onclick: async () => {
						if (!confirm(`Delete the intake for ${intake.clientName}?`)) return;
						if (await act(() => post("removeIntake", { id: intake._id }), "Intake deleted")) location.hash = "#intakes";
					},
				}),
			)
			: null,
	);
	elements.view.replaceChildren(
		h("div", { class: "ia-stack" },
			h("div", { class: "ia-heading-row" },
				h("div", {},
					h("a", { href: "#intakes", class: "ia-back", text: "← All intakes" }),
					h("h2", { class: "ia-title", text: intake.clientName }),
					h("p", { class: "ia-muted" }, `${intake.eventTypeName} · ${formatDate(intake.shootDate)} · `, statusPill(intake.status)),
				),
			),
			renderResults(data),
			link,
			details,
			renderIntakeQuestions(data, editingKey),
			renderIntakeDeck(data),
		),
	);
};

// ── Poses ─────────────────────────────────────────────────────────────────

/** Shrink to 1600 px on the long edge. Redrawing on a canvas also drops location and camera data. */
const shrinkImage = async (file) => {
	const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
	const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	let dataUrl = canvas.toDataURL("image/webp", 0.85);
	// Browsers that can't encode WebP hand back PNG; JPEG is much smaller.
	if (!dataUrl.startsWith("data:image/webp")) dataUrl = canvas.toDataURL("image/jpeg", 0.86);
	return { dataUrl, width: canvas.width, height: canvas.height };
};

const poseFields = (initial = {}) => {
	const { eventTypes, tagGroups } = state.library;
	const tagValue = (groupId) => (initial.tags || []).find((tag) => tag.group === groupId)?.value || "";
	return [
		h("div", { class: "ia-grid-2" },
			field("Title", h("input", { name: "title", maxLength: 120, value: initial.title || "" }), "Optional. Shown on the card."),
			field("Order", h("input", { name: "rank", type: "number", step: "1", value: initial.rank ?? 100 }), "Lower numbers come first in decks."),
		),
		h("fieldset", { class: "ia-fieldset" },
			h("legend", { text: "Source" }),
			h("label", { class: "ia-check" }, h("input", { type: "radio", name: "source", value: "own", checked: (initial.source || "own") === "own" }), "My photo"),
			h("label", { class: "ia-check" }, h("input", { type: "radio", name: "source", value: "reference", checked: initial.source === "reference" }), "Someone else's (shown as inspiration)"),
			field("Credit", h("input", { name: "credit", maxLength: 200, value: initial.credit || "" }), "For inspiration photos: the photographer's name."),
		),
		h("fieldset", { class: "ia-fieldset" },
			h("legend", { text: "Event types" }),
			eventTypes.map((type) =>
				h("label", { class: "ia-check" }, h("input", { type: "checkbox", name: "eventTypeIds", value: type._id, checked: (initial.eventTypeIds || []).includes(type._id) }), type.name),
			),
		),
		h("fieldset", { class: "ia-fieldset ia-tag-grid" },
			h("legend", { text: "Tags" }),
			tagGroups.map((group) =>
				field(group.name, h("select", { name: `tag:${group._id}` }, h("option", { value: "", text: "—" }), group.values.map((value) => h("option", { value: value.key, text: value.label, selected: tagValue(group._id) === value.key })))),
			),
		),
		field("Note tags", h("input", { name: "notes", value: (initial.notes || []).join(", "), placeholder: "golden hour, dip kiss" }), "Comma-separated. Shown with results, not scored."),
	];
};

const readPoseForm = (form) => {
	const data = new FormData(form);
	return {
		title: String(data.get("title") || ""),
		rank: Number(data.get("rank")) || 0,
		source: data.get("source") === "reference" ? "reference" : "own",
		credit: String(data.get("credit") || ""),
		eventTypeIds: data.getAll("eventTypeIds").map(String),
		tags: state.library.tagGroups.map((group) => ({ group: group._id, value: String(data.get(`tag:${group._id}`) || "") })).filter((tag) => tag.value),
		notes: String(data.get("notes") || "").split(",").map((note) => note.trim()).filter(Boolean),
	};
};

const renderPoses = (editingId) => {
	const fileInput = h("input", { type: "file", name: "file", accept: "image/*", required: true });
	const preview = h("img", { class: "ia-preview", alt: "", hidden: true });
	fileInput.addEventListener("change", () => {
		const file = fileInput.files[0];
		preview.hidden = !file;
		if (file) preview.src = URL.createObjectURL(file);
	});
	const upload = h("form", {
		class: "ia-card ia-form",
		onsubmit: async (event) => {
			event.preventDefault();
			const button = event.target.querySelector("button[type=submit]");
			button.disabled = true;
			button.textContent = "Uploading…";
			try {
				const image = await shrinkImage(fileInput.files[0]);
				await act(() => post("uploadPose", { image: image.dataUrl, width: image.width, height: image.height, ...readPoseForm(event.target) }), "Pose added");
			} catch (error) {
				say(`Couldn't read that image: ${error.message}`, true);
			} finally {
				button.disabled = false;
				button.textContent = "Add pose";
			}
		},
	},
		h("h2", { text: "Add a pose" }),
		h("div", { class: "ia-upload" }, field("Photo", fileInput, "Resized to 1600 px and stripped of location data before upload."), preview),
		poseFields(),
		h("button", { class: "primary-button", type: "submit", text: "Add pose" }),
	);
	const cards = state.library.poses.map((pose) => {
		if (pose._id === editingId) {
			return h("form", {
				class: "ia-card ia-form ia-pose-edit",
				onsubmit: (event) => {
					event.preventDefault();
					act(() => post("updatePose", { id: pose._id, archived: pose.archived, ...readPoseForm(event.target) }), "Pose saved");
				},
			},
				h("img", { src: imageUrl(pose._id), alt: "" }),
				poseFields(pose),
				h("div", { class: "ia-actions" }, h("button", { class: "primary-button", type: "submit", text: "Save pose" }), h("button", { class: "quiet-button", type: "button", text: "Cancel", onclick: () => renderPoses() })),
			);
		}
		const tags = pose.tags.map(tagLabel).filter(Boolean);
		return h("figure", { class: `ia-pose${pose.archived ? " ia-removed" : ""}` },
			h("img", { src: imageUrl(pose._id), alt: pose.title, loading: "lazy" }),
			h("figcaption", {},
				h("strong", { text: pose.title || "Untitled" }),
				pose.source === "reference" ? h("span", { class: "ia-pill", text: "Inspiration" }) : null,
				pose.archived ? h("span", { class: "ia-pill", text: "Archived" }) : null,
				h("div", { class: "ia-muted", text: pose.eventTypeIds.map(eventTypeName).join(", ") || "No event type" }),
				h("div", { class: "ia-muted", text: tags.join(" · ") || "No tags" }),
				h("div", { class: "ia-muted", text: `Order ${pose.rank}` }),
				h("div", { class: "ia-actions" },
					h("button", { class: "quiet-button", type: "button", text: "Edit", onclick: () => renderPoses(pose._id) }),
					pose.archived
						? h("button", { class: "quiet-button", type: "button", text: "Unarchive", onclick: () => act(() => post("updatePose", { id: pose._id, ...pick(pose), archived: false })) })
						: h("button", {
							class: "quiet-button ia-danger",
							type: "button",
							text: "Delete",
							onclick: async () => {
								if (!confirm("Delete this pose? If a client has seen it, it's archived instead.")) return;
								await act(() => post("deletePose", { id: pose._id }), "Done");
							},
						}),
				),
			),
		);
	});
	elements.view.replaceChildren(
		h("div", { class: "ia-stack" },
			upload,
			h("section", { class: "ia-card" },
				h("h2", { text: `Pose library (${state.library.poses.filter((pose) => !pose.archived).length})` }),
				cards.length ? h("div", { class: "ia-pose-grid" }, cards) : h("p", { class: "ia-muted", text: "No poses yet." }),
			),
		),
	);
};

const pick = (pose) => ({
	title: pose.title,
	source: pose.source,
	credit: pose.credit,
	tags: pose.tags,
	notes: pose.notes,
	eventTypeIds: pose.eventTypeIds,
	rank: pose.rank,
});

// ── Question templates ────────────────────────────────────────────────────

const renderQuestions = (editingId) => {
	const { questions, eventTypes } = state.library;
	const scopeSelect = (selected) =>
		field("Asked for", h("select", { name: "eventTypeId" },
			h("option", { value: "", text: "Every intake (shared)" }),
			eventTypes.map((type) => h("option", { value: type._id, text: type.name, selected: selected === type._id })),
		));
	const orderInput = (value) => field("Order", h("input", { name: "order", type: "number", step: "1", value }));
	const save = (id, archived) => (values) => {
		const { eventTypeId, order, ...rest } = values;
		return act(
			() => post("saveQuestionTemplate", { ...(id ? { id } : {}), prompt: rest.prompt, help: rest.help, kind: rest.kind, options: rest.options, required: rest.required, order: Number(order) || 0, archived, ...(eventTypeId ? { eventTypeId } : {}) }),
			"Question saved",
		);
	};
	const groups = [{ id: undefined, name: "Shared: every intake" }, ...eventTypes.map((type) => ({ id: type._id, name: type.name }))];
	elements.view.replaceChildren(
		h("div", { class: "ia-stack" },
			h("p", { class: "ia-muted", text: "Templates for new intakes. Intakes already created keep their own copy; edit those on the intake itself." }),
			groups.map((group) => {
				const items = questions.filter((question) => (question.eventTypeId || undefined) === group.id);
				return h("section", { class: "ia-card" },
					h("h2", { text: group.name }),
					items.length
						? h("ol", { class: "ia-q-list" },
							items.map((question) =>
								question._id === editingId
									? h("li", {}, questionForm({ initial: question, submitLabel: "Save question", extra: [scopeSelect(question.eventTypeId), orderInput(question.order)], onSave: save(question._id, question.archived), onCancel: () => renderQuestions() }))
									: h("li", { class: question.archived ? "ia-removed" : "" },
										h("div", { class: "ia-q-text" },
											h("strong", { text: question.prompt }),
											question.required ? h("span", { class: "ia-muted", text: " required" }) : null,
											h("div", { class: "ia-muted", text: `${KIND_LABELS[question.kind]}${question.options.length ? `: ${question.options.join(" / ")}` : ""}` }),
										),
										h("div", { class: "ia-actions" },
											h("button", { class: "quiet-button", type: "button", text: "Edit", onclick: () => renderQuestions(question._id) }),
											h("button", {
												class: "quiet-button",
												type: "button",
												text: question.archived ? "Restore" : "Archive",
												onclick: () => save(question._id, !question.archived)({ ...question, eventTypeId: question.eventTypeId || "", order: question.order }),
											}),
										),
									),
							),
						)
						: h("p", { class: "ia-muted", text: "No questions." }),
				);
			}),
			h("section", { class: "ia-card" },
				h("h2", { text: "Add a question" }),
				questionForm({ submitLabel: "Add question", extra: [scopeSelect(""), orderInput(questions.length)], onSave: save(undefined, false) }),
			),
		),
	);
};

// ── Event types and tag groups ────────────────────────────────────────────

const renderTypes = () => {
	const { eventTypes, tagGroups } = state.library;
	const typeRow = (type = {}) =>
		h("form", {
			class: "ia-row-form",
			onsubmit: (event) => {
				event.preventDefault();
				const values = formValues(event.target);
				act(() => post("saveEventType", { ...(type._id ? { id: type._id } : {}), name: values.name, deckLimit: Number(values.deckLimit) || 40, order: Number(values.order) || 0, active: event.target.elements.active.checked }), "Event type saved");
			},
		},
			h("input", { name: "name", required: true, maxLength: 80, value: type.name || "", placeholder: "New event type", "aria-label": "Name" }),
			h("label", { class: "ia-inline" }, "Deck", h("input", { name: "deckLimit", type: "number", min: 1, max: 100, value: type.deckLimit ?? 40 })),
			h("label", { class: "ia-inline" }, "Order", h("input", { name: "order", type: "number", value: type.order ?? eventTypes.length })),
			h("label", { class: "ia-check" }, h("input", { type: "checkbox", name: "active", checked: type.active ?? true }), "Active"),
			h("button", { class: "secondary-button", type: "submit", text: type._id ? "Save" : "Add" }),
		);
	const groupForm = (group = { values: [] }) => {
		const list = h("div", { class: "ia-values" });
		const addValue = (value = { label: "" }) =>
			list.append(h("input", { class: "ia-value", value: value.label, "data-key": value.key || "", placeholder: "Value", maxLength: 60 }));
		group.values.forEach(addValue);
		addValue();
		return h("form", {
			class: "ia-card ia-form",
			onsubmit: (event) => {
				event.preventDefault();
				const values = [...list.querySelectorAll(".ia-value")].map((input) => ({ label: input.value, ...(input.dataset.key ? { key: input.dataset.key } : {}) })).filter((value) => value.label.trim());
				const { name, order } = formValues(event.target);
				act(() => post("saveTagGroup", { ...(group._id ? { id: group._id } : {}), name, order: Number(order) || 0, values }), "Tag group saved");
			},
		},
			h("div", { class: "ia-grid-2" },
				field("Tag group", h("input", { name: "name", required: true, value: group.name || "", placeholder: "e.g. Movement" })),
				field("Order", h("input", { name: "order", type: "number", value: group.order ?? tagGroups.length })),
			),
			field("Values", list, "Renaming a value keeps poses tagged with it. Clear a box to drop the value."),
			h("div", { class: "ia-actions" },
				h("button", { class: "quiet-button", type: "button", text: "+ Another value", onclick: () => addValue() }),
				h("button", { class: "secondary-button", type: "submit", text: group._id ? "Save group" : "Add group" }),
			),
		);
	};
	elements.view.replaceChildren(
		h("div", { class: "ia-stack" },
			h("section", { class: "ia-card" },
				h("h2", { text: "Event types" }),
				h("p", { class: "ia-muted", text: "Deck is the most poses a new intake of this type gets. Inactive types can't be picked for new intakes." }),
				eventTypes.map((type) => typeRow(type)),
				typeRow(),
			),
			h("h2", { class: "ia-section-title", text: "Tag groups" }),
			h("p", { class: "ia-muted", text: "Each pose takes one value per group. Leanings are scored per value." }),
			tagGroups.map((group) => groupForm(group)),
			groupForm(),
		),
	);
};

// ── Routing and session ───────────────────────────────────────────────────

const route = async () => {
	const hash = location.hash.slice(1) || "intakes";
	const [tab, id] = hash.split("=");
	const active = tab === "intake" ? "intakes" : tab;
	document.querySelectorAll("[data-tab]").forEach((link) => link.setAttribute("aria-current", link.dataset.tab === active ? "page" : "false"));
	state.library = await get({ op: "overview" });
	if (tab === "intake" && id) return renderIntakeDetail(await get({ op: "intake", id }));
	if (tab === "poses") return renderPoses();
	if (tab === "questions") return renderQuestions();
	if (tab === "types") return renderTypes();
	state.intakes = (await get({ op: "intakes" })).intakes;
	elements.view.replaceChildren(renderIntakes());
};

window.addEventListener("hashchange", () => route().catch((error) => say(error.message, true)));

const start = async (session) => {
	state.csrf = session.csrf;
	elements.loginView.hidden = true;
	elements.dashboardView.hidden = false;
	await route().catch((error) => say(error.message, true));
};

elements.loginForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	elements.loginError.hidden = true;
	try {
		const session = await request("/api/admin/session", {
			method: "POST",
			body: JSON.stringify({ email: elements.loginEmail.value, password: elements.loginPassword.value }),
		});
		elements.loginPassword.value = "";
		await start(session);
	} catch (error) {
		elements.loginError.textContent = error.message;
		elements.loginError.hidden = false;
	}
});

elements.logoutButton.addEventListener("click", async () => {
	await request("/api/admin/session", { method: "DELETE" }).catch(() => {});
	location.reload();
});

(async () => {
	try {
		const session = await request("/api/admin/session");
		if (session.authenticated) await start(session);
		else elements.loginView.hidden = false;
	} catch (error) {
		elements.loginView.hidden = false;
		elements.loginError.textContent = error.message;
		elements.loginError.hidden = false;
	}
})();
