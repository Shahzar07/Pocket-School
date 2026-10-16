import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checklistBlocksPublish,
  courseOpenToStudents,
  courseStatusForReview,
  diffSincePublish,
  lessonVisibleToStudent,
  linkProblem,
  nextReviewStatus,
  previewStillValid,
  previousReviewStatus,
  publishChecklist,
  snapshotFromCourse,
  toPreviewLesson,
  type PreviewCourse,
} from './course-review';

const course: PreviewCourse = {
  id: 'bio',
  title: 'Cells',
  description: 'A year 7 science course.',
  status: 'draft',
  modules: [
    {
      id: 'm1',
      title: 'Living things',
      lessons: [
        toPreviewLesson({
          id: 'l1',
          moduleId: 'm1',
          moduleTitle: 'Living things',
          title: 'Plant cells',
          status: 'approved',
          body: 'A plant cell has a wall.\n\n[Image 1: chloroplast]\n\nSee [the lab](https://).',
          quiz: [{ question: 'What holds the cell?', options: ['A wall', 'A shoe'], answer: 'A wall' }],
          images: [{ alt: 'Cell', src: '' }],
        }),
        toPreviewLesson({
          id: 'l2',
          moduleId: 'm1',
          moduleTitle: 'Living things',
          title: 'Empty',
          status: 'draft',
          body: '   ',
        }),
      ],
    },
  ],
};

test('review moves one step at a time and maps onto the course status', () => {
  assert.equal(nextReviewStatus('draft'), 'in_review');
  assert.equal(nextReviewStatus('in_review'), 'approved');
  assert.equal(nextReviewStatus('approved'), 'published');
  assert.equal(nextReviewStatus('published'), null);
  assert.equal(previousReviewStatus('approved'), 'in_review');
  assert.equal(courseStatusForReview('approved'), 'pending_approval');
  assert.equal(courseStatusForReview('published'), 'published');
});

test('students never see an unpublished course or lesson', () => {
  assert.equal(courseOpenToStudents({ status: 'published' }), true);
  assert.equal(courseOpenToStudents({ status: 'published', reviewStatus: 'in_review' }), false);
  assert.equal(courseOpenToStudents({ status: 'draft' }), false);
  assert.equal(lessonVisibleToStudent({ status: 'published' }, { status: 'published', kind: 'curriculum' }), true);
  assert.equal(lessonVisibleToStudent({ status: 'approved' }, { status: 'published', kind: 'curriculum' }), false);
  assert.equal(lessonVisibleToStudent({ status: 'draft' }, { status: 'published', kind: 'marketplace' }), false);
  assert.equal(lessonVisibleToStudent({}, { status: 'published', kind: 'marketplace' }), true);
  assert.equal(lessonVisibleToStudent({}, { status: 'published', kind: 'curriculum' }), false);
  assert.equal(lessonVisibleToStudent({ status: 'published' }, { status: 'published', reviewStatus: 'approved', kind: 'marketplace' }), false);
});

test('checklist names missing images, empty lessons, broken links, and no second quiz', () => {
  const issues = publishChecklist(course);
  assert.ok(issues.some(issue => issue.code === 'missing_images' && issue.lessonId === 'l1'));
  assert.ok(issues.some(issue => issue.code === 'empty_lessons' && issue.lessonId === 'l2'));
  assert.ok(issues.some(issue => issue.code === 'broken_links'));
  assert.equal(issues.some(issue => issue.code === 'no_quiz'), false);
  assert.equal(checklistBlocksPublish(issues), true);
  assert.equal(linkProblem('https://poketschool.ai/lab'), null);
  assert.equal(linkProblem('javascript:alert(1)'), 'Script link');
});

test('a course with no quiz is called out, and the diff lists what moved', () => {
  const bare: PreviewCourse = {
    ...course,
    modules: [{
      id: 'm1',
      title: 'Living things',
      lessons: [toPreviewLesson({
        id: 'l9',
        moduleId: 'm1',
        moduleTitle: 'Living things',
        title: 'Notes',
        status: 'approved',
        body: 'Read this page.',
      })],
    }],
  };
  assert.ok(publishChecklist(bare).some(issue => issue.code === 'no_quiz'));
  const snapshot = snapshotFromCourse(bare, 10);
  bare.modules[0].lessons[0] = { ...bare.modules[0].lessons[0], title: 'Notes revised', body: 'Read this page carefully.' };
  bare.modules[0].lessons.push(toPreviewLesson({
    id: 'l10',
    moduleId: 'm1',
    moduleTitle: 'Living things',
    title: 'New lesson',
    body: 'Added later.',
  }));
  const diff = diffSincePublish(bare, snapshot);
  assert.ok(diff.some(item => item.kind === 'changed' && item.detail.includes('title') && item.detail.includes('text')));
  assert.ok(diff.some(item => item.kind === 'added' && item.id === 'l10'));
});

test('a preview link expires', () => {
  assert.equal(previewStillValid(2_000, 1_000), true);
  assert.equal(previewStillValid(1_000, 1_000), false);
});
