import { proceduralArt } from '@/components/media/fallback-art';
import {
  snapshotFromCourse,
  toPreviewLesson,
  type LessonComment,
  type PreviewCourse,
  type PublishedSnapshot,
} from '@/lib/course-review';

const cell = proceduralArt('academic', 'plant cell lower secondary', 0);

export function samplePreviewCourse(now = Date.now()): {
  course: PreviewCourse;
  snapshot: PublishedSnapshot;
  comments: LessonComment[];
} {
  const course: PreviewCourse = {
    id: 'sample-cells',
    title: 'Lower Secondary · Cells and systems',
    description: 'How a plant cell is built, and how to check the picture before the quiz.',
    subject: 'Science',
    level: 'Lower Secondary',
    language: 'English',
    status: 'in_review',
    modules: [
      {
        id: 'mod-cells',
        title: 'Module 1 · The cell',
        lessons: [
          toPreviewLesson({
            id: 'les-wall',
            moduleId: 'mod-cells',
            moduleTitle: 'Module 1 · The cell',
            title: 'The cell wall',
            status: 'in_review',
            body: [
              'A plant cell keeps its shape with a wall. The wall is outside the membrane. It is not a bone and it is not a shell you can peel off with a fingernail.',
              'Look at the picture, then name the green parts before you answer.',
              '[Image 2: a labelled chloroplast]',
              'The lab notes live at [the prep room](https://poketschool.ai/lab).',
            ].join('\n\n'),
            quiz: [{
              question: 'What does the cell wall do?',
              options: ['It keeps the shape of the cell.', 'It pumps blood.', 'It is the nucleus.'],
              answer: 'It keeps the shape of the cell.',
            }],
            images: [{ alt: 'A simple plant cell', src: cell, caption: 'Wall outside, green parts inside.' }],
            media: [{ kind: 'video', url: 'https://poketschool.ai/media/cell-wall', label: 'Cell wall, 90 seconds' }],
          }),
          toPreviewLesson({
            id: 'les-empty',
            moduleId: 'mod-cells',
            moduleTitle: 'Module 1 · The cell',
            title: 'Organelles',
            status: 'draft',
            body: '',
          }),
        ],
      },
      {
        id: 'mod-check',
        title: 'Module 2 · Check your work',
        lessons: [
          toPreviewLesson({
            id: 'les-link',
            moduleId: 'mod-check',
            moduleTitle: 'Module 2 · Check your work',
            title: 'Sources',
            status: 'approved',
            body: 'Some classes paste a link that never opens.\n\nRead more at [the old sheet](https://).',
            quiz: [],
          }),
        ],
      },
    ],
  };
  const published = {
    ...course,
    modules: course.modules.map(module => ({
      ...module,
      lessons: module.lessons.filter(lesson => lesson.id === 'les-wall').map(lesson => ({
        ...lesson,
        title: 'Cells',
        body: 'A short published page.',
      })),
    })),
  };
  return {
    course,
    snapshot: snapshotFromCourse(published, now - 3 * 24 * 60 * 60 * 1000),
    comments: [{
      id: 'c-sample',
      lessonId: 'les-wall',
      authorId: 'teacher-sample',
      authorName: 'Ms Rahman',
      body: 'The chloroplast picture is still a slot. Add it before approval.',
      createdAt: now - 60 * 60 * 1000,
    }],
  };
}
