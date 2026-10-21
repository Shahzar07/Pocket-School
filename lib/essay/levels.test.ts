import assert from 'node:assert/strict';
import test from 'node:test';
import { markEssayAtLevel, mergeModelMark } from './mark-level';
import { DEGREE_PROMPT, DEGREE_SAMPLE, IGCSE_PROMPT, IGCSE_SAMPLE, MASTERS_PROMPT, MASTERS_SAMPLE, PHD_PROMPT, PHD_SAMPLE } from './samples';
import { gradeFromMark } from './scale';
import {
  ESSAY_LEVELS,
  ESTIMATE_LABEL,
  WRITING_TYPES,
  countWords,
  criteriaFor,
  essayWriterHref,
  mapEssayScale,
  referencingApplies,
  writingTypesFor,
} from './scale-config';

test('every level maps onto its own working scale', () => {
  assert.equal(mapEssayScale('primary', 80).headline, 'Greater depth');
  assert.equal(mapEssayScale('primary', 74).headline, 'Expected');
  assert.equal(mapEssayScale('primary', 45).headline, 'Expected');
  assert.equal(mapEssayScale('lower-secondary', 44).headline, 'Working towards');
  assert.equal(mapEssayScale('primary', 80).showsPercentage, true);

  for (const raw of [95, 80, 74, 61, 55, 40, 33, 20, 12, 4]) {
    const grade = gradeFromMark(raw);
    const mapped = mapEssayScale('igcse', raw);
    assert.equal(mapped.headline, `Level ${grade.level} · ${grade.letter}`);
    assert.equal(mapped.percentage, grade.mark);
    assert.equal(mapped.letter, grade.letter);
    assert.equal(mapped.showsPercentage, true);
  }

  assert.equal(mapEssayScale('a-level', 90).headline, 'A*');
  assert.equal(mapEssayScale('a-level', 85).headline, 'A');
  assert.equal(mapEssayScale('pre-university', 92).headline, 'A*');
  assert.equal(mapEssayScale('a-level', 40).headline, 'E');
  assert.equal(mapEssayScale('a-level', 39).headline, 'Below E');

  assert.equal(mapEssayScale('degree', 70).headline, 'First');
  assert.equal(mapEssayScale('degree', 69).headline, '2:1');
  assert.equal(mapEssayScale('degree', 60).headline, '2:1');
  assert.equal(mapEssayScale('degree', 59).headline, '2:2');
  assert.equal(mapEssayScale('degree', 50).headline, '2:2');
  assert.equal(mapEssayScale('degree', 40).headline, 'Third');
  assert.equal(mapEssayScale('degree', 39).headline, 'Fail');
  assert.equal(mapEssayScale('degree', 65).detail, 'Percentage band 60–69');

  assert.equal(mapEssayScale('degree', 82, { degreeStyle: 'cgpa' }).headline, '4.00');
  assert.equal(mapEssayScale('degree', 68, { degreeStyle: 'cgpa' }).headline, '3.00');
  assert.equal(mapEssayScale('degree', 36, { degreeStyle: 'cgpa' }).headline, '1.00');
  assert.equal(mapEssayScale('degree', 10, { degreeStyle: 'cgpa' }).headline, '0.00');
  assert.match(mapEssayScale('degree', 68, { degreeStyle: 'cgpa' }).detail, /not a university transcript/);

  assert.equal(mapEssayScale('masters', 70).headline, 'Distinction');
  assert.equal(mapEssayScale('masters', 69).headline, 'Merit');
  assert.equal(mapEssayScale('masters', 50).headline, 'Pass');
  assert.equal(mapEssayScale('masters', 49).headline, 'Fail');

  for (const raw of [90, 75, 74, 50, 49, 0]) {
    const phd = mapEssayScale('phd', raw);
    assert.equal(phd.percentage, null);
    assert.equal(phd.showsPercentage, false);
    assert.equal(phd.mark, 0);
    assert.equal(phd.letter, '');
    assert.equal(phd.detail, 'Readiness only. No grade is given.');
    assert.doesNotMatch(`${phd.headline} ${phd.detail}`, /%/);
  }
  assert.equal(mapEssayScale('phd', 75).headline, 'Ready');
  assert.equal(mapEssayScale('phd', 74).headline, 'Minor revisions');
  assert.equal(mapEssayScale('phd', 50).headline, 'Minor revisions');
  assert.equal(mapEssayScale('phd', 49).headline, 'Major revisions');

  assert.equal(mapEssayScale('professional', 75).headline, 'Accomplished');
  assert.equal(mapEssayScale('professional', 50).headline, 'Competent');
  assert.equal(mapEssayScale('professional', 49).headline, 'Developing');

  assert.equal(mapEssayScale('igcse', Number.NaN).headline, 'Level U · U');
  assert.equal(mapEssayScale('degree', 140).percentage, 100);
  assert.equal(mapEssayScale('degree', 140).headline, 'First');
  assert.equal(mapEssayScale(undefined, 74).scaleId, 'igcse');

  for (const level of ESSAY_LEVELS) {
    assert.equal(mapEssayScale(level.id, 60).estimateLabel, ESTIMATE_LABEL);
  }
});

