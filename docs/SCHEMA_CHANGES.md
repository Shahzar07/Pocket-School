# Schema changes — payments

Collections written by the unified checkout. Clients cannot read or write the money collections. The Admin SDK bypasses the rules.

| Collection | Purpose |
| --- | --- |
| `platform_settings/payments` | Gateway vendor, SST rate, supplier TIN and BRN, teacher and affiliate share in basis points. |
| `platform_settings/feature_flags` | `{ overrides: { [flagId]: boolean } }`. Merged in application code. |
| `platform_settings/ai_spend` | Monthly caps and estimated spend for OpenRouter and Gemini. |
| `platform_secrets/{slotId}` | `{ value, masked }`. Admin API returns `masked` only. |
| `checkouts/{checkoutId}` | Server quote, method, provider mode, status. Id is `chk_` plus a hash of the idempotency key. |
| `payment_events/{provider:eventId}` | Webhook claim. A processed event is not applied twice. |
| `payment_links/{paymentIntentId}` | Maps a Stripe payment intent back to a checkout. |
| `transactions/{checkoutId}` | Receipt row: subtotal, discount, tax, total, invoice id, status. |
| `wallets/{uid}` | `{ balances: { USD, MYR } }` in minor units. |
| `wallets/{uid}/ledger/{entryId}` | One entry per checkout. The id is the checkout id, so a retry cannot debit twice. |
| `invoices/{checkoutId}` | SST invoice and a MyInvois document. Status is `ready` or `missing_supplier`. Nothing is submitted. |
| `subscriptions/{uid}` | Active plan, MRR on the buyer, family status on a sibling seat, Reads sku. |
| `coupons/{code}` | Percent off, affiliate id, revenue share, redemption count. |
| `affiliate_ledger/{id}` | Commission earned or reversed. |
| `payouts/{id}` | Teacher share of a course, ebook, or tutoring checkout. |
| `refund_requests/{checkoutId}` | Live gateway refund requested. Entitlements stay until the gateway confirms. |
| `disputes/{disputeId}` | Stripe dispute. |
| `library/{uid}/books/{bookId}` | Reads purchase. `{ bookId, source: 'purchase' }`. The buyer also receives `alloc:marketplace:{bookId}`. |
| `books/{bookId}` | Optional shelf price override: `title`, `status`, `priceUsd`, `priceRM`. |
| `tutor_offers/{id}` | Teacher-listed session. Checkout kind `booking`. |
| `bookings/{checkoutId}` | Paid tutoring session. |
| `resource_purchases` | Paid resource. The file URL on the resource stays as it is today. |

User fields written by the server: `permissions` (`alloc:marketplace:{id}`, `plan:reads`, `plan:reads-family`) and `stripeAccountId` (Connect). Both are privileged and rejected on client writes.

Reads plans are `reads` at $9 a month and `reads-family` at $15. Annual is ten times the monthly price and is billed in USD on a card. A ringgit book uses the shelf RM price so FPX, GrabPay, and Touch ’n Go can clear. Touch ’n Go is gateway method `tng`, not a Stripe metadata flag.
