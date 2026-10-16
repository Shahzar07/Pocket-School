# Launch readiness — Poket School

Checked on 16 October 2026 from `cursor/audit-credentials-qa-db34`. Production is `main` at https://pocket-school-ochre.vercel.app (Vercel project `pocket-school`). The AI product name on screen is ET AI. This branch is not merged and nothing here was deployed.

Signed-in production flows were not run. This environment has no `FIREBASE_SERVICE_ACCOUNT`, no `OPEN_BADGE_PRIVATE_KEY`, no `SEED_QA_PASSWORD`, and no SMTP or Stripe secrets. Where a flow needs a session, the check used the preview route or the signed-out redirect.

## Pass / fail matrix

| Area | Result | What was checked |
| --- | --- | --- |
| Student role | Blocked | `student.qa@poketschool.ai` is not seeded here. `/dashboard/student` redirects to `/login` once auth settles. |
| Teacher role | Blocked | Same seed gap. `/dashboard/teacher` stays behind sign-in. |
| Parent role | Blocked | Same seed gap. `/dashboard/parent` stays behind sign-in. |
| School admin | Blocked | `institution.qa@poketschool.ai` is not seeded. `/dashboard/institution` stays behind sign-in. |
| Super admin | Blocked | Owner emails need `/admin/login` plus an email code. SMTP is not configured here. |
| Multi-role switch | Partial | `/mode-preview` renders the learning-space switch. A signed-in switch was not exercised. The client reports `role.switch` when the mode changes. |
| Sign-up | Pass (page) | `/signup` renders. English hero reads “Classroom in Your Poket”. Account creation was not submitted. |
| Programme / year | Blocked | `/onboarding` does not complete without a session. |
| Login / OTP | Partial | `/login` and `/admin/login` render. Password, OTP, and failed-login rows need Auth plus the server account. |
| Dashboards | Partial | Signed-out dashboard URLs redirect to `/login`. Role homes were not opened with a session. |
| Courses | Pass (public) | `/courses` returns 200 on production and locally. Lesson player needs a session. |
| Player | Blocked | Lesson route is behind sign-in. |
| Quizzes | Blocked | Needs a signed-in lesson. |
| AI Studio | Partial | `/ai-studio` redirects to `/dashboard/studio`, which then requires sign-in. |
| ET AI teachers | Pass (public) | `/ai-teachers` returns 200. A live tutor session needs model keys and a session. |
| Goals | Pass (preview) | `/preview/goals` renders “Your goals”. |
| Reports | Pass (preview) | `/preview/reports` renders. |
| Attendance | Blocked | Teacher and student attendance routes require sign-in. |
| Behaviour | Pass (preview) | `/preview/behaviour` renders. |
| Integrity | Partial | `/preview/integrity` renders. It requests `https://poketschool.ai/logo.png`, and that host does not resolve. |
| Report cards | Pass (preview) | Covered by the integrity preview. Live cards need a school session. |
| Planner | Pass (preview) | `/preview/planner` renders “Year planner”. |
| Certificates / Open Badges | Partial | Preview certificate shows the document, “Add to LinkedIn”, share links, and “Open Badge”. `GET /api/credentials/11111111-2222-4333-8444-555555555555/image` returns `image/png`. A signed proof needs the server account and a signing key. |
| Marketplace | Blocked | `/dashboard/marketplace` requires sign-in. |
| Poket Reads | Pass (public) | `/reads`, library, a book page, and Book Studio render. Studio books are still local autosave. |
| Tutors | Blocked | `/dashboard/tutors` requires sign-in. There is no separate tutor role. |
| Exam centre | Blocked | `/dashboard/exam-centre` requires sign-in. |
| Community | Partial | `/preview/scope-c` renders the adult community preview. Live rooms require sign-in. |
| Messaging | Blocked | `/dashboard/messages` requires sign-in. |
| Checkout | Partial | `/payments-preview` renders. Live charge needs Stripe or the gateway secrets. |
| Admin console | Blocked | Activity log, certificate template, and payments screens require a super admin. `GET /api/audit?scope=all` returns 503 without the server account. |
| Languages | Pass | Header “Change language” opens 23 languages (English, 简体中文, 繁體中文, हिन्दी, Español, Français, العربية, বাংলা, and the rest of the list). |
| Mobile | Pass (spot) | Homepage, preview certificate, and Poket Reads render at 390×844. |
| Dark mode | Pass | The theme button adds `dark` on `<html>`. Body background becomes `rgb(11, 20, 23)`. |
| Accessibility | Partial | Production Lighthouse accessibility is 97. Contrast fails on `#2786A4` text (4.17:1). This branch sets the light-theme `--primary` token to `#1E6A83` (6.10:1 on white). Hardcoded `#2786A4` on pricing and many dashboard screens is still open. |
| Performance | Fail | Production homepage Lighthouse performance is 60. FCP 5.2s, LCP 7.9s, TBT 160ms, CLS 0, Speed Index 5.6s. Built homepage first-load JS is 281 kB. Maths lab is 635 kB and AI Studio is 614 kB. |
| SEO meta | Partial | Production Lighthouse SEO is 100 on the Vercel host. Title and description say Poket School. `sitemap.xml` points at `https://poketschool.ai/…`, and that host has no DNS. |
| Broken links | Partial | Internal links on the production homepage returned success. Sitemap URLs on `poketschool.ai` do not resolve. |
| Console errors | Partial | Preview routes had no page exceptions. Navigating away aborts Firestore listen channels. Integrity preview fails to resolve `poketschool.ai`. |

