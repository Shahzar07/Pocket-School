# E2E report

For Shahzar. No secret values. Playwright: `npm run test:e2e` (`.github/workflows/e2e.yml`). Local specs do not call production Firebase.

## Full-page AI shell (local emulator, this pull request)

`e2e/studio-chat.spec.ts` against a Next dev server with `NEXT_PUBLIC_FIREBASE_EMULATORS=1`, Auth on `9099`, Firestore on `8080`, and Storage on `9199`. `E2E_EMULATOR=1` and `E2E_PREVIEW_PASSWORD` were set for the signed-in tests. The password stays out of git.

GitHub Actions runs the same file without the emulators, so the signed-in tests skip there. The public test and the signed-out studio test still run. Playwright on this pull request is green.

| Test | Result |
| --- | --- |
| Signed-out `/dashboard/studio` leaves the spinner and opens `/login` | Passed |
| Student composer sends, mic and photo answer, tool hops | Passed |
| Teacher composer on `/dashboard/studio/et` | Passed |
| Student and teacher studio homes show chat, mic, and attach | Passed |
| Dark layout, student, including 390px sidebar | Passed. `scrollWidth` of the top-right cluster stays within `clientWidth`. |
| Dark layout, teacher, teachers grid, ET Science chat | Passed |
| Theme toggle persists light, including a 390px studio shot | Passed |
| One tool per role in dark and light | Passed on a rerun. The first full-suite attempt lost the dev server with `ERR_CONNECTION_REFUSED` on `/dashboard/parent/planner` (the process was out of memory). The rerun of that test passed in 1.5m. |
| Public `/ai-teachers` and `/reads/studio` in both themes | Passed. Book preview uses `[data-book-preview="1"]`. |

`lib/studio/tool-inventory.test.ts`: 3 passed.

Screenshots: `studio-dark-desktop-1440.png`, `studio-light-desktop.png`, `studio-light-mobile.png`, `studio-top-right-no-scrollbar.png`, `book-studio-dark-desktop.png`, `book-studio-dark-mobile.png`, `book-studio-light-desktop.png`, `ai-teachers-grid-dark-desktop.png`, `ai-teacher-chat-dark-desktop.png`, `ai-teachers-chat-dark-mobile.png`, `ai-teachers-dark-desktop.png`, `ai-teachers-light-desktop.png`, `ai-teachers-light-mobile.png`, `ai-tools-contact-sheet.png`.

## Production, `main` `f9d395c` (19 Oct 2026)

Deployment `dpl_14rQsk7dNuwsVEwsrWhBCVnP1VE6` is READY and aliased to https://pocket-school-ochre.vercel.app. Commit `f9d395cb84d904c123b77abb599eea441e934bd8` (squash of #151).

`e2e/roles.spec.ts` “marketing pages from the landing footer answer” with `PLAYWRIGHT_BASE_URL` set to that origin and `E2E_EMULATOR=1` (so Playwright does not start a local server): **1 passed**. The walk covers `/`, `/ai-teachers`, `/studio`, `/reads`, `/safeline`, `/id`, `/primary`, `/igcse`, `/alevel`, `/llb`, `/mbbs`, `/independent`, `/institutions`, `/institutions/register`, `/demo`, `/about`, `/rochfords`, `/privacy`, `/terms`, and `/signup?plan=primary`. Each response is below 400 and the first `h1` is visible. The homepage has `data-landing="v3"`, and that block does not contain `#c8820a` or “Years 1”.

| Route | Signed out | Result |
| --- | --- | --- |
| `/`, `/about`, `/studio`, `/login` | Public | 200, heading visible, no page error |
| `/blog` | Public | 200. “The journal”. The six drafts are still unpublished |
| `/courses` | Public | 200. Nine listings. `#featured` is empty |
| `/dashboard/studio` | Shell, then login | First response 200. Lands on `/login`. No page error |
| `/ai-studio` | Redirect, then login | 307 to `/dashboard/studio`, then `/login`. No page error |
| `/dashboard/admin/books` | Gated | 307 to session, then `/admin/login` |
| `/dashboard/admin/placement` | Gated | 307 to session, then `/admin/login` |
| Teacher, institution, student, parent timetable | Gated | 307 to `/dashboard/session?next=…`, then `/login` |
| `/dashboard/admin/timetable` | Gated | 307, then `/admin/login` |
| `/dashboard/studio/timetable` | Gated in the shell | First response 200. Lands on `/login`. No page error |
| `GET /api/calendar/ics` (no token) | Public | 404, not 500. A trailing slash 308s first. A bad token is 404 with “This calendar link is not active.” |

Screenshots from this pass: `prod-home.png`, `prod-blog.png`, `prod-courses.png`.

## Earlier production, `main` `de07f29` (19 Oct 2026)

At the time of that smoke, deployment `dpl_3oPXzYfPsmmboz57ZWERLteTDhHL` was READY and aliased to https://pocket-school-ochre.vercel.app. The alias now serves `f9d395c`.

`e2e/roles.spec.ts` “marketing pages from the landing footer answer” with `PLAYWRIGHT_BASE_URL` set to that origin and `E2E_EMULATOR=1` (so Playwright does not start a local server): **1 passed**. The walk covers `/`, `/ai-teachers`, `/studio`, `/reads`, `/safeline`, `/id`, `/primary`, `/igcse`, `/alevel`, `/llb`, `/mbbs`, `/independent`, `/institutions`, `/institutions/register`, `/demo`, `/about`, `/rochfords`, `/privacy`, `/terms`, and `/signup?plan=primary`. Each response is below 400 and the first `h1` is visible. The homepage has `data-landing="v3"`, and that block does not contain `#c8820a` or “Years 1”.

