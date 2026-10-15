# Sunday checklist for Harry

Cutoff for this preview: Saturday 17 Oct 2026, 23:59 MYT. This is the branch to open on Sunday.

Brand on screen is Poket School. The legal entity Poket Media Sdn Bhd appears only where a legal line needs it.

## Preview

Vercel project `pocket-school`. Preview deployments use Vercel SSO (`all_except_custom_domains`), so sign in to the Vercel team before the app loads. Production is not updated by this branch.

The preview URL is the Vercel check on the pull request for `cursor/integrated-preview-f0ff`.

Firestore is the named database `ai-studio-5cdc1a69-b213-49e8-8c41-756df00d9e15` in project `ringed-sentinel-436615-c2`. Rules in this branch still need an owner deploy before production enforces the new matches.

## What this build contains

- The product stack through the teacher course studio: language packs, USD pricing, allocation and OEM, product access, device tokens and goals hooks, Buzan exports and the CMS editor, the admin console, and the guided teacher studio.
- Poket Reads from draft PR #55: catalogue, reader, library, leaderboard, and Book Studio, sharing `components/editor` and `components/media`. Book and Reads checkout uses `POST /api/stripe/create-checkout` (`kind` `book` or `reads`). School plans, add-ons, and courses use the same route with the admin price table.
- `cursor/clarity-security-sparks-f0ff` and `cursor/integrated-preview-f0ff` point at the same commit. Stacked agents should merge this tip.
- Books Firestore matches appended to the later rules file: `books`, `library`, `readingSessions`, `leaderboards`.

## Not in this preview yet

These three cloud agents were still running with no branch and no pull request when this preview was cut:

| Area | Agent | Status |
|---|---|---|
| Payments, wallet, subscriptions, admin integrations | [payments agent](https://cursor.com/agents/bc-33e2d362-a376-5efe-ab4d-91ab3617b08c) | Running, no branch to merge |
| Goals, analytics, Bloom's, behaviour, attendance, reports, integrity, calendar | [learning-data agent](https://cursor.com/agents/bc-0e18e888-9c3a-5fa9-84c3-f2e7e5eb53a7) | Running, no branch to merge |
| Community, messaging age tiers, tutor marketplace, exam centre, resource store, snap-and-solve | [community agent](https://cursor.com/agents/bc-c81088ed-5201-53e7-ab82-87472894de9a) | Running, no branch to merge |

There is no `tutor` role in `lib/roles.ts`. The QA tutor signs in as a teacher with `tutor: true` on the profile. Tutor booking is not in this build.

A fuller status list is in `docs/ROADMAP.md`.

## Accounts

Shared password for the five QA accounts: `Poket-QA-Sunday-2026`

| Role | Email | Sign-in | Lands on |
|---|---|---|---|
| Student | student.qa@poketschool.ai | `/login` | `/dashboard/student` |
| Teacher | teacher.qa@poketschool.ai | `/login` | `/dashboard/teacher` |
| Parent | parent.qa@poketschool.ai | `/login` | `/dashboard/parent` |
| Institution | institution.qa@poketschool.ai | `/login` | `/dashboard/institution` |
| Tutor | tutor.qa@poketschool.ai | `/login` | `/dashboard/teacher` |
| Super admin | harry@poketschool.ai, harry.seggu@gmail.com, or shahzarrayyan123@gmail.com | `/admin/login` | `/dashboard/admin` after the email code |

The QA password accounts are not in Firebase until this is run with the owner service account:

```bash
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
npx tsx scripts/seed-test-accounts.ts
```

This environment did not have `FIREBASE_SERVICE_ACCOUNT`, so the accounts were not created from here. The script does not create a super admin and does not change the three owner emails.

Super admin sign-in asks for an email code. If SMTP is not configured, the console signs that person out instead of skipping the code. Content editor, support, and finance do not use that code. Staff sign-out returns to `/admin/login`.

Delete the five QA accounts after the Sunday pass. They write into the live Auth project.

## Checks already run here

From `/workspace` on this branch:

- `npx tsc --noEmit` passed.
- `npx tsx --test $(find lib -name '*.test.ts')` — 223 passed, 0 failed, after the attendance and reports hub.
- `npm run test:rules` runs the community age-tier cases against the Firestore emulator.

Signed-in browser passes were not run. There is no QA session in this environment until the seed script has been executed.

## Checklist

Use a desktop browser first. Then repeat the student home and Poket Reads on a narrow window.

### Student — student.qa@poketschool.ai

1. Open `/login`, sign in, and confirm the student dashboard loads.
2. Open Books in the sidebar (`/reads`). Confirm the catalogue renders and a book page opens.
3. Open My Courses and a lesson if one is enrolled. An empty course list is acceptable for a new QA student.
4. Open Sparks and confirm the balance is a number, not an error.
5. Open My Profile, change the display name, save, and refresh. The new name should stick.
6. Sign out. The next page should be the public login, not the admin login.

### Teacher — teacher.qa@poketschool.ai

1. Sign in at `/login` and land on the teacher overview.
2. Open Course studio (`/dashboard/teacher/courses/build`). Step through basics, curriculum, pricing, and allocation. Save a draft. Publishing to the marketplace must stay pending for admin review.
3. Open the draft and use preview. The Firebase user should stay the teacher.
4. Open Messages. Sending is limited to the existing `messages` collection.
5. Sign out.

### Parent — parent.qa@poketschool.ai

1. Sign in at `/login` and land on the parent home.
2. Confirm the linked child is the QA student after the seed script (the profile stores that child's id).
3. Open Messages and Billing. Empty invoices are acceptable.
4. Open Books from the sidebar.
5. Sign out.

### Institution — institution.qa@poketschool.ai

1. Sign in at `/login` and land on `/dashboard/institution` (My Classes), not the platform user list.
2. Confirm the sidebar is the institution set: My Classes, AI Studio, marketplace, Books, messages, announcements, calendar, profile.
3. Open the academy page and confirm it names QA Poket Academy once the seed has run.
4. Sign out.

### Tutor — tutor.qa@poketschool.ai

1. Sign in at `/login`. This account is a teacher until the tutor marketplace lands.
2. Confirm the teacher overview opens.
3. Do not expect a tutor booking screen. That work is the community agent's, and it had not pushed a branch.

### Super admin

1. Open `/admin/login` (not `/login`).
2. Sign in as one of the three owner emails.
3. Complete the email code. If no code arrives, SMTP is not configured and the console will sign you out. That is the intended gate.
4. After the code, confirm `/dashboard/admin` opens and Users shows the QA accounts once they are seeded.
5. Open Courses and confirm a teacher marketplace submission can be approved or rejected.
6. Sign out and confirm you return to `/admin/login`.

### Poket Reads

1. Signed out, open `/reads`. The catalogue should render.
2. Open one book, then the reader if the sample allows it.
3. Signed in as the student, open `/reads/library` and `/reads/leaderboard`.
4. Signed in as the teacher, open `/reads/studio` and confirm the shared editor is on the page.

### Known gaps to ignore on Sunday

- Payments checkout beyond the existing Stripe course route, wallet, and subscriptions from the payments agent.
- Goals analytics, Bloom's, behaviour, attendance reports, report cards, integrity cases, and the academic calendar from the learning-data agent.
- Community spaces, age-tier separation, tutor marketplace, exam centre, resource store, and snap-and-solve from the community agent.
- Dual-currency display is still a local stash (`wip dual price and daily rates`) and is not in this branch.
