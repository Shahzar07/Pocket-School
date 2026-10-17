import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  gradeUnitTest, itemAnalysis, parentExplainer, parseUnitTestImport, previousUnitUnlocked,
  quizPointsFromAttempt, resolvePassMark, reviewGate, versionForAttempt,
  type UnitTestQuestion,
} from './unit-test';
import { visualPublishErrors, type VisualBlock } from './visual-blocks';

const paper: UnitTestQuestion[] = [
  {
    id: 'q1', prompt: 'Name the process plants use to make food.',
    options: [{ id: 'opt:0', text: 'Digestion' }, { id: 'opt:1', text: 'Photosynthesis' }],
    answerId: 'opt:1', marks: 2, bloom: 'Remember', lessonId: 'lesson-plants',
  },
  {
    id: 'q2', prompt: 'Which organ pumps blood?',
    options: [{ id: 'opt:0', text: 'Lung' }, { id: 'opt:1', text: 'Heart' }],
    answerId: 'opt:1', marks: 3, bloom: 'Understand', lessonId: 'lesson-heart',
  },
];

describe('unit test pass mark and versions', () => {
  it('defaults to 70 and lets a course mark replace a default unit mark', () => {
    assert.equal(resolvePassMark(null, null), 70);
    assert.equal(resolvePassMark({ unitTestPassMark: 80 }, { masteryThreshold: 70 }), 80);
    assert.equal(resolvePassMark({ unitTestPassMark: 80 }, { masteryThreshold: 85 }), 85);
    assert.equal(resolvePassMark({ unitTestPassMark: 80 }, { unitTestPassMark: 60, masteryThreshold: 85 }), 60);
  });

  it('alternates version A and version B', () => {
    assert.equal(versionForAttempt(1), 'A');
    assert.equal(versionForAttempt(2), 'B');
    assert.equal(versionForAttempt(3), 'A');
    assert.equal(versionForAttempt(4), 'B');
  });
});

describe('unit test grading and review lock', () => {
  it('scores by marks and lists the lessons behind missed questions', () => {
    const graded = gradeUnitTest(paper, { q1: 'opt:0', q2: 'opt:1' }, 70);
    assert.equal(graded.marksAwarded, 3);
    assert.equal(graded.marksMax, 5);
    assert.equal(graded.percentage, 60);
    assert.equal(graded.passed, false);
    assert.deepEqual(graded.recommendedLessonIds, ['lesson-plants']);
  });

  it('locks the retake until those lessons are completed again, then offers version B', () => {
    const failed = reviewGate([
      { passed: false, attemptNumber: 1, completedAtMs: 1_000, recommendedLessonIds: ['lesson-plants'], lessonId: 'test' },
    ], { 'lesson-plants': 500 }, 'test');
    assert.equal(failed.locked, true);
    assert.deepEqual(failed.pendingLessonIds, ['lesson-plants']);
    assert.equal(failed.nextVersion, 'B');

    const ready = reviewGate([
      { passed: false, attemptNumber: 1, completedAtMs: 1_000, recommendedLessonIds: ['lesson-plants'], lessonId: 'test' },
    ], { 'lesson-plants': 2_000 }, 'test');
    assert.equal(ready.locked, false);
    assert.equal(ready.nextVersion, 'B');

    const again = reviewGate([
      { passed: false, attemptNumber: 1, completedAtMs: 1_000, recommendedLessonIds: ['lesson-plants'], lessonId: 'test' },
      { passed: false, attemptNumber: 2, completedAtMs: 3_000, recommendedLessonIds: ['lesson-heart'], lessonId: 'test' },
    ], { 'lesson-plants': 2_000, 'lesson-heart': 2_500 }, 'test');
    assert.equal(again.locked, true);
    assert.equal(again.nextVersion, 'A');
  });

  it('unlocks the next module only after a pass', () => {
    const units = [
      { module: { id: 'u1' }, lessons: [{ lessonType: 'unit_test' as const }] },
      { module: { id: 'u2' }, lessons: [{ lessonType: 'lesson' as const }] },
    ];
    assert.equal(previousUnitUnlocked(units, 1, []), false);
    assert.equal(previousUnitUnlocked(units, 1, [{ unitId: 'u1', passed: true }]), true);
    assert.equal(previousUnitUnlocked([{ module: { id: 'u1' }, lessons: [{ lessonType: 'lesson' }] }, units[1]], 1, []), true);
  });
});

