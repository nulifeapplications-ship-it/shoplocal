# NuLife Local Market

A bilingual ordering web app for vacation guests in Sosúa and Cabarete. Mobile browser users can install it from their browser menu where supported.

## Run locally

Install Node.js 24 or newer. Run these commands from the project directory. The app uses SQLite and has no npm dependencies.

```bash
npm test
read -rs NULIFE_ADMIN_PASSWORD
printf '%s\n' "$NULIFE_ADMIN_PASSWORD" | PREVIEW=1 ADMIN_EMAIL=admin@example.test npm run admin
unset NULIFE_ADMIN_PASSWORD
npm start
```

Type a password of at least 12 characters after the second line. Open http://localhost:3000/login and sign in as `admin@example.test` with that password. The same bootstrap command without `PREVIEW=1` creates the two source-based drafts without fictional sample storefronts. Use a fresh `DB_PATH` to create a separate database, since the command preserves existing records. To create a second NuLife administrator, run the command with their own email and password against the same database.

## Invite a vendor

1. Sign in and open **Storefronts**. Type the store name and select **Create invitation**. For Luiyi Organic Farm or Ilia, select **Review** beside the existing draft, then **Invite to this storefront**.
2. Copy the invitation and send it to that vendor on WhatsApp. The link expires after seven days and works once. Creating a new link for an existing draft revokes any earlier unused one.
3. The vendor opens the link on their phone, optionally switches to **ES**, and sets their own email and password. They fill in their delivery details and maintain their logo and products from the vendor dashboard.
4. NuLife checks the storefront and catalog, then selects **Approve and publish**. Copy the marketplace or storefront URL from the dashboard to send it or encode it as a QR code. Subsequent routine vendor edits are public immediately. NuLife can pause a store or product independently of the vendor's own availability controls.

## Source catalogs

The draft stores contain 35 Luiyi Organic Farm listings and 36 Ilia (Daja Land) listings, both with the embedded source logos. The phone numbers and Luiyi product photos associated with named products came from the respective documents. Where the price lists do not specify a sales unit, the draft uses a per-item listing with an empty package-size field. Confirm the quantities, delivery details, and current availability with each vendor before approval. Microgreens are listed as a three-pack at RD$500 and Ilia's cocoa as a fixed ¾-lb package at RD$700. Prices quoted per pound remain estimated until the vendor records the actual weight.

## Hosting for live orders

Use a clean database with preview mode disabled. Serve the Node app behind HTTPS, set `SECURE_COOKIE=1`, and place `DB_PATH` on a persistent private volume. Back up that database and restrict access to it. The database contains guest names, WhatsApp numbers, property information, private order records, and uploaded images. Test a private status URL on the production domain before sharing it. No payment gateway credentials are required. Guests settle directly with vendors.

Alternatively, `npm run build` creates a Worker build in `dist/` for Sites or Cloudflare. Bind a dedicated D1 database as `DB` and apply both SQL migrations. Set a random, temporary `FIRST_ADMIN_KEY` as a runtime secret. POST JSON with `key`, `email`, and `password` to `/api/setup` from a trusted client to create the first administrator and seed source drafts, then remove the runtime secret. Keep `PREVIEW`, `PREVIEW_ADMIN_EMAIL`, and `PREVIEW_ADMIN_PASSWORD` unset in production. Configure public access so guests and vendors can open links from WhatsApp. Preview credentials and data are for testing only.

## Verified

`npm test` runs a real local HTTP server against a temporary SQLite database and exercises first-admin setup, vendor invitations and sign-in, draft image authorization, image uploads, CSV validation and updates, store approval, guest checkout and order tracking, explicit delivery status changes, actual weight, sold-out rejection, price snapshots, cross-vendor isolation, and NuLife pauses.
