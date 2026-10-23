const elements = {
	loginView: document.getElementById("login-view"),
	loginForm: document.getElementById("login-form"),
	loginEmail: document.getElementById("login-email"),
	loginNotice: document.getElementById("login-notice"),
	loginError: document.getElementById("login-error"),
	dashboardView: document.getElementById("dashboard-view"),
	logoutButton: document.getElementById("logout-button"),
	saveButton: document.getElementById("save-button"),
	shopSyncButton: document.getElementById("shop-sync-button"),
	saveStatus: document.getElementById("save-status"),
	systemMessage: document.getElementById("system-message"),
	albumList: document.getElementById("album-list"),
	albumCount: document.getElementById("album-count"),
	albumEditor: document.getElementById("album-editor"),
	addAlbumForm: document.getElementById("add-album-form"),
	newAlbumName: document.getElementById("new-album-name"),
	trashButton: document.getElementById("trash-button"),
	trashCount: document.getElementById("trash-count"),
	shopSettingsButton: document.getElementById("shop-settings-button"),
	testimonialsButton: document.getElementById("testimonials-button"),
	ordersButton: document.getElementById("orders-button"),
	ordersCount: document.getElementById("orders-count"),
};

const state = {
	content: null,
	csrf: null,
	email: null,
	selectedAlbumId: null,
	showTrash: false,
	showShopSettings: false,
	showTestimonials: false,
	showOrders: false,
	orders: null,
	ordersLoading: false,
	ordersError: null,
	ordersBusy: false,
	orderEdit: null,
	dirty: false,
	saving: false,
	shopSyncing: false,
	uploading: false,
	emptyingTrash: false,
	draggedPhotoId: null,
};

const request = async (url, options = {}) => {
	const headers = { Accept: "application/json", ...(options.headers || {}) };
	if (options.body && !(options.body instanceof FormData)) {
		headers["Content-Type"] = "application/json";
	}
	if (!["GET", "HEAD"].includes(options.method || "GET") && state.csrf) {
		headers["X-CSRF-Token"] = state.csrf;
	}
	const response = await fetch(url, {
		credentials: "same-origin",
		...options,
		headers,
	});
	const body = await response.json().catch(() => ({}));
	if (!response.ok) {
		const error = new Error(body.error || `Request failed (${response.status})`);
		error.status = response.status;
		throw error;
	}
	return body;
};

const cloudinaryThumb = (publicId, width = 500) => {
	const encoded = String(publicId)
		.split("/")
		.map(encodeURIComponent)
		.join("/");
	return `https://res.cloudinary.com/dpmdkrggj/image/upload/f_auto,q_auto,w_${width},c_limit/${encoded}`;
};

const slugify = (value) =>
	String(value)
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 60);

const sortByOrder = (entries) =>
	[...entries].sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));

const normalizeOrders = (entries) => {
	sortByOrder(entries).forEach((entry, index) => {
		entry.order = index;
	});
};

const albumById = (id) => state.content?.albums.find((album) => album.id === id);

const descendantNodeIds = (nodeId) => {
	const descendants = new Set();
	const nodes = [...state.content.groups, ...state.content.albums];
	const visit = (parentId) => {
		for (const node of nodes.filter((entry) => entry.parentId === parentId)) {
			if (descendants.has(node.id)) continue;
			descendants.add(node.id);
			visit(node.id);
		}
	};
	visit(nodeId);
	return descendants;
};

const setAlbumParent = (album, parentId) => {
	const nextParentId = parentId || null;
	if (album.parentId === nextParentId) return;
	const forbiddenParents = descendantNodeIds(album.id);
	if (nextParentId === album.id || forbiddenParents.has(nextParentId)) {
		showMessage("An album cannot be placed inside itself or one of its sub-albums.", true);
		return;
	}

	const previousParentId = album.parentId || null;
	album.parentId = nextParentId;
	const siblings = state.content.albums.filter(
		(entry) => entry.id !== album.id && (entry.parentId || null) === nextParentId,
	);
	const rootGroups = nextParentId
		? []
		: state.content.groups.filter((entry) => !entry.parentId);
	album.order = Math.max(-1, ...siblings.map((entry) => entry.order), ...rootGroups.map((entry) => entry.order)) + 1;
	const previousSiblings = state.content.albums.filter(
		(entry) => entry.id !== album.id && (entry.parentId || null) === previousParentId,
	);
	const previousRootGroups = previousParentId
		? []
		: state.content.groups.filter((entry) => !entry.parentId);
	normalizeOrders([...previousSiblings, ...previousRootGroups]);
	markDirty();
	render();
};

const markDirty = () => {
	state.dirty = true;
	elements.saveButton.disabled = false;
	elements.saveStatus.textContent = "Unsaved changes";
};

const showMessage = (message, isError = false) => {
	elements.systemMessage.textContent = message;
	elements.systemMessage.hidden = false;
	elements.systemMessage.classList.toggle("is-error", isError);
	window.clearTimeout(showMessage.timeout);
	showMessage.timeout = window.setTimeout(() => {
		elements.systemMessage.hidden = true;
	}, isError ? 8_000 : 4_000);
};

const createButton = (label, className, onClick) => {
	const button = document.createElement("button");
	button.type = "button";
	button.textContent = label;
	if (className) button.className = className;
	button.addEventListener("click", onClick);
	return button;
};

const moveAlbum = (albumId, direction) => {
	const album = albumById(albumId);
	if (!album) return;
	const entries = album.parentId
		? sortByOrder(
				state.content.albums.filter((entry) => entry.parentId === album.parentId),
			)
		: [
				...state.content.albums
					.filter((entry) => !entry.parentId)
					.map((entry) => ({ type: "album", value: entry })),
				...state.content.groups
					.filter((entry) => !entry.parentId)
					.map((entry) => ({ type: "group", value: entry })),
			]
				.sort(
					(left, right) =>
						left.value.order - right.value.order ||
						left.value.label.localeCompare(right.value.label),
				)
				.map((entry) => entry.value);
	const index = entries.findIndex((entry) => entry.id === albumId);
	const nextIndex = index + direction;
	if (nextIndex < 0 || nextIndex >= entries.length) return;
	[entries[index].order, entries[nextIndex].order] = [entries[nextIndex].order, entries[index].order];
	normalizeOrders(entries);
	markDirty();
	render();
};

