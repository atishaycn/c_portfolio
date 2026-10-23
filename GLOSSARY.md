# Claire Thomas Art (clairethomas.art)

The photography portfolio and booking site for Claire Thomas, with its print Shop and the client intake. These are the words the project uses in its docs, admin and storefront.

## Language

### Portfolio

**Photo**:
A single photograph in an album, with its caption, size and print flag.
_Avoid_: Image, picture, item

**Album**:
A named set of photos shown on one page of the site.
_Avoid_: Gallery, series

**Section**:
A top-level album with photos, shown in the Portfolio menu. Events, Nature and Street keep their own addresses; any other top-level album opens on a gallery page. Each has a section page that opens with a cover photo.
_Avoid_: Category (for portfolio albums)

**Child album**:
An album nested under a section, such as Special occasions under Events. It shows as a tab under its parent's cover and is not in the Portfolio menu.
_Avoid_: Sub-gallery, nested album

**Group**:
A container that holds albums in the admin's Structure view. The admin labels it "Section —". In the Portfolio menu, a group with photo albums shows as a heading over them.
_Avoid_: Folder

**Cover photo**:
The full-width photo that opens a section page, above the section name.

**Slideshow**:
The rotating photos on the homepage. It is drawn from its own album and falls back to Events when that album is empty.

**Available for print**:
The setting on an album or photo that makes it sold in the Shop and shows the "Order print" link in the lightbox.
_Avoid_: Printable, print-enabled

**Testimonial**:
A client quote in "Kind words" on the Booking page, shown beside one photo from that shoot. Claire edits them in the admin's Testimonials panel. "In the middle" means its place in that list, not inside a gallery.
_Avoid_: Review, quote (for gallery text)

**Trash**:
Where deleted albums and photos wait until Claire restores them or empties the Trash for good.

**Content**:
The album, photo and settings data Claire edits in the admin. The site reads it live.
_Avoid_: CMS data

**Admin**:
Claire's sign-in editor for content, Shop settings and Shop orders.
_Avoid_: Dashboard, backend

**Cloudinary**:
The image host where every photo file and the Content are stored.

### Booking

**Booking page**:
The page where a visitor reads the packages and sends an inquiry.

**Package**:
A priced booking offer on the Booking page. Claire sets its price and notes.

**Inquiry**:
A booking form submission that is emailed to Claire. It holds the visitor's name, email or phone, project type and how they found Claire.
_Avoid_: Contact form, enquiry, lead

**Project type**:
The kind of shoot an inquiry is for: Corporate, Personal, Graduation, Special occasion or Other.

### Shop

**Shop**:
The print store on the Shop page. It sells Claire's photos as prints and wall art.
_Avoid_: Print shop, store

**Shopify shop**:
The old print shop on Shopify. It closes when the Shop goes live.
_Avoid_: Shop (for the old store)

**Product**:
A kind of print the Shop sells, such as Print, Canvas or Metal Frame.
_Avoid_: Item, SKU

**Category**:
The Shop group a product belongs to: Prints or Wall Art.

**Size**:
The printed size of a product in inches, such as 8×10.

**Option**:
A choice a customer makes on a product, such as paper, depth, frame colour or thickness. Size is not an option.

**Variant**:
One size plus one value for each option of a product. It is the unit that has a price and a print lab product.

**Catalog**:
The list of products, options, sizes and variant prices the Shop sells.

**Print lab**:
Gelato. It prints and ships every Shop order. Claire's only lab.
_Avoid_: Printer, fulfilment

**Cost**:
What the print lab charges Claire for a variant. It is never shown to customers.

**Markup**:
The multiplier Claire sets, from 1.5 to 5, that turns a cost into a retail price.

**Retail price**:
The price a customer pays for a variant: cost × markup, rounded up to the next whole dollar. Shipping is extra.
_Avoid_: List price

**Shipping rate**:
The flat charge per order. The Prints rate applies when every line is a Prints product. The Wall Art rate applies when any line is Wall Art.

**Mockup**:
The live picture of the customer's photo shown as the chosen product.

