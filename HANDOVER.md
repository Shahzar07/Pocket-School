# Handover

Poket School (poketschool.ai) is a Next.js 15 app with Firebase Auth, Firestore (named database from `firebase-applet-config.json`), and Firebase Storage. This note is for Shahzar. It does not contain secret values.

Current `main` is `f9d395cb84d904c123b77abb599eea441e934bd8` (squash of #151, the dark full-screen ET AI Studio). That commit includes #148 at `de07f29b121001e80714bc839a914158a0e6d780` and #147 at `6a041278bf02fc27e62c1f0647581b5351ce3cbe`. Production deployment `dpl_14rQsk7dNuwsVEwsrWhBCVnP1VE6` is READY and aliased to https://pocket-school-ochre.vercel.app. The exact go-live list is section 9 of `FINAL_AUDIT.md`.

## Start here

Read this section first. The rest of the file is the route map and the pieces that need a longer explanation.

### Local setup

CI uses Node 22. From a clean checkout:

```bash
npm install
npm run dev
```

The app listens on port 3000. Client Firebase uses `firebase-applet-config.json`. It talks to the Auth, Firestore, and Storage emulators only when `NEXT_PUBLIC_FIREBASE_EMULATORS=1` is set. Emulator ports in `firebase.json`: Auth `9099`, Firestore `8080`, Storage `9199`. Project id `ringed-sentinel-436615-c2`.

```bash
npx firebase emulators:start --only auth,firestore,storage --project ringed-sentinel-436615-c2
NEXT_PUBLIC_FIREBASE_EMULATORS=1 npm run dev
```

Put local names in `.env.local`. Do not commit that file, and do not paste values into git or into these docs. `npm run dev` is the development command. `npx convex deploy` is not used here. Production deploys go through Vercel when `main` moves.

### Environment names

Checked on the Vercel project `pocket-school` (team `shahzar07s-projects`) on 19 Oct 2026. Names only. Values were not copied. `hiddenProductionEnvCount` was 0, so this is the full project list. “Set” means the name exists on that target. “Missing” means it does not.

| Name | Production | Preview | Development |
| --- | --- | --- | --- |
| `CRON_SECRET` | set | set | missing |
| `CARD_TOKEN_SECRET` | set | set | missing |
| `TWILIO_AUTH_TOKEN` | set | set | missing |
| `TWILIO_ACCOUNT_SID` | set | set | missing |
| `OPENROUTER_API_KEY` | set | set | missing |
| `API_KEY` | set | set | missing |
| `GEMINI_API_KEY` | set | set | missing |
| `GOOGLE_API_KEY` | set | set | missing |
| `VITE_GEMINI_API_KEY` | set | set | missing |
| `VITE_GOOGLE_API_KEY` | set | set | missing |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | set | set | set |
| `DASHBOARD_SESSION_SECRET` | set | missing | missing |
| `OTP_SECRET` | set | missing | missing |
| `SUPER_ADMIN_EMAILS` | set | missing | missing |
| `FIREBASE_SERVICE_ACCOUNT` | missing | missing | missing |
| `SMTP_HOST` | missing | missing | missing |
| `SMTP_PORT` | missing | missing | missing |
| `SMTP_USER` | missing | missing | missing |
| `SMTP_PASS` | missing | missing | missing |
| `SMTP_FROM` | missing | missing | missing |
| `RESEND_API_KEY` | missing | missing | missing |
| `RESEND_FROM` | missing | missing | missing |
| `MAIL_FROM` | missing | missing | missing |
| `RESEND_WEBHOOK_SECRET` | missing | missing | missing |
| `STRIPE_SECRET_KEY` | missing | missing | missing |
| `STRIPE_WEBHOOK_SECRET` | missing | missing | missing |
| `IPAY88_DUITNOW_PAYMENT_ID` | missing | missing | missing |
| `PAYMENTS_SANDBOX` | missing | missing | missing |
| `MYINVOIS_CLIENT_ID` | missing | missing | missing |
| `MYINVOIS_CLIENT_SECRET` | missing | missing | missing |
| `MYINVOIS_TIN` | missing | missing | missing |
| `TIN` | missing | missing | missing |
| `MYINVOIS_ENV` | missing | missing | missing |
| `GOOGLE_CLIENT_ID` | missing | missing | missing |
| `GOOGLE_CLIENT_SECRET` | missing | missing | missing |
| `GOOGLE_OAUTH_REDIRECT_URI` | missing | missing | missing |

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is public by design. Do not copy it into git. Development has that one name and nothing else from this table. `OTP_SECRET` also signs the iCal subscription. `OPENROUTER_API_KEY` is the studio model key. The timetabler solver runs without it. `API_KEY`, `VITE_GEMINI_API_KEY`, and `VITE_GOOGLE_API_KEY` are present on production and preview. They are not the Google Calendar OAuth client. The code reads `MYINVOIS_CLIENT_SECRET` (and `TIN` or `MYINVOIS_TIN`). Billing mail reads `RESEND_FROM`. Other mail paths read `MAIL_FROM`. No `DAILY_*` name is read. `SCIM_BEARER_TOKEN` is optional and is not in the env list. DNS `poketschool.ai` is not a project domain. The live alias is https://pocket-school-ochre.vercel.app.

Local-only names, not on the Vercel project: `NEXT_PUBLIC_FIREBASE_EMULATORS`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `E2E_EMULATOR`, `PLAYWRIGHT_BASE_URL`, `E2E_PORT`, `INSTITUTION_PREVIEW`, `SCOPE_PREVIEW`. Signed-in emulator specs also read `E2E_PREVIEW_PASSWORD`. Keep that password out of git.

### Deploy Firestore rules and indexes

Rules and indexes are in git. They are not deployed. Do not run this from an agent session. Shahzar runs it when ready:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes --project ringed-sentinel-436615-c2
```

Deploy `storage.rules` in the same change once the Firebase project is on the Blaze plan. Blaze was not verified on 19 Oct 2026. Storage uploads and Cloud Functions need it.

### Tests

```bash
npm run lint
npm run typecheck
npx tsx --test lib/**/*.test.ts
npm run test:e2e
```

`npm run test:e2e` is Playwright (`.github/workflows/e2e.yml`). On a pull request the job runs `npm ci`, installs Chromium, and runs `npm run test:e2e` with `INSTITUTION_PREVIEW=1` and `SCOPE_PREVIEW=1`. It does not start the Firebase emulators, so signed-in studio specs skip unless you opt in.

`E2E_EMULATOR=1` tells Playwright not to start its own Next server and to use `PLAYWRIGHT_BASE_URL`. The default port is `E2E_PORT`, or `3466` when the emulator flag is set, otherwise `3465`. A production marketing walk uses the live origin and does not boot a local server:

```bash
E2E_EMULATOR=1 PLAYWRIGHT_BASE_URL=https://pocket-school-ochre.vercel.app npm run test:e2e -- e2e/roles.spec.ts -g "marketing pages from the landing footer answer"
```

Signed-in studio and timetable specs need the emulators, `NEXT_PUBLIC_FIREBASE_EMULATORS=1` on the Next process, `E2E_EMULATOR=1`, and `E2E_PREVIEW_PASSWORD`. Firestore rules tests are separate and clear the emulator:

```bash
npm run test:rules
```

### Branches and pull requests

Branch names are `cursor/<descriptive-name>-336c`, lowercase. Open the pull request against the base Harry names (handover docs against `main`). One concern per pull request. Docs-only changes stay in the four markdown files and do not ride along with product code. Do not commit `.next*` directories, or a Next-rewritten `tsconfig.json` / `next-env.d.ts`.

### Additive only

Product work adds. It does not delete a page, a sidebar `href`, or a studio tool to make a new one fit. Before a product pull request, compare `app/**/page.tsx` and the sidebar links with the base. `git diff --diff-filter=D` against that base should stay empty unless Harry has asked for a removal. A new studio entry goes in the dark sidebar or behind All tools. It does not replace Dashboard, New chat, or Back to Poket School.

### Brand

Say Poket School. Never “Pocket”. The product names are ET AI and Poket SafeLine. The accent is cyan `#3FE0D0` with ink `#203337`. Do not introduce gold. The marketing walk fails if the homepage block contains `#c8820a`.

### Open pull requests

Listed 19 Oct 2026 with `gh pr list --state open`. Nineteen open. #142 (Admin desk for super admins and scoped admins) is already merged, commit `a95825950f8e85625a33c31820466e086fcd1ca6` on 18 Oct 2026. It is not open.

| PR | State |
| --- | --- |
| [#149](https://github.com/Shahzar07/Pocket-School/pull/149) Give Reads covers alt text and a carousel spot | Open, not draft, base `main`, mergeable. Playwright and Vercel succeeded. |
| [#145](https://github.com/Shahzar07/Pocket-School/pull/145) Snap sample book prices to store points | Open, not draft, base `main`, PoketBooks prices, mergeable. Vercel succeeded. No Playwright check on the rollup. |
| [#123](https://github.com/Shahzar07/Pocket-School/pull/123) Add a standalone Poket Reads sales letter | Draft, base `main`, mergeable. Vercel succeeded. |
| [#74](https://github.com/Shahzar07/Pocket-School/pull/74) Apply the Poket School design system across the product | Draft, base `main`, conflicting. Vercel succeeded on 15 Oct 2026. |
| [#73](https://github.com/Shahzar07/Pocket-School/pull/73) Add integrity review, re-examination, and term report cards | Draft, stacked on `cursor/behaviour-dashboard-f0ff`, mergeable. Vercel succeeded. Stale against current `main`. |
| [#72](https://github.com/Shahzar07/Pocket-School/pull/72) Add a behaviour dashboard for every role | Draft, stacked on `cursor/attendance-reports-hub-f0ff`, mergeable. Vercel succeeded. |
| [#71](https://github.com/Shahzar07/Pocket-School/pull/71) Add attendance totals and a reports hub | Draft, stacked on `cursor/learning-analytics-f0ff`, mergeable. Vercel succeeded. |
| [#70](https://github.com/Shahzar07/Pocket-School/pull/70) Add learning analytics charts for students, parents, and teachers | Draft, stacked on `cursor/student-goals-f0ff`, mergeable. Vercel succeeded. |
| [#64](https://github.com/Shahzar07/Pocket-School/pull/64) Add a guided teacher course studio with ownership and marketplace review | Draft, stacked on `cursor/admin-console-f0ff`, mergeable. Vercel succeeded. |
| [#63](https://github.com/Shahzar07/Pocket-School/pull/63) Add the admin console for users, roles, and audit | Draft, stacked on `cursor/buzan-exports-cms-f0ff`, mergeable. Vercel succeeded. |
| [#62](https://github.com/Shahzar07/Pocket-School/pull/62) Buzan mind maps, lesson downloads, and grounded CMS generation | Draft, stacked on `cursor/platform-excellence-f0ff`, mergeable. Vercel succeeded. |
| [#61](https://github.com/Shahzar07/Pocket-School/pull/61) Share device tokens, goals, and Books hooks with the app | Draft, stacked on `cursor/product-access-f0ff`, mergeable. Vercel succeeded. |
| [#60](https://github.com/Shahzar07/Pocket-School/pull/60) Expand product access with audiences, schedules, and quotas | Draft, stacked on `cursor/academy-cms-oem-f0ff`, mergeable. Vercel succeeded. |
| [#59](https://github.com/Shahzar07/Pocket-School/pull/59) Drag-and-drop builder, audience allocation, and institution licences | Draft, stacked on `cursor/dynamic-pricing-f0ff`, mergeable. Vercel succeeded. |
| [#58](https://github.com/Shahzar07/Pocket-School/pull/58) Admin-managed pricing in USD | Draft, stacked on `cursor/language-packs-f0ff`, mergeable. Vercel succeeded. |
| [#57](https://github.com/Shahzar07/Pocket-School/pull/57) Language packs: geo default, major languages, and lesson translations | Draft, stacked on `cursor/ai-studio-hub-f0ff`, mergeable. Vercel succeeded. |
| [#56](https://github.com/Shahzar07/Pocket-School/pull/56) Move ET Maths and Exam Prep into the AI Studio hub | Draft, stacked on `claude/redesign-landing-page-9V7Xg`, mergeable. Vercel succeeded. |
| [#54](https://github.com/Shahzar07/Pocket-School/pull/54) Issue module certificates with a scannable QR code | Draft, stacked on `cursor/cms-content-builder-f0ff`, conflicting. Vercel succeeded. |
| [#53](https://github.com/Shahzar07/Pocket-School/pull/53) Port lesson image blocks onto the shared media | Draft, base `main`, conflicting. Vercel succeeded on 17 Oct 2026. |

The `f0ff` stack is not based on current `main`. Treat those drafts as historical until someone rebases them.

### Known bugs

| Severity | Bug |
| --- | --- |
| High | Production Firestore rules are undeployed, and `FIREBASE_SERVICE_ACCOUNT` is missing on every Vercel target, so admin desks and the school directory degrade. Some client listeners (the wall, some desks) cannot read until both are done. |
| Medium | The timetable week a person edits lives in `localStorage` (`poket-timetable-v1`). Persisting that week to Firestore is still a TODO. Rules for `timetables` are in git and are not deployed. |
| Medium | A drag onto the planner board, a completed copyright signature write, and a live school-wall post were not exercised. |
| Low | `next build` on Next 15.5.15 flakes when Google Fonts returns an extension-less font URL. CI Playwright uses `next dev`. The production Vercel build of `f9d395c` still reached READY. |
| Data, not a code bug | `/blog` is an empty journal until the six drafts are published. `/courses` lists 9 public items and `#featured` is empty until a course is marked featured. |

### Admin content still to do

These are data actions, not code gaps. Signed-out production on 19 Oct 2026 still shows the empty states.

1. Publish the six drafts on `/dashboard/admin/blog`. `/blog` says they stay unpublished until a super admin publishes them. Seed covers in `/blog/*.webp` already return 200.
2. Mark featured courses on `/dashboard/admin/placement`: Marketplace Listed, Featured spot on, course published. `/courses` listed 9 public items and `#featured` was empty.
3. Dedupe on the same placement page: Merge duplicates, then Confirm merge. Enrolments move to the kept course. The hidden course is not deleted. Duplicate institution records are merged from the academy admin (schools desk, Merge duplicates) before both ids are allocated.

### Timetable persistence

TODO: write the edited week to Firestore. Today `lib/timetable/store.ts` keeps it in the browser under `poket-timetable-v1`. That is not a production Firestore write. Deploying the rules above is required before a server write can succeed, and the write itself is not built yet.

### Timetabler price

The price stays `TBC by Harry` (`TIMETABLER_PRICE_NOTE`, the pricing page, and the landing feature list). Do not invent a number.

## Architecture

- App Router under `app/`. Dashboard shells are role-gated in `lib/dashboard-access.ts` and `app/dashboard/layout.tsx`.
- Client Firebase is `lib/firebase.ts`. Emulators connect only when `NEXT_PUBLIC_FIREBASE_EMULATORS=1`.
- Server writes use `lib/firebase-admin.ts`. `isAdminConfigured()` is true when `FIREBASE_SERVICE_ACCOUNT`, `GOOGLE_APPLICATION_CREDENTIALS`, or `FIRESTORE_EMULATOR_HOST` is set. Missing Admin SDK must degrade; it must not write.
- Brand: Poket School, ET AI, Poket SafeLine. Cyan `#3FE0D0`, ink `#203337`. Never “Pocket”. Never gold.

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
| AI Studio | `/dashboard/studio` and `/ai-studio` | #151. The signed-in home is the dark ET AI chat at full viewport. The light dashboard sidebar and top bar stay off this page. Dashboard is the first sidebar item and links to `/dashboard` for a student, `/dashboard/teacher`, `/dashboard/parent`, `/dashboard/institution`, `/dashboard/admin`, or `/dashboard/partner` by role. The light card hub is behind All tools. Teachers and institution admins also get Timetabler in the dark sidebar Tools list. Students do not. |
| Student | `/dashboard/student/timetable` | Own lessons and option choices. |
| Parent | `/dashboard/parent/timetable` | Child’s lessons and option choices. |
| Public | `/` | Blog at `/blog` and `/blog/[slug]`. Cards and the hero use the post cover. Social images use the cover, or the branded `opengraph-image` when a post has none. |

`/ai-studio` redirects to `/dashboard/studio` (307). Signed out, both then land on `/login` with no page error. Other studio routes (maths, essays, exam prep, teachers, timetable) still use the dashboard shell.

## Signup schools

`/signup` no longer reads the institution list from the client. `GET /api/institutions/directory` returns active Institute or Enterprise academies with public listing on (`listedForSelfJoin` or `publicListing`): id, display name, city, state, logo. Country, state, and type-ahead query are filters. An empty list, or a missing server account, stays on the independent path.

Join my school creates `institutions/{id}/join_requests/{uid}` with status `pending`, sets `membershipStatus: pending` on the user, and notifies the person and the institution admin. Until approval the account stays independent and the dashboard shows a pending badge. Approve or reject on `/dashboard/institution/approvals` (`POST /api/institutions/membership` action `decide`). Approval sets `institutionId`, `institutionAccess: active`, enrols the student into that school’s `school_classes`, and notifies both sides. A valid `join_codes/{code}` auto-approves when the school or the code has `inviteAutoApprove` / `autoApprove`. “My school isn’t listed” stores a free-text name and `POST` action `invite-school` records `school_invites`. Email send needs SMTP.

## Google Calendar

The timetabler, `/dashboard/calendar`, and the year planner share one connection. Refresh tokens are encrypted with AES-256-GCM and stored in Firestore (`google_calendar_connections`, `google_workspace_calendars`). Those collections are server-only. The client never sees the token or the ciphertext.

If `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_OAUTH_REDIRECT_URI` is missing, the screen says “Connect Google Calendar (not configured yet)”. Download iCal and the signed subscription at `/api/calendar/ics/{token}` still work. Regenerate rotates the nonce so the previous link stops. On production of `f9d395c`, `GET /api/calendar/ics` with no token is 404, a trailing slash 308s to that 404, and a token that does not match a feed is 404 with “This calendar link is not active.” None of these is a 500.

Signed-out visitors to `/dashboard/teacher/timetable`, `/dashboard/institution/timetable`, `/dashboard/student/timetable`, and `/dashboard/parent/timetable` get a 307 to `/dashboard/session` and then `/login`. `/dashboard/admin/timetable` and `/dashboard/admin/books` end on `/admin/login`. `/dashboard/studio` and `/dashboard/studio/timetable` are outside the middleware role list. The first response is 200, and the dashboard shell sends that visitor to `/login`. `/ai-studio` is a 307 to `/dashboard/studio`, then the same login.

Google Cloud Console, once, before the env vars are filled in:

1. Enable the Google Calendar API.
2. OAuth consent screen: app name Poket School. Add scopes `https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/calendar.readonly` (events, plus free/busy).
3. Create an OAuth client of type Web application.
4. Authorised redirect URIs: `https://poketschool.ai/api/google-calendar/callback` and the same path on the production domain.
5. Authorised JavaScript origins: `https://poketschool.ai` and the production origin. The popup uses Google Identity Services; the server exchanges that code with redirect URI `postmessage`.
6. Put the client id, secret, and redirect URI in the server environment. Do not commit them.

Each person gets a calendar named Poket School (a teacher, a student, or a parent’s calendar for their child’s lessons). Republishing or approving cover updates the same Google event ids and deletes ones that left the week. Teachers opt in before free/busy becomes a solver constraint. Leave typed in Google, or a calendar chosen as the absence calendar, is flagged for admin cover approval and is not applied by itself. An admin can name a rooms calendar and a school events calendar. Holidays and term dates import as timetable blocks. Room bookings hold that room for the period.

## Known limits

See `FINAL_AUDIT.md` and `E2E_REPORT.md`. Rules and indexes in git are not the same as production until the deploy command above is run. Client reads that depend on those rules still fail with a friendly message where the raw Firestore error was replaced (the school wall). Live rooms stay queued until Daily.co is configured. No `DAILY_*` variable name is read in this repo.
