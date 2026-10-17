import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isEssayShaped } from '../essays/plan';
import {
  acceptParentTranslation,
  acceptResearchPack,
  acceptTeacherPack,
  canUseDeskTool,
  DESK_SPARK_COSTS,
  explainerLines,
  factsFromSnapshot,
  hasChildActivity,
  ownsChild,
  parentExplainerFromFacts,
  parentFactText,
  RESEARCH_INTEGRITY,
  researchLines,
  researchQuestion,
  stripYearLabels,
  teacherFallback,
  toolkitLessonBody,
} from './desk';

test('desk tools are gated by role', () => {
  assert.equal(canUseDeskTool({ role: 'teacher' }, 'teacher-toolkit'), true);
  assert.equal(canUseDeskTool({ role: 'institution_admin' }, 'teacher-toolkit'), true);
  assert.equal(canUseDeskTool({ role: 'admin' }, 'teacher-toolkit'), true);
  assert.equal(canUseDeskTool({ role: 'student' }, 'teacher-toolkit'), false);
  assert.equal(canUseDeskTool({ role: 'parent' }, 'teacher-toolkit'), false);

  assert.equal(canUseDeskTool({ role: 'parent' }, 'parent-explainer'), true);
  assert.equal(canUseDeskTool({ role: 'teacher', roles: ['teacher', 'parent'] }, 'parent-explainer'), true);
  assert.equal(canUseDeskTool({ role: 'teacher' }, 'parent-explainer'), false);
  assert.equal(canUseDeskTool({ role: 'student' }, 'parent-explainer'), false);

  assert.equal(canUseDeskTool({ role: 'student' }, 'research-helper'), true);
  assert.equal(canUseDeskTool({ role: 'teacher' }, 'research-helper'), true);
  assert.equal(canUseDeskTool({ role: 'parent' }, 'research-helper'), false);
  assert.equal(canUseDeskTool({ role: 'institution_admin' }, 'research-helper'), false);
});

test('a parent can explain only a linked child', () => {
  assert.equal(ownsChild(['child-1'], 'child-1'), true);
  assert.equal(ownsChild(['child-1'], 'child-2'), false);
  assert.equal(ownsChild([], 'child-1'), false);
  assert.equal(ownsChild(undefined, 'child-1'), false);
});

test('teacher pack keeps one task in support, core, and stretch and drops year labels', () => {
  const pack = acceptTeacherPack({
    title: 'Fractions in Year 7',
    subject: 'Mathematics',
    level: 'Lower Secondary',
    objectives: ['See a half'],
    differentiated: {
      task: 'Shade one half of a shape.',
      support: 'Year 4 word bank: half, equal.',
      core: 'Shade one half and say why.',
      stretch: 'Shade one half, then a case where 2024 pieces would not be half.',
    },
    rubric: [{ criterion: 'Accuracy', support: 'Uses the bank', core: 'Explains', stretch: 'Finds the limit' }],
  }, { topic: 'Fractions', subject: 'Mathematics', level: 'Lower Secondary', kind: 'pack' });

  assert.equal(pack.differentiated.task, 'Shade one half of a shape.');
  assert.match(pack.differentiated.support, /Shade one half|word bank/);
  assert.equal(pack.differentiated.support.includes('Year'), false);
  assert.equal(pack.title.includes('Year'), false);
  assert.equal(pack.differentiated.stretch.includes('2024'), false);
  assert.equal(stripYearLabels('Year 10 and 2026'), 'and');
  const body = toolkitLessonBody(pack);
  assert.match(body, /Support \(SEN\)/);
  assert.equal(/\bYear\s+\d/.test(body), false);
  assert.equal(/\b20\d{2}\b/.test(body), false);
});

test('an empty week is not filled in', () => {
  const facts = factsFromSnapshot('Mina', null, []);
  assert.equal(hasChildActivity(facts), false);
  const note = parentExplainerFromFacts(facts);
  assert.equal(note.empty, true);
  assert.match(note.learned, /will not guess/);
  assert.equal(numbersInSafe(parentFactText(note)), true);
});

