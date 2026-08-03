/**
 * Launch catalogue — the five courses the marketplace ships with.
 *
 * An empty marketplace is the worst first impression a new visitor can get, so
 * these exist as real, complete course records rather than placeholders: every
 * one has a full description, learning outcomes, requirements, a duration and
 * a price. They are written by an admin action (Admin → Courses → Seed
 * catalogue) and are matched on `seedKey` so re-running never duplicates them.
 */

import {
  collection, doc, getDocs, query, where, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Course, CourseType } from './db';
import { courseCover } from './course-cover';

export interface SeedCourse {
  /** Stable identity across re-seeds. Never change once published. */
  seedKey: string;
  title: string;
  description: string;
  subject: string;
  category: string;
  level: string;
  type: CourseType;
  price: number;
  currency: string;
  durationHours: number;
  whatYouLearn: string[];
  requirements: string[];
  tags: string[];
}

export const SEED_COURSES: SeedCourse[] = [
  {
    seedKey: 'spm-add-maths-foundations',
    title: 'SPM Additional Mathematics: Complete Foundations',
    description:
      'A full walkthrough of the Additional Mathematics syllabus, built for students who want to understand the reasoning rather than memorise steps. Every topic starts from a worked example, builds to the general method, then gives you graded practice with fully explained solutions. Covers functions, quadratics, indices and logarithms, coordinate geometry, differentiation and integration, with exam-style questions at the end of each unit.',
    subject: 'Additional Mathematics',
    category: 'Mathematics',
    level: 'Secondary',
    type: 'course',
    price: 0,
    currency: 'MYR',
    durationHours: 24,
    whatYouLearn: [
      'Work confidently with functions, composite functions and inverses',
      'Solve quadratic equations and interpret the discriminant',
      'Apply the laws of indices and logarithms to real problems',
      'Differentiate and integrate polynomials, and know when each is needed',
      'Approach exam questions with a repeatable method instead of guesswork',
    ],
    requirements: [
      'Comfortable with Form 3 mathematics',
      'A notebook, pencil and a scientific calculator',
    ],
    tags: ['add-maths', 'spm', 'calculus', 'algebra'],
  },
  {
    seedKey: 'igcse-biology-cells-to-systems',
    title: 'IGCSE Biology: From Cells to Systems',
    description:
      'Biology explained as one connected story, from the structure of a single cell to how whole organ systems keep an organism alive. Each unit pairs clear explanations with diagrams you can redraw from memory, plus recall questions that target the exact wording examiners look for. Includes respiration, photosynthesis, transport in plants and animals, coordination and homeostasis.',
    subject: 'Biology',
    category: 'Science',
    level: 'GCSE',
    type: 'course',
    price: 49,
    currency: 'MYR',
    durationHours: 18,
    whatYouLearn: [
      'Describe cell structure and explain how structure supports function',
      'Explain aerobic and anaerobic respiration and compare their yields',
      'Trace the path of water and nutrients through a plant',
      'Explain how the body maintains a stable internal environment',
      'Answer 6-mark extended questions with the structure examiners expect',
    ],
    requirements: [
      'Lower secondary science',
      'No prior biology beyond the basics is assumed',
    ],
    tags: ['biology', 'igcse', 'cells', 'homeostasis'],
  },
  {
    seedKey: 'english-essay-writing-mastery',
    title: 'Academic English: Essay Writing That Scores',
    description:
      'A practical course on writing essays that hold together and argue something. You will learn how to read a question properly, build a thesis you can defend, structure paragraphs so each one earns its place, and edit your own work with a critical eye. Built around real student essays that are marked, rewritten and marked again so you can see exactly what changed and why the grade moved.',
    subject: 'English',
    category: 'Languages',
    level: 'Secondary',
    type: 'course',
    price: 39,
    currency: 'MYR',
    durationHours: 12,
    whatYouLearn: [
      'Break down an essay question and identify what is actually being asked',
      'Write a thesis statement that carries a whole essay',
      'Structure paragraphs with a clear point, evidence and analysis',
      'Use linking language so an argument flows instead of listing',
      'Edit your own writing for clarity, concision and accuracy',
    ],
    requirements: [
      'Intermediate English reading and writing',
      'Willingness to rewrite your own work',
    ],
    tags: ['english', 'writing', 'essays', 'exam-technique'],
  },
  {
    seedKey: 'intro-programming-python',
    title: 'Introduction to Programming with Python',
    description:
      'Learn to program by building things that run. Starting from variables and control flow, you will write progressively larger programs — a calculator, a text game, a data summariser — and learn to read error messages rather than fear them. Ends with file handling and a small project you design yourself. No prior programming experience needed.',
    subject: 'Computer Science',
    category: 'Technology',
    level: 'Secondary',
    type: 'course',
    price: 59,
    currency: 'MYR',
    durationHours: 20,
    whatYouLearn: [
      'Write and run Python programs from scratch',
      'Use variables, conditionals, loops and functions with confidence',
      'Work with lists and dictionaries to organise real data',
      'Read a traceback and debug your own code methodically',
      'Read and write files, and finish a project of your own design',
    ],
    requirements: [
      'A computer with a web browser',
      'No programming experience required',
    ],
    tags: ['python', 'programming', 'coding', 'beginners'],
  },
  {
    seedKey: 'spm-past-papers-bundle',
    title: 'SPM Past Papers & Worked Solutions Bundle',
    description:
      'A revision bundle of past-paper-style question sets across Mathematics, Additional Mathematics, Physics, Chemistry and Biology, each with a fully worked solution rather than just an answer key. Every solution shows the method, the common mistake at that step, and how many marks each stage is worth, so you can mark your own work the way an examiner would.',
    subject: 'Revision',
    category: 'Exam Preparation',
    level: 'Secondary',
    type: 'bundle',
    price: 89,
    currency: 'MYR',
    durationHours: 30,
    whatYouLearn: [
      'Work through exam-style papers under realistic timing',
      'Mark your own answers against a real mark scheme',
      'Recognise the mistakes that most often cost marks',
      'Identify your weakest topics and target revision at them',
      'Build exam stamina across five subjects',
    ],
    requirements: [
      'Currently studying towards SPM or an equivalent',
      'Have covered most of the syllabus already',
    ],
    tags: ['spm', 'past-papers', 'revision', 'solutions'],
  },
];

