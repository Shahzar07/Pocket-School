import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canConnect,
  canEditYearbook,
  wallAcceptsNotes,
  canSubmitPage,
  defaultAudiences,
  fieldVisible,
  lockDateFrom,
  MIN_PLACE_BUCKET,
  pageReleased,
  placeBoard,
  portraitLines,
  screenOwnPage,
  readTemplate,
  screenSignature,
  suggestionAllowed,
  yearbookPdf,
  type YearbookAudiences,
} from './yearbook';

const audiences = (): YearbookAudiences => ({
  ...defaultAudiences(),
  destination: 'public',
  quote: 'classmates',
});

test('each yearbook field opens only to the chosen audience and wider groups inside it', () => {
  assert.equal(fieldVisible('classmates', 'classmates'), true);
  assert.equal(fieldVisible('classmates', 'public'), false);
  assert.equal(fieldVisible('public', 'classmates'), true);
  assert.equal(fieldVisible('alumni', 'institution'), true);
  assert.equal(defaultAudiences().quote, 'classmates');
});

test('a student can edit until the lock date', () => {
  assert.equal(lockDateFrom('2026-06-01'), '2026-07-01');
  assert.equal(canEditYearbook('2026-07-01', '2026-07-01'), true);
  assert.equal(canEditYearbook('2026-07-02', '2026-07-01'), false);
});

test('an under-18 page waits for a parent before classmates can see it', () => {
  const pending = canSubmitPage({ today: '2026-06-02', lockOn: '2026-07-01', ageTier: 'teen', parentApproved: false });
  assert.equal(pending.ok, false);
  assert.equal(canSubmitPage({ today: '2026-06-02', lockOn: '2026-07-01', ageTier: 'teen', parentApproved: true }).ok, true);
  assert.equal(canSubmitPage({ today: '2026-06-02', lockOn: '2026-07-01', ageTier: 'adult', parentApproved: false }).ok, true);
  assert.equal(pageReleased({ ageTier: 'teen', parentApproved: false, approved: true, viewer: 'classmates' }), false);
  assert.equal(pageReleased({ ageTier: 'teen', parentApproved: true, approved: true, viewer: 'classmates' }), true);
  assert.equal(pageReleased({ ageTier: 'teen', parentApproved: false, approved: false, viewer: 'institution' }), true);
  assert.equal(pageReleased({ ageTier: 'adult', parentApproved: false, approved: true, viewer: 'public' }), true);
});

test('the printed page keeps a public destination and hides a classmates-only quote from the public', () => {
  const lines = portraitLines({
    name: 'Ada Lovelace',
    className: 'Oak',
    quote: 'Keep the library open.',
    mostLikely: 'Open a school',
    clubs: 'Debate',
    achievements: ['Graduate'],
    destination: 'Oxford',
    audiences: audiences(),
    released: true,
  }, 'public');
  assert.equal(lines.some((line) => line.startsWith('Destination')), true);
  assert.equal(lines.some((line) => line.startsWith('Quote')), false);
  assert.equal(portraitLines({
    name: 'ada@school.edu',
    className: 'Oak',
    quote: '',
    mostLikely: '',
    clubs: '',
    achievements: [],
    destination: '',
    audiences: defaultAudiences(),
    released: true,
  }, 'classmates').some((line) => line.includes('@')), false);
});

test('contact details stay off a yearbook page and a minor signature waits', () => {
  assert.equal(screenOwnPage('See you at the reunion.').ok, true);
  assert.equal(screenOwnPage('Write me at ada@school.edu').ok, false);
  const held = screenSignature('See you there.', 'star', 'teen');
  assert.equal(held.decision, 'hold');
  assert.equal(held.visible, false);
  const sticker = screenSignature('', 'gold', 'adult');
  assert.equal(sticker.visible, true);
  assert.equal(screenSignature('I will kill the plan', '', 'adult').decision, 'block');
});

test('connection requests stay between adults who opted in', () => {
  const adult = { id: 'ada', ageTier: 'adult' as const, directory: true };
  const teen = { id: 'sam', ageTier: 'teen' as const, directory: true };
  assert.equal(canConnect(adult, { id: 'grace', ageTier: 'adult', directory: true }, false), true);
  assert.equal(canConnect(adult, teen, false), false);
  assert.equal(canConnect(adult, { id: 'grace', ageTier: 'adult', directory: false }, false), false);
  assert.equal(canConnect(adult, adult, false), false);
});

test('the map hides a country until five people share it', () => {
  const rows = [
    ...Array.from({ length: MIN_PLACE_BUCKET }, () => ({ country: 'Malaysia', shareName: false, name: 'Ada L.' })),
    { country: 'Malaysia', shareName: true, name: 'Ada L.' },
    { country: 'Norway', shareName: true, name: 'Grace H.' },
  ];
  const board = placeBoard(rows);
  assert.equal(board.countries.length, 1);
  assert.equal(board.countries[0]?.country, 'Malaysia');
  assert.deepEqual(board.countries[0]?.names, ['Ada L.']);
  assert.equal(board.hiddenCountries, 1);
});

test('a feed suggestion has to match a recorded achievement', () => {
  assert.equal(suggestionAllowed('Graduate', ['Graduate', 'IGCSE Mathematics']), true);
  assert.equal(suggestionAllowed('Nobel prize', ['Graduate']), false);
});

test('the yearbook download is a printable A4 PDF in the academy colour', () => {
  const pdf = Buffer.from(yearbookPdf({
    template: 'deep',
    academy: 'North Academy',
    sheets: [
      { heading: 'Oak 2026', lines: ['North Academy'] },
      { heading: 'Ada L.', lines: ['Destination: Oxford'] },
    ],
  }));
  const text = pdf.toString('latin1');
  assert.equal(readTemplate('forest'), 'deep');
  assert.equal(readTemplate('gold'), 'mid');
  assert.equal(text.startsWith('%PDF-1.4'), true);
  assert.match(text, /\/Count 2/);
  assert.match(text, /0 0 595 842/);
  assert.match(text, /0\.118 0\.416 0\.514/);
  assert.match(text, /Oak 2026/);
  assert.match(text, /Ada L\./);
});

test('a reunion date reopens the signing wall after the yearbook locks', () => {
  assert.equal(wallAcceptsNotes('2026-12-01', '2026-08-01', ''), false);
  assert.equal(wallAcceptsNotes('2026-12-01', '2026-08-01', '2026-12-12'), true);
  assert.equal(canEditYearbook('2026-12-01', '2026-08-01'), false);
});