test('writing types follow the level and every type is offered somewhere', () => {
  const seen = new Set<string>();
  for (const level of ESSAY_LEVELS) {
    for (const type of writingTypesFor(level.id)) seen.add(type.id);
  }
  assert.deepEqual([...seen].sort(), WRITING_TYPES.map((type) => type.id).sort());
  assert.equal(writingTypesFor('primary').some((type) => type.id === 'dissertation'), false);
  assert.equal(writingTypesFor('phd').some((type) => type.id === 'narrative'), false);
  assert.deepEqual(
    writingTypesFor('phd').map((type) => type.id),
    ['dissertation', 'proposal', 'literature-review', 'research-essay'],
  );
  assert.equal(writingTypesFor('igcse').some((type) => type.id === 'argumentative'), true);
});

test('criteria match the level unless a rubric replaces them', () => {
  assert.deepEqual(criteriaFor('igcse').map((item) => item.id), ['content', 'structure', 'language', 'spag']);
  assert.deepEqual(criteriaFor('primary').map((item) => item.label), ['Content', 'Structure', 'Language', 'SPaG']);
  assert.equal(criteriaFor('degree').some((item) => item.id === 'spag'), false);
  assert.equal(criteriaFor('degree').some((item) => item.label === 'Argument and thesis'), true);
  assert.equal(criteriaFor('a-level').some((item) => item.label === 'Referencing accuracy'), true);
  for (const level of ['masters', 'phd'] as const) {
    for (const label of ['Research question clarity', 'Literature engagement', 'Methodology', 'Contribution']) {
      assert.equal(criteriaFor(level).some((item) => item.label === label), true, level);
    }
  }
  assert.deepEqual(
    criteriaFor('igcse', 'Clarity of the point\n- Use of the text').map((item) => item.label),
    ['Clarity of the point', 'Use of the text'],
  );
  assert.equal(referencingApplies('degree'), true);
  assert.equal(referencingApplies('masters'), true);
  assert.equal(referencingApplies('phd'), true);
  assert.equal(referencingApplies('igcse'), false);
  assert.equal(referencingApplies('professional'), false);
});

