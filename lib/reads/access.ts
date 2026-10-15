/**
 * How a book sits on the existing tier ladder.
 *
 * This module imports the tier table and does not edit it. The in-flight
 * Sparks / entitlements PR owns lib/entitlements.ts; rebase this file onto
 * that PR rather than folding the rules back into it.
 *
 * Defaults Harry can change:
 *   general, primary, lower secondary  → minTier 1 (Primary & Lower Secondary)
 *   IGCSE, A-Level, general academic    → minTier 2
 *   professional                        → minTier 3
 *   law                                 → minTier 4
 *   institution (tier 5)                → the whole subscription shelf
 *   tier 6 / marketplace                → buy-to-own only, not the shelf
 *
 * A purchased book stays in the library after a plan ends (`source: owned`).
 * The first chapter of every published book is a free preview.
 *
 * Legacy accounts with no accessTier are mapped to tier 2 when
 * subscriptionTier is `academic`, and to tier 0 otherwise. They are NOT
 * mapped to tier 6. accessTierFor() does that so old free accounts can still
 * buy courses; using it here would unlock every book.
 */

import { tierDefinition, type AccessTier } from '@/lib/entitlements';
import { anyTargetMatch, normaliseTargets } from '@/lib/allocation-targets';
import type { Book, BookChapter } from './types';

export interface ReadsProfile {
  role?: string | null;
  accessTier?: number | null;
  subscriptionTier?: string | null;
  permissions?: string[] | null;
  institutionId?: string | null;
  userId?: string | null;
  cohortIds?: string[] | null;
}

export type AccessSource = 'preview' | 'owned' | 'subscription' | 'staff' | 'institution' | 'sparks';

export type BookAccess =
  | { allowed: true; source: AccessSource }
  | { allowed: false; reason: 'UNPUBLISHED' | 'UPGRADE' | 'PURCHASE'; requiredTier?: AccessTier; priceRM?: number };

const ALLOWED = (source: AccessSource): BookAccess => ({ allowed: true, source });

export function readsTier(profile: ReadsProfile | null | undefined): AccessTier {
  if (!profile) return 0;
  if (profile.role === 'admin') return 5;
  if (typeof profile.accessTier === 'number' && profile.accessTier >= 0 && profile.accessTier <= 6) {
    if (profile.accessTier === 6) return 0;
    return profile.accessTier as AccessTier;
  }
  if (profile.subscriptionTier === 'academic') return 2;
  return 0;
}

export function bookAllocPermission(bookId: string): string {
  return `alloc:book:${bookId}`;
}

export function ownsBook(bookId: string, profile: ReadsProfile | null | undefined, ownedIds: readonly string[]): boolean {
  if (ownedIds.includes(bookId)) return true;
  return (profile?.permissions ?? []).includes(bookAllocPermission(bookId));
}

export function subscriptionIncludes(book: Book, profile: ReadsProfile | null | undefined): boolean {
  if (book.status !== 'published' || book.accessMode === 'purchase') return false;
  const targets = book.targets?.length ? normaliseTargets(book.targets).filter(target => target !== 'marketplace') : [];
  if (targets.length) {
    const match = anyTargetMatch(targets, {
      role: profile?.role || 'guest',
      userId: profile?.userId,
      institutionId: profile?.institutionId,
      cohortIds: profile?.cohortIds,
    });
    if (!match.hit) return false;
  } else if (!book.allocateLibrary) return false;
  return readsTier(profile) >= book.minTier;
}

export function checkBookAccess(
  book: Book,
  profile: ReadsProfile | null | undefined,
  opts: { ownedIds?: readonly string[]; chapter?: BookChapter | null } = {},
): BookAccess {
  const owned = ownsBook(book.id, profile, opts.ownedIds ?? []);
  if (profile?.role === 'admin') return ALLOWED('staff');
  if (book.status !== 'published') return { allowed: false, reason: 'UNPUBLISHED' };

  const chapter = opts.chapter;
  if (chapter?.preview || chapter?.order === 0) return ALLOWED('preview');
  if (owned) return ALLOWED('owned');
  if (subscriptionIncludes(book, profile)) return ALLOWED('subscription');

  if (book.accessMode === 'subscription') {
    return { allowed: false, reason: 'UPGRADE', requiredTier: book.minTier };
  }
  return { allowed: false, reason: 'PURCHASE', requiredTier: book.minTier, priceRM: book.priceRM };
}

export function planLabel(tier: AccessTier): string {
  return tierDefinition(tier).name;
}

/** Sample reader used when nobody is signed in, so the shelf is not empty. */
export const SAMPLE_READER: ReadsProfile = {
  role: 'student',
  accessTier: 2,
  subscriptionTier: 'academic',
};

export const SAMPLE_OWNED = ['harbour-light'] as const;
