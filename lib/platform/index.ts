/**
 * Seams between Poket Reads and the shared platform.
 *
 * PR #52 (`cursor/clarity-security-sparks-f0ff`) is the base of this branch.
 * It provides USD formatting (`lib/money.ts`), programme names (`lib/programmes.ts`),
 * allocation permission strings (`allocFree`, `allocPaid`, `allocMarketplace`,
 * `allocInstitution`, `allocCoupon` in `lib/entitlements.ts`), signed-in search
 * (`app/api/search`), dashboard nav, parent notifications, and white-label.
 *
 * It does not yet provide the richer systems Harry described. Each file here
 * is the function to replace when that system lands. Do not format money,
 * decide book access, translate a book, or rank a board anywhere else.
 *
 * | Seam | File | Replace with |
 * | --- | --- | --- |
 * | Price | pricing.ts `quotePrice` | Display conversion. Charged amounts use `lib/pricing.ts` on checkout. |
 * | Allocation | allocation.ts `bookAllocation`, `decideBook` | Product allocator. Kind is `book`. Grants use the existing `alloc:*` strings. |
 * | Institution licence | licence.ts `licenceOffer` | Academy seats and licensed programmes. |
 * | Translation | localization.ts `editionFor` | Geo i18n review record. `LanguageVersion` matches it field for field. |
 * | Board | leaderboard.ts `privacyBoard` | Shared privacy-safe leaderboard. |
 * | Notices | notifications.ts `readingNotices` | Notifications centre. Shape is `{ title, message, href }`. |
 * | Search | search.ts `searchBooks` | Merged into `GET /api/search` as `books`, and shown in dashboard search. Replace the function when a shared index owns book documents. |
 * | CMS order | cms.ts `moveItem` | Drag-and-drop curriculum CMS. Chapter reorder uses this, not a second helper. |
 * | Editor | `components/editor` | Shared source. `writeAutosave` matches the stack. API in `docs/EDITOR_MEDIA.md`. |
 * | Media | `components/media` | Shared source, including `media_assets` via `recordMediaAsset`. Book overlay stays in Book Studio. |
 * | Wallet | wallet.ts `quoteCheckout` | `POST /api/stripe/create-checkout` and `POST /api/payments/checkout` charge plans, add-ons, courses, books, and Reads. Touch 'n Go is the Malaysian gateway method `tng`. |
 * | Goals | `lib/goals.ts`, reading.ts `readingGoal` | Shared `daily_goals` contract. Category `reading`. Sessions return the document. The ledger write is still pending. |
 * | Roles | roles.ts `readAccountMode` | Local mode switch until `users.roles[]` exists. |
 * | Awards | gamification.ts `awardReading` | Local XP, `book-finished`, and `streak`. Replace with the shared XP service. |
 * | Push | push.ts `parsePushRequest` | `POST /api/push` sends through `lib/push`. This parser only checks the body. |
 * | Community | community.ts `discussionSpace`, `suggestWinPost` | Local suggestion. Adult and minor rooms are separate. No community collection yet. |
 * | Studio | studio-commands.ts `parseBookCommand` | `/book` in AI Studio. The tutor accepts `bookContext`. |
 * | Offline | offline.ts `downloadBookOffline` | Cache API `poket-reads-v1`. |
 * | Reports | reports.ts `parentReadingReport` | Reading minutes and books finished on the parent report. |
 */
export { quotePrice, viewerCurrency, FX_AS_OF, FX_PER_USD } from './pricing';
export { bookAllocation, decideBook } from './allocation';
export { licenceOffer } from './licence';
export { editionFor, activeLocale } from './localization';
export { privacyBoard } from './leaderboard';
export { readingNotices } from './notifications';
export { searchBooks } from './search';
export { moveItem } from './cms';
export { quoteCheckout } from './wallet';
export { readingGoal } from './reading';
export { readAccountMode, writeAccountMode } from './roles';
export { awardReading, readAwards } from './gamification';
export { parsePushRequest } from './push';
export { discussionSpace, suggestWinPost } from './community';
export { parseBookCommand } from './studio-commands';
export { downloadBookOffline } from './offline';
export { parentReadingReport } from './reports';