test('the parent note uses only saved activity', () => {
  const facts = factsFromSnapshot('Mina', {
    metrics: { study_time: 40, quiz_average: 72, mastery: 61, lessons_completed: 3 },
    goalsMet: 2,
    goalsMissed: 1,
    strengths: ['fractions'],
    weaknesses: ['decimals'],
    courseProgress: [{ label: 'Mathematics', progress: 48 }],
    misconceptions: [{ topic: 'place value' }],
  }, ['Finish the fractions goal']);
  assert.equal(hasChildActivity(facts), true);
  const note = parentExplainerFromFacts(facts);
  assert.match(note.learned, /40 minutes/);
  assert.match(note.learned, /Mathematics at 48%/);
  assert.match(note.strengths, /fractions/);
  assert.match(note.strengths, /72%/);
  assert.match(note.gaps, /decimals/);
  assert.match(note.gaps, /place value/);
  assert.match(note.helpAtHome.join(' '), /decimals/);
  const translated = acceptParentTranslation(
    `${note.learned}\n\n${note.strengths}\n\nMina scored 99% this week.\n\nHelp at home.`,
    note,
    'Spanish',
  );
  assert.equal(translated.language, 'en');
  const kept = acceptParentTranslation(
    `Mina estudió 40 minutos.\n\nFuerte en fractions. Quiz average is 72%.\n\ndecimals y place value.\n\nPregunta por decimals.\n\nMira Finish the fractions goal.`,
    note,
    'Spanish',
  );
  assert.equal(kept.language, 'Spanish');
  assert.equal(proseHasOnly(parentFactText(kept), parentFactText(note)), true);
});

test('research helper cites sources and refuses to write the assignment', () => {
  const asked = researchQuestion('Please write my essay about photosynthesis in full');
  assert.equal(asked.refusedWriting, true);
  assert.match(asked.question, /photosynthesis/i);
  assert.equal(WRITE_LEFT(asked.question), false);

  const pack = acceptResearchPack({
    sources: [
      {
        title: 'NASA Climate',
        authors: 'NASA',
        url: 'https://climate.nasa.gov',
        summary: 'A short public page on how plants use light. It is not a student essay.',
        credibility: 'A government science office. Check the date on the page.',
        citations: {
          apa: 'NASA. NASA Climate. https://climate.nasa.gov',
          harvard: 'NASA, NASA Climate. Available at: https://climate.nasa.gov',
          mla: 'NASA. "NASA Climate." https://climate.nasa.gov',
        },
      },
      {
        title: 'Invented essay',
        authors: 'ET AI',
        url: '',
        summary: 'Photosynthesis is the process plants use. '.repeat(40) + 'In conclusion the essay is complete and this is the assignment answer for the student to hand in with many long sentences that form paragraphs.\n\nThe second paragraph continues the finished essay so the marker would accept it as the student\'s own completed work today.',
        credibility: 'This one was dropped.',
      },
    ],
    nextSteps: ['Here is the completed essay about photosynthesis and the long argument that follows in several sentences of the assignment itself for the student.'],
  }, asked);

  assert.ok(pack);
  assert.equal(pack?.integrity, RESEARCH_INTEGRITY);
  assert.equal(pack?.sources.length, 2);
  assert.match(pack?.sources[1]?.summary ?? '', /removed because it started to write/);
  assert.equal(isEssayShaped(pack?.sources[0]?.summary ?? ''), false);
  assert.equal(pack?.sources.every(source => source.citations.apa && source.citations.harvard && source.citations.mla), true);
  const lines = researchLines(pack!);
  assert.equal(lines.some(line => /in conclusion/i.test(line)), false);
  assert.match(lines.join('\n'), /never writes the assignment/);
});

test('a research reply with no source is refused', () => {
  assert.equal(acceptResearchPack({ sources: [{ summary: 'No title' }] }, { question: 'Cells', refusedWriting: false }), null);
});

test('a parent note names saved badges', () => {
  const facts = factsFromSnapshot('Mina', {
    metrics: { study_time: 15 },
  }, [], ['First lesson', 'Linked & involved']);
  const note = parentExplainerFromFacts(facts);
  assert.equal(note.empty, false);
  assert.deepEqual(note.badges, ['First lesson', 'Linked & involved']);
  assert.match(note.learned, /First lesson/);
  assert.match(explainerLines(note).join('\n'), /Badges/);
});

test('sparks costs are set for every desk tool', () => {
  assert.deepEqual(DESK_SPARK_COSTS, {
    'teacher-toolkit': 15,
    'parent-explainer': 8,
    'research-helper': 10,
  });
});

test('the local teacher pack is a draft of the same task', () => {
  const pack = teacherFallback({ topic: 'Photosynthesis', subject: 'Science', level: 'IGCSE', kind: 'differentiated' });
  assert.equal(pack.kind, 'differentiated');
  assert.match(pack.differentiated.support, /SEN/);
  assert.match(pack.differentiated.core, /Photosynthesis/);
  assert.match(pack.differentiated.stretch, /Photosynthesis/);
  assert.equal(/\b20\d{2}\b/.test(toolkitLessonBody(pack)), false);
});

function numbersInSafe(text: string): boolean {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).length === 0;
}

function proseHasOnly(prose: string, source: string): boolean {
  const allowed = new Set(source.match(/\d+(?:\.\d+)?/g) ?? []);
  return (prose.match(/\d+(?:\.\d+)?/g) ?? []).every(value => allowed.has(value));
}

function WRITE_LEFT(value: string): boolean {
  return /\b(write|draft|complete)\b/i.test(value);
}
