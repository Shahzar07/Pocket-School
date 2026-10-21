import type { ExamQuestion } from '@/lib/db';

export const EXAM_BUILDER_COPY = {
  saveDraft: 'Save draft',
  preview: 'Preview',
  closePreview: 'Close preview',
  publish: 'Publish',
  allocate: 'Allocate to',
  noCourse: 'No course yet',
  level: 'Level',
  subject: 'Subject',
  board: 'Exam board style',
  settings: 'Settings',
  duplicate: 'Duplicate',
  deleteQuestion: 'Delete this question?',
  reorder: 'Reorder question',
  total: 'Total',
  marks: 'marks',
  questions: 'questions',
  question: 'question',
  untitled: 'Untitled exam',
  correct: 'Correct answer',
  addQuestion: 'Add question',
  newAssessment: 'New Assessment',
  createExam: 'Create Exam',
  timeLimit: 'Time Limit (minutes, optional)',
  passingScore: 'Passing Score (%)',
  availableFrom: 'Available From',
  availableTo: 'Available To',
  status: 'Status',
  draft: 'Draft',
  published: 'Published',
  title: 'Title *',
  description: 'Description',
  questionsTitle: 'Questions',
  questionTitle: 'Question',
  points: 'pts',
  correctAnswer: 'Correct Answer:',
  select: 'Select',
  answer: 'Answer',
  trueLabel: 'True',
  falseLabel: 'False',
  modelAnswer: 'Model answer',
  questionText: 'Question text...',
  examTitle: 'Exam title',
  noLimit: 'No limit',
  chooseSubject: 'Choose a subject',
} as const;

export const QUESTION_TYPES: readonly { id: ExamQuestion['type']; label: string }[] = [
  { id: 'multiple_choice', label: 'Multiple choice' },
  { id: 'true_false', label: 'True or false' },
  { id: 'short_answer', label: 'Short answer' },
];

export function questionTypeLabel(type: ExamQuestion['type']): string {
  return QUESTION_TYPES.find((item) => item.id === type)?.label ?? 'Multiple choice';
}
