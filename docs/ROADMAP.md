# Remaining work

Status as of 15 Oct 2026, on `cursor/integrated-preview-f0ff`. Sunday testing uses `TESTING.md`.

| Work | Status |
|---|---|
| Role lockdown, Sparks, and the master-brief alignment | In the preview via the later rules and PR #52's lineage inside Poket Reads |
| Language packs | Merged from draft PR #57 |
| Admin-managed USD pricing | Merged from draft PR #58. Charged prices live in `lib/pricing.ts` |
| Dual-currency display (USD plus local, daily rates) | Not in this branch. Stash `wip dual price and daily rates` on `cursor/dynamic-pricing-f0ff` is unfinished and must be kept |
| Allocation, OEM academies | Merged from draft PR #59 |
| Product access audiences | Merged from draft PR #60 |
| Device tokens, goals hooks, Books hooks | Merged from draft PR #61 |
| Buzan maps, downloads, shared editor and media | Merged from draft PR #62 |
| Admin console, three super admins, MFA | Merged from draft PR #63. MFA needs SMTP |
| Teacher course studio | Merged from draft PR #64. Signed-in Firestore writes were not browser-tested. Rules need an owner deploy |
| Poket Reads catalogue, reader, studio | Merged from draft PR #55 |
| Payments, wallet, subscriptions, integrations config | Not merged. Agent https://cursor.com/agents/bc-33e2d362-a376-5efe-ab4d-91ab3617b08c had no branch yet |
| Goals, analytics, Bloom's, behaviour, attendance, reports, integrity, calendar | Not merged. Agent https://cursor.com/agents/bc-0e18e888-9c3a-5fa9-84c3-f2e7e5eb53a7 had no branch yet |
| Community, age tiers, tutor marketplace, exam centre, resource store, snap-and-solve | Not merged. Agent https://cursor.com/agents/bc-c81088ed-5201-53e7-ab82-87472894de9a had no branch yet. No `tutor` role yet |
| QA accounts in live Firebase | Script `scripts/seed-test-accounts.ts` is ready. It was not run here because `FIREBASE_SERVICE_ACCOUNT` is not set |
| Firestore rules deploy | Owner deploy still required before production enforces this file |
