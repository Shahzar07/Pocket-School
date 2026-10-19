Sign-off for Shahzar as of `main` `f9d395cb84d904c123b77abb599eea441e934bd8` (#151, which includes #147 and #148). A row is Yes only when a named test passed or a screenshot shows the surface. A row is No when the feature was not seen working. Keys are names only. The #147 and #148 tables below are the earlier preview evidence. The production table is the 19 Oct 2026 smoke of `f9d395c` on the live alias.

| Feature | Yes or no | Evidence | Needs key |
| --- | --- | --- | --- |
| Sign-up schools | Yes | `e2e/signup-school.spec.ts` (independent or school join, teacher and parent choice, directory degrades, AI Book Creator named). Screenshot `signup-consents.png`. | `FIREBASE_SERVICE_ACCOUNT` for a live directory. Without it the directory response names that variable. |
| Consent defaults | Yes | Same sign-up test checks Demographic statistics consent, `[data-consent="timezone"]`, and Amber alerts start checked. `lib/consents.test.ts`. Screenshot `signup-consents.png`. | None |
| AI Book Creator previews | Yes | `e2e/books-preview.spec.ts` covers, previews, publishes, and finds the book on PoketReads. Screenshots `book-cover-preview.png`, `book-reader-preview.png`, `book-library-preview.png`, `book-student-preview.png`, `book-on-reads.png`. | `OPENROUTER_API_KEY` for ET generation. Manual write, cover, preview, and publish passed without it. |
| Admin desk | Yes | `e2e/roles.spec.ts` “admin opens the desk, signatures, AI Book Creator, and the blog” expects “Admin desk”. | `FIREBASE_SERVICE_ACCOUNT` for live KPIs. The emulator host makes the admin SDK configured, so this preview read the desk. |
| ET AI Studio chat, student | Yes | `e2e/studio-chat.spec.ts` “student composer sends, and mic and photo controls answer”. Screenshot `studio-student-reply.png`. The bubble is the empty-reply line when the model key is missing. | `OPENROUTER_API_KEY` |
| ET AI Studio mic, student | Yes | Same test clicks the mic and checks `data-voice-status`. Screenshot `studio-student-composer.png`. | None. Browser speech. |
| ET AI Studio photo, student | Yes | Same test attaches `public/blog/thumbs/igcse-revision-with-et-ai.webp` and checks `data-photo-pending`. Screenshot `studio-student-composer.png`. | `OPENROUTER_API_KEY` if the model should read the photo. Attach itself needs no key. |
| ET AI Studio tool hops, student | Yes | Same test opens AI Teachers, ET Maths, ET Exams, ET Essays, and ET AI. On #151 those hops are the dark sidebar and the empty-state chips. Screenshot `studio-dark-student-reply.png`. | None |
| ET AI Studio chat, teacher | Yes | `e2e/studio-chat.spec.ts` “teacher composer sends on the ET page”. Screenshot `studio-teacher-reply.png`. | `OPENROUTER_API_KEY` |
| ET AI Studio mic, teacher | Yes | Same teacher test. Screenshot `studio-teacher-composer.png`. | None |
| ET AI Studio photo, teacher | Yes | Same teacher test. Screenshot `studio-teacher-composer.png`. | `OPENROUTER_API_KEY` to have the model read the photo. |
| ET AI Studio tool hops, teacher | Yes | Same teacher test. On #151 those hops are the dark sidebar and the empty-state chips. Screenshot `studio-dark-teacher.png`. | None |
| Teacher portraits | Yes | Marketing walk screenshots `/ai-teachers` to `teacher-portraits.png`. `lib/teacher-portrait.test.ts`. | None |
| Blog images | Yes | `lib/blog/images.test.ts`. The admin journey opens `/dashboard/admin/blog` and expects the Blog heading. A new cover upload was not repeated in this pass. | None for the page. Production uploads still need deployed Storage rules. |
| School wall | No | No post was made. `wallNotice` in `lib/wall/live.ts` is the permission copy, and it has no test in this pass. | None. Production reads stay blocked until Firestore rules are deployed. |
| Landing v3 | Yes | `e2e/roles.spec.ts` “marketing pages from the landing footer answer” checks `data-landing="v3"`. Screenshot `landing-v3.png`. | None |
| Copyright e-sign | Yes | Teacher journey shows `[data-copyright-sign="1"]`. Screenshot `esign-course.png`. Admin signatures page: `esign-admin.png`. A new signature document was not created in this pass. | None |
| Planner | Yes | Student, parent, and admin boards: `planner-student.png`, `planner-parent.png`, `planner-admin.png`. Teacher journey expects `[data-planner-view="month"]`. A drag-and-drop was not clicked. | None |
| Private classrooms | Yes | Teacher classes page shows “Who can join”. Screenshot `private-classroom.png`. Join route `/join/class/[code]` is in the smoke list. A student self-enrol click was not completed. | None |
| Course placement previews | Yes | `e2e/placement.spec.ts`. Screenshots `placement-live-previews.png`, `placement-year-hint.png`. | None |
| Featured carousel | Yes | Same test. Screenshots `featured-marketplace-hero.png`, `featured-landing-row.png`, `featured-dashboard-market.png`, `featured-student-dashboard.png`. | None |
| Featured priority, dates, books, bundles | Yes | Same test. Fixture priority 40 stays in front of priority 10. Harbour Notes is a featured book. Science pack is a bundle. | None |
| Featured impressions and clicks | Yes | Counters are written by the carousel and read on the placement page. A live increment was not required for the screenshot. Rules for the client increment are not deployed. | None |
| Placement data QC | Yes | Same test. Biology 101 stays two rows. Rochford's International School is flagged once. `Physics — Year 11` suggests `Physics — IGCSE` and is not renamed by itself. | None |
| Gated preview galleries | Yes | `e2e/roles.spec.ts` “gated preview galleries answer when the preview flags are set”. `/preview/scope-c` and `/preview/institution-console` render when `SCOPE_PREVIEW=1` and `INSTITUTION_PREVIEW=1`. A production start without those flags still returns not-found. | None |

Counts: 24 yes, 1 no, 7 rows that name a key (`FIREBASE_SERVICE_ACCOUNT` on sign-up directory and the admin desk; `OPENROUTER_API_KEY` on book generation, student chat, student photo, teacher chat, and teacher photo).

## Checks run for this pass

- `npx eslint .` — 0 errors, 7 warnings, all `@firebase/security-rules/no-open-reads` in `firestore.rules` and `storage.rules`. Log `/tmp/qa-logs/eslint.log`.
- `npx tsc --noEmit` — exit 0. Log `/tmp/qa-logs/tsc.log`.
- Unit tests: `npx tsx --test` on 176 `lib/**/*.test.ts` files, excluding `tests/firestore.rules.test.ts`. 863 passed, 0 failed, 0 skipped. Log `/tmp/qa-logs/unit.log`. Rules tests were not run, because they clear the shared emulator.
- Playwright, CI-equivalent marketing walk with the credential guards and no emulator: `e2e/roles.spec.ts` “marketing pages from the landing footer answer” — 1 passed in 57.2s. This is the test that timed out on commit `26f961f`.
- Gated galleries: the same file’s “gated preview galleries answer when the preview flags are set” opens `/preview/scope-c` and `/preview/institution-console`. The Playwright server sets `SCOPE_PREVIEW=1` and `INSTITUTION_PREVIEW=1`.
- Playwright on the emulator, one worker. Parent journey and teacher studio failed once when the dashboard bounced a restoring session and when the dev server restarted. After the 2.5s auth grace they passed (2 passed, 1.2m).
- Full suite against `next start` on port 3465 (`INSTITUTION_PREVIEW=1`, `SCOPE_PREVIEW=1`): 16 passed, 3 failed, 12.2m. Passed: placement, marketing, all five role journeys, all four sign-up tests, and every-route smoke for student, parent, teacher, institution admin, and super admin. Failed then: book preview (a book created while the saved list was still loading was replaced by a seed) and both studio sends (the cookie dialog covered Send). Studio retry after dismissing cookies: 2 passed, 37.1s. Book preview after keeping the new book: 1 passed, 39.8s.
- Every-route smoke on its own, same production server: 5 passed, 4.6m.
- Lighthouse on `http://127.0.0.1:3465/` (Next dev, not a production build), fetch `2026-10-19T07:19:18.064Z`. Performance 45, accessibility 93, best-practices 96, SEO 92. FCP 1.1s, LCP 39.6s, TBT 6300ms, CLS 0, speed index 2.6s. The LCP element is the cookie-consent paragraph. After warmup the homepage responded in under a second, so this LCP is dev-server work, not the earlier credential hang. JSON `/tmp/qa-logs/lighthouse.json`.
- `next build` on Next 15.5.15 flakes when Google Fonts returns an extension-less `/l/font?kit=` URL (`TypeError: Cannot read properties of null (reading '1')`). A rebuild that receives `.woff2` URLs succeeds. CI Playwright uses `next dev`, which falls back instead of failing the job. Firestore rules were not deployed.

## ET AI Timetabler and Google Calendar

These rows are for this add-on on top of the handover table above. A row is key-blocked when a live Google client or a Firestore rules deploy is required before the check can pass. The price stays TBC by Harry.

| Feature | Yes, no, or key-blocked | Evidence | Needs key |
| --- | --- | --- | --- |
| Auto-built timetable | Yes | Emulator, institution admin, 2026-10-19. Generate built a week of lessons. Screenshot `timetable-built.png`. | None |
| Clash fix | Yes | Same session. Two lessons for one teacher in one slot showed the blocked panel, then Fix cleared it. Screenshot `timetable-clash.png`. | None |
| Cover suggestion | Yes | Absent on 2026-10-19. Mrs Lim's lesson proposed Mr Rahman. Screenshot `timetable-cover.png`. | None |
| Teacher dashboard | Yes | Teacher sidebar button ET AI Timetabler opens `/dashboard/teacher/timetable`. | None |
| Institution and Enterprise admin | Yes | Institution admin with `package:enterprise` opens `/dashboard/institution/timetable` and shows `data-edition="enterprise"`. | None |
| AI Studio entry | Yes | Studio home stays the ET AI chat and shows the Timetabler link for a teacher. A student does not see it. Screenshot `timetable-studio-entry.png`. | None |
| Price stays TBC | Yes | `TIMETABLER_PRICE_NOTE` is `TBC by Harry`. `/pricing` shows that line. | None |
| Calendar without Google keys | Yes | No Google env. The desk stays `data-google-state="unconfigured"`, the iCal file downloads, and the signed subscription feed returns `BEGIN:VCALENDAR` with no page errors. | None for the iCal path. Live OAuth needs the Google keys. |
| Google Calendar OAuth sync | key-blocked | Connect and sync need a Google client. Not run. | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` |
| Timetable Firestore rules | key-blocked | Rules are in git and were not deployed. The edited week is in `localStorage` (`poket-timetable-v1`). | Firestore rules deploy |

## Production smoke of `f9d395c`, 19 Oct 2026

Alias https://pocket-school-ochre.vercel.app. Deployment `dpl_14rQsk7dNuwsVEwsrWhBCVnP1VE6`, state READY, commit `f9d395cb84d904c123b77abb599eea441e934bd8`.

| Feature | Yes, no, or key-blocked | Evidence | Needs key |
| --- | --- | --- | --- |
| Marketing walk on production | Yes | `e2e/roles.spec.ts` “marketing pages from the landing footer answer”, `E2E_EMULATOR=1`, 1 passed. `data-landing="v3"`. | None |
| Home, about, studio, login | Yes | 200 and a visible heading. Screenshot `prod-home.png`. | None |
| Blog | Yes for the page. Content pending | 200, “The journal”, drafts still unpublished. Screenshot `prod-blog.png`. | None for the empty page. Publishing is an admin action. |
| Marketplace listings | Yes | `/courses` rendered 9 public items. | None |
| Featured carousel on production | No | `#featured` was empty. The preview fixture still passes. No live course is marked featured. | None. Admin marks Featured spot. |
| Signed-out studio home | Yes | `/dashboard/studio` first response 200, then `/login`. `/ai-studio` is 307 to `/dashboard/studio`, then `/login`. No page error. | None |
| Signed-out timetable routes | Yes | Teacher, institution, student, and parent: 307 then `/login`. Admin timetable: `/admin/login`. Studio timetable: shell then `/login`. No 500. | None |
| Calendar feed with no token | Yes | `GET /api/calendar/ics` is 404. A trailing slash 308s to that path. A bad token is 404 with “This calendar link is not active.” | None |
| Timetabler price | Yes | Still `TBC by Harry`. Do not invent a number. | None |
| Timetable Firestore persistence | No | The edited week is still `localStorage` (`poket-timetable-v1`). A production Firestore write is a TODO. | Firestore rules deploy, then the write itself. |

## Earlier production smoke of `de07f29`, 19 Oct 2026

Alias https://pocket-school-ochre.vercel.app at that time. Deployment `dpl_3oPXzYfPsmmboz57ZWERLteTDhHL`, state READY, commit `de07f29`. Kept as the record of that deploy. The current alias is the `f9d395c` table above.

| Feature | Yes, no, or key-blocked | Evidence | Needs key |
| --- | --- | --- | --- |
| Marketing walk on production | Yes | `e2e/roles.spec.ts` “marketing pages from the landing footer answer”, 1 passed. `data-landing="v3"`. | None |
| Home, about, studio, login | Yes | 200 and a visible heading. Screenshot `prod-home.png`. | None |
| Blog | Yes for the page. Content pending | 200, “The journal”, six drafts unpublished. Cover WebP files 200. Screenshot `prod-blog.png`. | None for the empty page. Publishing is an admin action. |
| Marketplace listings | Yes | `/courses` rendered 9 public items. | None |
| Featured carousel on production | No | `#featured` was empty. The preview fixture still passes. No live course is marked featured. | None. Admin marks Featured spot. |
| Signed-out timetable routes | Yes | Teacher, institution, student, and parent: 307 then `/login`. Admin timetable: `/admin/login`. Studio timetable: shell then `/login`. No 500. | None |
| Calendar feed with no token | Yes | `GET /api/calendar/ics` is 404. A bad token is 404 with “This calendar link is not active.” | None |
| Timetabler price | Yes | Still `TBC by Harry`. Do not invent a number. | None |

## Keys on the Vercel project

Names only, checked 19 Oct 2026. The per-environment table (set or missing on production, preview, and development) is in `HANDOVER.md` under Start here. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is the only name set on all three. `DASHBOARD_SESSION_SECRET`, `OTP_SECRET`, and `SUPER_ADMIN_EMAILS` are production only. `FIREBASE_SERVICE_ACCOUNT` is missing on every target. Firestore rules are not deployed. Firebase Blaze was not verified. `poketschool.ai` is not a project domain.

Admin actions still open: publish the six blog drafts, mark featured courses, merge duplicate course titles and duplicate institution records. The edited timetable week is still browser storage. The timetabler price stays TBC by Harry. The go-live order is `FINAL_AUDIT.md` section 9.

## Dark AI Studio layout

#151. The signed-in home at `/dashboard/studio` and `/ai-studio` (redirect) is the dark ET AI chat at full viewport height. The light dashboard sidebar and top bar stay off this page. Cyan `#3FE0D0` with `#203337` ink. No gold. Dashboard sits above New chat and returns students to `/dashboard`, teachers to `/dashboard/teacher`, parents to `/dashboard/parent`, institution admins to `/dashboard/institution`, platform admins to `/dashboard/admin`, and partners to `/dashboard/partner`. Back to Poket School stays at the bottom. The light card list stays behind All tools. Nothing from the previous studio was removed.

| Feature | Yes, no, or key-blocked | Evidence | Needs key |
| --- | --- | --- | --- |
| Dark studio chat, student and teacher | Yes | `e2e/studio-chat.spec.ts` checks `data-studio-layout="dark"`, `data-studio-immersive="1"`, the message box, a reply, and Read aloud. Screenshots `studio-dark-desktop-1440.png`, `studio-dark-student-empty.png`, `studio-dark-student-reply.png`, `studio-dark-teacher.png`. | `OPENROUTER_API_KEY` for a model answer. The empty-reply line still shows without it. |
| Dashboard home | Yes | Same spec. Dashboard is the first sidebar link. Student href `/dashboard`. Teacher href `/dashboard/teacher`. | None |
| Mic, attach, photo, Upload photo | Yes | Same spec. Mic sets `data-voice-status`. Attach and Upload photo use the photo input. Photo attached and Remove photo. Screenshot `studio-dark-photo.png`. | None for the controls. |
| Sidebar tools | Yes | Same spec, one navigation named AI Studio: Dashboard, New chat, Chats, Library, then AI Teachers, ET + Subject, ET Maths, ET Exams, ET Essays, Book Studio, Planner, Calendar, All tools. ET AI, PoketReads, AI Book Creator, and Creator Store are the empty-state chips and the All tools cards, not a second copy in that list. | None |
| Timetabler entry | Yes | Teacher sees Timetabler in the dark sidebar and `data-studio-entry="timetable"`. A student does not. | None |
| Role desks | Yes | Teacher Toolkit for the teacher. Research Helper for student and teacher. Parent Explainer for neither of those roles. | None |
| Mobile sidebar | Yes | 390px width. Dashboard is in the tools row. Open ET AI menu opens the dark sidebar. Screenshot `studio-dark-mobile-sidebar.png`. | None |
| Pip and theme | Yes | Pip is inside the dark studio essentials (`Open the guided tour`). The studio canvas stays dark when the site theme is light (`data-studio-theme="dark-default"`). | None |
