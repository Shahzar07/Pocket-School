import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_LEVELS } from './course-builder';
import { NAMED_LEVELS } from './example-courses';
import {
  NOT_APPLICABLE,
  PROGRAMMES,
  allocationLevelOptions,
  allocationYearsFor,
  assertPlacement,
  cmsSubjectYearOptions,
  cmsYearLevelSuggestions,
  displayLevels,
  levelsForProgramme,
  signupProgrammeOptions,
  suggestPlacementFromDob,
  toNamedLevel,
} from './programmes';

test('sign-up programme and level options equal the CMS taxonomy', () => {
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

test('programmes use named levels and never school year numbers', () => {
  assert.deepEqual([...levelsForProgramme('Primary')], ['Primary']);
  assert.deepEqual([...levelsForProgramme('Lower Secondary')], ['Lower Secondary']);
  assert.deepEqual([...levelsForProgramme('IGCSE')], ['IGCSE']);
  assert.deepEqual([...levelsForProgramme('A-Level')], ['A-Level']);
  assert.deepEqual([...levelsForProgramme('Pre-University')], ['Pre-University']);
  assert.deepEqual([...levelsForProgramme('LLB Law')], ['Degree']);
  assert.deepEqual([...levelsForProgramme('MBBS Medicine')], ['Degree']);
  assert.deepEqual([...levelsForProgramme('Micro Degree')], ['Degree']);
  assert.deepEqual([...levelsForProgramme('Professional Certification')], ['Professional']);
  assert.deepEqual([...levelsForProgramme('Independent Learning')], [NOT_APPLICABLE]);
  assert.deepEqual([...levelsForProgramme('Engineering')], ['Foundation', 'Degree']);
  assert.deepEqual([...levelsForProgramme('Nursing')], ['Foundation', 'Degree']);
  assert.equal(PROGRAMMES.find((item) => item.value === 'LLB Law')?.summary?.includes('University of London (UoL)'), true);
  for (const level of NAMED_LEVELS) {
    assert.equal(PROGRAMMES.some((programme) => programme.years.includes(level) || programme.label === level), true);
  }
});

test('CMS cards show levels instead of year numbers', () => {
  assert.equal(displayLevels(['Year 9', 'Year 10', 'Year 11']), 'Lower Secondary · IGCSE');
  assert.equal(displayLevels(['IGCSE – Year 9', 'Year 10', 'Year 11']), 'Lower Secondary · IGCSE');
  assert.equal(displayLevels(['Year 1', 'Year 6']), 'Primary');
  assert.equal(displayLevels(['Year 1 (LLB)', 'Year 2 (LLB)', 'Year 3 (LLB)']), 'Degree');
  assert.equal(displayLevels(['Year 1 (MBBS)', 'Year 5 (MBBS)']), 'Degree');
  assert.equal(displayLevels(['Foundation', 'Degree']), 'Foundation · Degree');
  assert.equal(displayLevels(['Form 4']), 'IGCSE');
  assert.equal(displayLevels(['Y7']), 'Lower Secondary');
  assert.equal(displayLevels(null), '');
  assert.equal(toNamedLevel('Year 8'), 'Lower Secondary');
  assert.equal(toNamedLevel('Degree'), 'Degree');
});

test('the server rejects a level that belongs to a different programme', () => {
  assert.throws(() => assertPlacement('Primary', 'IGCSE'), /does not belong/);
  assert.throws(() => assertPlacement('IGCSE', 'Primary'), /does not belong/);
  assert.throws(() => assertPlacement('Made up', 'Primary'), /Choose a programme/);
  assert.deepEqual(assertPlacement('IGCSE', 'IGCSE'), {
    pathway: 'IGCSE',
    level: 'IGCSE',
    yearGroup: 'IGCSE',
  });
  assert.deepEqual(assertPlacement('IGCSE', 'Year 11'), {
    pathway: 'IGCSE',
    level: 'IGCSE',
    yearGroup: 'IGCSE',
  });
  assert.deepEqual(assertPlacement('secondary', 'Year 8'), {
    pathway: 'Lower Secondary',
    level: 'Lower Secondary',
    yearGroup: 'Lower Secondary',
  });
  assert.deepEqual(assertPlacement('Independent Learning', NOT_APPLICABLE), {
    pathway: 'Independent Learning',
    level: 'Independent Learning',
    yearGroup: '',
  });
  assert.deepEqual(assertPlacement('', ''), { pathway: '', level: '', yearGroup: '' });
});

test('changing the programme drops levels that no longer belong', () => {
  const primary = allocationYearsFor(['Primary']);
  assert.equal(primary.includes('IGCSE'), false);
  assert.deepEqual(
    [...allocationYearsFor(['Primary', 'IGCSE'])],
    ['Primary', 'IGCSE'],
  );
  assert.deepEqual([...allocationYearsFor(['lower-secondary'])], ['Lower Secondary']);
});

test('a date of birth suggests the matching programme and level', () => {
  const now = new Date(2026, 9, 15);
  assert.deepEqual(suggestPlacementFromDob('2012-01-15', now), { programme: 'IGCSE', year: 'IGCSE' });
  assert.deepEqual(suggestPlacementFromDob('2013-03-01', now), { programme: 'Lower Secondary', year: 'Lower Secondary' });
  assert.deepEqual(suggestPlacementFromDob('2010-06-01', now), { programme: 'A-Level', year: 'A-Level' });
  assert.deepEqual(suggestPlacementFromDob('2000-01-01', now), { programme: 'Independent Learning', year: NOT_APPLICABLE });
  assert.equal(suggestPlacementFromDob('not-a-date', now), null);
});

test('a custom CMS programme keeps its own stored levels, rewritten when they are year numbers', () => {
  assert.deepEqual(
    [...cmsSubjectYearOptions('iLowerSecondary', ['Year 7', 'Year 8', 'Year 9'])],
    ['Lower Secondary'],
  );
  assert.deepEqual([...cmsSubjectYearOptions('Lower Secondary', ['Year 1'])], [...levelsForProgramme('Lower Secondary')]);
});
