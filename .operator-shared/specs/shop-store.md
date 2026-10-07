# Shop Store

The Shop page (`prints.html`, header "Shop") is a print store modelled on Claire's Pixieset store (clairethomasart.pixieset.com/…/store/, captured 2026-10-06). It sells Claire's portfolio photographs as prints and wall art. The user's priority is the option picker and **live product mockups**: every product shows the customer's chosen photograph rendered as that product (frame, mat, canvas edge, metal sheen…), and the mockup updates as options change.

## Scope (v1)

- Categories: **Prints** (Print, Fine Art Print, Large Format Print) and **Wall Art** (Canvas, Metal Print, Standout Print, Gallery Frame, Metal Frame, Framed Canvas, Wood Frame, Bamboo Panel, Wood Print, Acrylic Print). Pixieset's Digital, Cards and Albums are out of scope.
- Photos: albums and items with `printEnabled: true` in CMS content (same flag the lightbox "Order print" uses). Order follows the CMS.
- Cart in `localStorage`. **No payment in v1**: checkout shows "Checkout coming soon" with an email link. Payment arrives later through the Stripe pilot (`shop/stripe-print-pilot`). Production keeps "Coming soon" until the user approves the store.
- Prices, sizes and option lists live in one catalog config. Values are samples copied from Pixieset "From" prices until Claire sets real ones; mark them as samples in code.

## Screens

1. **Store home**: hero carousel (product type name, one-line description, a mockup of a featured photo; arrows; auto-advance off under reduced motion) → "Categories:" anchor row → one section per category with an underlined heading and a 4-column card grid (2 on phone). Card = square light-grey tile with the product mockup, product name, "From $X".
2. **Product page** (`prints.html?product=<slug>`): breadcrumb `Home / Category / Product`. Left: large mockup with prev/next arrows and a thumbnail strip (same product, different photos). Right: uppercase name, price ("From $X" until every required option is chosen, then the exact price), description, option groups, primary CTA, collapsible "Product info" (materials, production time), then "You might also like" (4 cards from the same category).
   - Option groups: label in small spaced caps with the selected value beside it. Sizes and text options are a grid of bordered buttons (4 per row desktop, 2 on phone); selected = dark border. Colour/material options (frame finish, canvas edge) are square swatches.
   - Hovering a swatch or a paper/finish option shows a detail card (close-up mockup + name + one-line description).
   - Options with no default (frame, paper on framed products) are required; pressing the CTA without them marks them "* Select an option".
3. **Photo picker** (full-screen overlay after the CTA): close ×, "Select photos" title, "N photos selected", Next (disabled at 0). Grid of print-enabled photos; selected tiles get a check badge and a grey backing.
4. **Customize** (per selected photo): top bar with back arrow, `<size>" <Product>` and `<options> - $<price>`, "Preview", "Edit product", "Add to cart". Centre: the live mockup at the true aspect ratio for the size, including mat (photo shrinks to the inner window; show "Your photo is W x H" with the mat option"). Under it: "Edit crop" (drag to reposition the photo in the window), "Change" (photo), size select and quantity stepper. "Edit product" opens a side panel with the same option groups; every change redraws the mockup and price live. "Preview" shows the piece on a wall, scaled by its real size.
5. **Cart**: line items with a small mockup, option summary, quantity, remove, line and subtotal; empty state "Your cart is empty" with "Browse products". Header shows a cart icon with a count on every store screen.

## Mockup contract

- Mockups are drawn with HTML/CSS around the real photograph (Cloudinary URL), not pre-rendered images, so any photo and option combination renders. One renderer serves cards, the product page, detail cards, customize, wall preview and cart.
- Each product type has a distinct, recognisable look: print (white paper border, soft shadow), canvas (visible wrapped side edge: photo, black or white), metal/acrylic (gloss sheen; acrylic thick clear edge), standout (thick black edge), frames (moulding colour/texture per finish, optional white or black mat with bevel), framed canvas (floater gap), wood/bamboo (grain texture showing through or on the edge).
- Aspect ratio follows the chosen size and the photo's orientation (an 11 x 14 of a landscape photo renders 14 x 11).

## Style

- Use the site's existing header, footer, fonts and colours (`specs/site-design.md`), not Pixieset's branding. Layout and spacing follow Pixieset: white page, light-grey `#f4f4f4` tiles, dark `#333` primary buttons with spaced caps, thin borders.
- Desktop and 390px phone must both work; no sideways scroll; centring by flex/grid, not fixed widths.
