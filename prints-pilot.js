(() => {
	const root = document.getElementById("print-pilot");
	if (!root) return;
	const text = (message, container = root) => {
		const paragraph = document.createElement("p");
		paragraph.textContent = message;
		container.append(paragraph);
		return paragraph;
	};
	const request = async (url, options = {}) => {
		const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(25_000), ...options });
		const body = await response.json();
		if (!response.ok) throw new Error(body.error || "Print checkout is unavailable.");
		return body;
	};
	const params = new URLSearchParams(location.search);
	const showReturnStatus = async () => {
		if (params.get("checkout") === "cancelled") {
			text("Checkout cancelled. You can start again.");
			return;
		}
		if (params.get("checkout") !== "success") return;
		const status = text("Checking your test payment with Stripe…");
		try {
			for (let attempt = 0; attempt < 6; attempt++) {
				const result = await request(`/api/print-status?session_id=${encodeURIComponent(params.get("session_id") || "")}`);
				if (!result.paid) { status.textContent = "Stripe has not confirmed a completed test payment."; return; }
				if (result.validated) {
					status.textContent = "Test payment confirmed. The webhook checked the print order details. Nothing was sent to Gelato or will be printed.";
					return;
				}
				status.textContent = "Test payment confirmed. Waiting for the webhook to check the print order details. Nothing will be printed.";
				if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 2000));
			}
			status.textContent += " Check the Stripe webhook delivery log if this message remains.";
		} catch (error) { status.textContent = `Could not verify checkout. ${error.message}`; }
	};
	const start = async () => {
		root.replaceChildren();
		// Remove the bearer session ID from history/referrers after reading it.
		if (params.has("session_id")) history.replaceState(null, "", location.pathname);
		const returnStatus = showReturnStatus();
		const loading = text("Loading print availability…");
		try {
			const catalog = await request("/api/print-catalog");
			if (!catalog.enabled) { text("Online print sales are not open yet. Contact Claire for availability."); return; }
			const warning = text("Sandbox pilot only. No real payment, printing, or shipping.");
			warning.className = "print-test-notice";
			const card = document.createElement("div");
			card.className = "print-pilot-card";
			const image = document.createElement("img");
			image.src = catalog.photo.image;
			image.alt = catalog.photo.title;
			image.width = catalog.photo.width;
			image.height = catalog.photo.height;
			card.append(image);
			const details = document.createElement("div");
			details.className = "print-pilot-details";
			text(catalog.photo.title, details);
			text(catalog.label, details);
			text(`${new Intl.NumberFormat("en-US", { style: "currency", currency: catalog.currency }).format(catalog.amount / 100)} test price · US shipping included`, details);
			const button = document.createElement("button");
			button.type = "button";
			button.className = "print-pilot-button";
			button.textContent = catalog.checkoutReady ? "Try test checkout" : "Test checkout not configured";
			button.disabled = !catalog.checkoutReady;
			const feedback = text(catalog.checkoutReady ? "Use Stripe's test card 4242 4242 4242 4242. Use a future expiry and any three-digit CVC." : "Stripe test credentials and a webhook signing secret are needed before this pilot can take a fake payment.", details);
			const requestId = crypto.randomUUID();
			button.addEventListener("click", async () => {
				button.disabled = true;
				button.textContent = "Opening Stripe…";
				try {
					const result = await request("/api/print-checkout", {
						method: "POST", headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ photoId: catalog.photo.id, size: catalog.size, requestId }),
					});
					if (!/^https:\/\/checkout\.stripe\.com\//.test(result.url)) throw new Error("Unexpected checkout link.");
					location.assign(result.url);
				} catch (error) {
					feedback.textContent = error.message;
					button.disabled = false;
					button.textContent = "Retry test checkout";
					// Keep the same request ID so a network retry cannot create two sessions.
				}
			});
			details.append(button);
			card.append(details);
			root.append(card);
		} catch { text("Print availability could not be loaded. Please contact Claire or try again later."); }
		finally { loading.remove(); }
		await returnStatus;
	};
	start();
})();