| Route | Signed out | Result |
| --- | --- | --- |
| `/`, `/about`, `/studio`, `/login` | Public | 200, heading visible, no page error |
| `/blog` | Public | 200. “The journal”. The six drafts are still unpublished. Cover WebP files return 200 |
| `/courses` | Public | 200. Nine listings. Featured region empty |
| `/dashboard/admin/books` | Gated | 307 to session, then `/login` |
| `/dashboard/admin/placement` | Gated | 307 to session, then `/admin/login` |
| Teacher, institution, student, parent timetable | Gated | 307 to `/dashboard/session?next=…`, then `/login` |
| `/dashboard/admin/timetable` | Gated | 307, then `/admin/login` |
| `/dashboard/studio/timetable` | Gated in the shell | Lands on `/login`. No page error |
| `GET /api/calendar/ics` (no token) | Public | 404, not 500. A bad token is also 404 |

Screenshots from this pass: `prod-home.png`, `prod-blog.png`, `prod-courses.png`.

## Earlier local runs

The notes below are local emulator or local Next runs. They are not the production smoke above.

Latest local run: **4 passed** (student school choice and blue panel, teacher and parent copy, directory degrade, AI Book Creator route). The dev server is started with `DISABLE_HMR=true` so trace output does not rebuild the app mid-test.

| Journey | Result | Notes |
| --- | --- | --- |
| Student sign-up, independent vs join my school | Covered | Buttons, search, “My school isn’t listed”, blue auth panel. |
| Student school request approved by the institution | Partial | Server path is `POST /api/institutions/membership` and the approvals page. A full emulator seed of approve-then-enrol is not in this Playwright file. Unit coverage: `lib/institutions/public-directory.test.ts` (`membershipOutcome`). |
| Invite code auto-approve | Partial | `lookupInviteCode` plus `membershipOutcome`. Playwright does not redeem a live code. |
| Teacher and parent school choice | Covered | Same picker, staff vs parent copy. |
| Directory without Admin SDK | Covered | `GET /api/institutions/directory` returns an empty list and a setup message. |
| AI Book Creator route | Covered | `/dashboard/admin/books` responds below 500 when signed out (redirect or page, not a crash). |
| Student lesson, quiz, assignment, goal, wall, RSVP | Open | Not in this Playwright file. |
| Parent grades and reports | Open | Not in this Playwright file. |
| Teacher classroom, gradebook, copyright signature | Open | Not in this Playwright file. |
| Institution onboarding and ID cards | Open | Approvals page is wired; the rest of the institution journey is not in this file. |
| Admin queues, blog, planner, declarations | Open | Admin desk auth-first is implemented. Browser journeys are not in this file. |

Do not treat an open row as a pass.

## Portraits and standalone studio (local emulator, 19 Oct 2026, before #151)

This table is a local run from before the full-screen studio. It is a historical record. The current signed-in home is the full-page shell in dark and light. See `QA_QC.md`, “Dark AI Studio layout” and “Full-page shell on every AI tool”.

Signed in on `http://127.0.0.1:3466` with the Auth and Firestore emulators. Student `student.preview@poketschool.ai` (Amina Yusuf) and teacher `teacher.preview@poketschool.ai` (Ms Lee). Password was a local emulator password and is not a production credential.

| Check | Student | Teacher |
| --- | --- | --- |
| `/ai-teachers` photographic portraits | Pass (public page, distinct faces, no SVG) | Same public page |
| `/dashboard/studio` one sidebar and header tabs | Historical pass, from before the full-screen shell. The current home is the full-page shell. | Historical pass |
| `/dashboard/studio/teachers` a face on every card | Pass. 35 `ET ` images. No `/teachers/` 404. | Pass. 35 faces. |
| `/dashboard/studio/et` portrait in the chat header | Pass. 1 header face. | Pass |
| Student dashboard teacher picker | Pass. 12 faces. | Not the student home |

Screenshots: `ai-teachers-after.png`, `studio-student-after.png`, `studio-teachers-student-after.png`, `studio-et-student-after.png`, `student-picker-after.png`, `studio-teacher-after.png`, `studio-teachers-teacher-after.png`, `studio-et-teacher-after.png`.

## Blog images (local emulator, 19 Oct 2026)

Signed in as `harry@poketschool.ai` (super admin) on `http://127.0.0.1:3466` with Auth, Firestore, and Storage emulators. Uploaded `/tmp/cover-upload.png` on `/dashboard/admin/blog`, set alt text “Blue test banner for the essay”, and published “Banner check essay”.

| Check | Result |
| --- | --- |
| Editor live preview, replace path, alt text, publish | Pass. Toast “Image saved.” then “Published.” |
| `/blog` card | Pass. Thumbnail, title, excerpt, date, and reading time. |
| `/blog/banner-check-essay` hero | Pass. Full-width banner, title on the blue overlay. |
| `og:image` and `twitter:image` | Pass. Both point at the Storage cover (`blog/banner-check-essay/cover-*.webp` on the emulator). No 4xx on `/blog` or Storage. |
| Seed covers | Pass as files. Branded WebP in `public/blog/`, no photographs of people. |
| Branded fallback route | Pass by curl. `/blog/igcse-revision-with-et-ai/opengraph-image` returned `image/png` 1200×630. Posts that already have a cover use that cover in metadata and do not leave `images` unset. |

Screenshots: `blog-editor-cover.png`, `blog-editor-published.png`, `blog-index-cover.png`, `blog-post-hero.png`.

The Playwright file still does not drive this journey. Do not treat the admin blog row above as a Playwright pass.
