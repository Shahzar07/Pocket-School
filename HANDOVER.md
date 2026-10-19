# Handover

Poket School (poketschool.ai) is a Next.js 15 app with Firebase Auth, Firestore (named database from `firebase-applet-config.json`), and Firebase Storage. This note is for Shahzar. It does not contain secret values.

## Architecture

- App Router under `app/`. Dashboard shells are role-gated in `lib/dashboard-access.ts` and `app/dashboard/layout.tsx`.
- Client Firebase is `lib/firebase.ts`. Emulators connect only when `NEXT_PUBLIC_FIREBASE_EMULATORS=1`.
- Server writes use `lib/firebase-admin.ts`. `isAdminConfigured()` is true when `FIREBASE_SERVICE_ACCOUNT`, `GOOGLE_APPLICATION_CREDENTIALS`, or `FIRESTORE_EMULATOR_HOST` is set. Missing Admin SDK must degrade; it must not write.
- Brand: Poket School, ET AI, Poket SafeLine. Never “Pocket”.

## Route map (short)

| Role | Home | Notable routes |
| --- | --- | --- |
| Student | `/dashboard/student` | courses, wall, goals, ID card, signup school request |
| Parent | `/dashboard/parent` | grades, goals, reports |
| Teacher | `/dashboard/teacher` | classes, gradebook, courses, AI Book Creator when the CMS add-on is on |
| Institution admin | `/dashboard/institution` | approvals at `/dashboard/institution/approvals` |
| Platform admin (`role: admin`, including `content_editor` and `super_admin`) | `/dashboard/admin` | queues, platform, pulse, AI Book Creator at `/dashboard/admin/books`, ET AI Timetabler at `/dashboard/admin/timetable` |
| Institution admin with the timetabler add-on | `/dashboard/institution/timetable` | School week. Enterprise (`plan` or `package:enterprise`) can use more than one campus. |
| Teacher | `/dashboard/teacher/timetable` | Published lessons. The add-on unlocks a personal timetable for private classrooms. |
| Student | `/dashboard/student/timetable` | Own lessons and option choices. |
| Parent | `/dashboard/parent/timetable` | Child’s lessons and option choices. |

## Signup schools

`/signup` no longer reads the institution list from the client. `GET /api/institutions/directory` returns active Institute or Enterprise academies with public listing on (`listedForSelfJoin` or `publicListing`): id, display name, city, state, logo. Country, state, and type-ahead query are filters. An empty list, or a missing server account, stays on the independent path.

Join my school creates `institutions/{id}/join_requests/{uid}` with status `pending`, sets `membershipStatus: pending` on the user, and notifies the person and the institution admin. Until approval the account stays independent and the dashboard shows a pending badge. Approve or reject on `/dashboard/institution/approvals` (`POST /api/institutions/membership` action `decide`). Approval sets `institutionId`, `institutionAccess: active`, enrols the student into that school’s `school_classes`, and notifies both sides. A valid `join_codes/{code}` auto-approves when the school or the code has `inviteAutoApprove` / `autoApprove`. “My school isn’t listed” stores a free-text name and `POST` action `invite-school` records `school_invites`. Email send needs SMTP.

## Deploy Firestore

Do not run this from an agent session. Shahzar runs it when ready:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes --project ringed-sentinel-436615-c2
```

## Environment still needed

| Name | Why |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Admin SDK. Without it, admin desks and the school directory degrade. |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Mail, including school invites. Optional `SMTP_PORT`, `SMTP_FROM`. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Card payments. Publishable key may already be set. |
| Malaysian gateway | `IPAY88_DUITNOW_PAYMENT_ID`, `PAYMENTS_SANDBOX` |
| `MYINVOIS_CLIENT_ID`, `MYINVOIS_SECRET`, `MYINVOIS_TIN` or `TIN`, `MYINVOIS_ENV` | E-invoice |
| `RESEND_API_KEY`, `MAIL_FROM` | Alternate mail |
| `OPENROUTER_API_KEY` | ET AI and AI Book Creator. The timetabler solver runs without it. The key only adds a model paragraph on `POST /api/timetable/explain`. |
| `OTP_SECRET`, `CRON_SECRET`, `CARD_TOKEN_SECRET`, `DASHBOARD_SESSION_SECRET`, `SUPER_ADMIN_EMAILS` | Session, OTP, cron, cards |
| Firebase Blaze | Storage and Functions |
| DNS | poketschool.ai |

Live rooms stay queued until Daily.co is configured. No `DAILY_*` variable name is read in this repo.

## Known limits

See `FINAL_AUDIT.md` and `E2E_REPORT.md`. Rules and indexes in git are not the same as production until the deploy command above is run. Client reads that depend on those rules still fail with a friendly message where this pass replaced the raw Firestore error (the school wall).