test('sample essays land on the IGCSE, degree, masters, and PhD scales', () => {
  const igcse = markEssayAtLevel({
    essay: IGCSE_SAMPLE,
    prompt: IGCSE_PROMPT,
    levelId: 'igcse',
    writingType: 'argumentative',
    wordTarget: countWords(IGCSE_SAMPLE),
    subject: 'English',
    board: 'Cambridge',
  });
  assert.equal(igcse.headline, 'Level 8 · A*');
  assert.equal(igcse.percentage, 84);
  assert.equal(igcse.letter, 'A*');
  assert.deepEqual(igcse.criteria.map((item) => item.id), ['content', 'structure', 'language', 'spag']);

  const degree = markEssayAtLevel({
    essay: DEGREE_SAMPLE,
    prompt: DEGREE_PROMPT,
    levelId: 'degree',
    writingType: 'research-essay',
    wordTarget: countWords(DEGREE_SAMPLE),
    referencing: 'harvard',
    degreeStyle: 'uk',
  });
  assert.equal(degree.headline, '2:1');
  assert.equal(degree.percentage, 68);
  assert.equal(degree.detail, 'Percentage band 60–69');
  assert.match(degree.criteria.find((item) => item.id === 'referencing')?.fix ?? '', /Harvard/);
  assert.equal(mapEssayScale('degree', degree.percentage ?? 0, { degreeStyle: 'cgpa' }).headline, '3.00');

  const masters = markEssayAtLevel({
    essay: MASTERS_SAMPLE,
    prompt: MASTERS_PROMPT,
    levelId: 'masters',
    writingType: 'literature-review',
    wordTarget: countWords(MASTERS_SAMPLE),
    referencing: 'apa',
  });
  assert.equal(masters.headline, 'Distinction');
  assert.equal(masters.percentage, 70);
  assert.equal(masters.criteria.some((item) => item.id === 'methodology'), true);

  const phd = markEssayAtLevel({
    essay: PHD_SAMPLE,
    prompt: PHD_PROMPT,
    levelId: 'phd',
    writingType: 'dissertation',
    wordTarget: 900,
    referencing: 'chicago',
  });
  assert.equal(phd.headline, 'Minor revisions');
  assert.equal(phd.percentage, null);
  assert.equal(phd.showsPercentage, false);
  assert.equal(phd.mark, 0);
  assert.equal(phd.letter, '');
  assert.match(phd.criteria[0]?.scoreLabel ?? '', /\/ 5$/);

  for (const marked of [igcse, degree, masters, phd]) {
    assert.equal(marked.estimateLabel, ESTIMATE_LABEL);
    assert.ok(marked.nextSteps.length >= 2);
    assert.equal(marked.improvedParagraph.includes('\n\n'), false);
    assert.ok(marked.improvedParagraph.length < 500);
    const essay = marked === igcse ? IGCSE_SAMPLE : marked === degree ? DEGREE_SAMPLE : marked === masters ? MASTERS_SAMPLE : PHD_SAMPLE;
    for (const criterion of marked.criteria) {
      assert.equal(essay.includes(criterion.quote), true, criterion.quote);
      assert.ok(criterion.strength.length > 8);
      assert.ok(criterion.fix.length > 8);
    }
    const reused = marked.criteria.some((item) => {
      const snippet = item.quote.replace(/[.!?]+$/, '').slice(0, 24).toLowerCase();
      return snippet.length > 8 && marked.improvedParagraph.toLowerCase().includes(snippet);
    });
    assert.equal(reused, true);
  }
});

test('a pasted rubric replaces the default criteria', () => {
  const marked = markEssayAtLevel({
    essay: IGCSE_SAMPLE,
    levelId: 'igcse',
    wordTarget: countWords(IGCSE_SAMPLE),
    rubric: 'Clarity of the point\nUse of the text',
  });
  assert.deepEqual(marked.criteria.map((item) => item.label), ['Clarity of the point', 'Use of the text']);
  assert.equal(marked.criteria.some((item) => item.id === 'spag'), false);
});

test('a model percentage is mapped on our scale and a PhD mark stays a readiness', () => {
  const local = markEssayAtLevel({ essay: IGCSE_SAMPLE, levelId: 'igcse', wordTarget: countWords(IGCSE_SAMPLE) });
  const merged = mergeModelMark(local, IGCSE_SAMPLE, { mark: 74, feedback: 'A tighter ending would help.' });
  assert.equal(merged.source, 'model');
  assert.equal(merged.headline, 'Level 7 · A');
  assert.equal(merged.percentage, 74);
  assert.equal(merged.feedback, 'A tighter ending would help.');
  assert.equal(merged.estimateLabel, ESTIMATE_LABEL);

  const phd = markEssayAtLevel({ essay: PHD_SAMPLE, levelId: 'phd', wordTarget: 900 });
  const doctoral = mergeModelMark(phd, PHD_SAMPLE, { mark: 90 });
  assert.equal(doctoral.headline, 'Ready');
  assert.equal(doctoral.percentage, null);
  assert.equal(doctoral.showsPercentage, false);
});

test('an assigned task carries the level, writing type, and rubric', () => {
  const href = essayWriterHref({
    essayLevel: 'degree',
    essayType: 'research-essay',
    essayRubric: 'Thesis\nSources',
    essaySubject: 'Law',
    essayBoard: 'Cambridge',
    essayWordTarget: 1500,
    essayReferencing: 'oscola',
    essayDegreeStyle: 'cgpa',
  });
  const params = new URLSearchParams(href.split('?')[1]);
  assert.equal(params.get('level'), 'degree');
  assert.equal(params.get('type'), 'research-essay');
  assert.equal(params.get('rubric'), 'Thesis\nSources');
  assert.equal(params.get('subject'), 'Law');
  assert.equal(params.get('referencing'), 'oscola');
  assert.equal(params.get('degreeStyle'), 'cgpa');
  assert.equal(params.get('words'), '1500');
});
