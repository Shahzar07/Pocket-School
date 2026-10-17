import assert from 'node:assert/strict';
import test from 'node:test';
import { caseCardHtml, caseCardSubject, caseCardText, type CaseCard } from './template';

const card: CaseCard = {
  typeLabel: 'Danger now',
  fullName: 'Aisha Rahman',
  studentNumber: 'PS-1044',
  classLabel: '5 Amanah',
  photoUrl: 'https://poketschool.ai/photos/aisha.jpg',
  guardians: [{ name: 'Farah Rahman', phone: '+603000000', email: 'farah@example.com' }],
  description: 'Needs help at the gate.',
  location: 'School gate',
  atIso: '2026-10-17T04:30:00.000Z',
  caseId: 'ticket-1',
  caseUrl: 'https://poketschool.ai/dashboard/safety/ticket-1',
  parentsExcluded: true,
};

test('the confidential card names the child and tells staff not to forward it', () => {
  const text = caseCardText(card);
  const html = caseCardHtml(card);
  assert.equal(caseCardSubject(card.typeLabel), 'Confidential: Danger now');
  assert.equal(caseCardSubject(card.typeLabel).includes('Aisha'), false);
  assert.match(text, /Confidential, do not forward/);
  assert.match(html, /Confidential, do not forward/);
  assert.match(text, /Aisha Rahman/);
  assert.match(text, /PS-1044/);
  assert.match(text, /5 Amanah/);
  assert.match(text, /Farah Rahman/);
  assert.match(text, /\+603000000/);
  assert.match(text, /farah@example.com/);
  assert.match(text, /Needs help at the gate/);
  assert.match(text, /School gate/);
  assert.match(text, /ticket-1/);
  assert.match(text, /https:\/\/poketschool\.ai\/dashboard\/safety\/ticket-1/);
  assert.match(text, /Parents were not notified/);
  assert.match(html, /#2786A4/);
  assert.match(html, /https:\/\/poketschool\.ai\/photos\/aisha\.jpg/);
  assert.match(html, /Parents were not notified/);
});

test('an empty card stays confidential and does not invent a guardian', () => {
  const empty = caseCardText({
    ...card,
    fullName: '',
    studentNumber: '',
    guardians: [],
    location: '',
    parentsExcluded: false,
  });
  assert.match(empty, /Not on file/);
  assert.match(empty, /No parent or guardian is linked/);
  assert.equal(empty.includes('Parents were not notified'), false);
});
