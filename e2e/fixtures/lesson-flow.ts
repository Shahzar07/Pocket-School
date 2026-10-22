import { adminAuth, adminDb } from '../../lib/firebase-admin';

export const FLOW_STUDENT = 'student.e2e@poketschool.ai';
export const FLOW_COURSE = 'e2e-flow-course';
export const FLOW_MODULE = 'e2e-flow-unit';
export const FLOW_LESSONS = {
  plant: 'e2e-flow-plant',
  animal: 'e2e-flow-animal',
  compare: 'e2e-flow-compare',
} as const;

const DIAGRAM = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="280"><rect width="640" height="280" fill="#E9F7FA"/><text x="32" y="150" fill="#1E6A83" font-size="28" font-family="sans-serif">Plant cell</text></svg>',
);

/** Published marketplace course: three lessons, several visual blocks, and a three-question quiz. */
export async function seedLessonFlow(password: string): Promise<string> {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
  const auth = adminAuth();
  let user;
  try {
    user = await auth.getUserByEmail(FLOW_STUDENT);
    await auth.updateUser(user.uid, { password, emailVerified: false });
  } catch {
    user = await auth.createUser({ email: FLOW_STUDENT, password, emailVerified: false });
  }
  await auth.setCustomUserClaims(user.uid, { role: 'student' });
  const db = adminDb();
  await db.collection('users').doc(user.uid).set({
    email: FLOW_STUDENT,
    role: 'student',
    name: 'E2E Learner',
    language: 'en',
    emailVerified: false,
    twoFactorEnabled: false,
  }, { merge: true });

  await db.collection('courses').doc(FLOW_COURSE).set({
    title: 'Cells in view',
    description: 'A published sample course for lesson and quiz arrows.',
    subject: 'Science',
    ownerId: user.uid,
    status: 'published',
    isPublic: false,
    kind: 'course',
  });
  await db.collection('courses').doc(FLOW_COURSE).collection('modules').doc(FLOW_MODULE).set({
    title: 'Cells',
    courseId: FLOW_COURSE,
    order: 1,
  });

  const lessons = db.collection('courses').doc(FLOW_COURSE).collection('modules').doc(FLOW_MODULE).collection('lessons');
  await lessons.doc(FLOW_LESSONS.plant).set({
    title: 'Plant cells',
    moduleId: FLOW_MODULE,
    courseId: FLOW_COURSE,
    order: 1,
    status: 'published',
    lessonType: 'lesson',
    aiOutputs: {
      text: 'A plant cell has a nucleus, a cell wall, and chloroplasts.\n\nThe wall is outside the membrane.\n\nChloroplasts trap light.',
    },
    visualBlocks: [
      { kind: 'mindmapImage', alt: 'Mind map of a plant cell', src: DIAGRAM, caption: 'Plant cell map', intelligence: 'Spatial' },
      {
        kind: 'comic',
        alt: 'A short comic about a plant cell',
        title: 'Cell story',
        intelligence: 'Linguistic',
        panels: [
          { src: DIAGRAM, alt: 'A plant cell wall', caption: 'The wall' },
          { src: DIAGRAM, alt: 'A chloroplast', caption: 'The chloroplast' },
        ],
      },
      { kind: 'infographicImage', alt: 'Infographic of plant cell parts', src: DIAGRAM, caption: 'Plant cell parts', intelligence: 'Naturalistic' },
      {
        kind: 'audioChant',
        alt: 'A chant about cells',
        title: 'Cell chant',
        transcript: 'Cells are the smallest living units.',
        intelligence: 'Musical',
      },
    ],
  });
  await lessons.doc(FLOW_LESSONS.animal).set({
    title: 'Animal cells',
    moduleId: FLOW_MODULE,
    courseId: FLOW_COURSE,
    order: 2,
    status: 'published',
    lessonType: 'lesson',
    aiOutputs: {
      text: 'An animal cell has a nucleus and no cell wall.',
      quiz: [
        {
          question: 'Which part holds the genetic material?',
          options: ['Cell wall', 'Nucleus', 'Chloroplast'],
          answer: 'Nucleus',
          explanation: 'The nucleus stores the genetic material.',
        },
        {
          question: 'Which cells have a cell wall?',
          options: ['Animal cells', 'Plant cells', 'Neither'],
          answer: 'Plant cells',
          explanation: 'Plant cells have a wall. Animal cells do not.',
        },
        {
          question: 'What is the smallest living unit?',
          options: ['A tissue', 'A cell', 'An organ'],
          answer: 'A cell',
          explanation: 'A cell is the smallest living unit.',
        },
      ],
    },
  });
  await lessons.doc(FLOW_LESSONS.compare).set({
    title: 'Comparing cells',
    moduleId: FLOW_MODULE,
    courseId: FLOW_COURSE,
    order: 3,
    status: 'published',
    lessonType: 'lesson',
    aiOutputs: {
      text: 'Plant cells and animal cells both have a nucleus.',
      slides: [
        { title: 'Shared parts', bullets: ['Nucleus', 'Membrane', 'Cytoplasm'] },
        { title: 'Plant only', bullets: ['Cell wall', 'Chloroplast'] },
      ],
    },
  });
  await db.collection('courses').doc(FLOW_COURSE).collection('enrollments').doc(user.uid).set({
    studentId: user.uid,
    courseId: FLOW_COURSE,
    status: 'active',
  });
  for (const lessonId of Object.values(FLOW_LESSONS)) {
    await db.collection('lesson_notes').doc(`${user.uid}_${lessonId}`).set({
      userId: user.uid,
      lessonId,
      text: '',
    });
  }
  return user.uid;
}
