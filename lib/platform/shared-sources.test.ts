import assert from 'node:assert/strict';
import test from 'node:test';
import { blankProfile } from '../enterprise';
import { seedInstitutionPricing } from '../institution-pricing';
import { buildSparkPool, quoteForInstitution } from '../institution-membership';
import { parseModelFields } from '../i18n/content-translation';
import { LANGUAGES } from '../languages';
import { quoteCourse, seedPricing } from '../pricing';
import { bookById } from '../reads/seed';
import type { Book } from '../reads/types';
import { bookAllocation, decideBook } from './allocation';
import { coverBookSparks, institutionReadsBill, licenceOffer, quoteBookLicence, seatsFromInstitution } from './licence';
import { applyTranslatedFields, editionFor } from './localization';
import { storedBookPriceRM } from './pricing';

function requireBook(id: string): Book {
  const found = bookById(id);
  if (!found) throw new Error(`Missing seed book ${id}`);
  return found;
}

const book = requireBook('plain-contract');
const harbour = requireBook('harbour-light');

const seats = {
  institutionId: 'sch',
  seatCount: 40,
  seatsUsed: 12,
  licenceStartsOn: '2026-01-01',
  licenceEndsOn: '2026-12-31',
  status: 'active' as const,
};

const reader = {
  role: 'student',
  accessTier: 0,
  institutionId: 'sch',
  permissions: ['alloc:institution:sch:plain-contract'],
};

test('book seats come from the institution, not the book', () => {
  assert.equal(book.seats?.total, 30);
  assert.equal(bookAllocation(book).seats, undefined);
  assert.deepEqual(bookAllocation(book, seats).seats, { total: 40, used: 12 });
  const fromProfile = seatsFromInstitution(blankProfile({
    seatCount: 40,
    seatsUsed: 12,
    licenceStartsOn: '2026-01-01',
    licenceEndsOn: '2026-12-31',
  }));
  assert.equal(fromProfile.seatCount, 40);
  assert.equal(fromProfile.seatsUsed, 12);
});

test('an institution seat opens a paid chapter only while the licence is active', () => {
  const chapter = book.chapters.find(item => item.id === 'pc-2');
  assert.ok(chapter);
  const open = decideBook(book, reader, { institution: seats, today: '2026-10-17', chapter });
  assert.deepEqual(open, { allowed: true, source: 'institution' });

  const full = decideBook(book, reader, {
    institution: { ...seats, seatsUsed: 40 },
    today: '2026-10-17',
    chapter,
  });
  assert.equal(full.allowed, false);

  const undated = decideBook(book, reader, {
    institution: { ...seats, licenceStartsOn: '', licenceEndsOn: '' },
    today: '2026-10-17',
    chapter,
  });
  assert.equal(undated.allowed, false);

  const noSnapshot = decideBook(book, reader, { today: '2026-10-17', chapter });
  assert.equal(noSnapshot.allowed, false);
});

test('quoting a book licence adds the poket_reads add-on', () => {
  const schedule = seedInstitutionPricing();
  const addon = schedule.addons.find(item => item.id === 'poket_reads');
  assert.ok(addon);
  addon.flatAnnual = 12;
  const quote = quoteBookLicence({ seats: 10, schedule });
  assert.equal(quote.addonId, 'poket_reads');
  assert.equal(quote.addonTotal, 12);

  const offer = licenceOffer(book, seats, '2026-10-17');
  assert.equal(offer.phase, 'active');
  assert.equal(offer.remaining, 28);
  assert.equal(offer.addonId, 'poket_reads');
  assert.equal(offer.seats?.total, 40);
  assert.equal(offer.grant('sch'), 'alloc:institution:sch:plain-contract');
});

test('the school bill keeps the seat quote and adds poket_reads', () => {
  const seatOnly = quoteForInstitution({ seats: 40, planId: 'igcse_alevel', interval: 'annual' });
  const seedBill = institutionReadsBill({ seats: 40, planId: 'igcse_alevel', interval: 'annual' });
  assert.equal(seedBill.seats.total, seatOnly.total);
  assert.equal(seedBill.reads.addonTotal, 0);
  assert.equal(seedBill.total, seatOnly.total);
  assert.equal(seedBill.addonId, 'poket_reads');

  const schedule = seedInstitutionPricing();
  const addon = schedule.addons.find(item => item.id === 'poket_reads');
  assert.ok(addon);
  addon.flatAnnual = 12;
  const quoted = institutionReadsBill({ seats: 40, planId: 'igcse_alevel', interval: 'annual', schedule });
  const seatsOnSchedule = quoteForInstitution({ seats: 40, planId: 'igcse_alevel', interval: 'annual', schedule });
  assert.equal(quoted.seats.total, seatsOnSchedule.total);
  assert.equal(quoted.reads.addonTotal, 12);
  assert.equal(quoted.total, seatsOnSchedule.total + 12);
});

