# Shop Store

The Shop page (`prints.html`, header "Shop") is a print store modelled on Claire's Pixieset store (clairethomasart.pixieset.com/…/store/, captured 2026-10-06). It sells Claire's portfolio photographs as prints and wall art. The user's priority is the option picker and **live product mockups**: every product shows the customer's chosen photograph rendered as that product (frame, mat, canvas edge, metal sheen…), and the mockup updates as options change.

## Scope (v1)

- Gelato is the only print lab (user decision, 2026-10-13). The store sells only what Gelato makes; the Pixieset layout stays, the Pixieset product list does not. Pixieset's Digital, Cards and Albums are out of scope.
- Categories: **Prints** (Print, Fine Art Print) and **Wall Art** (Canvas, Framed Canvas, Metal Print, Acrylic Print, Wood Print, Foam Print, Wood Frame, Metal Frame). See the Gelato mapping below.
- Photos: albums and items with `printEnabled: true` in CMS content (same flag the lightbox "Order print" uses). Order follows the CMS.
- Cart in `localStorage`. Checkout shows "Checkout coming soon" with an email link until Stripe checkout is built (it reuses the checks from `shop/stripe-print-pilot`). Production keeps "Coming soon" until the user approves the store.
- Products, sizes, option lists and Gelato costs come from one generated catalog file that the browser and the server both read. Retail price = Gelato US cost × one markup number. The markup is a sample until Claire sets prices; mark it as a sample in code.
- When the store goes live, the Shopify shop closes and the lightbox "Order print" link points at the store.

## Gelato mapping

Checked against the Gelato product API on 2026-10-13 (every product in each catalog, and US prices for 12 x 16 samples).

| Store product | Category | Gelato catalog | Fixed attributes | Customer options |
|---|---|---|---|---|
| Print | Prints | `posters` | none | Paper: Semi-gloss (`200-gsm-80lb-coated-silk`), Matte (`200-gsm-80lb-uncoated`), Archival matte (`250-gsm-100lb-uncoated-offwhite-archival`) |
| Fine Art Print | Prints | `fine-art` | paper `200-gsm-80lb-enhanced-uncoated` | none |
| Canvas | Wall Art | `canvas` | none | Depth: Slim (`wood-fsc-slim`), Thick (`wood-fsc-thick`) |
| Framed Canvas | Wall Art | `framed-canvas` | `FrameProperties` `w14xt42-mm` | Frame: Black, Natural wood, Dark wood |
| Metal Print | Wall Art | `metallic` | none | Finish: White matte (`3-mm`), Brushed silver (`3-mm-silver-brushed`) |
| Acrylic Print | Wall Art | `acrylic` | none | none |
| Wood Print | Wall Art | `wood-prints` | none | Thickness: 10 mm, 20 mm |
| Foam Print (was Standout) | Wall Art | `foam-print-product` | none | Edge: Black, White |
| Wood Frame (was Gallery Frame + Wood Frame) | Wall Art | `mounted-fine-art` | `FrameMaterial` `wood`, `FrameProperties` `w12xt22-mm` | Frame: Black, White, Natural wood, Dark wood |
| Metal Frame | Wall Art | `mounted-fine-art` | `FrameMaterial` `aluminum` (black only) | none |

- Dropped: Bamboo Panel (Gelato has none). Large Format Print is no longer a product; large sizes belong to Print and Fine Art Print. Mats are dropped: Gelato has no mat. Canvas edge colour is dropped.
- Gelato's "mounted" frame catalogs mean the print arrives assembled in the frame. Frames always use them.
- Gold, silver and copper aluminium frames exist in Gelato but are deactivated; only `ProductStatus` `activated` products are sold.
- Sizes are inch sizes from this list, where Gelato has the product: 8x10, 8x12, 11x14, 12x12, 12x16, 12x18, 16x16, 16x20, 16x24, 18x24, 20x20, 20x30, 24x36, 28x40, 30x40. Use the inch-first product (`12x16-inch-300x400-mm`); Framed Canvas has only the mm-first form (`300x400-mm-12x16-inch`). Both forms cost the same.
- A size is offered for a photo only when the original file has enough pixels for it.

## Catalog file

- `scripts/shop-catalog.mjs` reads the Gelato product API (GET and search only) and writes `content/shop-catalog.json`, which the site serves and the checkout server reads. It is the only source of products, options, sizes, product UIDs and retail prices.
- Each variant is one size plus one value per option, with the Gelato product UID for both orientations and one retail price.
- Retail price = Gelato US cost × `markup`, rounded up to a whole dollar. `markup` is 2.5 (user decision, 2026-10-14: launch with it; Claire may change it later). Gelato costs stay out of the served file; the script writes them to `scripts/shop-catalog-costs.json`.
- Shipping is not in the price.
- The browser loads the file before the store renders (`cms-loader.js` fetches it on the Shop page and hands it to `shop.js`). `shop.js` holds only presentation: descriptions, option descriptions, swatch colours and mockup styles, keyed by product slug and option value. If the file cannot be loaded, the Shop page says the store is unavailable and shows the email link.
- A price shown anywhere in the store is the variant's `price` from the file, and a chosen option is shown by its `label` from the file, never its raw `value`. A cart line whose product, size or option values match no variant is dropped.

