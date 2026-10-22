# Handover

Poket School (poketschool.ai) is a Next.js 15 app with Firebase Auth, Firestore (named database from `firebase-applet-config.json`), and Firebase Storage. This note is for Shahzar. It does not contain secret values.

`main` at the production alias is `8b140af9568177c8c3a7023c2459ac3e1d5ff2ae` (squash of #123, the Poket Reads sales letter) until this pull request merges. Production deployment `dpl_Cm6db66hp6imYjfntJG5XJgZyGLV` is READY and aliased to https://pocket-school-ochre.vercel.app, https://poketschool.ai, and https://www.poketschool.ai. This pull request only updates this handover. It does not change product behaviour. The list since 21 Oct 2026 noon (Malaysia time) is the next section. `FINAL_AUDIT.md` is the older audit and is not that list.

## Shipped since 21 Oct 2026, noon MYT

Squash commits on `main`, oldest first. Times below are the git commit time in UTC. Production aliases follow `main`. A docs-only commit after this list does not change those routes.

| PR | Commit | UTC | What landed |
| --- | --- | --- | --- |
| [#163](https://github.com/Shahzar07/Pocket-School/pull/163) | `c38cfbd7ff5fbd99d19ec61ce7f05969f88f62cc` | 2026-10-21 06:23 | Landing page: no menu bar, balanced footer, and how lessons are taught. `/` |
| [#161](https://github.com/Shahzar07/Pocket-School/pull/161) | `32187ee45e9691f3762d7133a292230c92ab7b6f` | 2026-10-21 07:58 | ET AI Essay Writer marks against the chosen level. `/studio/essays` and `/dashboard/studio/essays` |
| [#162](https://github.com/Shahzar07/Pocket-School/pull/162) | `b40b48d4391720e80dd977b35ebd0582d6a9dfee` | 2026-10-21 08:23 | One learner level list, including postgraduate, and exam-board styles |
| [#157](https://github.com/Shahzar07/Pocket-School/pull/157) | `87bc435c3005f7cfb50b2ef3c7a6f86791c34515` | 2026-10-21 08:32 | Journal editor with live preview and SEO fields. `/dashboard/admin/blog` |
| [#156](https://github.com/Shahzar07/Pocket-School/pull/156) | `d03577f16095db2d8ed08f661cb29165d255b57d` | 2026-10-21 08:44 | Certificate template editor: preview and PDF match. `/dashboard/admin/certificates` |
| [#164](https://github.com/Shahzar07/Pocket-School/pull/164) | `104ec65f4e91d212a24854da4e424cbfcec786b5` | 2026-10-21 08:54 | Official exam packs live under ET Exams and persist. `/dashboard/admin/exam-packs` |
| [#166](https://github.com/Shahzar07/Pocket-School/pull/166) | `f0f0e418d1a7a3dacfa456508284c45ecf92f93b` | 2026-10-21 09:07 | Official exams as a page-by-page flow with arrow links |
| [#165](https://github.com/Shahzar07/Pocket-School/pull/165) | `72930772f8b80784d8c0ab172f318a696d1b7bef` | 2026-10-21 09:23 | Exam builder opens as a full-width form |
| [#167](https://github.com/Shahzar07/Pocket-School/pull/167) | `cdc3aaa3209fe4d85819880cf6e52a0621afb459` | 2026-10-21 09:35 | The same arrow links (`FlowTrail`, `FlowNav`) on learning steps |
| [#158](https://github.com/Shahzar07/Pocket-School/pull/158) | `786a4cf55daf92ad8ebbe7401c03b8e115a973ab` | 2026-10-21 23:08 | Course builder: teacher copyright, maps, and one block grid |
| [#154](https://github.com/Shahzar07/Pocket-School/pull/154) | `6e7210c743c98609e7ac0e1a38031c8f3f32be2f` | 2026-10-21 23:23 | Admin Action Centre. `/dashboard/admin/tasks` |
| [#155](https://github.com/Shahzar07/Pocket-School/pull/155) | `ce722570d00b391e5253cf75bf6af43a6ee8486a` | 2026-10-21 23:38 | Pathway pages list stages, subjects, and ET teachers |
| [#159](https://github.com/Shahzar07/Pocket-School/pull/159) | `9f1a6469b9a5215e6301764646096cf14b547b10` | 2026-10-21 23:53 | Creator Store: private product files and a bulk importer. `/dashboard/admin/store/import` |
| [#168](https://github.com/Shahzar07/Pocket-School/pull/168) | `ea39fc94aa5e14b7ad3a48762d32eec80d095562` | 2026-10-22 00:44 | Hero range reads “Primary to PhD”, in white |
| [#169](https://github.com/Shahzar07/Pocket-School/pull/169) | `d5c149bc45d106f099b3cd12540034daaa0fb0be` | 2026-10-22 01:26 | Brand illustrations on the public feature pages (`components/marketing/illustrations.tsx`, product and pathway views, `/ai-teachers`) |
| [#170](https://github.com/Shahzar07/Pocket-School/pull/170) | `f5a2b5c9efe82b8686ddc402dc90ac7920a39a5e` | 2026-10-22 03:47 | Admin landing-page builder. Desk `/dashboard/admin/funnels`. Public `/p/[slug]` |
| [#171](https://github.com/Shahzar07/Pocket-School/pull/171) | `56a753bdfb8c661ea5c372d4b49cd48adeb966b5` | 2026-10-22 04:20 | Academic results. Desk `/dashboard/results`. Public `/results/[token]` |
| [#172](https://github.com/Shahzar07/Pocket-School/pull/172) | `cef1f3acd8ba583b585200b72864da2c3d45bb14` | 2026-10-22 04:55 | Sidebar keys render as labels, and the account control is not clipped |
| [#173](https://github.com/Shahzar07/Pocket-School/pull/173) | `ff089fcd8d66682b660664d191ce785008aebdc0` | 2026-10-22 05:44 | Each sidebar destination has its own label. Search stays readable |
| [#174](https://github.com/Shahzar07/Pocket-School/pull/174) | `6e064970cf98d8d712db5e5fc058754409ed3def` | 2026-10-22 06:18 | Dashboard tiles and alerts use the cyan tile tokens |
| [#175](https://github.com/Shahzar07/Pocket-School/pull/175) | `fe170cffab06294300d7460212c78256a249bda6` | 2026-10-22 06:49 | Lesson-to-lesson and question-to-question arrows, with an emulator fixture |
| [#145](https://github.com/Shahzar07/Pocket-School/pull/145) | `3ee29679779e15d3465bb56b03accc14e8b491ac` | 2026-10-22 07:03 | Sample book prices snap to store points (7.99, 3.99, 9.99, 4.99). Harbour Light stays 1.99. Free books stay 0 |
| [#123](https://github.com/Shahzar07/Pocket-School/pull/123) | `8b140af9568177c8c3a7023c2459ac3e1d5ff2ae` | 2026-10-22 07:15 | Standalone Poket Reads sales letter at `/reads/offer` (`noindex`). Prices come from the shared shelf, so the snapped points show there |

### Routes added in that stretch

| Route | Who | Behaviour |
| --- | --- | --- |
| `/dashboard/admin/tasks` | Platform admin and super admin | Action Centre. The bell is in the admin header. Writes need the Admin SDK. |
| `/dashboard/admin/funnels` | Admin and super admin. Support, finance, and content editor are refused | Draft, preview, duplicate, and publish a landing page. The desk card on `/dashboard/admin` is “Landing pages”. |
| `/p/[slug]` | Public. The site header hides on `/p/` | See the funnel and alumni note below. |
| `/dashboard/results` | Student, parent, institution admin, platform admin, super admin. Teachers and partners are refused | Academic results. The learner writes. A school or platform admin verifies. Teachers do not open this page. There is no sidebar row yet. Open the path directly. |
| `/results/[token]` | Public, `noindex`. The site header hides on `/results/` | Read-only portfolio. See below. |
| `/dashboard/admin/store/import` | Content editors and admins | Creator Store importer. Saves drafts. Publishing is a separate action. |
| `/dashboard/admin/exam-packs` | Admin curriculum desk | Official exam packs under ET Exams. |
| `/reads/offer` | Public, `noindex` | Poket Reads sales letter. Checkout still needs Stripe before a card charge works. |
| `/dashboard/admin/blog` | Super admin | Journal editor. |
| `/dashboard/admin/pathways` | Admin | Pathway stages, subjects, and ET teachers. |
| `/dashboard/admin/safety-desk` | Admin | Safety Desk. Poket SafeLine stays `/dashboard/admin/hotline`. Emergency alerts stay `/dashboard/admin/emergency`. |

### `/p/[slug]` and alumni

A slug is two to 48 characters, lowercase letters and numbers, with single hyphens: `^[a-z0-9]+(?:-[a-z0-9]+)*$`. The page looks up a funnel first.

- A **published** funnel renders the public landing page and stores leads.
- A **draft** slug renders “This page is not published.” It does not fall through to an alumni record.
- Any other code (unknown slug, or a code that is not a funnel) renders the private alumni record. With the Admin SDK and a public alumni row, the name, institution, level, student number, certificate titles, and badge count show. Without a public row, or without `FIREBASE_SERVICE_ACCOUNT`, the page says the profile is private. Certificate QR pages stay on their own verify URLs.

Funnels and alumni both need `FIREBASE_SERVICE_ACCOUNT` on Vercel before a real record can be read or written in production. The emulator is enough for local QA.

### `/results/[token]`

The token is hex, 32 to 64 characters. The student turns the link on from `/dashboard/results`. The public page is `noindex`. The disclaimer on the page is exactly: “Exam boards award these grades. Poket School records them.” A missing Admin SDK, a short token, or a switched-off link renders the private state. Certificate files are not public. `GET /api/results/file` needs the signed-in owner or a linked parent.

### Lesson and quiz arrows

`FlowTrail` and `FlowNav` move lesson to lesson inside a unit, and question to question inside a quiz (Back, Next, trail clicks, ArrowLeft, ArrowRight). A quiz sets `data-flow-capture="quiz"` so the lesson arrows do not also change the lesson while the quiz is open. The signed-in check uses the emulator fixture in `e2e/fixtures/lesson-flow.ts` (course `e2e-flow-course`). That course is not in production Firestore, so a signed-out production lesson URL redirects to `/login`.

### Sample book prices

`lib/reads/seed.ts` runs Cells to Systems, Malacca, Plain Words for Contract, and The Monsoon Market through `snapToStorePricePoint`. The letter at `/reads/offer` reads that shelf, so production shows 7.99, 3.99, 9.99, and 4.99. Re-seeding production Firestore is a separate data step and still needs the Admin SDK. The letter itself does not.

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

Rechecked on the Vercel project `pocket-school` (team `shahzar07s-projects`) on 22 Oct 2026. Names only. Values were not copied. `hiddenProductionEnvCount` was 0, so this is the full project list. “Set” means the name exists on that target. “Missing” means it does not. The set and missing columns below match that read.

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

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is public by design. Do not copy it into git. Development has that one name and nothing else from this table. `OTP_SECRET` also signs the iCal subscription. `OPENROUTER_API_KEY` is the studio model key. The timetabler solver runs without it. `API_KEY`, `VITE_GEMINI_API_KEY`, and `VITE_GOOGLE_API_KEY` are present on production and preview. They are not the Google Calendar OAuth client. The code reads `MYINVOIS_CLIENT_SECRET` (and `TIN` or `MYINVOIS_TIN`). Billing mail reads `RESEND_FROM`. Other mail paths read `MAIL_FROM`. No `DAILY_*` name is read. `SCIM_BEARER_TOKEN` is optional and is not in the env list. `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are also absent. The production deployment is aliased to https://poketschool.ai, https://www.poketschool.ai, and https://pocket-school-ochre.vercel.app.

### What still needs a key before it works live

These names were still missing on 22 Oct 2026. The pages load. The live write, charge, or send does not.

| Missing name | What stays dark until Harry sets it |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Admin SDK. Signed Creator Store downloads (`POST /api/store/download` returns the setup message and does not invent a URL). School directory (`School list is unavailable until FIREBASE_SERVICE_ACCOUNT is set.`). Adding an institution (`INSTITUTION_KEY_MESSAGE`, HTTP 503). Admin claim sync, the activity log, badge signing, funnel and results writes, alumni reads, push send, and other server routes that call `isAdminConfigured()`. A local `FIRESTORE_EMULATOR_HOST` is enough for emulator QA. It does not sign a production URL. |
| Firebase Blaze plan | Not verified. `storage.rules` (store thumbs, previews, and private PDFs), storage uploads, Cloud Functions, and backups need Blaze. Rules and indexes in git are not production until Shahzar runs the deploy command below. Do not run that deploy from an agent session. |
| `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` | Card checkout returns 503 with “Card payments are not switched on yet.” (`POST /api/stripe/checkout` and the other `/api/stripe/*` routes). The webhook does nothing until both names exist. The publishable key is already set, so the client can load Stripe.js. It cannot charge. |
| `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_WEBHOOK_SECRET` | Billing and staff mail. `lib/mail/index.ts` uses Resend only when the key and `RESEND_FROM` are set. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Invite and other SMTP mail, including “My school isn’t listed”. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` | Google Calendar. The screen says it is not configured. Download iCal still works. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web push. Also needs the Admin SDK to send. |

`OPENROUTER_API_KEY` is set, so the studio model calls are not in this list. The timetabler price stays `TBC by Harry`.

Local-only names, not on the Vercel project: `NEXT_PUBLIC_FIREBASE_EMULATORS`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `E2E_EMULATOR`, `PLAYWRIGHT_BASE_URL`, `E2E_PORT`, `INSTITUTION_PREVIEW`, `SCOPE_PREVIEW`. Signed-in emulator specs also read `E2E_PREVIEW_PASSWORD`. Keep that password out of git.

### Deploy Firestore rules and indexes

Rules and indexes are in git. They are not deployed. Do not run this from an agent session. Shahzar runs it when ready:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes --project ringed-sentinel-436615-c2
```

Deploy `storage.rules` in the same change once the Firebase project is on the Blaze plan. Blaze was not verified on 19 Oct 2026. Storage uploads and Cloud Functions need it.

### Creator Store files (for Shahzar)

`storage.rules` now covers `store/products/{productId}/thumbs/*` (public images, 5 MB), `preview/*` (public watermarked pages), and `private/paper.pdf` plus `private/markscheme.pdf` (never public, PDFs, 50 MB). Writes in those rules are only `adminRole` `super_admin`, `admin`, or `content_editor`.

Two production steps are still open. Do not treat either as done:

1. **Firebase Blaze plan.** Deploying these storage rules (and any storage upload in production) still needs Blaze. The importer does not deploy rules and does not report a successful deploy.
2. **`FIREBASE_SERVICE_ACCOUNT` on Vercel.** Signed downloads are minted by the Admin SDK for about 10 minutes, and only after a purchase, an entitlement, or an admin or content editor check. The key is missing on every Vercel target. Until it is set, `POST /api/store/download` returns setup needed and does not invent a URL. A Firestore emulator host is enough for the importer to store files locally. It is not enough to sign a production URL.

The import desk is `/dashboard/admin/store/import`. It saves drafts only. Publishing stays a separate admin action. See `docs/STORE_IMPORT.md`.

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

Product work adds. It does not delete a page, a sidebar `href`, or a studio tool to make a new one fit. Before a product pull request, compare `app/**/page.tsx` and the sidebar links with the base. `git diff --diff-filter=D` against that base should stay empty unless Harry has asked for a removal. A new tool is a row in `TOOL_ROUTES`. It appears in the shell Tools list for roles that pass its gate. Dashboard, New chat, and Back to Poket School stay where they are.

### Brand

Say Poket School. Never “Pocket”. The product names are ET AI and Poket SafeLine. The accent is cyan `#3FE0D0` with ink `#203337`. On a light surface, text is `#1E6A83` or `#203337`. The dark page is `#0B1417`. Dashboard tiles use `--ps-tile-wash` (light `rgba(63, 224, 208, 0.18)`, dark `#121E22`) and `--ps-tile-ink` (light `#1E6A83`, dark `#3FE0D0`). Fills stay cyan with ink text. Do not introduce gold, mustard, amber, or olive. The marketing walk fails if the homepage block contains `#c8820a`. The Pip guide’s cheeks and the Poket logo red stay. Chart tokens `--ps-coral`, `--ps-violet`, `--chart-3`, and `--chart-4` stay so the chart colour test still matches.

### Full-page AI shell

Every AI tool uses one full-viewport shell, in dark and in light. On those routes the light dashboard sidebar, top bar, mobile nav, and floating tutor stay hidden (`data-studio-immersive="1"`). Dashboard is the first sidebar item and links to the role home. Back to Poket School is the last item. Between them, Tools lists the tools that role may open and highlights the open one with a cyan fill and ink text.

| Piece | Where |
| --- | --- |
| Sidebar, essentials, dashboard wrap, public wrap | `components/studio/tool-shell.tsx` (`ShellSidebar`, `ShellEssentials`, `ToolShell`, `PublicToolShell`) |
| Which routes are tools, who may see them | `lib/studio/tool-inventory.ts` (`TOOL_ROUTES`, `isAiToolPath`, `ownsStudioShell`, `sidebarTools`) |
| Dark and light colours | `lib/studio/shell-theme.ts` (`studioCssVars`) |
| Chat homes that draw the shell themselves | `components/studio/ai-studio.tsx` on `/dashboard/studio` and `/dashboard/studio/et` |
| Hide the light chrome and wrap the other dashboard tools | `app/dashboard/layout.tsx` |
| Theme | `components/theme-provider.tsx` and `components/theme-toggle.tsx` |

The wrapped and unwrapped list, with the reason for each row, is the table in `QA_QC.md` under “Full-page shell on every AI tool”. `npx tsx --test lib/studio/tool-inventory.test.ts` checks the wrap rules and the role gates.

To wrap a new tool:

1. Add a `TOOL_ROUTES` entry with `id`, `label`, `href`, `sidebar: true`, `wrapped: true`, `covers` (that path and its children), `why`, and a `gate` when a role or add-on already limits it.
2. A page under `app/dashboard` is wrapped by the dashboard layout. Leave the page body as it is.
3. A page outside the dashboard wraps its existing view in `PublicToolShell`. The public pages that do this today are `/ai-teachers`, `/ai-teachers/[teacherId]/session`, `/reads/studio`, and `/studio/essays` (including review).
4. Set `ownsShell: true` and `exact: true` only when the page renders the sidebar itself. Today that is the two chat homes. The layout must not wrap those again.
5. Keep the role check in `lib/dashboard-access.ts` and on the route gate. The shell hides a link. It does not grant access.
6. The highlighted tool is the longest matching `covers` prefix (`aria-current="page"`).

Theme handling: `next-themes` sets `class` on `html`, `defaultTheme` is `system`, and the saved choice is the `localStorage` key `theme`. A saved choice wins. With nothing saved, the system theme is used. `studioCssVars` reads the resolved theme. Dark keeps the approved studio palette (background `#1A1918`, accent text `#3FE0D0`). Light uses a white and very light blue surface, the same cyan fills, and `#1E6A83` or `#203337` for text. Do not add a `dark` class on the shell while the theme is light, because child `dark:` styles would stay dark. A headless test that needs the approved dark look sets `localStorage.theme` to `dark` before navigation.

### Open pull requests

Listed 22 Oct 2026 with `gh pr list --state open`. #145 and #123 are merged and are in the shipped table above. #149 was already merged before this note. Sixteen drafts remain. They were not closed.

#56–#74 were compared with `main` on 22 Oct 2026. The check was file presence and, for the already-merged rows, whether the squash commit is an ancestor of `main`. They were not rebased and not merged again.

| PR | Feature | In main | What's missing |
| --- | --- | --- | --- |
| 56 | Move ET Maths and Exam Prep into the AI Studio hub | yes | Nothing from that move. The hub is larger now. Exam prep is labelled ET Exams. Redirects live in `lib/studio-paths.ts`. |
| 57 | Language packs, geo default, lesson translations | partly | Packs, the switcher, human catalogs for en/ms/zh/ta, other catalogs marked needs-review, RTL, the Kazakhstan one-click shortcut, and lesson title/body translation are on `main`. Automatic geo default is not. `initialLanguage` in `lib/i18n/detect.ts` stays English until an explicit choice or a language cookie. Geolocation only suggests. |
| 58 | Admin-managed pricing in USD | yes | `pricing_config/current`, `pricing_audit`, and `AdminPricingPanel` on admin settings. |
| 59 | Drag-and-drop builder, audience allocation, institution licences | yes | `lib/reorder.ts`, Alt+Arrow reorder, `lib/allocation.ts`, `lib/oem.ts`, `lib/white-label.ts`, and the institution licence UI. That draft deferred branded-invite email send and an offline service worker. Mail transport exists later and still needs the keys above. |
| 60 | Product access audiences, schedules, quotas | yes | `lib/access-policy.ts`, the allocation panel, and the Firestore gates. |
| 61 | Device tokens, goals, Books hooks | yes | `deviceTokens` rules and `lib/push.ts`. `/reads` exists. Live push still needs `FIREBASE_SERVICE_ACCOUNT` and the VAPID names. |
| 62 | Buzan mind maps, lesson downloads, grounded CMS | yes | `lib/mindmap.ts` (`layoutBuzan`, `parseBuzan`), the download menu, and generation jobs. |
| 63 | Admin console users, roles, audit | yes | `/dashboard/admin/users`, `/dashboard/admin/audit`, `lib/admin-console.ts`. Action Centre (#154) is extra. Claims sync still needs `FIREBASE_SERVICE_ACCOUNT`. |
| 64 | Guided teacher course studio | yes | `components/teacher-course-studio.tsx` still steps through basics, curriculum, and pricing. |
| 65 | Sunday preview: product stack plus Poket Reads | yes | Merged. `c5bc03b3afdf2162af861bdfd9ee2747b4e883dd` is an ancestor of `main`. |
| 66 | Finish Scope C tutors, exams, store, snap, lesson Q&A | yes | Merged onto the clarity stack. `3bf058eba2e7f5a7812b9e61b07e747366454500` is an ancestor of `main`. |
| 67 | Goals, insights, reports, integrity, academic calendar | yes | `51d3ae05f92be34b9404c22132451c42fc203af7` is an ancestor of `main`. |
| 68 | Unified checkout for plans, books, and Reads | yes | The same stack. `c5bc03b3afdf2162af861bdfd9ee2747b4e883dd` is an ancestor of `main`. Checkout still needs `STRIPE_SECRET_KEY` to charge. |
| 69 | Student goals with parent cheers and class privacy | yes | Merged. `e3d0c12f4597e83e318f8df75c282701c71a2814` is an ancestor of `main`. |
| 70 | Learning analytics charts | yes | `/dashboard/student/analytics`, parent and teacher analytics, `components/insights/learning-charts.tsx`. |
| 71 | Attendance totals and reports hub | yes | Attendance pages, `components/insights/reports-hub.tsx`, `lib/insights/attendance.ts`. |
| 72 | Behaviour dashboard | yes | `/dashboard/behaviour`, `components/insights/behaviour-dashboard.tsx`. |
| 73 | Integrity review, re-examination, term report cards | yes | `lib/insights/reexam.ts`, integrity pages, and the report-card model. |
| 74 | Poket School design system | yes | `lib/design/system.ts` and the shell. The palette later moved to the cyan tile tokens in #174. The system is applied. |

#54 (module certificates with a QR) and #53 (lesson image blocks on the shared media) are still open drafts. They were not part of this check.

The `f0ff` stack is not based on current `main`. Leave those drafts open. Do not merge them on top of `main` without a fresh rebase.

### Known bugs

| Severity | Bug |
| --- | --- |
| High | Production Firestore rules are undeployed, and `FIREBASE_SERVICE_ACCOUNT` is missing on every Vercel target, so admin desks and the school directory degrade. Some client listeners (the wall, some desks) cannot read until both are done. |
| Medium | The timetable week a person edits lives in `localStorage` (`poket-timetable-v1`). Persisting that week to Firestore is still a TODO. Rules for `timetables` are in git and are not deployed. |
| Medium | A drag onto the planner board, a completed copyright signature write, and a live school-wall post were not exercised. |
| Low | `next build` on Next 15.5.15 flakes when Google Fonts returns an extension-less font URL. CI Playwright uses `next dev`. Production builds of `main` have still reached READY, including `dpl_Cm6db66hp6imYjfntJG5XJgZyGLV`. |
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
| Student | `/dashboard/student` | courses, wall, goals, ID card, signup school request. Academic results are `/dashboard/results` (no sidebar row). |
| Parent | `/dashboard/parent` | grades, goals, reports |
| Teacher | `/dashboard/teacher` | classes, gradebook, courses, AI Book Creator when the CMS add-on is on |
| Institution admin | `/dashboard/institution` | approvals at `/dashboard/institution/approvals` |
| Platform admin (`role: admin`, including `content_editor` and `super_admin`) | `/dashboard/admin` | Action Centre `/dashboard/admin/tasks`, Queues, Safety Desk `/dashboard/admin/safety-desk`, Landing pages `/dashboard/admin/funnels`, Store import `/dashboard/admin/store/import`, exam packs `/dashboard/admin/exam-packs`, pathways `/dashboard/admin/pathways`, journal `/dashboard/admin/blog`, curriculum CMS `/dashboard/admin/curriculum`, AI Book Creator `/dashboard/admin/books`, ET AI Timetabler `/dashboard/admin/timetable`. The home desk tiles are in `components/admin/desk.tsx`. |
| Institution admin with the timetabler add-on | `/dashboard/institution/timetable` | School week. Enterprise (`plan` or `package:enterprise`) can use more than one campus. |
| Teacher | `/dashboard/teacher/timetable` | Published lessons. The add-on unlocks a personal timetable for private classrooms. |
| AI tools | `/dashboard/studio`, `/ai-studio`, and the routes in `TOOL_ROUTES` | Full-page shell, dark and light. `/ai-studio` redirects to `/dashboard/studio`. Dashboard is the first sidebar item and links to `/dashboard` for a student, `/dashboard/teacher`, `/dashboard/parent`, `/dashboard/institution`, `/dashboard/admin`, or `/dashboard/partner` by role. All tools still opens the card list. Teachers and institution admins see Timetabler. Students and parents do not. |
| Student | `/dashboard/student/timetable` | Own lessons and option choices. |
| Parent | `/dashboard/parent/timetable` | Child’s lessons and option choices. |
| Public | `/` | Blog at `/blog` and `/blog/[slug]`. Poket Reads letter at `/reads/offer` (`noindex`). A published landing page at `/p/[slug]`. A switched-on results portfolio at `/results/[token]` (`noindex`). The site header hides on `/p/` and `/results/`. Cards and the hero use the post cover. Social images use the cover, or the branded `opengraph-image` when a post has none. |

`/ai-studio` redirects to `/dashboard/studio` (307). Signed out, both then land on `/login` with no page error. Maths, essays, exam prep, teachers, the timetable, and the other rows in `TOOL_ROUTES` use the same full-page shell. The light dashboard menu returns on every page that is not an AI tool.

## Signup schools

`/signup` no longer reads the institution list from the client. `GET /api/institutions/directory` returns active Institute or Enterprise academies with public listing on (`listedForSelfJoin` or `publicListing`): id, display name, city, state, logo. Country, state, and type-ahead query are filters. An empty list, or a missing server account, stays on the independent path.

Join my school creates `institutions/{id}/join_requests/{uid}` with status `pending`, sets `membershipStatus: pending` on the user, and notifies the person and the institution admin. Until approval the account stays independent and the dashboard shows a pending badge. Approve or reject on `/dashboard/institution/approvals` (`POST /api/institutions/membership` action `decide`). Approval sets `institutionId`, `institutionAccess: active`, enrols the student into that school’s `school_classes`, and notifies both sides. A valid `join_codes/{code}` auto-approves when the school or the code has `inviteAutoApprove` / `autoApprove`. “My school isn’t listed” stores a free-text name and `POST` action `invite-school` records `school_invites`. Email send needs SMTP.

## Google Calendar

The timetabler, `/dashboard/calendar`, and the year planner share one connection. Refresh tokens are encrypted with AES-256-GCM and stored in Firestore (`google_calendar_connections`, `google_workspace_calendars`). Those collections are server-only. The client never sees the token or the ciphertext.

If `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_OAUTH_REDIRECT_URI` is missing, the screen says “Connect Google Calendar (not configured yet)”. Those three names were still missing on 22 Oct 2026. Download iCal and the signed subscription at `/api/calendar/ics/{token}` still work. Regenerate rotates the nonce so the previous link stops. `GET /api/calendar/ics` with no token is 404, a trailing slash 308s to that 404, and a token that does not match a feed is 404 with “This calendar link is not active.” None of these is a 500.

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