test('a saved edition wins over machine translation across the language list', () => {
  assert.equal(LANGUAGES.length, 53);
  const malay = editionFor(harbour, 'ms');
  assert.equal(malay.machine, false);
  assert.equal(malay.status, 'review');
  assert.equal(malay.title, 'Cahaya Pelabuhan');

  const french = editionFor(harbour, 'fr');
  assert.equal(french.machine, true);
  assert.equal(french.locale, 'fr');
  assert.equal(french.title, harbour.title);
  assert.equal(french.aiTranslated, false);

  const unknown = editionFor(harbour, 'xx');
  assert.equal(unknown.locale, 'en');
  assert.equal(unknown.machine, false);

  const held = applyTranslatedFields(
    french,
    { title: 'Lumière', blurb: 'x', chapterTitle: 'Chapitre', markdown: 'Texte' },
    false,
    'hl-1',
  );
  assert.equal(held.title, harbour.title);

  const overlaid = applyTranslatedFields(
    french,
    { title: 'Lumière', blurb: 'x', chapterTitle: 'Chapitre', markdown: 'Texte' },
    true,
    'hl-1',
  );
  assert.equal(overlaid.title, 'Lumière');
  assert.equal(overlaid.aiTranslated, true);
  assert.equal(overlaid.chapters.find(item => item.id === 'hl-1')?.title, 'Chapitre');
  assert.equal(overlaid.chapters.find(item => item.id === 'hl-1')?.markdown, 'Texte');
  assert.notEqual(overlaid.chapters.find(item => item.id === 'hl-3')?.markdown, 'Texte');
});

test('the shared translator keeps only the requested fields', () => {
  const parsed = parseModelFields(
    '```json\n{"title":"A","blurb":"B","extra":"no"}\n```',
    ['title', 'blurb'],
  );
  assert.deepEqual(parsed, { title: 'A', blurb: 'B' });
  assert.equal(parseModelFields('not json', ['title']), null);
});

test('grace keeps a seated reader, and a suspended bill does not', () => {
  const chapter = book.chapters.find(item => item.id === 'pc-2');
  assert.ok(chapter);
  const grace = decideBook(book, reader, {
    institution: { ...seats, billingPhase: 'grace' },
    today: '2026-10-17',
    chapter,
  });
  assert.deepEqual(grace, { allowed: true, source: 'institution' });

  const fullDuringGrace = decideBook(book, reader, {
    institution: { ...seats, seatsUsed: 40, billingPhase: 'grace' },
    today: '2026-10-17',
    chapter,
  });
  assert.equal(fullDuringGrace.allowed, false);

  const suspended = decideBook(book, reader, {
    institution: { ...seats, billingPhase: 'suspended' },
    today: '2026-10-17',
    chapter,
  });
  assert.equal(suspended.allowed, false);

  const offer = licenceOffer(book, { ...seats, billingPhase: 'grace' }, '2026-10-17');
  assert.equal(offer.learning, true);
  assert.equal(offer.seatCharge, 'waived');
});

test('a book Sparks cost can be covered by the institution pool', () => {
  const chapter = book.chapters.find(item => item.id === 'pc-2');
  assert.ok(chapter);
  const built = buildSparkPool({ planId: 'primary_secondary', seats: 10, perSeat: 100 });
  assert.ok(!('error' in built));
  const member = { role: 'student', accessTier: 0, institutionId: 'sch' };
  const opened = decideBook(book, member, {
    institution: { ...seats, sparkPool: built },
    today: '2026-10-17',
    chapter,
  });
  assert.deepEqual(opened, { allowed: true, source: 'sparks' });

  const short = buildSparkPool({ planId: 'primary_secondary', seats: 1, perSeat: 10 });
  assert.ok(!('error' in short));
  const denied = decideBook(book, member, {
    institution: { ...seats, sparkPool: short },
    today: '2026-10-17',
    chapter,
  });
  assert.equal(denied.allowed, false);

  const reserved = coverBookSparks(built, book.id, book.sparksCost ?? 0);
  assert.ok(!('error' in reserved));
  if (!('error' in reserved)) {
    assert.equal(reserved.pool.allocated, book.sparksCost);
    assert.equal(reserved.allocations[0]?.subjectId, `book:${book.id}`);
  }
});

test('a stored MYR book price uses the admin rate', () => {
  const quoted = quoteCourse(seedPricing(), 5, 'USD', 'MYR');
  assert.equal(storedBookPriceRM(5), quoted.amount);
  assert.equal(storedBookPriceRM(0), 0);
});