describe('unit test import, analysis, and analytics', () => {
  it('reads JSON and CSV into version A and version B', () => {
    const json = parseUnitTestImport(JSON.stringify({
      title: 'Plants',
      passMark: 75,
      versionA: [{ prompt: 'One?', options: ['No', 'Yes'], answer: 'B', marks: 2, bloom: 'Apply', lessonId: 'l1' }],
      versionB: [{ prompt: 'Two?', options: ['No', 'Yes'], answer: 'Yes', marks: 1, bloom: 'Remember', lessonId: 'l2' }],
    }));
    assert.equal(json.errors.length, 0);
    assert.equal(json.passMark, 75);
    assert.equal(json.content.versionA[0]?.answerId, 'opt:1');
    assert.equal(json.content.versionB[0]?.answerId, 'opt:1');

    const csv = parseUnitTestImport([
      'version,prompt,optionA,optionB,answer,marks,bloom,lessonId',
      'A,"What is 2+2?",3,4,B,1,Apply,l1',
      'B,"What is 3+3?",5,6,6,2,Remember,l2',
    ].join('\n'));
    assert.equal(csv.errors.length, 0);
    assert.equal(csv.content.versionA.length, 1);
    assert.equal(csv.content.versionB[0]?.answerId, 'opt:1');
  });

  it('builds item analysis, a parent explainer, and analytics points', () => {
    const graded = gradeUnitTest(paper, { q1: 'opt:0', q2: 'opt:1' }, 70);
    const stats = itemAnalysis([{ version: 'A', responses: graded.responses }]);
    assert.equal(stats.length, 2);
    assert.equal(stats[0]?.correct, 0);
    assert.equal(stats[1]?.correct, 1);

    const lines = parentExplainer({
      unitTitle: 'Living things',
      percentage: 60,
      passed: false,
      passMark: 70,
      version: 'A',
      reviewTitles: ['How plants feed'],
      timeTakenSeconds: 75,
    });
    assert.match(lines[0], /Version A/);
    assert.match(lines.join(' '), /Review these lessons: How plants feed/);

    const points = quizPointsFromAttempt({
      completedAt: 1_700_000_000_000,
      marksAwarded: 3,
      marksMax: 5,
      unitId: 'u1',
      lessonId: 'test',
      courseId: 'c1',
      passed: false,
      version: 'A',
      timeTakenSeconds: 75,
      attemptNumber: 1,
      responses: graded.responses,
    });
    assert.equal(points[0]?.unitId, 'u1');
    assert.equal(points[0]?.max, 5);
    assert.equal(points[1]?.unitId, undefined);
    assert.equal(points[1]?.bloom, 'remember');
  });
});

describe('visual alt text', () => {
  it('blocks publish when alt text is missing', () => {
    const blocks: VisualBlock[] = [
      { kind: 'mindmapImage', alt: '  ', src: '/map.png' },
      { kind: 'comic', alt: 'A three-panel strip', panels: [{ src: '/p.png', alt: '' }] },
      { kind: 'revisionPoster', alt: 'Revision poster for the unit', src: '/poster.png' },
    ];
    const errors = visualPublishErrors({
      blocksOrder: ['mindmapImage', 'comic', 'revisionPoster', 'audioChant'],
      visualBlocks: blocks,
    });
    assert.equal(errors.length, 3);
    assert.match(errors[0], /Mind Map image/);
    assert.match(errors[1], /panel 1/);
    assert.match(errors[2], /Audio chant/);
  });
});