## Bugs found and fixed on this branch

- Sign-out from a revoked session, a suspended account, the sidebar, the account menu, and the admin idle timeout now asks the server to record `auth.logout` before `signOut`, so the ID token is still available.
- Admin console actions (`set-role`, status, sparks, tier, permission, session revoke, password reset, invite) also write `activity_log`. Role changes are stored as `role.switch`. IP and device come from that request.
- Payment and integration saves, and refunds, write `payments.edit`, `flags.edit`, or `admin.action`. Secret values are not stored. A secret change records the slot and `changed: true`.
- Book Studio status changes report `content.publish` or `content.edit` for the book. The book itself remains in local autosave.
- A template expiry of `0` was stored as 1 month. `0` and anything below 1 now mean no expiry. Values above 120 months clamp to 120.
- The preview certificate did not show the Open Badge actions. It now includes the credential panel, and the sample id returns a public preview document without the Admin SDK.
- The English sign-in hero said “Classroom in Your Pocket”. It now says “Classroom in Your Poket”.
- Light-theme `--primary` moved from `#2786A4` to `#1E6A83` so small primary text and white-on-primary buttons clear 4.5:1.

## Open issues by severity

### Critical

- Firestore rules and indexes for `activity_log`, `auth_activity`, `audit_settings`, `credential_keys`, and `certificate_templates` are in the repo only. Production will keep accepting the old client rules until an owner deploys `firestore.rules` and `firestore.indexes.json`. Do not deploy them from an agent session.
- `FIREBASE_SERVICE_ACCOUNT` is required for the activity log, badge signing, revocation, and bulk issue. Without it those routes return 503 and certificates stay unsigned.
- `https://poketschool.ai` does not resolve. The sitemap, Open Badge issuer id, and the integrity report logo use that host. Verifiers and search engines cannot follow those URLs.

### High

- QA accounts are not in Firebase until someone runs `scripts/seed-test-accounts.ts` with `FIREBASE_SERVICE_ACCOUNT` and `SEED_QA_PASSWORD`. Student, teacher, parent, school admin, tutor, and super admin journeys are untested in a browser.
- Super admin sign-in sends an email code. Without SMTP the console signs that person out.
- Live checkout needs Stripe and the Billplz / iPay88 / RMS secrets. Sandbox preview does not prove a charge.
- Homepage LCP is 7.9s on production (Lighthouse performance 60). That is the public first impression.

