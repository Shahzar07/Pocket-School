/**
 * Seams between Poket Reads and the shared platform.
 *
 * Wired on this branch: display prices (`lib/pricing.ts`), the reader language
 * (`lib/languages.ts` and `I18nProvider`), reading pushes (`lib/push` and
 * `POST /api/push`), and book targets (`migrateAllocation`, the same list the
 * Firestore `targetsHit` rule uses).
 *
 * Still local: the daily FX feed, the privacy leaderboard (`privacyBoard`),
 * server-side notification fan-out, XP and badges, and `users.roles[]`.
 * Badge work in the open PR #127 stays unwired so this XP stub can adopt it later.
 *
 * | Seam | File | Status |
 * | --- | --- | --- |
 * | Price | pricing.ts `quotePrice`, `storedBookPriceRM` | `lib/pricing.ts`. `dailyFxRate` is null. |
 * | Allocation | allocation.ts `bookAllocation`, `decideBook` | `book.targets` via `migrateAllocation`. Seats come from the institution profile. |
 * | Institution licence | licence.ts `licenceOffer`, `quoteBookLicence` | Seat phase from `lib/oem.ts`. Billing phase from `learningOpen`. `poket_reads` add-on. |
 * | Translation | localization.ts `editionFor` | Saved editions win. Machine text uses `useContentTranslation` and `/api/content/translate`. |
 * | Board | leaderboard.ts `privacyBoard` | Local rows. The shelf renders `LeaderboardPodium`. |
 * | Notices | notifications.ts `readingNotices`, `postReadingNotice` | On-screen list, and `POST /api/push` with category `goals`. |
 * | Search | search.ts `searchBooks` | Catalogue filter until a shared book index exists. |
 * | CMS order | cms.ts `moveItem` | Shared chapter reorder. |
 * | Editor | `components/editor` | Shared source. Book overlay stays in Book Studio. |
 * | Media | `components/media` | Shared source. Book overlay stays in Book Studio. |
 * | Wallet | wallet.ts `quoteCheckout` | Reads plan amounts come from `seedPricing()`. Subscriptions stay USD on card. |
 * | Goals | reading.ts `readingGoal` | Shared `daily_goals` shape. The ledger write is still pending. |
 * | Roles | roles.ts `readAccountMode` | Local mode switch. `users.roles[]` is not read. |
 * | Awards | gamification.ts `awardReading` | Local XP, `book-finished`, and streak. |
 * | Push | push.ts `deliverReadingGoal` | `sendGoalParentAlert` in `lib/push`. |
 * | Community | community.ts | Local suggestion. Adult and minor rooms stay apart. |
 * | Studio | studio-commands.ts `parseBookCommand` | `/book` in AI Studio. |
 * | Offline | offline.ts `downloadBookOffline` | Cache API `poket-reads-v1`. |
 * | Reports | reports.ts `parentReadingReport` | Reading minutes and books finished. |
 */
export { quotePrice, viewerCurrency, dailyFxRate, storedBookPriceRM } from './pricing';
export { bookAllocation, decideBook } from './allocation';
export { licenceOffer, quoteBookLicence, seatsFromInstitution, coverBookSparks } from './licence';
export { editionFor, activeLocale } from './localization';
export { privacyBoard } from './leaderboard';
export { readingNotices, postReadingNotice } from './notifications';
export { searchBooks } from './search';
export { moveItem } from './cms';
export { quoteCheckout } from './wallet';
export { readingGoal } from './reading';
export { readAccountMode, writeAccountMode } from './roles';
export { awardReading, readAwards } from './gamification';
export { parsePushRequest, deliverReadingGoal, readingGoalMessage } from './push';
export { discussionSpace, suggestWinPost } from './community';
export { parseBookCommand } from './studio-commands';
export { downloadBookOffline } from './offline';
export { parentReadingReport } from './reports';
