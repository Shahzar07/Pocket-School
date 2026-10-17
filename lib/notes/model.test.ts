import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NOTE_COLOURS,
  NOTE_TEXT_MAX,
  TRASH_MS,
  clampNoteText,
  filterNotes,
  noteActionPrompt,
  reminderDecision,
  reorderNotes,
  shareAllowed,
  trashExpired,
  type StickyNote,
} from './model';

const now = 1_700_000_000_000;

function note(partial: Partial<StickyNote> & Pick<StickyNote, 'id'>): StickyNote {
  return {
    text: 'Photosynthesis',
    colour: 'cyan',
    pinned: false,
    order: 0,
    board: 'My board',
    linkedTo: { type: 'none', id: '' },
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

function contrast(ink: string, fill: string): number {
  const channel = (hex: string) => {
    const value = hex.replace('#', '');
    const raw = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
    return raw.map((part) => (part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4));
  };
  const lum = (hex: string) => {
    const [r, g, b] = channel(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const lighter = Math.max(lum(ink), lum(fill));
  const darker = Math.min(lum(ink), lum(fill));
  return (lighter + 0.05) / (darker + 0.05);
}

test('sticky colours are pastel tints with AA ink and no yellow', () => {
  const banned = /yellow|mustard|gold|olive|#e2af4d|#f5c542|#c4b15a/i;
  for (const colour of NOTE_COLOURS) {
    assert.equal(colour.ink, '#203337');
    assert.equal(banned.test(`${colour.id} ${colour.label} ${colour.fill}`), false);
    assert.equal(contrast(colour.ink, colour.fill) >= 4.5, true, colour.id);
  }
});

test('text, order, search, and trash stay inside the note rules', () => {
  assert.equal(clampNoteText('a'.repeat(NOTE_TEXT_MAX + 20)).length, NOTE_TEXT_MAX);
  const notes = [
    note({ id: 'a', order: 0, text: 'Cells' }),
    note({ id: 'b', order: 1, text: 'Algebra', pinned: true, board: 'Mocks' }),
    note({ id: 'c', order: 2, text: 'Coast', deletedAt: now - 1000 }),
    note({ id: 'd', order: 3, text: 'Old', deletedAt: now - TRASH_MS - 1 }),
  ];
  const moved = reorderNotes([
    note({ id: 'a', order: 0 }),
    note({ id: 'b', order: 1 }),
    note({ id: 'c', order: 2, text: 'Coast' }),
  ], 'a', 'c');
  assert.deepEqual(moved.map((item) => item.id), ['b', 'c', 'a']);
  assert.deepEqual(moved.map((item) => item.order), [0, 1, 2]);
  const found = filterNotes(notes, { now, search: 'alg', board: 'Mocks' });
  assert.deepEqual(found.map((item) => item.id), ['b']);
  const trash = filterNotes(notes, { now, trash: true });
  assert.deepEqual(trash.map((item) => item.id), ['c']);
  assert.equal(trashExpired(now - TRASH_MS, now), true);
});

test('reminders wait during quiet hours and do not repeat', () => {
  assert.equal(reminderDecision({ remindAt: now - 1, remindedAt: 0, now, quiet: false }), 'send');
  assert.equal(reminderDecision({ remindAt: now - 1, remindedAt: 0, now, quiet: true }), 'wait');
  assert.equal(reminderDecision({ remindAt: now - 1, remindedAt: now, now, quiet: false }), 'skip');
  assert.equal(reminderDecision({ remindAt: now + 10, remindedAt: 0, now, quiet: false }), 'skip');
  assert.equal(reminderDecision({ remindAt: now - 1, deletedAt: now - 5, now, quiet: false }), 'skip');
});

test('sharing stays off for outsiders and for under-18s outside school', () => {
  const space = { kind: 'class', institutionId: 'school-a', memberIds: ['u1'], staffIds: [] };
  assert.equal(shareAllowed({ uid: 'u1', ageTier: 'teen', userInstitutionId: 'school-a', space }).ok, true);
  assert.equal(shareAllowed({ uid: 'u2', ageTier: 'adult', userInstitutionId: 'school-a', space }).ok, false);
  assert.equal(shareAllowed({
    uid: 'u1',
    ageTier: 'under13',
    userInstitutionId: 'school-a',
    space: { ...space, institutionId: 'school-b' },
  }).reason.includes('school'), true);
  assert.equal(shareAllowed({
    uid: 'u1',
    ageTier: 'teen',
    userInstitutionId: '',
    space,
  }).ok, false);
  assert.equal(shareAllowed({
    uid: 'u1',
    ageTier: 'adult',
    userInstitutionId: '',
    space: { kind: 'subject', institutionId: '', memberIds: ['u1'], staffIds: [] },
  }).ok, true);
});

test('ET AI prompts include the notes only when an action is built', () => {
  const prompt = noteActionPrompt('flashcards', [{ text: 'Mitosis', checklist: [{ id: '1', text: 'Stages', done: false }] }]);
  assert.match(prompt, /flashcards/i);
  assert.match(prompt, /Mitosis/);
  assert.match(prompt, /Stages/);
  assert.match(noteActionPrompt('summarise', [{ text: 'Only this' }]), /Only this/);
  assert.match(noteActionPrompt('plan', [{ text: 'Paper 2' }]), /revision plan/i);
});
