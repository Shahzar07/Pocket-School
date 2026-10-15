import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_LEVELS } from './course-builder';
import {
  NOT_APPLICABLE,
  PROGRAMMES,
  allocationLevelOptions,
  allocationYearsFor,
  assertPlacement,
  cmsSubjectYearOptions,
  cmsYearLevelSuggestions,
  levelsForProgramme,
  signupProgrammeOptions,
  suggestPlacementFromDob,
} from './programmes';

test('sign-up programme and year options equal the CMS taxonomy', () => {
  const signup = signupProgrammeOptions().map((option) => option.value);
  assert.deepEqual(signup, PROGRAMMES.map((programme) => programme.value));
  assert.deepEqual([...allocationLevelOptions()], signup);
  assert.deepEqual(COURSE_LEVELS.filter((level) => level !== 'All'), signup);

  for (const programme of signup) {
    const years = [...levelsForProgramme(programme)];
    assert.deepEqual([...allocationYearsFor([programme])], years);
    assert.deepEqual([...cmsSubjectYearOptions(programme)], years);
  }

  assert.deepEqual(
    [...cmsYearLevelSuggestions()],
    [...new Set(PROGRAMMES.flatMap((programme) => [...levelsForProgramme(programme.value)]))],
  );
});

test('school programmes use the year bands from the master brief', () => {
  assert.deepEqual(
    [...levelsForProgramme('Primary')],
    ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'],
  );
  assert.deepEqual([...levelsForProgramme('Lower Secondary')], ['Year 7', 'Year 8', 'Year 9']);
  assert.deepEqual([...levelsForProgramme('IGCSE')], ['Year 10', 'Year 11']);
  assert.deepEqual([...levelsForProgramme('A-Level')], ['Year 12', 'Year 13']);
  assert.deepEqual([...levelsForProgramme('LLB Law')], ['Year 1 (LLB)', 'Year 2 (LLB)', 'Year 3 (LLB)']);
  assert.deepEqual([...levelsForProgramme('MBBS Medicine')], [
    'Year 1 (MBBS)', 'Year 2 (MBBS)', 'Year 3 (MBBS)', 'Year 4 (MBBS)', 'Year 5 (MBBS)',
  ]);
  assert.deepEqual([...levelsForProgramme('Micro Degree')], [NOT_APPLICABLE]);
  assert.deepEqual([...levelsForProgramme('Professional Certification')], [NOT_APPLICABLE]);
  assert.deepEqual([...levelsForProgramme('Independent Learning')], [NOT_APPLICABLE]);
});

test('the server rejects a year that belongs to a different programme', () => {
  assert.throws(() => assertPlacement('Primary', 'Year 10'), /does not belong/);
  assert.throws(() => assertPlacement('IGCSE', 'Year 7'), /does not belong/);
  assert.throws(() => assertPlacement('Made up', 'Year 1'), /Choose a programme/);
  assert.deepEqual(assertPlacement('IGCSE', 'Year 11'), {
    pathway: 'IGCSE',
    level: 'IGCSE',
    yearGroup: 'Year 11',
  });
  assert.deepEqual(assertPlacement('secondary', 'Year 8'), {
    pathway: 'Lower Secondary',
    level: 'Lower Secondary',
    yearGroup: 'Year 8',
  });
  assert.deepEqual(assertPlacement('Independent Learning', NOT_APPLICABLE), {
    pathway: 'Independent Learning',
    level: 'Independent Learning',
    yearGroup: '',
  });
  assert.deepEqual(assertPlacement('', ''), { pathway: '', level: '', yearGroup: '' });
});

test('changing the programme drops years that no longer belong', () => {
  const primary = allocationYearsFor(['Primary']);
  assert.equal(primary.includes('Year 7'), false);
  assert.deepEqual(
    [...allocationYearsFor(['Primary', 'IGCSE'])],
    ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Year 10', 'Year 11'],
  );
  assert.deepEqual([...allocationYearsFor(['lower-secondary'])], ['Year 7', 'Year 8', 'Year 9']);
});

test('a date of birth suggests the matching programme and year', () => {
  const now = new Date(2026, 9, 15);
  assert.deepEqual(suggestPlacementFromDob('2012-01-15', now), { programme: 'IGCSE', year: 'Year 10' });
  assert.deepEqual(suggestPlacementFromDob('2013-03-01', now), { programme: 'Lower Secondary', year: 'Year 9' });
  assert.deepEqual(suggestPlacementFromDob('2010-06-01', now), { programme: 'A-Level', year: 'Year 12' });
  assert.deepEqual(suggestPlacementFromDob('2000-01-01', now), { programme: 'Independent Learning', year: NOT_APPLICABLE });
  assert.equal(suggestPlacementFromDob('not-a-date', now), null);
});

test('a custom CMS programme keeps its own stored years', () => {
  assert.deepEqual(
    [...cmsSubjectYearOptions('iLowerSecondary', ['Year 7', 'Year 8', 'Year 9'])],
    ['Year 7', 'Year 8', 'Year 9'],
  );
  assert.deepEqual([...cmsSubjectYearOptions('Lower Secondary', ['Year 1'])], [...levelsForProgramme('Lower Secondary')]);
});
