# QA / QC

This file records the ET AI Timetabler check on `cursor/et-ai-timetabler-336c`. It does not sign the wider handover table.

| Check | Result |
| --- | --- |
| Solver unit tests on the Primary 2 and IGCSE seed | No teacher, room, student, room-type, capacity, availability, load, or campus hard violation. |
| Option blocks | Co-chosen subjects land in different blocks. One block reports the clashes. Approval creates sets and enrols the students. |
| Cover | A teacher on leave gets a qualified free cover teacher. Notices are built for the teacher, the students, and the parents. Cover load is counted. |
| Plain language | “Mr Chen can’t do Friday afternoons” blocks Friday P5 and P6 without a model key. |
| Publish | Calendar items are type `class`. Planner items are periods. Registers are unmarked. iCal exports. Rollback restores the version. Sample school-desk classes can be added from the feed. |
| Package | Teacher add-on is personal. Institution is the school week. Enterprise is multi-campus. Price stays TBC by Harry. |
| Playwright | `e2e/timetable.spec.ts` generates a week, rejects a clash and applies a free slot, approves cover, saves a student option, and opens the teacher, parent, and personal views. |
| Rules | `timetables` editors are institution admins and `timetable:edit`. Teachers, students, and parents read their own `people` view. Audit create only, no update or delete. Not deployed. |
| AI Studio | Teachers and school timetablers see the Timetabler tab, quick action, and tool card. A missing add-on shows an upsell. Students do not see the tab. |
| Studio chat | “Build the IGCSE timetable”, cover, Tuesday room clashes, and “add 2 more maths periods for Primary 5” produce a preview. Confirm writes the draft. Cancel leaves the week. |
| Photo | A photographed timetable is read from the image. The solver still runs with no model key. OpenRouter is only used when `OPENROUTER_API_KEY` is set. |
| Studio page | `/dashboard/studio/timetable` is the grid editor. The studio nav is not nested on that route. |
| Google Calendar | OAuth uses `calendar.events` and `calendar.readonly`. Refresh tokens stay encrypted in Firestore. Missing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_OAUTH_REDIRECT_URI` shows “Connect Google Calendar (not configured yet)” and leaves the iCal feed working. |
| Google Cloud Console | Enable the Calendar API. Consent screen scopes are `https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/calendar.readonly`. Redirect URIs are `https://poketschool.ai/api/google-calendar/callback` and the same path on the production domain. JavaScript origins are `https://poketschool.ai` and the production origin. No client secret is stored in git. |
| Google sync | The published week, approved cover, exams, assignment due dates, and planner events upsert by a stable id. A removed lesson is deleted. A second sync does not create a second copy. |
| Free/busy and leave | Free/busy is opt-in and becomes solver unavailability. A keyword or a chosen calendar flags leave for cover approval. It is not auto-applied. |
| School calendars | An admin imports the rooms calendar and the school events calendar as holidays, terms, and room holds. |
| Signed iCal | Each person can regenerate a subscription URL for Google, Apple, and Outlook without OAuth. |
| Not claimed | Live OpenRouter wording, production Firestore deploy, a live Google account, and the rest of the handover sign-off. |
