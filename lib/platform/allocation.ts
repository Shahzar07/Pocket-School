import { migrateAllocation } from '@/lib/allocation-targets';
import {
  allocFree,
  allocInstitution,
  allocMarketplace,
  allocPaid,
  type PriceType,
} from '@/lib/entitlements';
import { learningOpen, type BillingPhase, type SparkPool } from '@/lib/institution-membership';
import { licencePhase } from '@/lib/oem';
import { checkBookAccess, type BookAccess, type ReadsProfile } from '@/lib/reads/access';
import type { Book, BookChapter } from '@/lib/reads/types';

/**
 * Seat cap on the institution, not on the book.
 * `seatCount` / `seatsUsed` and the licence dates are the institution profile fields.
 */
export interface InstitutionSeats {
  institutionId?: string;
  seatCount: number;
  seatsUsed: number;
  licenceStartsOn: string;
  licenceEndsOn: string;
  status?: 'active' | 'suspended';
  /**
   * Payment phase from `lib/institution-membership.ts`.
   * Absent means only the seat dates are checked.
   * `grace` still allows reading, matching `learningOpen`.
   */
  billingPhase?: BillingPhase;
  /** Institution Sparks pool. A book cost is covered when `available` is enough. */
  sparkPool?: SparkPool | null;
}

/**
 * A book is a product. The fields mirror the allocator Harry described.
 * Grants are the same `alloc:*` strings courses already use, keyed by book id.
 * Sparks unlock, drip, seats, coupons, and bundles are carried so the real
 * allocator can fill them without a second book model.
 */
export interface ProductAllocation {
  kind: 'book';
  id: string;
  /** Same tokens `migrateAllocation` and Firestore `targetsHit` use. */
  audiences: string[];
  minTier: number;
  priceType: PriceType | 'SPARKS_UNLOCK';
  sparksCost?: number;
  drip?: { availableFrom?: string };
  /** Institution seat cap. Absent until the caller passes an institution profile. */
  seats?: { total: number; used: number };
  licenceStartsOn?: string;
  licenceEndsOn?: string;
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

/**
 * Targets for a book. An explicit `targets` list is kept.
 * An empty list expands the library and marketplace flags the same way
 * `migrateAllocation` does, which is what the rules use when `targets` is absent.
 * Seat counts are not taken from the book.
 */
export function defaultBookTargets(book: {
  targets?: readonly string[] | null;
  allocateLibrary?: boolean | null;
  allocateMarketplace?: boolean | null;
}): string[] {
  return migrateAllocation({
    targets: book.targets,
    allocateLibrary: book.allocateLibrary,
    allocateMarketplace: book.allocateMarketplace,
  });
}

export function bookAllocation(book: Book, institution?: InstitutionSeats | null): ProductAllocation {
  const priceType: PriceType | 'SPARKS_UNLOCK' = book.accessMode === 'subscription' && book.priceUsd <= 0
    ? 'SUBSCRIPTION_INCLUDED'
    : book.priceUsd <= 0
      ? 'FREE'
      : 'MARKETPLACE_PURCHASE';
  return {
    kind: 'book',
    id: book.id,
    audiences: defaultBookTargets(book),
    minTier: book.minTier,
    priceType,
    sparksCost: book.sparksCost,
    drip: book.availableFrom ? { availableFrom: book.availableFrom } : undefined,
    seats: institution ? { total: institution.seatCount, used: institution.seatsUsed } : undefined,
    licenceStartsOn: institution?.licenceStartsOn,
    licenceEndsOn: institution?.licenceEndsOn,
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

/** YYYY-MM-DD for a seat check. An invalid or empty argument is today's UTC date. */
export function licenceDay(today?: string): string {
  if (today && /^\d{4}-\d{2}-\d{2}$/.test(today)) return today;
  return new Date().toISOString().slice(0, 10);
}

/** Seat dates are active, and a billing phase, when present, still has learning open. */
export function institutionReadingOpen(institution: InstitutionSeats, today?: string): boolean {
  const phase = licencePhase({
    seats: institution.seatCount,
    seatsUsed: institution.seatsUsed,
    startsOn: institution.licenceStartsOn,
    endsOn: institution.licenceEndsOn,
    status: institution.status === 'suspended' ? 'suspended' : 'active',
  }, licenceDay(today));
  if (phase !== 'active') return false;
  if (institution.billingPhase && !learningOpen(institution.billingPhase)) return false;
  return true;
}

function billingAllowsPool(institution: InstitutionSeats): boolean {
  return !institution.billingPhase || learningOpen(institution.billingPhase);
}

/** Access decision for a book. Institution seats and Sparks sit on top of the tier gate. */
export function decideBook(
  book: Book,
  profile: ReadsProfile | null | undefined,
  opts: {
    ownedIds?: readonly string[];
    chapter?: BookChapter | null;
    institution?: InstitutionSeats | null;
    today?: string;
  } = {},
): BookAccess {
  const alloc = bookAllocation(book, opts.institution);
  const base = checkBookAccess(book, profile, opts);
  if (base.allowed) return base;

  const perms = profile?.permissions ?? [];
  if (perms.includes(alloc.grants.free) || perms.includes(alloc.grants.marketplace) || perms.includes(alloc.grants.paid)) {
    return allowed('owned');
  }
  const institutionId = profile?.institutionId;
  if (institutionId && alloc.licensable && opts.institution && perms.includes(alloc.grants.institution(institutionId))) {
    if (institutionReadingOpen(opts.institution, opts.today)) return allowed('institution');
  }
  if (alloc.sparksCost && perms.includes(`sparks:book:${book.id}`)) return allowed('sparks');
  const pool = opts.institution?.sparkPool;
  if (
    alloc.sparksCost
    && institutionId
    && pool
    && opts.institution
    && billingAllowsPool(opts.institution)
    && pool.available >= alloc.sparksCost
  ) {
    return allowed('sparks');
  }
  return base;
}
