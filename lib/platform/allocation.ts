import {
  allocFree,
  allocInstitution,
  allocMarketplace,
  allocPaid,
  type PriceType,
} from '@/lib/entitlements';
import { checkBookAccess, type BookAccess, type ReadsProfile } from '@/lib/reads/access';
import { BOOK_TARGETS, type Book, type BookChapter, type BookTarget } from '@/lib/reads/types';

/**
 * A book is a product. The fields mirror the allocator Harry described.
 * Grants are the same `alloc:*` strings courses already use, keyed by book id.
 * Sparks unlock, drip, seats, coupons, and bundles are carried so the real
 * allocator can fill them without a second book model.
 */
export interface ProductAllocation {
  kind: 'book';
  id: string;
  audiences: BookTarget[];
  minTier: number;
  priceType: PriceType | 'SPARKS_UNLOCK';
  sparksCost?: number;
  drip?: { availableFrom?: string };
  seats?: { total: number; used: number };
  couponCodes?: string[];
  bundleWith?: string[];
  licensable: boolean;
  grants: {
    free: string;
    paid: string;
    marketplace: string;
    institution: (institutionId: string) => string;
  };
}

/** Default multi-select when a book has not chosen targets yet. */
export function defaultBookTargets(book: { allocateLibrary?: boolean; allocateMarketplace?: boolean }): BookTarget[] {
  const targets: BookTarget[] = ['students', 'parents'];
  if (book.allocateLibrary) targets.push('institutions');
  if (book.allocateMarketplace) targets.push('marketplace');
  return BOOK_TARGETS.filter(target => targets.includes(target));
}

export function bookAllocation(book: Book): ProductAllocation {
  const priceType: PriceType | 'SPARKS_UNLOCK' = book.accessMode === 'subscription' && book.priceUsd <= 0
    ? 'SUBSCRIPTION_INCLUDED'
    : book.priceUsd <= 0
      ? 'FREE'
      : 'MARKETPLACE_PURCHASE';
  return {
    kind: 'book',
    id: book.id,
    audiences: book.targets?.length ? book.targets : defaultBookTargets(book),
    minTier: book.minTier,
    priceType,
    sparksCost: book.sparksCost,
    drip: book.availableFrom ? { availableFrom: book.availableFrom } : undefined,
    seats: book.seats,
    bundleWith: book.series ? [`series:${book.series.id}`] : undefined,
    licensable: book.licensable,
    grants: {
      free: allocFree(book.id),
      paid: allocPaid(book.id),
      marketplace: allocMarketplace(book.id),
      institution: (institutionId: string) => allocInstitution(institutionId, book.id),
    },
  };
}

function allowed(source: 'owned' | 'institution' | 'sparks'): BookAccess {
  return { allowed: true, source };
}

/** Access decision for a book. Institution seats and Sparks sit on top of the tier gate. */
export function decideBook(
  book: Book,
  profile: ReadsProfile | null | undefined,
  opts: { ownedIds?: readonly string[]; chapter?: BookChapter | null } = {},
): BookAccess {
  const alloc = bookAllocation(book);
  const base = checkBookAccess(book, profile, opts);
  if (base.allowed) return base;

  const perms = profile?.permissions ?? [];
  if (perms.includes(alloc.grants.free) || perms.includes(alloc.grants.marketplace) || perms.includes(alloc.grants.paid)) {
    return allowed('owned');
  }
  const institutionId = profile?.institutionId;
  if (institutionId && alloc.licensable && perms.includes(alloc.grants.institution(institutionId))) {
    if (!alloc.seats || alloc.seats.used < alloc.seats.total) return allowed('institution');
  }
  if (alloc.sparksCost && perms.includes(`sparks:book:${book.id}`)) return allowed('sparks');
  return base;
}
