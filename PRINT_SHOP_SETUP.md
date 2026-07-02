# Print Shop Setup

## Recommended Setup

Use Shopify + Gelato for the cleanest website-owned shop:

1. Create a Shopify store.
2. Install Gelato, Printful, or Printify.
3. Create wall-art products for selected photographs.
4. Let the print provider handle production, shipping, tracking, and fulfillment.
5. Set `printShopConfig.shopUrl` in `site.js` to the live Shopify collection URL.

Use Etsy + Gelato/Printful/Printify if discovery on Etsy matters more than owning checkout.

## Site Integration

The portfolio is already wired for external checkout:

1. Buyers open any gallery photo.
2. The lightbox shows `Order print`.
3. The link includes a stable print ID, such as `the-natural-world-1`.
4. Until `shopUrl` is set, the link opens an email inquiry with the print ID.

## Product Naming

Use the same IDs in shop listings:

```text
the-natural-world-1
california-12
san-francisco-83
india-4
shapes-and-shadows-7
protests-2
```

## Launch Checklist

1. Pick one provider and order test prints.
2. Create products for the first 10-20 strongest photos.
3. Add sizes, paper type, border/framing options, and shipping regions.
4. Publish the shop collection.
5. Paste the collection URL into `printShopConfig.shopUrl`.
6. Verify one order link from each gallery.
