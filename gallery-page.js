const requestedAlbum = new URLSearchParams(window.location.search).get("album");
if (requestedAlbum && /^[a-z0-9-]+$/.test(requestedAlbum)) {
	document.body.dataset.page = requestedAlbum;
}
