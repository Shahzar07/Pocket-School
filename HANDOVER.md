# Handover

Poket School (poketschool.ai) is a Next.js 15 app with Firebase Auth, Firestore (named database from `firebase-applet-config.json`), and Firebase Storage. This note is for Shahzar. It does not contain secret values.

Current `main` is `de07f29b121001e80714bc839a914158a0e6d780` (squash of #148, including #147). Production deployment `dpl_3oPXzYfPsmmboz57ZWERLteTDhHL` is READY at https://pocket-school-ochre.vercel.app. The exact go-live list is section 9 of `FINAL_AUDIT.md`.

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
| Platform admin (`role: admin`, including `content_editor` and `super_admin`) | `/dashboard/admin` | queues, platform, pulse, AI Book Creator at `/dashboard/admin/books`, journal at `/dashboard/admin/blog`, ET AI Timetabler at `/dashboard/admin/timetable` |
| Institution admin with the timetabler add-on | `/dashboard/institution/timetable` | School week. Enterprise (`plan` or `package:enterprise`) can use more than one campus. |
| Teacher | `/dashboard/teacher/timetable` | Published lessons. The add-on unlocks a personal timetable for private classrooms. |
| AI Studio | `/dashboard/studio` and `/dashboard/studio/timetable` | The studio home is the ET AI chat. Teachers and institution or enterprise admins also open the Timetabler from that chat and from the studio header. The grid sits beside the main sidebar. |
| Student | `/dashboard/student/timetable` | Own lessons and option choices. |
| Parent | `/dashboard/parent/timetable` | Child’s lessons and option choices. |
| Public | `/` | Blog at `/blog` and `/blog/[slug]`. Cards and the hero use the post cover. Social images use the cover, or the branded `opengraph-image` when a post has none. |

## Signup schools

`/signup` no longer reads the institution list from the client. `GET /api/institutions/directory` returns active Institute or Enterprise academies with public listing on (`listedForSelfJoin` or `publicListing`): id, display name, city, state, logo. Country, state, and type-ahead query are filters. An empty list, or a missing server account, stays on the independent path.

Join my school creates `institutions/{id}/join_requests/{uid}` with status `pending`, sets `membershipStatus: pending` on the user, and notifies the person and the institution admin. Until approval the account stays independent and the dashboard shows a pending badge. Approve or reject on `/dashboard/institution/approvals` (`POST /api/institutions/membership` action `decide`). Approval sets `institutionId`, `institutionAccess: active`, enrols the student into that school’s `school_classes`, and notifies both sides. A valid `join_codes/{code}` auto-approves when the school or the code has `inviteAutoApprove` / `autoApprove`. “My school isn’t listed” stores a free-text name and `POST` action `invite-school` records `school_invites`. Email send needs SMTP.

## Deploy Firestore

Do not run this from an agent session. Shahzar runs it when ready:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes --project ringed-sentinel-436615-c2
```

## Environment

Names only. “Configured” means the name is on the Vercel project `pocket-school` as of 19 Oct 2026. Values were not read.

| Name | Status |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Absent. Admin SDK and the school directory degrade until it is set. |
| Firestore rules and indexes | In git. Not deployed. Command above. |
| Firebase Blaze | Not verified. Storage and Functions need the Blaze plan. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | All absent. Invites are recorded and not mailed. |
| `RESEND_API_KEY`, `MAIL_FROM`, `RESEND_WEBHOOK_SECRET` | All absent. Alternate mail path. |
| `OTP_SECRET` | Configured on production. Also signs the iCal subscription. |
| `DASHBOARD_SESSION_SECRET`, `CARD_TOKEN_SECRET`, `CRON_SECRET`, `SUPER_ADMIN_EMAILS` | Configured. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Absent. Do not take card payment yet. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Configured. Public by design. Do not copy it into git. |
| `IPAY88_DUITNOW_PAYMENT_ID`, `PAYMENTS_SANDBOX` | Absent. Malaysian gateway. |
| `MYINVOIS_CLIENT_ID`, `MYINVOIS_SECRET`, `MYINVOIS_TIN` or `TIN`, `MYINVOIS_ENV` | Absent. |
| `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY` | Configured on production and preview. The timetabler solver runs without them. `OPENROUTER_API_KEY` adds a model paragraph on `POST /api/timetable/explain` and can read a photographed timetable on `POST /api/timetable/ocr`. |
| `API_KEY`, `VITE_GEMINI_API_KEY`, `VITE_GOOGLE_API_KEY` | Names are also configured. They are not the Calendar OAuth client. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` | Absent. Leave unset until the Cloud Console client exists. No values belong in git. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Configured. A live send was not smoked. |
| DNS `poketschool.ai` | Not a project domain. Live alias is https://pocket-school-ochre.vercel.app. |

## Google Calendar

The timetabler, `/dashboard/calendar`, and the year planner share one connection. Refresh tokens are encrypted with AES-256-GCM and stored in Firestore (`google_calendar_connections`, `google_workspace_calendars`). Those collections are server-only. The client never sees the token or the ciphertext.

If `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_OAUTH_REDIRECT_URI` is missing, the screen says “Connect Google Calendar (not configured yet)”. Download iCal and the signed subscription at `/api/calendar/ics/{token}` still work. Regenerate rotates the nonce so the previous link stops. On production, `GET /api/calendar/ics` with no token is 404, and a token that does not match a feed is 404 with “This calendar link is not active.” Neither is a 500.

Signed-out visitors to `/dashboard/teacher/timetable`, `/dashboard/institution/timetable`, `/dashboard/student/timetable`, and `/dashboard/parent/timetable` get a 307 to `/dashboard/session` and then `/login`. `/dashboard/admin/timetable` ends on `/admin/login`. `/dashboard/studio/timetable` is outside the middleware role list; the dashboard shell sends that visitor to `/login`.

The price stays `TBC by Harry`. The week the desk edits is in browser storage (`poket-timetable-v1`), not a deployed Firestore write.

Google Cloud Console, once, before the env vars are filled in:

1. Enable the Google Calendar API.
2. OAuth consent screen: app name Poket School. Add scopes `https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/calendar.readonly` (events, plus free/busy).
3. Create an OAuth client of type Web application.
4. Authorised redirect URIs: `https://poketschool.ai/api/google-calendar/callback` and the same path on the production domain.
5. Authorised JavaScript origins: `https://poketschool.ai` and the production origin. The popup uses Google Identity Services; the server exchanges that code with redirect URI `postmessage`.
6. Put the client id, secret, and redirect URI in the server environment. Do not commit them.

Each person gets a calendar named Poket School (a teacher, a student, or a parent’s calendar for their child’s lessons). Republishing or approving cover updates the same Google event ids and deletes ones that left the week. Teachers opt in before free/busy becomes a solver constraint. Leave typed in Google, or a calendar chosen as the absence calendar, is flagged for admin cover approval and is not applied by itself. An admin can name a rooms calendar and a school events calendar. Holidays and term dates import as timetable blocks. Room bookings hold that room for the period.


## Admin content still to do

These are data actions, not code gaps. Signed-out production already shows the empty states.

1. Publish the six drafts on `/dashboard/admin/blog`. `/blog` says they stay unpublished until a super admin publishes them. Seed covers in `/blog/*.webp` already return 200.
2. Mark featured courses on `/dashboard/admin/placement`: Marketplace Listed, Featured spot on, course published. `/courses` listed 9 public items on 19 Oct 2026 and `#featured` was empty.
3. Dedupe on the same placement page: Merge duplicates, then Confirm merge. Enrolments move to the kept course. The hidden course is not deleted. Duplicate institution records are merged from the academy admin (schools desk, Merge duplicates) before both ids are allocated.

## Known limits

See `FINAL_AUDIT.md` and `E2E_REPORT.md`. Rules and indexes in git are not the same as production until the deploy command above is run. Client reads that depend on those rules still fail with a friendly message where the raw Firestore error was replaced (the school wall). Live rooms stay queued until Daily.co is configured. No `DAILY_*` variable name is read in this repo.
