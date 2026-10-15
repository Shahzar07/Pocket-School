import { bookAllocation } from './allocation';
import type { Book } from '@/lib/reads/types';

/**
 * What an institution academy needs in order to licence a book.
 * `grant(institutionId)` is `alloc:institution:{id}:{bookId}` from entitlements.
 * Seat totals are the cap. Nothing here writes a seat ledger.
 */
export function licenceOffer(book: Book) {
  const alloc = bookAllocation(book);
  return {
    product: { kind: alloc.kind, id: alloc.id },
    programme: book.programme ?? null,
    licensable: alloc.licensable,
    seats: alloc.seats ?? null,
    grant: alloc.grants.institution,
  };
}
