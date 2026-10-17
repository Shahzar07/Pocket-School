# Poket School institutions

This is the owner-approved flow. It extends the Institutions console, `docs/INSTITUTION_PRICING.md`, and the existing Stripe and Malaysia gateway payments. Firestore rules in this change are **not deployed**. The diff is `docs/firestore-institution.rules.diff`. Run `npm run test:rules` before a rules release.

## Registration

Signup asks Independent or From an institution.

From an institution: Country, State, then a dropdown of academies a super admin has saved with `listedForSelfJoin`. Submitting creates `institutions/{id}/join_requests/{uid}` as pending. The institution admin approves or rejects it and assigns a level, classes, and courses. Students under the institution are not charged by Poket School.

If the academy is not listed, signup stays Independent and the person pays online (Stripe, or Billplz when the country is MY).

Parents are free and link children by email. An invite code or CSV is the faster path. A code with an email invite attaches the account. Any other code becomes a pending request.

## Dashboard

`/dashboard/institution` is the white-label academy home (logo and subdomain already live on the institution record). New pages:

- `/dashboard/institution/approvals`
- `/dashboard/institution/publishing`
- `/dashboard/institution/sparks`
- `/dashboard/institution/billing`
- `/dashboard/institution/usage`
- `/dashboard/institution/onboarding`

Report cards, attendance, behaviour, integrity, analytics, transcripts, and certificates stay on the existing dashboard routes, scoped by the institution rules.

A public walkthrough that does not need a login is `/preview/institution-flow`.

## Billing

A super admin picks the level and the student seat count. `POST /api/institutions/billing/link` writes `institutions/{id}/billing/current`, opens a Stripe Checkout session when `STRIPE_SECRET_KEY` is set (`metadata.kind = institution_billing`), and emails the link when SMTP is set. The webhook marks the bill paid and restores a suspended academy.

`GET /api/cron/institution-billing` with `Authorization: Bearer $CRON_SECRET` sends the day-1, day-3, and day-6 reminders, suspends on day 7, and uses the same lifecycle for `subscriber_billing/{uid}`. The cron reads academies whose `billingPhase` is `active` or `grace`, and subscriber bills in those same phases. It does not scan every institution.

Signup lists institutions with `listedForSelfJoin`, `country`, `state`, and `status`, ordered by name. The institution course library queries `institutionId` and `publishScope`. Pending join requests are ordered by `createdAt`. Those three composite indexes are in `firestore.indexes.json`. They are not deployed from this change. Until an owner deploys them, the screens fall back to the single-field query and filter in memory. Seat changes use the period already stored on the bill.

Seat changes inside the period are pro-rated. Teachers and parents are not seats.

## Sparks, courses, co-brand

Per-seat monthly Sparks default to 300 (Primary & Lower Secondary), 800 (IGCSE & A-Level), and 1000 (Professional & Degrees). The institution pool is seats times that number, plus top-ups. A spending cap and a low-balance alert live on `institutions/{id}/sparks_guard/current`. There is no unlimited allowance.

Access modes are Subscription, A la carte, or Both. A la carte needs an eligible flag and a price. Subscription access ends when the person or the institution lapses. A la carte stays.

An institution teacher submits a course. The institution admin approves it into the library. The public marketplace, featured placement, and core-programme placement stay with the super admin.

Co-brand (partner logo, name, “Recognised by”) is already on the certificate and Open Badge. Poket School remains the creator. Partner revenue is append-only.

## Wallet and PDPA

The wallet records top-ups, purchases, gifts, and refunds. Marketplace checkout refuses a Sparks tender. Signup still requires Terms, Privacy, and a verified guardian for anyone under 18. Export and deletion requests are `data_requests/{id}`. Invoices are kept for 7 years with the name removed.

## Environment

| Key | Use |
| --- | --- |
| `STRIPE_SECRET_KEY` | Payment links and subscriptions |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Card form |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | Payment, dunning, and invite mail |
| `OTP_SECRET` | Guardian and email codes |
| `CRON_SECRET` | Billing cron |
| `NEXT_PUBLIC_APP_URL` | Links inside emails |
| `FIREBASE_SERVICE_ACCOUNT` or `GOOGLE_APPLICATION_CREDENTIALS` | Admin SDK for webhooks and cron |
| `MY_GATEWAY_PROVIDER` plus the Billplz, iPay88, or RMS secret already used by `/api/payments/webhook/gateway` | Malaysia payments |

Stripe Connect payouts use the existing `payments.stripe_connect` flag and `teacherShareBps` (default 7000). The Teacher plan seed is USD 29 a month, the same figure as the course-builder add-on, and a super admin can replace it.
