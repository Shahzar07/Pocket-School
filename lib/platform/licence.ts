import type { Book } from '@/lib/reads/types';
import type { InstitutionProfile } from '@/lib/enterprise';
import { licencePhase, seatsRemaining, type LicencePhase } from '@/lib/oem';
import {
  quoteInstitution,
  seedInstitutionPricing,
  type InstitutionVolumeSchedule,
  type VolumeInterval,
  type VolumePlanId,
  type VolumeQuote,
} from '@/lib/institution-pricing';
import {
  allocateSparks,
  chargeFor,
  quoteForInstitution,
  type SparkAllocation,
  type SparkPool,
} from '@/lib/institution-membership';
import { bookAllocation, institutionReadingOpen, licenceDay, type InstitutionSeats } from './allocation';

/**
 * Institution licensing for a book.
 * Seat counts and licence dates come from the institution profile
 * (`seatCount`, `seatsUsed`, `licenceStartsOn`, `licenceEndsOn`).
 * The book does not keep a second seat ledger.
 * A quote for that licence includes the `poket_reads` volume add-on.
 * `quoteForInstitution` leaves add-ons empty. `institutionReadsBill` adds the
 * Poket Reads line on top of that seat quote for the existing billing page.
 *
 * Billing follows `learningOpen`: `active` and `grace` can read; `pending_payment`
 * and `suspended` cannot. A full seat cap still denies a new reader during grace.
 */

export type InstitutionLicence = InstitutionSeats;

export function seatsFromInstitution(
  profile: Pick<InstitutionProfile, 'seatCount' | 'seatsUsed' | 'licenceStartsOn' | 'licenceEndsOn'>,
): InstitutionSeats {
  return {
    seatCount: profile.seatCount,
    seatsUsed: profile.seatsUsed,
    licenceStartsOn: profile.licenceStartsOn,
    licenceEndsOn: profile.licenceEndsOn,
  };
}

export function institutionSeatPhase(institution: InstitutionSeats, today: string): LicencePhase {
  return licencePhase({
    seats: institution.seatCount,
    seatsUsed: institution.seatsUsed,
    startsOn: institution.licenceStartsOn,
    endsOn: institution.licenceEndsOn,
    status: institution.status === 'suspended' ? 'suspended' : 'active',
  }, today);
}

export function licenceOffer(book: Book, institution?: InstitutionSeats | null, today = '') {
  const alloc = bookAllocation(book, institution);
  const phase = institution ? institutionSeatPhase(institution, licenceDay(today)) : null;
  return {
    product: { kind: alloc.kind, id: alloc.id },
    programme: book.programme ?? null,
    licensable: alloc.licensable,
    seats: alloc.seats ?? null,
    licenceStartsOn: institution?.licenceStartsOn ?? '',
    licenceEndsOn: institution?.licenceEndsOn ?? '',
    phase,
    billingPhase: institution?.billingPhase ?? null,
    /** True when seat dates and the billing phase both allow reading. */
    learning: institution ? institutionReadingOpen(institution, today) : null,
    /** A student on an institution seat is not billed for that seat. */
    seatCharge: institution ? chargeFor({ membership: 'institution', product: 'seat', role: 'student' }) : null,
    remaining: institution ? seatsRemaining({ seats: institution.seatCount, seatsUsed: institution.seatsUsed }) : null,
    grant: alloc.grants.institution,
    addonId: 'poket_reads' as const,
  };
}

/**
 * Reserve a book's Sparks cost on the institution pool.
 * The row id is `book:{bookId}`. A later call for the same book replaces that row.
 */
export function coverBookSparks(
  pool: SparkPool,
  bookId: string,
  cost: number,
  current: readonly SparkAllocation[] = [],
): { pool: SparkPool; allocations: SparkAllocation[] } | { error: string } {
  return allocateSparks(pool, current, { subjectId: `book:${bookId}`, amount: cost, classId: '' });
}

/** Price an institution book licence on the shared volume schedule, with Poket Reads included. */
export function quoteBookLicence(input: {
  seats: number;
  schedule?: InstitutionVolumeSchedule;
  interval?: VolumeInterval;
  planId?: VolumePlanId;
}): VolumeQuote & { addonId: 'poket_reads' } {
  const quote = quoteInstitution({
    schedule: input.schedule ?? seedInstitutionPricing(),
    seats: input.seats,
    override: {
      planId: input.planId ?? 'primary_secondary',
      interval: input.interval ?? 'annual',
      addons: ['poket_reads'],
    },
  });
  return { ...quote, addonId: 'poket_reads' };
}

/**
 * Seat bill from `quoteForInstitution`, plus the Poket Reads add-on.
 * The seat quote stays free of add-ons. The payable total is the sum.
 */
export function institutionReadsBill(input: {
  seats: number;
  planId: VolumePlanId;
  interval: VolumeInterval;
  schedule?: InstitutionVolumeSchedule;
}): {
  seats: VolumeQuote;
  reads: VolumeQuote & { addonId: 'poket_reads' };
  total: number;
  currency: string;
  addonId: 'poket_reads';
} {
  const seatsQuote = quoteForInstitution({
    schedule: input.schedule,
    seats: input.seats,
    planId: input.planId,
    interval: input.interval,
  });
  const reads = quoteBookLicence({
    seats: input.seats,
    schedule: input.schedule,
    interval: input.interval,
    planId: input.planId,
  });
  return {
    seats: seatsQuote,
    reads,
    total: reads.total,
    currency: reads.currency,
    addonId: 'poket_reads',
  };
}
