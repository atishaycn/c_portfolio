const elements = {
	loginView: document.getElementById("login-view"),
	loginForm: document.getElementById("login-form"),
	loginEmail: document.getElementById("login-email"),
	loginPassword: document.getElementById("login-password"),
	loginError: document.getElementById("login-error"),
	dashboardView: document.getElementById("dashboard-view"),
	logoutButton: document.getElementById("logout-button"),
	saveButton: document.getElementById("save-button"),
	saveStatus: document.getElementById("save-status"),
	systemMessage: document.getElementById("system-message"),
	albumList: document.getElementById("album-list"),
	albumCount: document.getElementById("album-count"),
	albumEditor: document.getElementById("album-editor"),
	addAlbumForm: document.getElementById("add-album-form"),
	newAlbumName: document.getElementById("new-album-name"),
	trashButton: document.getElementById("trash-button"),
	trashCount: document.getElementById("trash-count"),
};

const state = {
	content: null,
	csrf: null,
	email: null,
	selectedAlbumId: null,
	showTrash: false,
	dirty: false,
	saving: false,
	uploading: false,
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
	row.className = `album-row${state.selectedAlbumId === album.id && !state.showTrash ? " is-selected" : ""}`;
	row.style.setProperty("--depth", depth);
	const select = createButton(
		`${album.label} (${album.items.length})`,
		"album-select",
		() => {
			state.selectedAlbumId = album.id;
			state.showTrash = false;
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
	markDirty();
	render();
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

const renderEditor = () => {
	if (state.showTrash) return renderTrash();
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
};

elements.loginForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	elements.loginError.hidden = true;
	const submit = elements.loginForm.querySelector("button[type='submit']");
	submit.disabled = true;
	try {
		const session = await request("/api/admin/session", {
			method: "POST",
			body: JSON.stringify({
				email: elements.loginEmail.value,
				password: elements.loginPassword.value,
			}),
		});
		elements.loginPassword.value = "";
		await initializeDashboard(session);
	} catch (error) {
		elements.loginError.textContent = error.message;
		elements.loginError.hidden = false;
	} finally {
		submit.disabled = false;
	}
});

elements.saveButton.addEventListener("click", () => saveContent().catch(() => {}));

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
	elements.newAlbumName.value = "";
	markDirty();
	render();
});

elements.trashButton.addEventListener("click", () => {
	state.showTrash = true;
	render();
});

window.addEventListener("beforeunload", (event) => {
	if (!state.dirty) return;
	event.preventDefault();
	event.returnValue = "";
});

(async () => {
	try {
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
