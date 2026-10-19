# QA / QC

Sign-off for additions on PR 147. A row is signed only when a preview check or a named test passed. A missing key is named in the last column. This file records the course placement pass. Other areas stay unsigned until their own preview evidence is attached.

| Feature | Exists on main | Still present | Works on preview | Needs key |
| --- | --- | --- | --- | --- |
| Course placement previews | Placement page saved marketplace, featured, core, levels, and institutions. Featured was not drawn on any page. | Yes. `/dashboard/admin/placement` still saves those fields and now shows a live preview under each control. | Yes. `e2e/placement.spec.ts`. Screenshots: `featured-marketplace-hero.png`, `placement-year-hint.png`, `placement-live-previews.png`. | None |
| Featured carousel | `course.placement.featured` was stored and unused. Blog featured is unchanged. | Yes. Marketplace hero on `/courses` and `/dashboard/marketplace`, a row on the landing page and the student dashboard. | Yes. Same test. Hero shows cover, ET portrait, level, a stored rating (`ratingCount` 3 on the fixture), price, Buy and Enrol. Arrows, dots, and ArrowRight move the slide. `prefers-reduced-motion` sets `data-motion="reduce"` and skips autoplay. Also `featured-landing-row.png`, `featured-dashboard-market.png`, `featured-student-dashboard.png`. | None |
| Featured priority, dates, books, bundles | Not stored. | Priority, start, and end are saved. A published PoketReads book and a bundle can join the same carousel with a type badge. | Yes. Fixture priority 40 stays in front of priority 10. Harbour Notes is a featured book. Science pack is a bundle. | None |
| Featured impressions and clicks | Not stored. | `featured_stats/{kind:id}` aggregate counters. The placement page shows them. Rules allow a single increment. Not deployed. | Counter write is in the carousel. The placement page reads the totals. A live increment was not required for the screenshot pass. | None |
| Placement data QC | Course and institution lists were not deduped. | List is deduped by id, with owner, institution, date, and status. Same titles can be merged without deleting the course. Institutions with the same name and domain collapse to one checkbox and flag the extra record. Year-number titles suggest a level name and rename only when the admin confirms. | Yes. Biology 101 stays two rows. Rochford's International School is flagged once. `Physics — Year 11` suggests `Physics — IGCSE` and is not renamed by itself. | None |

## Checks run for this pass

- `npx tsx --test lib/courses/placement.test.ts lib/institution-commerce.test.ts` — 13 passed.
- `npx tsc --noEmit` — passed.
- `npx tsx --test lib/i18n/hardcoded-ui.test.ts` — passed.
- `e2e/placement.spec.ts` with `E2E_EMULATOR=1` against the preview on port 3466 — passed.
- Firestore rules were loaded on the local emulator only. They were not deployed.
