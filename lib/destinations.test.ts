import assert from 'node:assert/strict';
import { test } from 'node:test';
import { destinationBoard, detectDestination, stateDestination, type DestinationRow } from './destinations';

function row(patch: Partial<DestinationRow> & Pick<DestinationRow, 'name'>): DestinationRow {
  return {
    kind: 'university',
    course: 'Medicine',
    country: 'Malaysia',
    source: 'stated',
    shareWithSchools: true,
    shareName: false,
    testimonial: '',
    shareTestimonial: false,
    fromInstitutionId: 'north',
    learnerName: '',
    ...patch,
  };
}

test('a move to another academy is recorded only with consent', () => {
  assert.equal(detectDestination({ consent: false, institutionName: 'Harbour College', level: 'A-Level', country: 'Malaysia' }), null);
  const detected = detectDestination({ consent: true, institutionName: 'Harbour College', level: 'A-Level', country: 'Malaysia' });
  assert.equal(detected?.source, 'detected');
  assert.equal(detected?.shareName, false);
  assert.equal(detected?.shareWithSchools, true);
  assert.deepEqual(stateDestination({ kind: 'university', name: '  ', shareWithSchools: true, shareName: true, shareTestimonial: false }), {
    error: 'Add the university, college, or workplace.',
  });
});

test('destination counts under five stay hidden and an opted-in name still shows', () => {
  const many = Array.from({ length: 5 }, () => row({ name: 'University of Malaya' }));
  const quiet = [row({ name: 'Small College', country: 'Singapore', course: 'Design' }), row({ name: 'Small College', country: 'Singapore', course: 'Design' })];
  const named = row({
    name: 'Studio School',
    course: 'Design',
    country: 'Singapore',
    shareName: true,
    learnerName: 'Ada L.',
    testimonial: 'The science course carried me to the next step.',
    shareTestimonial: true,
  });
  const board = destinationBoard([...many, ...quiet, named]);
  assert.equal(board.institutions.some((bucket) => bucket.label === 'University of Malaya' && bucket.count >= 5), true);
  assert.equal(board.institutions.some((bucket) => bucket.label === 'Small College'), false);
  assert.equal(board.institutions.some((bucket) => bucket.label === 'Studio School'), false);
  assert.ok(board.hiddenBuckets >= 1);
  assert.deepEqual(board.named, [{ name: 'Ada L.', destination: 'Studio School', course: 'Design' }]);
  assert.equal(board.testimonials[0]?.name, 'Ada L.');
  assert.match(board.testimonials[0]?.quote ?? '', /science course/);
});
