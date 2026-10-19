# QA / QC

Sign-off for PR 147. A row is Yes only when a named test passed or a screenshot from this preview shows the surface. A row is No when this pass did not see the feature work. Keys are named only when a live provider needs them. Screenshot files sit in the preview artifact folder.

| Feature | Yes or no | Evidence | Needs key |
| --- | --- | --- | --- |
| Sign-up schools | Yes | `e2e/signup-school.spec.ts` (independent or school join, teacher and parent choice, directory degrades, AI Book Creator named). Screenshot `signup-consents.png`. | `FIREBASE_SERVICE_ACCOUNT` for a live directory. Without it the directory response names that variable. |
| Consent defaults | Yes | Same sign-up test checks Demographic statistics consent, `[data-consent="timezone"]`, and Amber alerts start checked. `lib/consents.test.ts`. Screenshot `signup-consents.png`. | None |
| AI Book Creator previews | Yes | `e2e/books-preview.spec.ts` covers, previews, publishes, and finds the book on PoketReads. Screenshots `book-cover-preview.png`, `book-reader-preview.png`, `book-library-preview.png`, `book-student-preview.png`, `book-on-reads.png`. | `OPENROUTER_API_KEY` for ET generation. Manual write, cover, preview, and publish passed without it. |
| Admin desk | Yes | `e2e/roles.spec.ts` “admin opens the desk, signatures, AI Book Creator, and the blog” expects “Admin desk”. | `FIREBASE_SERVICE_ACCOUNT` for live KPIs. The emulator host makes the admin SDK configured, so this preview read the desk. |
| ET AI Studio chat, student | Yes | `e2e/studio-chat.spec.ts` “student composer sends, and mic and photo controls answer”. Screenshot `studio-student-reply.png`. The bubble is the empty-reply line when the model key is missing. | `OPENROUTER_API_KEY` |
| ET AI Studio mic, student | Yes | Same test clicks the mic and checks `data-voice-status`. Screenshot `studio-student-composer.png`. | None. Browser speech. |
| ET AI Studio photo, student | Yes | Same test attaches `public/blog/thumbs/igcse-revision-with-et-ai.webp` and checks `data-photo-pending`. Screenshot `studio-student-composer.png`. | `OPENROUTER_API_KEY` if the model should read the photo. Attach itself needs no key. |
| ET AI Studio header tabs, student | Yes | Same test clicks AI Teachers, ET Maths, ET Exams, ET Essays, and ET AI. Screenshot `studio-student-reply.png`. | None |
| ET AI Studio chat, teacher | Yes | `e2e/studio-chat.spec.ts` “teacher composer sends on the ET page”. Screenshot `studio-teacher-reply.png`. | `OPENROUTER_API_KEY` |
| ET AI Studio mic, teacher | Yes | Same teacher test. Screenshot `studio-teacher-composer.png`. | None |
| ET AI Studio photo, teacher | Yes | Same teacher test. Screenshot `studio-teacher-composer.png`. | `OPENROUTER_API_KEY` to have the model read the photo. |
| ET AI Studio header tabs, teacher | Yes | Same teacher test. Screenshot `studio-teacher-reply.png`. | None |
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

Counts: 23 yes, 1 no, 7 rows that name a key (`FIREBASE_SERVICE_ACCOUNT` on sign-up directory and the admin desk; `OPENROUTER_API_KEY` on book generation, student chat, student photo, teacher chat, and teacher photo).

## Checks run for this pass

- `npx eslint .` — 0 errors, 7 warnings, all `@firebase/security-rules/no-open-reads` in `firestore.rules` and `storage.rules`. Log `/tmp/qa-logs/eslint.log`.
- `npx tsc --noEmit` — exit 0. Log `/tmp/qa-logs/tsc.log`.
- Unit tests: `npx tsx --test` on 176 `lib/**/*.test.ts` files, excluding `tests/firestore.rules.test.ts`. 863 passed, 0 failed, 0 skipped. Log `/tmp/qa-logs/unit.log`. Rules tests were not run, because they clear the shared emulator.
- Playwright, CI-equivalent marketing walk with the credential guards and no emulator: `e2e/roles.spec.ts` “marketing pages from the landing footer answer” — 1 passed in 57.2s. This is the test that timed out on commit `26f961f`.
- Playwright on the emulator, one worker. Parent journey and teacher studio failed once when the dashboard bounced a restoring session and when the dev server restarted. After the 2.5s auth grace they passed (2 passed, 1.2m).
- Full suite against `next start` on port 3465 (`INSTITUTION_PREVIEW=1`, `SCOPE_PREVIEW=1`): 16 passed, 3 failed, 12.2m. Passed: placement, marketing, all five role journeys, all four sign-up tests, and every-route smoke for student, parent, teacher, institution admin, and super admin. Failed then: book preview (a book created while the saved list was still loading was replaced by a seed) and both studio sends (the cookie dialog covered Send). Studio retry after dismissing cookies: 2 passed, 37.1s. Book preview after keeping the new book: 1 passed, 39.8s.
- Every-route smoke on its own, same production server: 5 passed, 4.6m.
- Lighthouse on `http://127.0.0.1:3465/` (Next dev, not a production build), fetch `2026-10-19T07:19:18.064Z`. Performance 45, accessibility 93, best-practices 96, SEO 92. FCP 1.1s, LCP 39.6s, TBT 6300ms, CLS 0, speed index 2.6s. The LCP element is the cookie-consent paragraph. After warmup the homepage responded in under a second, so this LCP is dev-server work, not the earlier credential hang. JSON `/tmp/qa-logs/lighthouse.json`.
- `next build` on Next 15.5.15 flakes when Google Fonts returns an extension-less `/l/font?kit=` URL (`TypeError: Cannot read properties of null (reading '1')`). A rebuild that receives `.woff2` URLs succeeds. CI Playwright uses `next dev`, which falls back instead of failing the job. Firestore rules were not deployed.