### Medium

- Set `OPEN_BADGE_PRIVATE_KEY` (PKCS8 PEM) before the first real badge. If it is unset, the server creates one key in `credential_keys/poket-school`. Changing that key later makes older signatures fail. Clients cannot read the key.
- Hardcoded `#2786A4` remains on pricing, login buttons, and many dashboard gradients. Those still fail the 4.5:1 check that the CSS token now passes.
- Book Studio does not write books to Firestore. The activity row records the status change only while the editor is signed in with a content role.
- Retention purge of `users/{id}/auth_activity` needs the collection-group index. Until that index is deployed, the purge logs the error and still deletes the `activity_log` page.
- Other language packs still translate the hero as “in your pocket” (or the equivalent). Only the English catalog string was changed.
- The older `admin_audit` collection can still be written by an admin client when the server account is missing. The new `activity_log` cannot.

### Low

- Activity search loads the latest 500 rows and filters in the browser. Older rows need a narrower query after the composite indexes are deployed.
- A revoked or expired badge keeps its signature. Status is read live from `/api/credentials/{id}/status`.
- Preview badges are explicitly unsigned. They must not be treated as issued credentials.

## Blocked by missing keys

| Key or secret | What it blocks |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Activity writes, retention, signed badges, revocation, bulk issue, admin claims, QA seed |
| `SEED_QA_PASSWORD` | Creating the five QA accounts |
| `OPEN_BADGE_PRIVATE_KEY` | Stable signatures across deploys |
| SMTP (`SMTP_*` / the mail transport already used for OTP) | Login OTP and super admin email code |
| Stripe secret and webhook secret | Card checkout and webhooks |
| Billplz, iPay88, or RMS secrets | Local gateway charges |
| AI provider keys (OpenRouter / Gemini) | Live ET AI replies and Studio generation |
| DNS for `poketschool.ai` | Sitemap, issuer id, public verify links in issued badges |

## Finishing touches before launch

- [ ] Owner deploys `firestore.rules` and `firestore.indexes.json` with the project toolchain. Confirm clients cannot create, update, or delete `activity_log`.
- [ ] Set `FIREBASE_SERVICE_ACCOUNT` on the Vercel project `pocket-school` for Production.
- [ ] Set `OPEN_BADGE_PRIVATE_KEY` and `NEXT_PUBLIC_APP_URL` to the public origin before issuing any badge.
- [ ] Attach `poketschool.ai` (or change the sitemap and issuer origin to the live host) and confirm `https://poketschool.ai/` answers.
- [ ] Seed QA accounts, then walk student, teacher, parent, school admin, and super admin through sign-in, a role switch, one course, the player, a quiz, ET AI, goals, attendance, behaviour, a report card, the planner, a certificate, Reads, tutors, the exam centre, community, messaging, and checkout. Delete the QA accounts afterwards.
- [ ] Confirm SMTP by completing one OTP and one super admin code.
- [ ] Run one sandbox payment and one webhook.
- [ ] Replace remaining `#2786A4` text on white or `#f4f6f6` with `#1E6A83`.
- [ ] Reduce homepage LCP (hero media and the 281 kB first load). Re-run Lighthouse on the production URL after deploy. Target is a passing performance score and LCP under 2.5s.
- [ ] Translate the English hero “Classroom in Your Poket” in the other catalogs, or drop the pocket metaphor.
- [ ] Decide whether Book Studio should persist books before launch. Until then, do not describe those books as saved to the school.
- [ ] After indexes are deployed, run one retention purge and confirm both `activity_log` and `auth_activity` copies are removed and the purge itself is logged.

## Commands run

- `npx tsc --noEmit` — passed after the contrast, slogan, and preview-credential edits
- `npx tsx --test $(find lib -name '*.test.ts')` — 280 passed, 0 failed
- `npm run test:rules` — 28 passed, including the activity log, signing key, and certificate template rules
- `npm run build` — completed after those edits
