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
