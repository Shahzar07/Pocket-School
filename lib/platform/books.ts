/**
 * Hooks for Poket Reads. That agent owns the catalogue, reader, and studio
 * at `/reads`. This file is the contract they call. It does not render a library.
 *
 * Grant string: `alloc:book:{bookId}`
 * Sparks string: `alloc:sparks:{bookId}` (the same shape courses use)
 * Coupon string: `alloc:coupon:{bookId}:{YYYY-MM-DD}`
 * Institution string: `alloc:institution:{institutionId}:{bookId}`
 */
import { productAccess, type AllocatableProduct, type AllocationViewer, type ProductAccess } from '../allocation';
import { quoteCourse, type PricingConfig } from '../pricing';
import type { PriceType } from '../entitlements';

/** Public route Poket Reads replaces with the real catalogue. */
export const BOOKS_HREF = '/reads';

export const BOOK_KIND = 'book' as const;

export function bookGrant(bookId: string): string {
  return `alloc:book:${bookId}`;
}

export interface BookProduct extends AllocatableProduct {
  kind: typeof BOOK_KIND;
  /** Canonical price in US dollars. Display converts through the pricing config. */
  priceUsd?: number | null;
}

export function asBookProduct(book: {
  id: string;
  status?: string | null;
  title?: string;
  minTier?: number | null;
  priceType?: PriceType | string | null;
  priceUsd?: number | null;
  audiences?: AllocatableProduct['audiences'];
  accessPolicy?: AllocatableProduct['accessPolicy'];
  allocatedInstitutionIds?: string[] | null;
}): BookProduct {
  return {
    id: book.id,
    status: book.status ?? 'published',
    kind: BOOK_KIND,
    contentType: 'BOOK',
    minTier: book.minTier,
    priceType: book.priceType,
    price: book.priceUsd,
    audiences: book.audiences,
    accessPolicy: book.accessPolicy,
    allocatedInstitutionIds: book.allocatedInstitutionIds,
    priceUsd: book.priceUsd,
  };
}

/**
 * Same decision as a course, plus a purchased-book grant.
 * Reads should pass the signed-in profile through `viewerFromProfile`.
 */
export function decideBook(book: BookProduct, viewer: AllocationViewer): ProductAccess {
  const held = viewer.permissions ?? [];
  if (held.includes(bookGrant(book.id))) {
    return { listed: true, open: true, reason: 'Purchased' };
  }
  return productAccess(book, viewer);
}

/** Books are priced in USD. The visitor currency comes from the shared pricing config. */
export function quoteBook(
  config: PricingConfig,
  priceUsd: number,
  displayCurrency: string | null | undefined,
) {
  return quoteCourse(config, priceUsd, 'USD', displayCurrency);
}

/**
 * A book edition uses the same review model as a lesson localization:
 * English is the source, and a translation is shown only when it has text
 * and is approved (or has no status yet, so a hand-typed edition still works).
 */
export interface BookEdition {
  language: string;
  title?: string;
  text?: string;
  source?: 'manual' | 'ai';
  status?: 'draft' | 'review' | 'approved';
}

export interface BookCopy {
  title: string;
  text: string;
  language: string;
  fellBack: boolean;
  source: 'manual' | 'ai' | 'source';
}

export function editionFor(
  book: {
    title: string;
    text?: string | null;
    localizations?: Record<string, BookEdition | undefined> | null;
  },
  language: string,
): BookCopy {
  const source = {
    title: book.title,
    text: book.text?.trim() ?? '',
    language: 'en',
    fellBack: false,
    source: 'source' as const,
  };
  if (!language || language === 'en') return source;
  const edition = book.localizations?.[language];
  const text = edition?.text?.trim() ?? '';
  const approved = !edition?.status || edition.status === 'approved';
  if (!text || !approved) {
    return { ...source, fellBack: true };
  }
  return {
    title: edition?.title?.trim() || book.title,
    text,
    language,
    fellBack: false,
    source: edition?.source ?? 'manual',
  };
}

export interface SearchBook {
  id: string;
  title: string;
  blurb?: string | null;
  language?: string | null;
}

/** Reads fills the list. An empty list keeps the search response shape stable. */
export function searchBooks(books: readonly SearchBook[], query: string): SearchBook[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return books.filter(book =>
    book.title.toLowerCase().includes(q) || (book.blurb ?? '').toLowerCase().includes(q),
  ).slice(0, 5);
}
