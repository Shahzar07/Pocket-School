# Roadmap

Shipped on this branch: shared `deviceTokens` rules and push delivery, the DailyGoal contract, a Books nav hook for Poket Reads, role checklists, and the schema note in `docs/SCHEMA_CHANGES.md`.

Still to do:

- Email digests and a scheduled push digest. The push sender exists (`sendDigest`, category `digests`). Nothing sends mail, and nothing runs on a clock yet.
- Referral programme UI.
- Spaced repetition and an AI study planner.
- Lesson discussion and Q&A.
- A full WCAG AA audit. The skip target and checklist are a start.
- Per-role analytics rebuilt from server data. Revenue still comes from the course-page enrol amount.
- True SSR or ISR of Firebase pages. Public pages are client components because there is no Admin SDK in the browser data path. Push delivery is the first Admin SDK use, and it needs `FIREBASE_SERVICE_ACCOUNT`.
- Dual-currency display. That work is still in the git stash `wip dual price and daily rates` and is not part of this branch.
- Poket Reads catalogue, reader, and studio. Those belong to the Reads agent. This branch only leaves `/reads`, `alloc:book:{id}`, USD `quoteBook`, and `editionFor`.
- Firestore rules deploy, including `deviceTokens`. The file is in the repo. Production does not enforce it until an owner deploys it.
- Lighthouse 90+ on the marketing pages. Measure a production build, not the dev server. The landing footer video is already off the first paint path.
