# Remaining work

Status as of 15 Oct 2026. The canonical base for every stacked agent is `cursor/clarity-security-sparks-f0ff`. `cursor/integrated-preview-f0ff` is the same tip until a later commit splits them. Sunday testing uses `TESTING.md`.

| Work | Status |
|---|---|
| Role lockdown, Sparks, and the master-brief alignment | In the preview via the later rules and PR #52's lineage inside Poket Reads |
| Language packs | Merged from draft PR #57 |
| Admin-managed USD pricing | Merged from draft PR #58. Charged prices live in `lib/pricing.ts` |
| Dual-currency display (USD plus local, daily rates) | Not in this branch. Stash `wip dual price and daily rates` on `cursor/dynamic-pricing-f0ff` is unfinished and must be kept |
| Allocation, OEM academies | Multi-select target list on courses, books, academies, announcements, and the calendar. Any matching target can see the item. |
| Multi-role accounts | One login can hold learner, teacher, and parent. The header and account menu switch Learning, Teaching, and Parent view, remember the last mode, and open that dashboard. Teachers and parents have a personal learner space. Become an instructor does not publish to the marketplace. Admin stays on `/admin/login` with a verification code. Rules still need an owner deploy |
| Profile and settings | My profile & settings is in the account menu for every role, including parents. Photo, password, language, currency, notifications, privacy, export, and a 14-day deletion grace period stay on that page. Parents also link children by invite code or the child's approval, edit under-13 profiles, and set weekly reports, screen time, Sparks limits, purchase approval, teacher-message preferences, and a payment method (last four digits). Firestore rules for these fields still need an owner deploy |
| Product access audiences | Merged from draft PR #60 |
| Device tokens, goals hooks, Books hooks | Merged from draft PR #61 |
| Buzan maps, downloads, shared editor and media | Merged from draft PR #62 |
| Admin console, three super admins, MFA | Merged from draft PR #63. MFA needs SMTP |
| Teacher course studio | Merged from draft PR #64. Signed-in Firestore writes were not browser-tested. Rules need an owner deploy |
| Poket Reads catalogue, reader, studio | Merged from draft PR #55, including the wallet checkout commit. Book and Reads purchases use `POST /api/stripe/create-checkout`. Add-ons use the admin price table. Touch 'n Go is still session metadata. XP, badges, streaks, community win posts, and the Cache API download stay local until those agents land |
| Payments, wallet, subscriptions, integrations config | Not merged. Agent https://cursor.com/agents/bc-33e2d362-a376-5efe-ab4d-91ab3617b08c had no branch yet |
| Goals, analytics, Bloom's, behaviour, attendance, reports, integrity, calendar | Not merged. Agent https://cursor.com/agents/bc-0e18e888-9c3a-5fa9-84c3-f2e7e5eb53a7 had no branch yet |
| Community, age tiers, tutor marketplace, exam centre, resource store, snap-and-solve | Merged from `cursor/community-tutor-exam-de9a`. Age tiers, spaces, posts, and adult-only DMs are in `firestore.rules`. Tutor charges still use `lib/wallet.ts` `stubWallet` until the payments branch replaces `getWallet()`. User profiles stay readable by any signed-in person so class dashboards can load a name |
| QA accounts in live Firebase | Script `scripts/seed-test-accounts.ts` is ready. It was not run here because `FIREBASE_SERVICE_ACCOUNT` is not set |
| Firestore rules deploy | Owner deploy still required before production enforces this file |
