# Shop Admin

Claire runs the Shop store from `/admin.html`: shop settings and paid-order review. Decided by the user on 2026-10-14. Store and checkout contracts: `specs/shop-store.md`, `specs/shop-checkout.md`.

## Invariants

- Every shop admin endpoint needs the admin session (`ct_admin` cookie) and, for writes, an allowed Origin. Until release they also need the same test-mode guard as checkout.
- Gelato costs stay private: never sent to the browser, never in a served file.
- A settings change never breaks a paid order. Each checkout session records the settings it was priced with, and the webhook, the return page and the Orders tab reprice with those recorded settings.
- Money moves only on Claire's click, behind a confirm prompt that states the effect: Approve charges her Gelato account; Cancel refunds the buyer.

## Shop settings

- Claire edits three values: the markup (default 2.5), the Prints shipping rate (default $8) and the Wall Art shipping rate (default $20). They are saved with the CMS content and validated on the server (markup 1.5 to 5; each rate a whole dollar from $0 to $100).
- Retail price = Gelato US cost × markup, rounded up to a whole dollar, over the larger of the two orientation costs. The store shows prices the server computed; the browser never computes a price from costs.
- A change applies to carts priced after the save.

## Orders tab

- Source of truth for the list: the Stripe Checkout Sessions this app created and that are paid. Each row joins its Gelato order by the session ID (`orderReferenceId`).
- States: **Waiting** (Gelato draft), **Approved** (real Gelato order), **Cancelled** (refunded, draft deleted), **Needs attention** (paid but no draft, for example a mismatch or refusal; Claire was emailed).
- A row shows the date, the buyer's name and city, the amount paid with tax, and each line's product, size, options, quantity and the exact cropped print file that Gelato prints.
- **Approve** turns the draft into a real Gelato order (`PATCH /v4/orders/{id}` with `orderType: "order"`).
- **Cancel** refunds the whole payment through Stripe and deletes the Gelato draft. A repeated click refunds nothing more.
- **Edit** (Waiting orders only) changes a line's crop and its options at the same price, for example frame colour or paper. Saving leaves exactly one Gelato draft for the session, with the new print files, and records the edited lines on the session, so the confirmation page and later views agree. A change of product, size or quantity, or any change that alters the price, is not offered: Claire cancels and the buyer reorders.
- Approved and Cancelled orders are read-only.
