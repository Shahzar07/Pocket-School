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
 * | Price | pricing.ts `quotePrice` | Admin FX table. USD stays canonical. `lib/money.formatMoney` already prints USD. |
 * | Allocation | allocation.ts `bookAllocation`, `decideBook` | Product allocator. Kind is `book`. Grants use the existing `alloc:*` strings. |
 * | Institution licence | licence.ts `licenceOffer` | Academy seats and licensed programmes. |
 * | Translation | localization.ts `editionFor` | Geo i18n review record. `LanguageVersion` matches it field for field. |
 * | Board | leaderboard.ts `privacyBoard` | Shared privacy-safe leaderboard. |
 * | Notices | notifications.ts `readingNotices` | Notifications centre. Shape is `{ title, message, href }`. |
 * | Search | search.ts `searchBooks` | Merged into `GET /api/search` as `books`, and shown in dashboard search. Replace the function when a shared index owns book documents. |
 * | CMS order | cms.ts `moveItem` | Drag-and-drop curriculum CMS. |
 */
export { quotePrice, viewerCurrency, FX_AS_OF, FX_PER_USD } from './pricing';
export { bookAllocation, decideBook } from './allocation';
export { licenceOffer } from './licence';
export { editionFor, activeLocale } from './localization';
export { privacyBoard } from './leaderboard';
export { readingNotices } from './notifications';
export { searchBooks } from './search';
export { moveItem } from './cms';
