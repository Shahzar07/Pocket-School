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
| AI Studio | `/dashboard/studio/timetable` | Full grid beside the main sidebar. ET AI chat at `/dashboard/studio/et` can draft a week, cover, or a photographed timetable, and waits for confirm. |
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
| `OPENROUTER_API_KEY` | ET AI and AI Book Creator. The timetabler solver runs without it. The key adds a model paragraph on `POST /api/timetable/explain` and can read a photographed timetable on `POST /api/timetable/ocr`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` | Google Calendar. Leave unset until the Cloud Console client exists. No values belong in git. |
| `OTP_SECRET`, `CRON_SECRET`, `CARD_TOKEN_SECRET`, `DASHBOARD_SESSION_SECRET`, `SUPER_ADMIN_EMAILS` | Session, OTP, cron, cards. `OTP_SECRET` also signs the iCal subscription link. |
| Firebase Blaze | Storage and Functions |
| DNS | poketschool.ai |

Live rooms stay queued until Daily.co is configured. No `DAILY_*` variable name is read in this repo.

## Google Calendar

The timetabler, `/dashboard/calendar`, and the year planner share one connection. Refresh tokens are encrypted with AES-256-GCM and stored in Firestore (`google_calendar_connections`, `google_workspace_calendars`). Those collections are server-only. The client never sees the token or the ciphertext.

If `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_OAUTH_REDIRECT_URI` is missing, the screen says “Connect Google Calendar (not configured yet)”. Download iCal and the signed subscription at `/api/calendar/ics/{token}` still work. Regenerate rotates the nonce so the previous link stops.

Google Cloud Console, once, before the env vars are filled in:

1. Enable the Google Calendar API.
2. OAuth consent screen: app name Poket School. Add scopes `https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/calendar.readonly` (events, plus free/busy).
3. Create an OAuth client of type Web application.
4. Authorised redirect URIs: `https://poketschool.ai/api/google-calendar/callback` and the same path on the production domain.
5. Authorised JavaScript origins: `https://poketschool.ai` and the production origin. The popup uses Google Identity Services; the server exchanges that code with redirect URI `postmessage`.
6. Put the client id, secret, and redirect URI in the server environment. Do not commit them.

Each person gets a calendar named Poket School (a teacher, a student, or a parent’s calendar for their child’s lessons). Republishing or approving cover updates the same Google event ids and deletes ones that left the week. Teachers opt in before free/busy becomes a solver constraint. Leave typed in Google, or a calendar chosen as the absence calendar, is flagged for admin cover approval and is not applied by itself. An admin can name a rooms calendar and a school events calendar. Holidays and term dates import as timetable blocks. Room bookings hold that room for the period.


## Known limits

See `FINAL_AUDIT.md` and `E2E_REPORT.md`. Rules and indexes in git are not the same as production until the deploy command above is run. Client reads that depend on those rules still fail with a friendly message where this pass replaced the raw Firestore error (the school wall).