const appendAlbumNode = (container, album, depth, siblingIndex, siblingCount) => {
	const row = document.createElement("div");
	row.className = `album-row${state.selectedAlbumId === album.id && !state.showTrash && !state.showShopSettings && !state.showTestimonials && !state.showOrders ? " is-selected" : ""}`;
	row.style.setProperty("--depth", depth);
	const select = createButton(
		`${album.label} (${album.items.length})`,
		"album-select",
		() => {
			state.selectedAlbumId = album.id;
			state.showTrash = false;
			state.showShopSettings = false;
			state.showTestimonials = false;
			state.showOrders = false;
			render();
		},
	);
	select.dataset.testid = `album-${album.key}`;
	const actions = document.createElement("div");
	actions.className = "album-order-actions";
	const up = createButton("↑", "icon-button", () => moveAlbum(album.id, -1));
	up.setAttribute("aria-label", `Move ${album.label} up`);
	up.disabled = siblingIndex === 0;
	const down = createButton("↓", "icon-button", () => moveAlbum(album.id, 1));
	down.setAttribute("aria-label", `Move ${album.label} down`);
	down.disabled = siblingIndex === siblingCount - 1;
	actions.append(up, down);
	row.append(select, actions);
	container.append(row);

	const children = sortByOrder(state.content.albums.filter((entry) => entry.parentId === album.id));
	children.forEach((child, index) => appendAlbumNode(container, child, depth + 1, index, children.length));
};

const renderAlbumList = () => {
	elements.albumList.replaceChildren();
	const topAlbums = sortByOrder(state.content.albums.filter((album) => !album.parentId));
	const groups = sortByOrder(state.content.groups.filter((group) => !group.parentId));
	const roots = [
		...topAlbums.map((album) => ({ type: "album", order: album.order, value: album })),
		...groups.map((group) => ({ type: "group", order: group.order, value: group })),
	].sort((left, right) => left.order - right.order);

	for (const root of roots) {
		if (root.type === "album") {
			appendAlbumNode(
				elements.albumList,
				root.value,
				0,
				roots.findIndex((entry) => entry.value.id === root.value.id),
				roots.length,
			);
			continue;
		}
		const groupLabel = document.createElement("p");
		groupLabel.className = "eyebrow";
		groupLabel.style.margin = "12px 8px 4px";
		groupLabel.textContent = root.value.label;
		elements.albumList.append(groupLabel);
		const groupAlbums = sortByOrder(state.content.albums.filter((album) => album.parentId === root.value.id));
		groupAlbums.forEach((album, index) =>
			appendAlbumNode(elements.albumList, album, 0, index, groupAlbums.length),
		);
	}
	elements.albumCount.textContent = `${state.content.albums.length} total`;
	elements.trashCount.textContent = state.content.trash.length;
	elements.trashButton.classList.toggle("is-selected", state.showTrash);
	elements.shopSettingsButton.classList.toggle("is-selected", state.showShopSettings);
	elements.testimonialsButton.classList.toggle("is-selected", state.showTestimonials);
	elements.ordersButton.classList.toggle("is-selected", state.showOrders);
	elements.ordersCount.textContent = state.orders ? String(state.orders.filter((order) => order.state === "waiting").length) : "";
};

const reorderPhoto = (album, photoId, direction) => {
	const items = sortByOrder(album.items);
	const index = items.findIndex((item) => item.id === photoId);
	const nextIndex = index + direction;
	if (nextIndex < 0 || nextIndex >= items.length) return;
	[items[index], items[nextIndex]] = [items[nextIndex], items[index]];
	items.forEach((item, itemIndex) => {
		item.order = itemIndex;
	});
	album.items = items;
	markDirty();
	renderEditor();
};

const movePhotoBefore = (album, photoId, beforeId) => {
	if (!photoId || photoId === beforeId) return;
	const items = sortByOrder(album.items);
	const sourceIndex = items.findIndex((item) => item.id === photoId);
	const targetIndex = items.findIndex((item) => item.id === beforeId);
	if (sourceIndex === -1 || targetIndex === -1) return;
	const [moved] = items.splice(sourceIndex, 1);
	items.splice(targetIndex, 0, moved);
	items.forEach((item, index) => {
		item.order = index;
	});
	album.items = items;
	markDirty();
	renderEditor();
};

const deletePhoto = (album, item) => {
	if (!window.confirm(`Remove photo ${item.order + 1} from ${album.label}? You can restore it from Trash.`)) return;
	album.items = album.items.filter((entry) => entry.id !== item.id);
	normalizeOrders(album.items);
	state.content.trash.unshift({
		albumId: album.id,
		deletedAt: new Date().toISOString(),
		item: { ...item },
	});
	markDirty();
	render();
};

const renderPhotoCard = (album, item, index) => {
	const card = document.createElement("article");
	card.className = "photo-card";
	card.draggable = true;
	card.dataset.photoId = item.id;
	card.addEventListener("dragstart", () => {
		state.draggedPhotoId = item.id;
		card.classList.add("is-dragging");
	});
	card.addEventListener("dragend", () => {
		state.draggedPhotoId = null;
		card.classList.remove("is-dragging");
	});
	card.addEventListener("dragover", (event) => event.preventDefault());
	card.addEventListener("drop", (event) => {
		event.preventDefault();
		movePhotoBefore(album, state.draggedPhotoId, item.id);
	});

	const imageWrap = document.createElement("div");
	imageWrap.className = "photo-image";
	const image = document.createElement("img");
	image.src = cloudinaryThumb(item.publicId);
	image.alt = item.title || `${album.label} photo ${index + 1}`;
	image.loading = "lazy";
	const position = document.createElement("span");
	position.className = "photo-position";
	position.textContent = `${index + 1} / ${album.items.length}`;
	imageWrap.append(image, position);

	const body = document.createElement("div");
	body.className = "photo-body";
	const label = document.createElement("label");
	label.textContent = "Caption";
	const textarea = document.createElement("textarea");
	textarea.value = item.title || "";
	textarea.maxLength = 2000;
	textarea.placeholder = "Optional caption";
	textarea.dataset.testid = `caption-${item.id}`;
	textarea.addEventListener("input", () => {
		item.title = textarea.value;
		markDirty();
	});
	label.append(textarea);

	const printToggle = document.createElement("label");
	printToggle.className = "photo-print-toggle";
	const printCheckbox = document.createElement("input");
	printCheckbox.type = "checkbox";
	printCheckbox.checked = item.printEnabled === true;
	printCheckbox.dataset.testid = `print-toggle-${item.id}`;
	printCheckbox.setAttribute(
		"aria-label",
		`Available for print, photo ${index + 1}`,
	);
	printCheckbox.addEventListener("change", () => {
		item.printEnabled = printCheckbox.checked;
		markDirty();
	});
	const printToggleText = document.createElement("span");
	printToggleText.textContent = "Available for print";
	printToggle.append(printCheckbox, printToggleText);

	const actions = document.createElement("div");
	actions.className = "photo-actions";
	const orderActions = document.createElement("div");
	const left = createButton("←", "", () => reorderPhoto(album, item.id, -1));
	left.setAttribute("aria-label", `Move photo ${index + 1} earlier`);
	left.disabled = index === 0;
	const right = createButton("→", "", () => reorderPhoto(album, item.id, 1));
	right.setAttribute("aria-label", `Move photo ${index + 1} later`);
	right.disabled = index === album.items.length - 1;
	orderActions.append(left, right);
	const remove = createButton("Delete", "delete-photo", () => deletePhoto(album, item));
	actions.append(orderActions, remove);
	body.append(label, printToggle, actions);
	card.append(imageWrap, body);
	return card;
};