export interface SeedResult {
  created: number;
  skipped: number;
}

/**
 * Write any missing catalogue courses.
 *
 * Idempotent: existing seeds are matched on `seedKey` and left untouched, so
 * this can be re-run safely and will not overwrite edits made in the CMS.
 */
export async function seedMarketplaceCourses(
  ownerId: string,
  ownerName: string,
): Promise<SeedResult> {
  const snap = await getDocs(
    query(collection(db, 'courses'), where('seedKey', 'in', SEED_COURSES.map(c => c.seedKey))),
  );
  const existing = new Set(snap.docs.map(d => d.data().seedKey as string));

  const missing = SEED_COURSES.filter(c => !existing.has(c.seedKey));
  if (missing.length === 0) return { created: 0, skipped: SEED_COURSES.length };

  const batch = writeBatch(db);
  for (const c of missing) {
    const ref = doc(collection(db, 'courses'));
    const course: Omit<Course, 'id'> & { seedKey: string } = {
      seedKey: c.seedKey,
      title: c.title,
      description: c.description,
      ownerId,
      ownerName,
      // Explicit palette per catalogue entry so the five shipped covers are
      // visibly distinct rather than whatever the title hash happens to pick.
      thumbnailUrl: courseCover(c.title, c.subject, {
        paletteIndex: SEED_COURSES.findIndex(s => s.seedKey === c.seedKey),
      }),
      status: 'published',
      isPublic: true,
      kind: 'marketplace',
      subject: c.subject,
      category: c.category,
      level: c.level,
      type: c.type,
      price: c.price,
      currency: c.currency,
      durationHours: c.durationHours,
      whatYouLearn: c.whatYouLearn,
      requirements: c.requirements,
      tags: c.tags,
      enrollmentCount: 0,
    };
    batch.set(ref, { ...course, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  await batch.commit();

  return { created: missing.length, skipped: existing.size };
}
