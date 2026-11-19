# NuLife Local Market

A bilingual ordering web app for vacation guests in Sosúa and Cabarete. Mobile browser users can install it from their browser menu where supported.

## Run locally

Install Node.js 24 or newer. Run these commands from the project directory. The local app uses SQLite. Install the Node dependencies before running it.

```bash
npm ci
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

## Manage orders on behalf of a vendor

Open **Storefronts**, choose **Review**, and enable **NuLife-managed ordering**. Enter the NuLife WhatsApp number with its country code, the agreed delivery areas and hours, and the delivery fee. Enter zero for free delivery. Save the settings. Checkout opens on the approved storefront even if the vendor has no account.

Open **All orders** to confirm or decline new NuLife-managed orders, enter final weights for products sold by the pound, and update delivery status. The order's private status page shows the NuLife WhatsApp number for payment coordination.

When the vendor can take over, turn off the setting. NuLife can finish orders already assigned to it. New orders go to the vendor once they have an active account and delivery settings.

## Order alerts

In the admin or vendor dashboard, choose **Enable order alerts** and allow notifications for the site. Use **Send test alert** to verify delivery to that device. On iPhone or iPad, add the marketplace to the Home Screen and open it there before enabling alerts.

Vendor-managed orders alert the vendor's enabled devices. NuLife-managed orders alert the enabled devices on NuLife administrator accounts. The dashboard also shows the number of orders awaiting confirmation for that account.

On a new deployment, configure a stable P-256 VAPID key pair using `PUSH_PUBLIC_KEY` and `PUSH_PRIVATE_KEY` as runtime values. The public key is the base64url-encoded uncompressed EC point. The private key is the base64url JWK `d` value and belongs in a hosting secret. Set `PUSH_SUBJECT` to the public HTTPS site origin or a monitored mailto address. Existing browser subscriptions are tied to the public key.

## Source catalogs

The draft stores contain 35 Luiyi Organic Farm listings and 36 Ilia (Daja Land) listings, both with the embedded source logos. The phone numbers and Luiyi product photos associated with named products came from the respective documents. Where the price lists do not specify a sales unit, the draft uses a per-item listing with an empty package-size field. Confirm the quantities, delivery details, and current availability with each vendor before approval. Microgreens are listed as a three-pack at RD$500 and Ilia's cocoa as a fixed ¾-lb package at RD$700. Prices quoted per pound remain estimated until the vendor records the actual weight.

## Production launch

The live marketplace runs on ChatGPT Sites. The Git repository contains the application code and draft catalogs. The hosted D1 database and credentials are managed in Sites. Guest orders and uploaded files stay in D1.

Approved storefronts can be browsed as soon as they are published. Checkout opens when the vendor accepts their invitation and saves their phone number, delivery areas, hours, and a delivery fee, or when NuLife enables managed ordering with those details. Enter zero for free delivery. Vendors confirm orders in their dashboard and arrange payment directly with guests.

For another deployment, provision a persistent database and use HTTPS. The Node app uses SQLite, `DB_PATH` on a private persistent volume, and `SECURE_COOKIE=1` behind the HTTPS endpoint. For Sites or Cloudflare Workers, `npm run build` produces the Worker bundle. Bind D1 as `DB` and apply the migrations in order.

For first administrator setup, set a random 32-byte hex `FIRST_ADMIN_KEY` as a runtime secret. Set `FIRST_ADMIN_KEY_EXPIRES` to a future Unix timestamp in milliseconds. Open `/setup#<key>` on the deployed site, choose an admin email and password, and sign in. The link stops creating accounts once the first production administrator exists. Remove the setup secret after use.

Leave `PREVIEW`, `PREVIEW_ADMIN_EMAIL`, and `PREVIEW_ADMIN_PASSWORD` unset for live use. On the original Site, preview accounts, stores, and orders are retained in the database and excluded from production sign-in, storefronts, checkout, and order views. Use a separate database for future testing.

## Verified

`npm test` runs a real local HTTP server against a temporary SQLite database and exercises first-admin setup, vendor invitations and sign-in, draft image authorization, image uploads, CSV validation and updates, store approval, guest checkout and order tracking, explicit delivery status changes, actual weight, sold-out rejection, price snapshots, cross-vendor isolation, and NuLife pauses.
