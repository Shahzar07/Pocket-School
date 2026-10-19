# E2E report

Playwright: `npm run test:e2e` (`e2e/signup-school.spec.ts`, `.github/workflows/e2e.yml`). No real credentials. The spec uses the local Next server and does not call production Firebase.

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

## Portraits and standalone studio (local emulator, 19 Oct 2026)

Signed in on `http://127.0.0.1:3466` with the Auth and Firestore emulators. Student `student.preview@poketschool.ai` (Amina Yusuf) and teacher `teacher.preview@poketschool.ai` (Ms Lee). Password was a local emulator password and is not a production credential.

| Check | Student | Teacher |
| --- | --- | --- |
| `/ai-teachers` photographic portraits | Pass (public page, distinct faces, no SVG) | Same public page |
| `/dashboard/studio` one sidebar, header tabs, centred prompt | Pass. `aside` count 1. Nested studio `aside` count 0. | Pass |
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