const uploadPhotos = async (album, files, progressElement) => {
	if (!files.length || state.uploading) return;
	state.uploading = true;
	try {
		for (let index = 0; index < files.length; index += 1) {
			const file = files[index];
			if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image`);
			progressElement.textContent = `Uploading ${index + 1} of ${files.length}: ${file.name}`;
			const signature = await request("/api/admin/upload-signature", {
				method: "POST",
				body: JSON.stringify({ albumKey: album.key }),
			});
			const form = new FormData();
			form.set("file", file);
			form.set("api_key", signature.apiKey);
			form.set("timestamp", signature.timestamp);
			form.set("signature", signature.signature);
			form.set("public_id", signature.publicId);
			form.set("overwrite", "false");
			const uploadResponse = await fetch(signature.uploadUrl, { method: "POST", body: form });
			const uploaded = await uploadResponse.json();
			if (!uploadResponse.ok) throw new Error(uploaded.error?.message || `Upload failed for ${file.name}`);
			album.items.push({
				id: `${album.key}-${crypto.randomUUID()}`,
				publicId: uploaded.public_id,
				title: "",
				location: "",
				width: uploaded.width,
				height: uploaded.height,
				order: album.items.length,
				printEnabled: false,
			});
			markDirty();
		}
		await saveContent();
		progressElement.textContent = `${files.length} photo${files.length === 1 ? "" : "s"} uploaded and published.`;
		showMessage("Photos uploaded and published.");
		render();
	} finally {
		state.uploading = false;
	}
};

const deleteAlbum = (album) => {
	if (
		!window.confirm(
			`Delete “${album.label}”? Its ${album.items.length} photo${album.items.length === 1 ? "" : "s"} will move to Trash.`,
		)
	) {
		return;
	}
	for (const item of album.items) {
		state.content.trash.unshift({
			albumId: album.id,
			deletedAt: new Date().toISOString(),
			item: { ...item },
		});
	}
	const nextParentId = album.parentId || null;
	const targetSiblings = state.content.albums.filter(
		(entry) => entry.id !== album.id && entry.parentId !== album.id && (entry.parentId || null) === nextParentId,
	);
	const rootGroups = nextParentId
		? []
		: state.content.groups.filter((entry) => !entry.parentId);
	let nextOrder = Math.max(
		-1,
		...targetSiblings.map((entry) => entry.order),
		...rootGroups.map((entry) => entry.order),
	) + 1;
	for (const child of sortByOrder(state.content.albums.filter((entry) => entry.parentId === album.id))) {
		child.parentId = nextParentId;
		child.order = nextOrder;
		nextOrder += 1;
	}
	state.content.albums = state.content.albums.filter((entry) => entry.id !== album.id);
	state.selectedAlbumId = state.content.albums[0]?.id || null;
	markDirty();
	render();
};

const renderAlbumEditor = (album) => {
	const fragment = document.createDocumentFragment();
	const heading = document.createElement("div");
	heading.className = "editor-heading";
	const headingCopy = document.createElement("div");
	const eyebrow = document.createElement("p");
	eyebrow.className = "eyebrow";
	eyebrow.textContent = "Album";
	const title = document.createElement("h2");
	title.textContent = album.label;
	headingCopy.append(eyebrow, title);
	const headingActions = document.createElement("div");
	headingActions.className = "editor-actions";
	const preview = document.createElement("a");
	preview.className = "secondary-button";
	preview.href = album.path;
	preview.target = "_blank";
	preview.rel = "noreferrer";
	preview.textContent = "Preview";
	const remove = createButton("Delete album", "danger-button", () => deleteAlbum(album));
	headingActions.append(preview, remove);
	heading.append(headingCopy, headingActions);

	const fields = document.createElement("div");
	fields.className = "album-fields";
	const nameLabel = document.createElement("label");
	nameLabel.textContent = "Album name";
	const nameInput = document.createElement("input");
	nameInput.type = "text";
	nameInput.maxLength = 100;
	nameInput.value = album.label;
	nameInput.dataset.testid = "album-name";
	nameInput.addEventListener("input", () => {
		album.label = nameInput.value;
		title.textContent = nameInput.value || "Untitled album";
		markDirty();
		renderAlbumList();
	});
	nameLabel.append(nameInput);
	const parentLabel = document.createElement("label");
	parentLabel.textContent = "Show under";
	const parentSelect = document.createElement("select");
	parentSelect.dataset.testid = "album-parent";
	const topLevelOption = document.createElement("option");
	topLevelOption.value = "";
	topLevelOption.textContent = "Top level";
	parentSelect.append(topLevelOption);
	const forbiddenParents = descendantNodeIds(album.id);
	for (const group of sortByOrder(state.content.groups)) {
		if (forbiddenParents.has(group.id)) continue;
		const option = document.createElement("option");
		option.value = group.id;
		option.textContent = `Section — ${group.label}`;
		parentSelect.append(option);
	}
	for (const candidate of sortByOrder(state.content.albums)) {
		if (candidate.id === album.id || forbiddenParents.has(candidate.id)) continue;
		const option = document.createElement("option");
		option.value = candidate.id;
		option.textContent = `Album — ${candidate.label}`;
		parentSelect.append(option);
	}
	parentSelect.value = album.parentId || "";
	parentSelect.addEventListener("change", () => setAlbumParent(album, parentSelect.value));
	parentLabel.append(parentSelect);
	const meta = document.createElement("div");
	meta.className = "album-meta";
	meta.textContent = `${album.items.length} photo${album.items.length === 1 ? "" : "s"} • Choose another album to make this a sub-album • URL stays stable`;
	fields.append(nameLabel, parentLabel, meta);

	const uploadBar = document.createElement("div");
	uploadBar.className = "upload-bar";
	const uploadLabel = document.createElement("label");
	uploadLabel.className = "upload-control";
	uploadLabel.textContent = "Add photos";
	const uploadInput = document.createElement("input");
	uploadInput.type = "file";
	uploadInput.accept = "image/*";
	uploadInput.multiple = true;
	uploadInput.dataset.testid = "photo-upload";
	uploadLabel.append(uploadInput);
	const uploadProgress = document.createElement("span");
	uploadProgress.className = "upload-progress";
	uploadProgress.textContent = "JPG, PNG, HEIC or other browser-supported images";
	uploadInput.addEventListener("change", async () => {
		uploadInput.disabled = true;
		try {
			await uploadPhotos(album, [...uploadInput.files], uploadProgress);
		} catch (error) {
			showMessage(error.message, true);
			uploadProgress.textContent = error.message;
		} finally {
			uploadInput.disabled = false;
			uploadInput.value = "";
		}
	});
	uploadBar.append(uploadLabel, uploadProgress);

	const grid = document.createElement("div");
	grid.className = "photo-grid";
	const items = sortByOrder(album.items);
	album.items = items;
	if (items.length) {
		items.forEach((item, index) => grid.append(renderPhotoCard(album, item, index)));
	} else {
		const empty = document.createElement("div");
		empty.className = "empty-album";
		empty.textContent = "This album is empty. Use Add photos above.";
		grid.append(empty);
	}
	fragment.append(heading, fields, uploadBar, grid);
	elements.albumEditor.replaceChildren(fragment);
};

const restoreTrashItem = (entry) => {
	const album = albumById(entry.albumId) || state.content.albums[0];
	if (!album) {
		showMessage("Create an album before restoring this photo.", true);
		return;
	}
	entry.item.order = album.items.length;
	album.items.push(entry.item);
	state.content.trash = state.content.trash.filter((candidate) => candidate !== entry);
	state.selectedAlbumId = album.id;
	state.showTrash = false;
	state.showShopSettings = false;
	markDirty();
	render();
};

// The Trash view re-renders between batches, so look the button up each time.
const setEmptyTrashLabel = (label) => {
	const button = elements.albumEditor.querySelector('[data-testid="empty-trash"]');
	if (button) button.textContent = label;
};

const emptyTrash = async () => {
	if (state.emptyingTrash) return;
	if (state.dirty || state.saving || state.uploading) {
		showMessage("Save your other changes before emptying Trash.", true);
		return;
	}
	const count = state.content.trash.length;
	const answer = window.prompt(
		`Permanently delete the ${count} photo${count === 1 ? "" : "s"} in Trash?\n\n` +
			"Their original files will be deleted from Cloudinary and cannot be recovered. " +
			"Photos still shown on the site are never deleted.\n\nType DELETE to confirm.",
	);
	if (answer?.trim() !== "DELETE") {
		if (answer !== null) showMessage("Trash was not emptied. Type DELETE to confirm.", true);
		return;
	}
	state.emptyingTrash = true;
	render();
	const totals = { deleted: 0, alreadyGone: 0, failed: 0 };
	try {
		// The server works through Trash in batches; keep going until nothing is left
		// or a batch stops making progress.
		while (state.content.trash.length) {
			const before = state.content.trash.length;
			setEmptyTrashLabel(`Deleting… ${before} left`);
			const result = await request("/api/admin/empty-trash", {
				method: "POST",
				body: JSON.stringify({ revision: state.content.revision }),
			});
			state.content = result.content;
			totals.deleted += result.deleted;
			totals.alreadyGone += result.alreadyGone;
			totals.failed += result.failed;
			render();
			if (result.remaining >= before) break;
		}
		const removed = totals.deleted + totals.alreadyGone;
		if (state.content.trash.length) {
			showMessage(
				`Deleted ${removed} file${removed === 1 ? "" : "s"}; ${state.content.trash.length} could not be deleted and remain in Trash.`,
				true,
			);
		} else {
			showMessage(`Trash emptied. ${removed} original file${removed === 1 ? "" : "s"} deleted from Cloudinary.`);
		}
	} catch (error) {
		showMessage(error.message, true);
		render();
	} finally {
		state.emptyingTrash = false;
		render();
	}
};

const renderTrash = () => {
	const heading = document.createElement("div");
	heading.className = "editor-heading";
	const copy = document.createElement("div");
	const eyebrow = document.createElement("p");
	eyebrow.className = "eyebrow";
	eyebrow.textContent = "Recovery";
	const title = document.createElement("h2");
	title.textContent = "Trash";
	copy.append(eyebrow, title);
	heading.append(copy);
	if (state.content.trash.length) {
		const empty = createButton("Empty Trash", "danger-button", emptyTrash);
		empty.dataset.testid = "empty-trash";
		empty.disabled = state.emptyingTrash;
		heading.append(empty);
	}
	const list = document.createElement("div");
	list.className = "trash-list";
	if (!state.content.trash.length) {
		const empty = document.createElement("div");
		empty.className = "empty-album";
		empty.textContent = "Trash is empty.";
		list.append(empty);
	}
	for (const entry of state.content.trash) {
		const row = document.createElement("article");
		row.className = "trash-item";
		const image = document.createElement("img");
		image.src = cloudinaryThumb(entry.item.publicId, 160);
		image.alt = entry.item.title || "Deleted photo";
		const details = document.createElement("div");
		const name = document.createElement("p");
		name.textContent = entry.item.title || entry.item.id;
		const meta = document.createElement("small");
		meta.textContent = `Removed ${new Date(entry.deletedAt).toLocaleString()}`;
		details.append(name, meta);
		const restore = createButton("Restore", "secondary-button", () => restoreTrashItem(entry));
		row.append(image, details, restore);
		list.append(row);
	}
	elements.albumEditor.replaceChildren(heading, list);
};

const shopSettingInput = (label, testid, value, limits, onInput) => {
	const wrapper = document.createElement("label");
	wrapper.textContent = label;
	const input = document.createElement("input");
	input.type = "number";
	input.min = String(limits.min);
	input.max = String(limits.max);
	input.step = String(limits.step);
	input.value = String(value);
	input.dataset.testid = testid;
	input.addEventListener("input", () => {
		onInput(Number(input.value));
		markDirty();
	});
	wrapper.append(input);
	return wrapper;
};

const renderShopSettings = () => {
	const settings = state.content.shopSettings;
	const heading = document.createElement("div");
	heading.className = "editor-heading";
	const copy = document.createElement("div");
	const eyebrow = document.createElement("p");
	eyebrow.className = "eyebrow";
	eyebrow.textContent = "Shop";
	const title = document.createElement("h2");
	title.textContent = "Shop settings";
	copy.append(eyebrow, title);
	heading.append(copy);

	const fields = document.createElement("div");
	fields.className = "album-fields";
	fields.append(
		shopSettingInput("Markup (× Gelato cost)", "shop-markup", settings.markup, { min: 1.5, max: 5, step: 0.1 }, (value) => {
			settings.markup = value;
		}),
		shopSettingInput("Prints shipping ($)", "shop-shipping-prints", settings.shippingPrints, { min: 0, max: 100, step: 1 }, (value) => {
			settings.shippingPrints = value;
		}),
		shopSettingInput("Wall Art shipping ($)", "shop-shipping-wall-art", settings.shippingWallArt, { min: 0, max: 100, step: 1 }, (value) => {
			settings.shippingWallArt = value;
		}),
	);
	const note = document.createElement("p");
	note.className = "shop-settings-note";
	note.textContent = "Prices round up to a whole dollar. Changes apply to new checkouts after you save.";
	elements.albumEditor.replaceChildren(heading, fields, note);
};

// Where a photo sits in its album, by the same order the album editor shows (the "44 / 48" numbering).
const photoPlacement = (photoId) => {
	if (!photoId) return null;
	for (const album of state.content.albums) {
		const items = sortByOrder(album.items);
		const index = items.findIndex((item) => item.id === photoId);
		if (index !== -1) return { album, index, item: items[index] };
	}
	return null;
};

const moveTestimonial = (index, direction) => {
	const list = state.content.testimonials;
	const nextIndex = index + direction;
	if (nextIndex < 0 || nextIndex >= list.length) return;
	[list[index], list[nextIndex]] = [list[nextIndex], list[index]];
	markDirty();
	renderEditor();
};

const testimonialField = (labelText, control, testid, value, onInput) => {
	const label = document.createElement("label");
	label.className = "testimonial-field";
	label.textContent = labelText;
	control.value = value;
	control.dataset.testid = testid;
	control.addEventListener("input", () => {
		onInput(control.value);
		markDirty();
	});
	label.append(control);
	return label;
};

const renderTestimonialRow = (entry, index, count) => {
	const row = document.createElement("article");
	row.className = "testimonial-row";

	const thumb = document.createElement("div");
	thumb.className = "testimonial-thumb";
	const image = document.createElement("img");
	image.alt = "";
	image.loading = "lazy";
	const empty = document.createElement("span");
	empty.className = "testimonial-thumb-empty";
	empty.textContent = "No photo";
	thumb.append(image, empty);

	// The preview crops exactly as the Booking page does: same aspect ratio and vertical position.
	const refreshThumb = () => {
		const placement = photoPlacement(entry.photoId);
		image.hidden = !placement;
		empty.hidden = Boolean(placement);
		image.style.aspectRatio = entry.photoShape === "wide" ? "5 / 4" : "4 / 5";
		image.style.objectFit = "cover";
		image.style.objectPosition = `50% ${entry.photoFocus ?? 50}%`;
		if (placement) image.src = cloudinaryThumb(placement.item.publicId, 240);
	};

	const fields = document.createElement("div");
	fields.className = "testimonial-fields";

	const quote = document.createElement("textarea");
	quote.maxLength = 2000;
	quote.rows = 4;
	fields.append(testimonialField("Quote", quote, `testimonial-quote-${entry.id}`, entry.quote, (value) => {
		entry.quote = value;
	}));

	const name = document.createElement("input");
	name.type = "text";
	name.maxLength = 200;
	const nameField = testimonialField("Name (optional)", name, `testimonial-name-${entry.id}`, entry.name, (value) => {
		entry.name = value;
	});
	const context = document.createElement("input");
	context.type = "text";
	context.maxLength = 200;
	const contextField = testimonialField("Context (optional)", context, `testimonial-context-${entry.id}`, entry.context, (value) => {
		entry.context = value;
	});
	fields.append(nameField, contextField);

	const picker = document.createElement("div");
	picker.className = "testimonial-picker";
	const placement = photoPlacement(entry.photoId);

	const albumSelect = document.createElement("select");
	albumSelect.dataset.testid = `testimonial-album-${entry.id}`;
	albumSelect.append(new Option("No photo", ""));
	for (const album of sortByOrder(state.content.albums)) {
		albumSelect.append(new Option(album.label, album.id));
	}
	albumSelect.value = placement ? placement.album.id : "";
	const albumField = document.createElement("label");
	albumField.className = "testimonial-field";
	albumField.textContent = "Album";
	albumField.append(albumSelect);

	const numberInput = document.createElement("input");
	numberInput.type = "number";
	numberInput.min = "1";
	numberInput.step = "1";
	numberInput.dataset.testid = `testimonial-photo-${entry.id}`;
	const numberField = document.createElement("label");
	numberField.className = "testimonial-field";
	numberField.textContent = "Photo number";
	numberField.append(numberInput);

	const hint = document.createElement("p");
	hint.className = "testimonial-hint";

	const syncPicker = () => {
		const album = albumById(albumSelect.value);
		const count = album ? album.items.length : 0;
		numberInput.max = String(count);
		numberInput.disabled = !count;
		const current = photoPlacement(entry.photoId);
		numberInput.value = current ? String(current.index + 1) : "";
		hint.textContent = album && !count ? "This album has no photos yet." : "";
		refreshThumb();
	};
	albumSelect.addEventListener("change", () => {
		const album = albumById(albumSelect.value);
		entry.photoId = album ? (sortByOrder(album.items)[0]?.id ?? "") : "";
		markDirty();
		syncPicker();
	});
	const applyPhotoNumber = (revertIfInvalid) => {
		const album = albumById(albumSelect.value);
		const items = album ? sortByOrder(album.items) : [];
		const number = Number(numberInput.value);
		if (Number.isInteger(number) && number >= 1 && number <= items.length) {
			entry.photoId = items[number - 1].id;
			markDirty();
			refreshThumb();
		} else if (revertIfInvalid) {
			syncPicker();
		}
	};
	numberInput.addEventListener("input", () => applyPhotoNumber(false));
	numberInput.addEventListener("change", () => applyPhotoNumber(true));

	picker.append(albumField, numberField, hint);
	fields.append(picker);
	syncPicker();

	const look = document.createElement("div");
	look.className = "testimonial-picker";
	const shape = document.createElement("select");
	shape.append(new Option("Tall (4:5)", "tall"), new Option("Wide (5:4)", "wide"));
	const shapeField = testimonialField("Photo shape", shape, `testimonial-shape-${entry.id}`, entry.photoShape === "wide" ? "wide" : "tall", (value) => {
		entry.photoShape = value === "wide" ? "wide" : "tall";
		refreshThumb();
	});
	const focus = document.createElement("input");
	focus.type = "range";
	focus.min = "0";
	focus.max = "100";
	focus.step = "1";
	const focusField = testimonialField("Crop position", focus, `testimonial-focus-${entry.id}`, String(entry.photoFocus ?? 50), (value) => {
		entry.photoFocus = Math.round(Number(value));
		refreshThumb();
	});
	const focusScale = document.createElement("span");
	focusScale.className = "testimonial-scale";
	focusScale.append(document.createElement("span"), document.createElement("span"));
	focusScale.firstChild.textContent = "Top";
	focusScale.lastChild.textContent = "Bottom";
	focusField.append(focusScale);
	look.append(shapeField, focusField);
	fields.append(look);
	refreshThumb();

	const actions = document.createElement("div");
	actions.className = "testimonial-actions";
	const up = createButton("↑", "icon-button", () => moveTestimonial(index, -1));
	up.setAttribute("aria-label", "Move testimonial up");
	up.disabled = index === 0;
	const down = createButton("↓", "icon-button", () => moveTestimonial(index, 1));
	down.setAttribute("aria-label", "Move testimonial down");
	down.disabled = index === count - 1;
	const remove = createButton("Delete", "danger-button", () => {
		if (!window.confirm("Delete this testimonial?")) return;
		state.content.testimonials.splice(index, 1);
		markDirty();
		renderEditor();
	});
	actions.append(up, down, remove);

	row.append(thumb, fields, actions);
	return row;
};

const renderTestimonialsEditor = () => {
	const heading = document.createElement("div");
	heading.className = "editor-heading";
	const copy = document.createElement("div");
	const eyebrow = document.createElement("p");
	eyebrow.className = "eyebrow";
	eyebrow.textContent = "Booking";
	const title = document.createElement("h2");
	title.textContent = "Testimonials";
	copy.append(eyebrow, title);
	const add = createButton("Add testimonial", "secondary-button", () => {
		state.content.testimonials.unshift({
			id: "testimonial-" + crypto.randomUUID(),
			quote: "",
			name: "",
			context: "",
			photoId: "",
			photoShape: "tall",
			photoFocus: 50,
		});
		markDirty();
		renderEditor();
	});
	add.dataset.testid = "add-testimonial";
	heading.append(copy, add);

	const note = document.createElement("p");
	note.className = "shop-settings-note";
	note.textContent = "Shown on Booking in this order. A testimonial without a quote is removed when you save.";

	const list = document.createElement("div");
	list.className = "testimonial-list";
	const testimonials = state.content.testimonials;
	if (testimonials.length) {
		testimonials.forEach((entry, index) => list.append(renderTestimonialRow(entry, index, testimonials.length)));
	} else {
		const none = document.createElement("p");
		none.className = "empty-editor";
		none.textContent = "No testimonials. Booking hides “Kind words” until you add one.";
		list.append(none);
	}
	elements.albumEditor.replaceChildren(heading, note, list);
};

const renderEditor = () => {
	if (state.showOrders) return renderOrders();
	if (state.showTrash) return renderTrash();
	if (state.showShopSettings) return renderShopSettings();
	if (state.showTestimonials) return renderTestimonialsEditor();
	const album = albumById(state.selectedAlbumId) || state.content.albums[0];
	if (!album) {
		elements.albumEditor.innerHTML = '<div class="empty-editor">Create an album to begin.</div>';
		return;
	}
	state.selectedAlbumId = album.id;
	renderAlbumEditor(album);
};

const render = () => {
	if (!state.content) return;
	renderAlbumList();
	renderEditor();
};

const saveContent = async () => {
	if (!state.content || state.saving || (!state.dirty && !state.uploading)) return;
	state.saving = true;
	elements.saveButton.disabled = true;
	elements.saveStatus.textContent = "Saving…";
	try {
		state.content = await request("/api/admin/content", {
			method: "PUT",
			body: JSON.stringify(state.content),
		});
		state.dirty = false;
		render();
		elements.saveStatus.textContent = "Saved";
		showMessage("OK, saved.");
	} catch (error) {
		elements.saveButton.disabled = false;
		elements.saveStatus.textContent = "Save failed";
		showMessage(error.message, true);
		throw error;
	} finally {
		state.saving = false;
	}
};

const syncShop = async () => {
	if (state.shopSyncing) return;
	if (state.saving || state.uploading) {
		showMessage("Wait for the current save or upload to finish.", true);
		return;
	}
	state.shopSyncing = true;
	elements.shopSyncButton.disabled = true;
	elements.shopSyncButton.textContent = "Starting…";
	try {
		if (state.dirty) await saveContent();
		await request("/api/admin/shop-sync", { method: "POST" });
		elements.shopSyncButton.textContent = "Sync started";
		showMessage("Shop sync started. You can continue editing while it runs.");
	} catch (error) {
		elements.shopSyncButton.textContent = "Sync shop";
		showMessage(error.message, true);
	} finally {
		window.setTimeout(() => {
			state.shopSyncing = false;
			elements.shopSyncButton.disabled = false;
			elements.shopSyncButton.textContent = "Sync shop";
		}, 3_000);
	}
};

const orderStateLabels = {
	waiting: "Waiting",
	approved: "Approved",
	"approved-test": "Approved (test, not sent to Gelato)",
	cancelled: "Cancelled",
	"needs-attention": "Needs attention",
};

const money = (cents) => `$${(cents / 100).toFixed(2)}`;

const loadOrders = async () => {
	state.ordersLoading = true;
	render();
	try {
		const result = await request("/api/admin/shop-orders");
		state.orders = result.orders;
		state.ordersError = null;
	} catch (error) {
		state.ordersError = error.message;
	} finally {
		state.ordersLoading = false;
		render();
	}
};

const runOrderAction = async (order, action) => {
	if (state.ordersBusy) return;
	const question = action === "approve"
		? "Send this order to Gelato for printing? Gelato charges your account now."
		: `Cancel this order and refund ${money(order.amountTotal)} to the buyer?`;
	if (!window.confirm(question)) return;
	state.ordersBusy = true;
	render();
	try {
		const result = await request("/api/admin/shop-orders", {
			method: "POST",
			body: JSON.stringify({ action, sessionId: order.sessionId }),
		});
		showMessage(`Order updated: ${orderStateLabels[result.state] || result.state}.`);
	} catch (error) {
		showMessage(error.message, true);
	} finally {
		state.ordersBusy = false;
	}
	await loadOrders();
};

const EDIT_PREVIEW_DELAY_MS = 300;

const startOrderEdit = (order) => {
	state.orderEdit = {
		sessionId: order.sessionId,
		lines: order.lines.map((line) => ({
			crop: { ...line.crop },
			options: { ...line.options },
			editOptions: line.editOptions,
			previewUrl: line.previewUrl,
			previewToken: 0,
			previewTimer: null,
		})),
	};
	render();
};

const discardOrderEdit = () => {
	state.orderEdit = null;
	render();
};

const schedulePreview = (sessionId, lineIndex, line, image) => {
	window.clearTimeout(line.previewTimer);
	line.previewTimer = window.setTimeout(async () => {
		const token = line.previewToken + 1;
		line.previewToken = token;
		try {
			const result = await request("/api/admin/shop-orders", {
				method: "POST",
				body: JSON.stringify({ action: "preview", sessionId, lineIndex, crop: line.crop }),
			});
			if (line.previewToken !== token) return;
			line.previewUrl = result.previewUrl;
			image.src = result.previewUrl;
		} catch (error) {
			showMessage(error.message, true);
		}
	}, EDIT_PREVIEW_DELAY_MS);
};

const sliderControl = (labelText, value, onInput) => {
	const label = document.createElement("label");
	label.textContent = labelText;
	const input = document.createElement("input");
	input.type = "range";
	input.min = "-50";
	input.max = "50";
	input.step = "1";
	input.value = String(value);
	input.addEventListener("input", () => onInput(Number(input.value)));
	label.append(input);
	return label;
};

const orderEditor = (order) => {
	const editor = document.createElement("div");
	editor.className = "order-editor";
	state.orderEdit.lines.forEach((line, lineIndex) => {
		const row = document.createElement("div");
		row.className = "order-edit-line";
		const image = document.createElement("img");
		image.src = line.previewUrl;
		image.alt = "";
		const controls = document.createElement("div");
		controls.className = "order-edit-controls";
		const name = document.createElement("p");
		name.textContent = order.lines[lineIndex].productName;
		controls.append(
			name,
			sliderControl("Move left / right", line.crop.x, (value) => {
				line.crop.x = value;
				schedulePreview(order.sessionId, lineIndex, line, image);
			}),
			sliderControl("Move up / down", line.crop.y, (value) => {
				line.crop.y = value;
				schedulePreview(order.sessionId, lineIndex, line, image);
			}),
		);
		for (const group of line.editOptions) {
			const label = document.createElement("label");
			label.textContent = group.label;
			const select = document.createElement("select");
			for (const option of group.values) {
				const item = document.createElement("option");
				item.value = option.value;
				item.textContent = option.label;
				item.selected = option.value === line.options[group.key];
				select.append(item);
			}
			select.addEventListener("change", () => {
				line.options[group.key] = select.value;
			});
			label.append(select);
			controls.append(label);
		}
		row.append(image, controls);
		editor.append(row);
	});

	const actions = document.createElement("div");
	actions.className = "order-actions";
	const save = createButton("Save changes", "primary-button", () => saveOrderEdit(order));
	save.disabled = state.ordersBusy;
	const discard = createButton("Discard", "secondary-button", discardOrderEdit);
	discard.disabled = state.ordersBusy;
	actions.append(save, discard);
	editor.append(actions);
	return editor;
};

const saveOrderEdit = async (order) => {
	if (state.ordersBusy || !state.orderEdit) return;
	if (!window.confirm("Save these changes to the order? The print files sent to Gelato will change.")) return;
	state.ordersBusy = true;
	render();
	try {
		const lines = state.orderEdit.lines.map((line, index) => ({ index, crop: line.crop, options: line.options }));
		await request("/api/admin/shop-orders", {
			method: "POST",
			body: JSON.stringify({ action: "edit", sessionId: order.sessionId, lines }),
		});
		state.orderEdit = null;
		showMessage("Order updated: Waiting.");
	} catch (error) {
		showMessage(error.message, true);
	} finally {
		state.ordersBusy = false;
	}
	await loadOrders();
};

const orderCard = (order) => {
	const card = document.createElement("article");
	card.className = "order-card";
	const header = document.createElement("div");
	header.className = "order-header";
	const summary = document.createElement("div");
	const title = document.createElement("p");
	title.className = "order-title";
	const buyer = [order.buyerName || "Buyer", order.buyerCity].filter(Boolean).join(", ");
	title.textContent = `${new Date(order.created).toLocaleString()} · ${buyer}`;
	const amount = document.createElement("small");
	amount.textContent = `Paid ${money(order.amountTotal)}${order.tax ? ` (includes ${money(order.tax)} tax)` : ""}`;
	summary.append(title, amount);
	const badge = document.createElement("span");
	badge.className = `order-state order-state-${order.state}`;
	badge.textContent = orderStateLabels[order.state] || order.state;
	header.append(summary, badge);
	card.append(header);

	if (order.state === "waiting" && state.orderEdit?.sessionId === order.sessionId) {
		card.append(orderEditor(order));
		return card;
	}

	const lines = document.createElement("div");
	lines.className = "order-lines";
	for (const line of order.lines) {
		const row = document.createElement("div");
		row.className = "order-line";
		const image = document.createElement("img");
		image.src = line.previewUrl;
		image.alt = "";
		image.loading = "lazy";
		const details = document.createElement("div");
		const name = document.createElement("p");
		name.textContent = line.productName;
		const meta = document.createElement("small");
		const options = Object.entries(line.optionLabels || {}).map(([label, value]) => `${label}: ${value}`);
		meta.textContent = [line.size, ...options, `Quantity ${line.quantity}`].join(" · ");
		details.append(name, meta);
		row.append(image, details);
		lines.append(row);
	}
	card.append(lines);

	if (order.state === "waiting") {
		const actions = document.createElement("div");
		actions.className = "order-actions";
		const approve = createButton("Approve", "primary-button", () => runOrderAction(order, "approve"));
		approve.disabled = state.ordersBusy;
		const edit = createButton("Edit", "secondary-button", () => startOrderEdit(order));
		edit.disabled = state.ordersBusy;
		const cancel = createButton("Cancel order", "danger-button", () => runOrderAction(order, "cancel"));
		cancel.disabled = state.ordersBusy;
		actions.append(approve, edit, cancel);
		card.append(actions);
	}
	return card;
};

const renderOrders = () => {
	const heading = document.createElement("div");
	heading.className = "editor-heading";
	const copy = document.createElement("div");
	const eyebrow = document.createElement("p");
	eyebrow.className = "eyebrow";
	eyebrow.textContent = "Shop";
	const title = document.createElement("h2");
	title.textContent = "Orders";
	copy.append(eyebrow, title);
	const refresh = createButton(state.ordersLoading ? "Loading…" : "Refresh", "secondary-button", () => loadOrders());
	refresh.dataset.testid = "orders-refresh";
	refresh.disabled = state.ordersLoading || state.ordersBusy;
	heading.append(copy, refresh);

	const list = document.createElement("div");
	list.className = "orders-list";
	if (state.ordersError) {
		const error = document.createElement("div");
		error.className = "empty-album";
		error.textContent = state.ordersError;
		list.append(error);
	} else if (!state.orders) {
		const loading = document.createElement("div");
		loading.className = "empty-album";
		loading.textContent = "Loading orders…";
		list.append(loading);
	} else if (!state.orders.length) {
		const empty = document.createElement("div");
		empty.className = "empty-album";
		empty.textContent = "No paid orders yet.";
		list.append(empty);
	}
	const newestFirst = [...(state.orders || [])].sort((left, right) => right.created.localeCompare(left.created));
	for (const order of newestFirst) list.append(orderCard(order));
	elements.albumEditor.replaceChildren(heading, list);
};

const initializeDashboard = async (session) => {
	state.csrf = session.csrf;
	state.email = session.email;
	state.content = await request("/api/admin/content");
	state.selectedAlbumId = state.content.albums[0]?.id || null;
	state.dirty = false;
	elements.saveButton.disabled = true;
	elements.loginView.hidden = true;
	elements.dashboardView.hidden = false;
	render();
	loadOrders();
};

const showLoginNotice = (message, devLink) => {
	elements.loginNotice.replaceChildren(message);
	if (devLink) {
		const link = document.createElement("a");
		link.href = devLink;
		link.textContent = "Open the local sign-in link";
		elements.loginNotice.append(link);
	}
	elements.loginNotice.hidden = false;
};

const showLoginError = (message) => {
	elements.loginView.hidden = false;
	elements.loginNotice.hidden = true;
	elements.loginError.textContent = message;
	elements.loginError.hidden = false;
};

elements.loginForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	elements.loginError.hidden = true;
	elements.loginNotice.hidden = true;
	const submit = elements.loginForm.querySelector("button[type='submit']");
	submit.disabled = true;
	try {
		const result = await request("/api/admin/session", {
			method: "POST",
			body: JSON.stringify({ action: "request-link", email: elements.loginEmail.value }),
		});
		showLoginNotice(
			"If that is the admin email, a sign-in link is on its way. It expires in about 30 minutes.",
			result.devLink,
		);
	} catch (error) {
		showLoginError(error.message);
	} finally {
		submit.disabled = false;
	}
});

const LOGIN_HASH = "#login=";

// The token rides in the fragment so mail scanners that prefetch links never see it.
const redeemLoginLink = async () => {
	if (!window.location.hash.startsWith(LOGIN_HASH)) return false;
	const token = window.location.hash.slice(LOGIN_HASH.length);
	history.replaceState(null, "", window.location.pathname + window.location.search);
	try {
		const session = await request("/api/admin/session", {
			method: "POST",
			body: JSON.stringify({ action: "redeem", token }),
		});
		await initializeDashboard(session);
	} catch (error) {
		showLoginError(error.message);
	}
	return true;
};

window.addEventListener("hashchange", () => redeemLoginLink());

elements.saveButton.addEventListener("click", () => saveContent().catch(() => {}));
elements.shopSyncButton.addEventListener("click", () => syncShop());

elements.logoutButton.addEventListener("click", async () => {
	if (state.dirty && !window.confirm("Sign out and discard unsaved changes?")) return;
	await request("/api/admin/session", { method: "DELETE" });
	window.location.reload();
});

elements.addAlbumForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const label = elements.newAlbumName.value.trim();
	if (!label) return;
	let key = slugify(label) || `album-${Date.now()}`;
	let suffix = 2;
	while (state.content.albums.some((album) => album.key === key)) {
		key = `${slugify(label)}-${suffix}`;
		suffix += 1;
	}
	const topLevelAlbums = state.content.albums.filter((album) => !album.parentId);
	const album = {
		id: key,
		key,
		label,
		path: `./gallery.html?album=${encodeURIComponent(key)}`,
		order: Math.max(
			0,
			...topLevelAlbums.map((entry) => entry.order + 1),
			...state.content.groups.map((entry) => entry.order + 1),
		),
		parentId: null,
		preserveCase: false,
		printEnabled: false,
		items: [],
	};
	state.content.albums.push(album);
	state.selectedAlbumId = album.id;
	state.showTrash = false;
	state.showShopSettings = false;
	state.showTestimonials = false;
	state.showOrders = false;
	elements.newAlbumName.value = "";
	markDirty();
	render();
});

elements.trashButton.addEventListener("click", () => {
	state.showTrash = true;
	state.showShopSettings = false;
	state.showTestimonials = false;
	state.showOrders = false;
	render();
});

elements.shopSettingsButton.addEventListener("click", () => {
	state.showShopSettings = true;
	state.showTrash = false;
	state.showTestimonials = false;
	state.showOrders = false;
	render();
});

elements.testimonialsButton.addEventListener("click", () => {
	state.showTestimonials = true;
	state.showTrash = false;
	state.showShopSettings = false;
	state.showOrders = false;
	render();
});

elements.ordersButton.addEventListener("click", () => {
	state.showOrders = true;
	state.showTrash = false;
	state.showShopSettings = false;
	state.showTestimonials = false;
	loadOrders();
});

window.addEventListener("beforeunload", (event) => {
	if (!state.dirty) return;
	event.preventDefault();
	event.returnValue = "";
});

(async () => {
	try {
		if (await redeemLoginLink()) return;
		const session = await request("/api/admin/session");
		if (session.authenticated) {
			await initializeDashboard(session);
		} else {
			elements.loginView.hidden = false;
		}
	} catch (error) {
		elements.loginView.hidden = false;
		elements.loginError.textContent = error.message;
		elements.loginError.hidden = false;
	}
})();
