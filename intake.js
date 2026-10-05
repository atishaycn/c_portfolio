(() => {
	// The intake link is /intake/<token>; the token is the only credential.
	const token = location.pathname.split("/").filter(Boolean)[1] || "";
	const main = document.getElementById("intake");
	const saveState = document.getElementById("save-state");
	const progress = document.getElementById("progress");
	const progressBar = document.getElementById("progress-bar");

	const CHOICE_LABELS = { like: "Like", dislike: "Not for me", must: "Must have", skip: "Not sure" };
	const SWIPE_DISTANCE = 90;

	let view = null;
	let mode = "full"; // "update" shows only what Claire added since the last submit
	let deckPos = 0;
	let redo = false;
	let history = [];
	let pending = 0;

	/** Build an element. Text always goes in as text, never as HTML. */
	const h = (tag, props = {}, ...children) => {
		const element = document.createElement(tag);
		for (const [name, value] of Object.entries(props)) {
			if (value === undefined || value === null || value === false) continue;
			if (name === "class") element.className = value;
			else if (name === "text") element.textContent = value;
			else if (name.startsWith("on")) element.addEventListener(name.slice(2), value);
			else if (name in element && name !== "list") element[name] = value;
			else element.setAttribute(name, value === true ? "" : value);
		}
		for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) element.append(child);
		return element;
	};

	const show = (...nodes) => {
		main.replaceChildren(...nodes);
		window.scrollTo({ top: 0 });
		main.querySelector("h1, h2")?.focus({ preventScroll: true });
	};

	const setProgress = (fraction) => {
		progress.hidden = fraction === null;
		if (fraction !== null) progressBar.style.width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
	};

	const setSaving = (state) => {
		saveState.textContent = state === "saving" ? "Saving…" : state === "error" ? "Couldn't save. Check your connection." : state === "saved" ? "Saved" : "";
		saveState.dataset.state = state;
	};

	const api = async (op, data = {}) => {
		pending += 1;
		setSaving("saving");
		try {
			const response = await fetch("/api/intake", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, op, ...data }),
			});
			const body = await response.json().catch(() => ({}));
			if (body.closed) {
				showClosed();
				throw new Error(body.error);
			}
			if (!response.ok) throw Object.assign(new Error(body.error || "Couldn't save"), { body });
			if (pending === 1) setSaving("saved");
			return body;
		} catch (error) {
			setSaving(main.querySelector(".panel h1")?.textContent === "This intake has closed" ? "" : "error");
			throw error;
		} finally {
			pending -= 1;
		}
	};

	const imageUrl = (card) => `/api/intake?op=image&token=${encodeURIComponent(token)}&pose=${encodeURIComponent(card.poseId)}`;

	const firstName = () => view.clientName.split(/\s+/)[0];
	const formatDate = (value) =>
		new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

	const scopeCards = () => (mode === "update" ? view.cards.filter((card) => card.isNew) : view.cards);
	const scopeQuestions = () => (mode === "update" ? view.questions.filter((question) => question.isNew) : view.questions);
	const hasAnswer = (value) => (Array.isArray(value) ? value.length > 0 : String(value ?? "").trim() !== "");
	const missing = () => ({
		cards: scopeCards().filter((card) => !card.choice).length,
		questions: scopeQuestions().filter((question) => question.required && !hasAnswer(question.answer)),
	});
	const nextUnswiped = (from = 0) => {
		const cards = scopeCards();
		const index = cards.findIndex((card, position) => position >= from && !card.choice);
		return index === -1 ? cards.length : index;
	};

	const newBadge = (item) => (item.isNew ? h("span", { class: "badge badge-new", text: "New from Claire" }) : null);

	// ── Screens ────────────────────────────────────────────────────────────

	const showClosed = () => {
		setProgress(null);
		setSaving("");
		show(
			h("section", { class: "panel" },
				h("h1", { tabIndex: -1, text: "This intake has closed" }),
				h("p", { text: "The link may have expired or been replaced. Please contact Claire and she'll send you a new one." }),
				h("a", { class: "button", href: "/booking.html", text: "Contact Claire" }),
			),
		);
	};

	const showWelcome = () => {
		setProgress(null);
		const started = view.cards.some((card) => card.choice) || view.questions.some((question) => hasAnswer(question.answer));
		const updated = view.status === "needs update";
		const steps = h("ol", { class: "steps" },
			h("li", {}, h("strong", { text: "Swipe through poses. " }), "Right if you like it, left if not, up for a must-have. About two minutes."),
			h("li", {}, h("strong", { text: "Answer a few questions " }), "about the day and the people in it."),
			h("li", {}, h("strong", { text: "Review and send. " }), "Everything saves as you go, so you can stop and come back with this link."),
		);
		const start = () => {
			mode = updated ? "update" : "full";
			redo = false;
			deckPos = nextUnswiped();
			if (deckPos < scopeCards().length) showDeck();
			else if (scopeQuestions().some((question) => !hasAnswer(question.answer))) showQuestions();
			else showReview();
		};
		show(
			h("section", { class: "panel welcome" },
				h("p", { class: "eyebrow", text: `${view.eventTypeName} · ${formatDate(view.shootDate)}` }),
				h("h1", { tabIndex: -1, text: updated ? `${firstName()}, Claire added a few things` : `Hi ${firstName()}` }),
				view.welcome ? h("p", { class: "welcome-message", text: view.welcome }) : null,
				updated
					? h("p", { text: "Since you sent your answers, Claire added some poses or questions. You'll only see the new ones." })
					: steps,
				h("button", { class: "button", type: "button", onclick: start, text: updated ? "Show me what's new" : started ? "Continue where I left off" : "Start with the poses" }),
			),
		);
	};

	const showThanks = () => {
		setProgress(null);
		show(
			h("section", { class: "panel" },
				h("h1", { tabIndex: -1, text: `Thank you, ${firstName()}!` }),
				h("p", { text: "Claire has your answers. You can change them any time before the shoot with this same link." }),
				h("button", {
					class: "button button-quiet",
					type: "button",
					text: "Review or change my answers",
					onclick: () => {
						mode = "full";
						showReview();
					},
				}),
			),
		);
	};

	// ── Deck ───────────────────────────────────────────────────────────────

	const preload = (cards) => cards.forEach((card) => card && (new Image().src = imageUrl(card)));

	const cardElement = (card, isTop) => {
		const image = h("img", { src: imageUrl(card), alt: card.title || "Pose example", draggable: false, decoding: "async" });
		return h("article", { class: `card${isTop ? " card-top" : " card-under"}`, "data-key": card.key },
			image,
			h("div", { class: "card-badges" },
				card.inspiration ? h("span", { class: "badge", text: "Inspiration" }) : null,
				newBadge(card),
			),
			h("span", { class: "stamp stamp-like", text: "Like" }),
			h("span", { class: "stamp stamp-dislike", text: "Not for me" }),
			h("span", { class: "stamp stamp-must", text: "Must have" }),
			card.title || card.credit
				? h("div", { class: "card-caption" },
					card.title ? h("span", { text: card.title }) : null,
					card.credit ? h("small", { text: `Photo: ${card.credit}` }) : null,
				)
				: null,
		);
	};

	const leaveDeck = () => (redo || mode === "full" ? showPosesNote() : scopeQuestions().length ? showQuestions() : showReview());

	const choose = (choice, element) => {
		const cards = scopeCards();
		const card = cards[deckPos];
		if (!card) return;
		const previous = card.choice;
		card.choice = choice;
		history.push({ key: card.key, previous, pos: deckPos });
		const fly = { like: "translate(140vw, 0) rotate(24deg)", dislike: "translate(-140vw, 0) rotate(-24deg)", must: "translate(0, -140vh)", skip: "translate(0, 40px) scale(0.9)" }[choice];
		if (element) {
			element.classList.add("card-leaving");
			element.style.transform = fly;
			element.style.opacity = choice === "skip" ? "0" : "";
		}
		deckPos = redo ? deckPos + 1 : nextUnswiped(deckPos + 1);
		api("swipe", { deckKey: card.key, choice }).catch(() => {
			card.choice = previous;
			deckPos = Math.min(deckPos, cards.indexOf(card));
			history = history.filter((entry) => entry.key !== card.key);
			showDeck();
		});
		setTimeout(() => (deckPos >= cards.length ? leaveDeck() : showDeck()), element ? 220 : 0);
	};

	const undo = () => {
		const last = history.pop();
		if (!last) return;
		const card = scopeCards().find((entry) => entry.key === last.key);
		if (!card) return;
		card.choice = last.previous;
		deckPos = last.pos;
		api("swipe", { deckKey: card.key, choice: last.previous ?? null }).catch(() => {});
		showDeck();
	};

	const attachDrag = (element) => {
		let start = null;
		const reset = () => {
			element.style.transform = "";
			element.style.setProperty("--like", 0);
			element.style.setProperty("--dislike", 0);
			element.style.setProperty("--must", 0);
		};
		element.addEventListener("pointerdown", (event) => {
			if (event.button !== 0) return;
			start = { x: event.clientX, y: event.clientY, dx: 0, dy: 0 };
			element.setPointerCapture(event.pointerId);
			element.classList.add("card-dragging");
		});
		element.addEventListener("pointermove", (event) => {
			if (!start) return;
			start.dx = event.clientX - start.x;
			start.dy = event.clientY - start.y;
			element.style.transform = `translate(${start.dx}px, ${start.dy}px) rotate(${start.dx / 18}deg)`;
			const upward = -start.dy > Math.abs(start.dx);
			element.style.setProperty("--like", upward ? 0 : Math.max(0, Math.min(1, start.dx / SWIPE_DISTANCE)));
			element.style.setProperty("--dislike", upward ? 0 : Math.max(0, Math.min(1, -start.dx / SWIPE_DISTANCE)));
			element.style.setProperty("--must", upward ? Math.max(0, Math.min(1, -start.dy / SWIPE_DISTANCE)) : 0);
		});
		const end = () => {
			if (!start) return;
			const { dx, dy } = start;
			start = null;
			element.classList.remove("card-dragging");
			if (-dy > SWIPE_DISTANCE && -dy > Math.abs(dx)) return choose("must", element);
			if (dx > SWIPE_DISTANCE) return choose("like", element);
			if (dx < -SWIPE_DISTANCE) return choose("dislike", element);
			reset();
		};
		element.addEventListener("pointerup", end);
		element.addEventListener("pointercancel", () => {
			start = null;
			element.classList.remove("card-dragging");
			reset();
		});
	};

	const showDeck = () => {
		const cards = scopeCards();
		const card = cards[deckPos];
		if (!card) return leaveDeck();
		setProgress((deckPos + 1) / (cards.length + 1));
		const top = cardElement(card, true);
		const under = cards[deckPos + 1] ? cardElement(cards[deckPos + 1], false) : null;
		preload([cards[deckPos + 2], cards[deckPos + 3]]);
		attachDrag(top);
		const button = (choice, symbol, extra = "") =>
			h("button", {
				class: `choice choice-${choice} ${extra}`,
				type: "button",
				"aria-label": CHOICE_LABELS[choice],
				onclick: () => choose(choice, top),
			}, h("span", { "aria-hidden": "true", text: symbol }), h("small", { text: CHOICE_LABELS[choice] }));
		show(
			h("section", { class: "deck-screen" },
				h("div", { class: "deck-heading" },
					h("h2", { tabIndex: -1, class: "visually-hidden", text: "Poses" }),
					h("p", { class: "eyebrow", text: `Pose ${deckPos + 1} of ${cards.length}` }),
					card.choice ? h("span", { class: "badge", text: `You said: ${CHOICE_LABELS[card.choice]}` }) : null,
				),
				h("div", { class: "stack" }, under, top),
				h("div", { class: "choices" },
					button("dislike", "✕"),
					button("must", "★", "choice-big"),
					button("like", "♥"),
				),
				h("div", { class: "deck-tools" },
					h("button", { class: "link-button", type: "button", disabled: !history.length, onclick: undo, text: "↶ Undo" }),
					h("button", { class: "link-button", type: "button", onclick: () => choose("skip", top), text: "Not sure, skip" }),
				),
				deckPos === 0 && !history.length
					? h("p", { class: "hint", text: "Swipe right to like, left to pass, up for a must-have. Or use the buttons." })
					: null,
			),
		);
	};

	document.addEventListener("keydown", (event) => {
		if (!main.querySelector(".deck-screen") || event.target.closest("input, textarea")) return;
		const top = main.querySelector(".card-top");
		const keys = { ArrowRight: "like", ArrowLeft: "dislike", ArrowUp: "must", ArrowDown: "skip" };
		if (keys[event.key]) {
			event.preventDefault();
			choose(keys[event.key], top);
		} else if ((event.key === "z" && (event.metaKey || event.ctrlKey)) || event.key === "Backspace") {
			event.preventDefault();
			undo();
		}
	});

	// ── Note, questions, review ────────────────────────────────────────────

	const debounce = (fn, wait) => {
		let timer;
		return (...args) => {
			clearTimeout(timer);
			timer = setTimeout(() => fn(...args), wait);
		};
	};

	const showPosesNote = () => {
		setProgress(null);
		const saveNote = debounce((text) => api("posesNote", { text }).catch(() => {}), 700);
		const field = h("textarea", {
			rows: 5,
			maxLength: 5000,
			value: view.posesNote,
			placeholder: "e.g. We'd love a photo with our dog, and no kissing shots please.",
			oninput: (event) => {
				view.posesNote = event.target.value;
				saveNote(view.posesNote);
			},
		});
		show(
			h("section", { class: "panel" },
				h("p", { class: "eyebrow", text: "Poses done" }),
				h("h1", { tabIndex: -1, text: "Anything else about the poses?" }),
				h("label", { class: "field" }, h("span", { text: "Optional" }), field),
				h("button", { class: "button", type: "button", onclick: () => (redo ? showReview() : showQuestions()), text: "Continue" }),
			),
		);
	};

	const questionField = (question) => {
		const save = (value) => {
			question.answer = value;
			return api("answer", { questionKey: question.key, value }).catch((error) => {
				if (error.body?.error) alert(error.body.error);
			});
		};
		const saveSoon = debounce(save, 700);
		const id = `q-${question.key}`;
		if (question.kind === "single" || question.kind === "multiple") {
			const multiple = question.kind === "multiple";
			const current = () => (multiple ? (Array.isArray(question.answer) ? question.answer : []) : question.answer || "");
			return h("div", { class: "options", role: multiple ? "group" : "radiogroup", "aria-labelledby": `${id}-label` },
				question.options.map((option) =>
					h("label", { class: "option" },
						h("input", {
							type: multiple ? "checkbox" : "radio",
							name: id,
							value: option,
							checked: multiple ? current().includes(option) : current() === option,
							onchange: (event) => {
								if (!multiple) return save(option);
								const picked = new Set(current());
								event.target.checked ? picked.add(option) : picked.delete(option);
								save(question.options.filter((entry) => picked.has(entry)));
							},
						}),
						h("span", { text: option }),
					),
				),
			);
		}
		const props = {
			id,
			value: question.answer || "",
			required: question.required,
			oninput: (event) => {
				question.answer = event.target.value;
				saveSoon(event.target.value);
			},
		};
		if (question.kind === "long") return h("textarea", { ...props, rows: 4, maxLength: 5000 });
		if (question.kind === "datetime") return h("input", { ...props, type: "datetime-local" });
		return h("input", { ...props, type: "text", maxLength: 500 });
	};

	const showQuestions = (focusKey) => {
		setProgress(null);
		const questions = scopeQuestions();
		show(
			h("section", { class: "panel" },
				h("p", { class: "eyebrow", text: "About your day" }),
				h("h1", { tabIndex: -1, text: mode === "update" ? "New questions from Claire" : "A few questions" }),
				h("p", { class: "hint", text: "Questions marked * are needed. Everything saves as you type." }),
				h("div", { class: "questions" },
					questions.map((question) =>
						h("div", { class: "question", "data-key": question.key },
							h("label", { class: "question-label", id: `q-${question.key}-label`, htmlFor: `q-${question.key}` },
								question.prompt,
								question.required ? h("span", { class: "required", "aria-label": "required", text: " *" }) : null,
								newBadge(question),
							),
							question.help ? h("p", { class: "question-help", text: question.help }) : null,
							questionField(question),
						),
					),
				),
				h("button", { class: "button", type: "button", onclick: showReview, text: "Review and send" }),
			),
		);
		if (focusKey) main.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)?.scrollIntoView({ block: "center" });
	};

	const formatAnswer = (value) => (Array.isArray(value) ? value.join(", ") : value) || "—";

	const showReview = () => {
		setProgress(null);
		const cards = scopeCards();
		const count = (choice) => cards.filter((card) => card.choice === choice).length;
		const gaps = missing();
		const ready = !gaps.cards && !gaps.questions.length;
		const errorBox = h("p", { class: "form-error", role: "alert", hidden: true });
		const submit = async (event) => {
			event.target.disabled = true;
			errorBox.hidden = true;
			try {
				await api("submit");
				view.status = "submitted";
				view.submittedAt = Date.now();
				view.cards.forEach((card) => (card.isNew = false));
				view.questions.forEach((question) => (question.isNew = false));
				mode = "full";
				showThanks();
			} catch (error) {
				errorBox.textContent = error.message;
				errorBox.hidden = false;
				event.target.disabled = false;
			}
		};
		const wasSubmitted = view.status === "submitted";
		show(
			h("section", { class: "panel" },
				h("p", { class: "eyebrow", text: "Review" }),
				h("h1", { tabIndex: -1, text: wasSubmitted ? "Your answers" : "Ready to send?" }),
				cards.length
					? h("div", { class: "review-block" },
						h("h2", { text: "Poses" }),
						h("p", { text: `Must-have ${count("must")} · liked ${count("like")} · not for you ${count("dislike")} · not sure ${count("skip")}` }),
						gaps.cards ? h("p", { class: "missing", text: `${gaps.cards} pose${gaps.cards === 1 ? "" : "s"} still to swipe.` }) : null,
						h("button", {
							class: "link-button",
							type: "button",
							text: gaps.cards ? "Finish the poses" : "Go through the poses again",
							onclick: () => {
								redo = !gaps.cards;
								history = [];
								deckPos = redo ? 0 : nextUnswiped();
								showDeck();
							},
						}),
						view.posesNote ? h("p", { class: "review-note", text: `“${view.posesNote}”` }) : null,
					)
					: null,
				h("div", { class: "review-block" },
					h("h2", { text: "Questions" }),
					h("dl", { class: "review-answers" },
						scopeQuestions().map((question) => {
							const empty = question.required && !hasAnswer(question.answer);
							return h("div", { class: empty ? "missing-row" : "" },
								h("dt", { text: question.prompt }),
								h("dd", {},
									empty ? h("span", { class: "missing", text: "Needs an answer" }) : formatAnswer(question.answer),
									" ",
									h("button", { class: "link-button", type: "button", text: "Edit", onclick: () => showQuestions(question.key) }),
								),
							);
						}),
					),
				),
				errorBox,
				h("button", {
					class: "button",
					type: "button",
					disabled: !ready,
					onclick: submit,
					text: wasSubmitted ? "Send my changes to Claire" : "Send to Claire",
				}),
				ready ? null : h("p", { class: "hint", text: "Finish the items marked above to send." }),
			),
		);
	};

	// ── Start ──────────────────────────────────────────────────────────────

	const load = async () => {
		try {
			const response = await fetch(`/api/intake?op=view&token=${encodeURIComponent(token)}`, { cache: "no-store" });
			const body = await response.json().catch(() => ({}));
			if (body.closed || response.status === 404 || response.status === 410) return showClosed();
			if (!response.ok) throw new Error(body.error || "Couldn't load");
			view = body;
			document.title = `Your ${view.eventTypeName.toLowerCase()} shoot • Claire Thomas`;
			if (view.status === "submitted") showThanks();
			else showWelcome();
		} catch {
			show(
				h("section", { class: "panel" },
					h("h1", { tabIndex: -1, text: "Something went wrong" }),
					h("p", { text: "We couldn't load your intake. Check your connection and try again." }),
					h("button", { class: "button", type: "button", onclick: load, text: "Try again" }),
				),
			);
		}
	};

	window.addEventListener("beforeunload", (event) => {
		if (pending) event.preventDefault();
	});

	if (!token) showClosed();
	else load();
})();