**Wall preview**:
The view of a print on a wall, scaled to its real size.
_Avoid_: Preview

**Photo picker**:
The screen where a customer chooses the photos to order.

**Customize**:
The screen for one chosen photo, where the customer sets size, options, quantity and crop before adding it to the cart.

**Crop**:
The part of a photo that a print shows. The customer moves it within the frame of the chosen size.

**Print file**:
The full-size, cropped copy of a photo that the print lab prints.

**Photo size check**:
The rule that a size is offered for a photo only when the photo has enough pixels for it. The current threshold is 125 pixels per printed inch.

**Cart**:
The customer's list of cart lines before payment. It stays on the customer's device until they pay.

**Cart line**:
One product, size, option set, photo and quantity in the cart.

**Checkout**:
The Stripe-hosted payment page where the customer pays.

**Test mode**:
The state in which Shop payments run only in Stripe's test environment. No real charge and no print order happen. It lasts until release.
_Avoid_: Sandbox

**Customer**:
A person who buys from the Shop.
_Avoid_: Buyer, client

**Order**:
A paid Shop purchase. It is listed in the admin's Orders tab with its state.

**Order state**:
Where an order stands in the admin: **Waiting** (the Gelato draft is not yet approved), **Approved** (a real print lab order), **Cancelled** (refunded, draft deleted) or **Needs attention** (paid, but no draft could be made; Claire was emailed).

**Gelato draft**:
The print lab order made when a customer pays. It is not printed or charged until Claire approves it.
_Avoid_: Gelato order (before approval)

**Approve**:
Claire's action that turns a Gelato draft into a real print lab order. It charges her print lab account.

**Cancel (order)**:
Claire's action that refunds the whole payment and deletes the Gelato draft.

### Client intake (on branch `feature/client-intake`, not yet on main)

**Client**:
A person Claire has booked, or is about to book, for a shoot. Clients never sign up.
_Avoid_: Customer

**Intake**:
One questionnaire for one client and one shoot. A client reaches it only through its private link.
_Avoid_: Questionnaire

**Intake link**:
The private URL Claire sends a client. The link is the client's only credential.

**Event type**:
A kind of shoot, such as Wedding or Family. It decides which poses an intake starts from.
_Avoid_: Event (for a section)

**Pose**:
An example photo a client swipes on in the deck.
_Avoid_: Photo (for portfolio work)

**Pose source**:
Whether a pose is Claire's own work or an outside reference. A reference shows to the client as "inspiration".

**Deck**:
The ordered poses one intake shows.

**Swipe**:
A client's answer on one pose: like, dislike, must or skip.

**Must-have**:
A pose swiped as must. Together the must-haves form the **shot list** Claire sees.

**Tag group**:
A scored way of describing poses: Style, Framing, Mood, Setting or People.

**Note tag**:
A free-text tag on a pose. It is shown in results but never scored.

**Leaning**:
A client's score for one tag value. It is shown only when at least three poses with that value were swiped.

**Intake copy**:
The questions and deck frozen into an intake when it is created. Later template edits do not change it.

**Intake status**:
Where an intake stands: draft, sent, started, submitted or needs update.

**Pose stats**:
The like, dislike and must rates for one pose across all intakes.

**Cleanup**:
Deleting an intake's answers and the client's personal details. Its swipes stay as anonymous data.

### Drive migration (on branch `drive/album-folders`)

**Exact match**:
A Google Drive original that is byte-for-byte the same as a live photo.

**Visual match**:
A Drive original that looks the same as a live photo but is not byte-identical. It is reused only with explicit approval.

### Working model

**CEO thread**:
The agent thread that plans, reviews, keeps the brain and the work board, and owns branches.

**Work board**:
The living list of open workstreams, with their branches, status, next step and gate.

**Workstream**:
One branch and worktree of work on the project.

**Gate**:
A step that needs the user's approval before it runs, such as a Drive write or a release.

**Release**:
Pushing `main`, which makes Vercel publish the site to clairethomas.art.
_Avoid_: Deploy (for a live publish)

**Preview deployment**:
A login-protected Vercel build of a non-main branch. It does not reach clairethomas.art.