## Product facts

Use only these in product descriptions and "Product info"; no production or delivery times until Gelato's are confirmed.

- Print: 200 gsm poster paper (semi-gloss or matte) or 250 gsm off-white archival matte paper.
- Fine Art Print: 200 gsm enhanced matte fine art paper, 12-colour printing.
- Canvas: stretched on FSC wood bars, 2 cm (slim) or 4 cm (thick) deep.
- Framed Canvas: slim canvas in a wood floater frame.
- Metal Print: 3 mm aluminium, white matte or brushed silver surface.
- Acrylic Print: 4 mm clear acrylic.
- Wood Print: birch-faced plywood, 10 mm or 20 mm thick; the grain shows through light areas.
- Foam Print: 5 mm foam board with a black or white edge.
- Wood Frame, Metal Frame: fine art print behind plexiglass, delivered assembled in the frame. Wood moulding 12 mm wide; aluminium moulding 10 mm wide.

## Screens

1. **Store home**: hero carousel (product type name, one-line description, a mockup of a featured photo; arrows; auto-advance off under reduced motion) → "Categories:" anchor row → one section per category with an underlined heading and a 4-column card grid (2 on phone). Card = square light-grey tile with the product mockup, product name, "From $X".
2. **Product page** (`prints.html?product=<slug>`): breadcrumb `Home / Category / Product`. Left: large mockup with prev/next arrows and a thumbnail strip (same product, different photos). Right: uppercase name, price ("From $X" until every required option is chosen, then the exact price), description, option groups, primary CTA, collapsible "Product info" (materials, production time), then "You might also like" (4 cards from the same category).
   - Option groups: label in small spaced caps with the selected value beside it. Sizes and text options are a grid of bordered buttons (4 per row desktop, 2 on phone); selected = dark border. Colour/material options (frame finish, canvas edge) are square swatches.
   - Hovering a swatch or a paper/finish option shows a detail card (close-up mockup + name + one-line description).
   - Size defaults to the product's smallest size. Every other option has no default and is required; pressing the CTA without one marks it "* Select an option".
3. **Photo picker** (full-screen overlay after the CTA): close ×, "Select photos" title, "N photos selected", Next (disabled at 0). Grid of print-enabled photos; selected tiles get a check badge and a grey backing.
4. **Customize** (per selected photo): top bar with back arrow, `<size>" <Product>` and `<options> - $<price>`, "Preview", "Edit product", "Add to cart". Centre: the live mockup at the true aspect ratio for the size, Under it: "Edit crop" (drag to reposition the photo in the window), "Change" (photo), size select and quantity stepper. "Edit product" opens a side panel with the same option groups; every change redraws the mockup and price live. "Preview" shows the piece on a wall, scaled by its real size.
5. **Cart**: line items with a small mockup, option summary, quantity, remove, line and subtotal; empty state "Your cart is empty" with "Browse products". Header shows a cart icon with a count on every store screen.

## Mockup contract

- Mockups are drawn with HTML/CSS around the real photograph (Cloudinary URL), not pre-rendered images, so any photo and option combination renders. One renderer serves cards, the product page, detail cards, customize, wall preview and cart.
- Each product type has a distinct, recognisable look: print (white paper border, soft shadow), canvas (visible wrapped side edge showing the photo; thick is visibly deeper than slim), metal (white matte is flat, brushed silver shows a brushed sheen), acrylic (gloss sheen, thick clear edge), foam (thick black or white edge), frames (moulding colour per frame option, no mat), framed canvas (floater gap, frame colour per option), wood print (grain texture showing through; 20 mm is visibly thicker than 10 mm).
- The front view of a framed product shows no side face; depth comes from the shadow. Before a frame colour is chosen, the frame is black.
- Aspect ratio follows the chosen size and the photo's orientation (an 11 x 14 of a landscape photo renders 14 x 11).

## Style

- Use the site's existing header, footer, fonts and colours (`specs/site-design.md`), not Pixieset's branding. Layout and spacing follow Pixieset: white page, light-grey `#f4f4f4` tiles, dark `#333` primary buttons with spaced caps, thin borders.
- Desktop and 390px phone must both work; no sideways scroll; centring by flex/grid, not fixed widths.
