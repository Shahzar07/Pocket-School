import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc,
  deleteDoc, query, where, orderBy, limit, serverTimestamp,
  increment, arrayUnion, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Types ────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'parent' | 'admin';
  avatarUrl?: string;
  level?: string;
  learningStyle?: string;
  interests?: string[];
  xp: number;
  childIds?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  ownerId: string;
  ownerName?: string;
  thumbnailUrl?: string;
  status: 'draft' | 'published';
  subject?: string;
  createdAt?: Timestamp;
}

export interface Module {
  id: string;
  title: string;
  description?: string;
  courseId: string;
  order: number;
}

export interface Lesson {
  id: string;
  title: string;
  moduleId: string;
  courseId: string;
  order: number;
  contentSources?: { type: 'text' | 'url'; value: string }[];
  aiOutputs?: AiOutputs;
  status?: 'draft' | 'published';
  createdAt?: Timestamp;
}

export interface AiOutputs {
  text?: string;
  flashcards?: { question: string; answer: string }[];
  quiz?: { question: string; options: string[]; answer: string; explanation?: string }[];
  slides?: { title: string; bullets: string[] }[];
  notes?: string;
  summary?: string;
  problems?: string;
  glossary?: { term: string; definition: string }[];
  mindmap?: string;
  infographic?: string;
}

export interface Enrollment {
  studentId: string;
  courseId: string;
  progress: number;
  completedLessons: string[];
  enrolledAt?: Timestamp;
}

export interface Badge {
  id: string;
  userId: string;
  type: string;
  name: string;
  description: string;
  icon: string;
  awardedAt?: Timestamp;
}

export interface Message {
  id: string;
  fromId: string;
  fromName: string;
  fromRole: string;
  toId: string;
  subject: string;
  body: string;
  read: boolean;
  studentId?: string;
  sentAt?: Timestamp;
}

export interface Institution {
  id: string;
  name: string;
  domain?: string;
  adminId?: string;
  studentCount: number;
  teacherCount: number;
  status: 'active' | 'pending';
  createdAt?: Timestamp;
}

export interface LiveClass {
  id: string;
  title: string;
  teacherId: string;
  teacherName?: string;
  courseId: string;
  scheduledAt: Timestamp;
  joinUrl?: string;
  status: 'scheduled' | 'live' | 'ended';
}

export interface LessonNote {
  userId: string;
  lessonId: string;
  content: string;
  updatedAt?: Timestamp;
}

// ─── User ─────────────────────────────────────────────────────

export async function getUser(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function updateUser(uid: string, data: Partial<UserProfile>) {
  await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() });
}

export async function getUserByEmail(email: string): Promise<{ id: string; data: UserProfile } | null> {
  const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, data: d.data() as UserProfile };
}

export async function getTopStudentsByXp(count = 10): Promise<{ id: string; data: UserProfile }[]> {
  const q = query(collection(db, 'users'), where('role', '==', 'student'), orderBy('xp', 'desc'), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, data: d.data() as UserProfile }));
}

// ─── Courses ──────────────────────────────────────────────────

export async function getAllPublishedCourses(): Promise<Course[]> {
  const q = query(collection(db, 'courses'), where('status', '==', 'published'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Course));
}

export async function getTeacherCourses(teacherId: string): Promise<Course[]> {
  const q = query(collection(db, 'courses'), where('ownerId', '==', teacherId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Course));
}

export async function getCourse(courseId: string): Promise<Course | null> {
  const snap = await getDoc(doc(db, 'courses', courseId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Course) : null;
}

export async function createCourse(data: Omit<Course, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'courses'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

// ─── Modules & Lessons ────────────────────────────────────────

export async function getModulesWithLessons(courseId: string): Promise<{ module: Module; lessons: Lesson[] }[]> {
  const modSnap = await getDocs(
    query(collection(db, 'courses', courseId, 'modules'), orderBy('order'))
  );
  const results: { module: Module; lessons: Lesson[] }[] = [];
  for (const modDoc of modSnap.docs) {
    const module = { id: modDoc.id, ...modDoc.data() } as Module;
    const lesSnap = await getDocs(
      query(collection(db, 'courses', courseId, 'modules', modDoc.id, 'lessons'), orderBy('order'))
    );
    const lessons = lesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lesson));
    results.push({ module, lessons });
  }
  return results;
}

export async function getLesson(courseId: string, moduleId: string, lessonId: string): Promise<Lesson | null> {
  const snap = await getDoc(doc(db, 'courses', courseId, 'modules', moduleId, 'lessons', lessonId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Lesson) : null;
}

export async function getLessonByIds(courseId: string, lessonId: string): Promise<{ lesson: Lesson; moduleId: string } | null> {
  // Search across all modules for the lesson
  const modSnap = await getDocs(collection(db, 'courses', courseId, 'modules'));
  for (const modDoc of modSnap.docs) {
    const lesSnap = await getDoc(doc(db, 'courses', courseId, 'modules', modDoc.id, 'lessons', lessonId));
    if (lesSnap.exists()) {
      return { lesson: { id: lesSnap.id, ...lesSnap.data() } as Lesson, moduleId: modDoc.id };
    }
  }
  return null;
}

export async function saveAiOutputsToLesson(
  courseId: string, moduleId: string, lessonId: string, aiOutputs: AiOutputs
) {
  await updateDoc(doc(db, 'courses', courseId, 'modules', moduleId, 'lessons', lessonId), {
    aiOutputs,
    status: 'published',
    updatedAt: serverTimestamp(),
  });
}

export async function createModule(courseId: string, data: Omit<Module, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'courses', courseId, 'modules'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function createLesson(courseId: string, moduleId: string, data: Omit<Lesson, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'courses', courseId, 'modules', moduleId, 'lessons'), {
    ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Enrollments ──────────────────────────────────────────────

export async function getEnrolledCourses(studentId: string): Promise<{ course: Course; enrollment: Enrollment }[]> {
  const allCourses = await getAllPublishedCourses();
  const results: { course: Course; enrollment: Enrollment }[] = [];
  for (const course of allCourses) {
    const snap = await getDoc(doc(db, 'courses', course.id, 'enrollments', studentId));
    if (snap.exists()) {
      results.push({ course, enrollment: snap.data() as Enrollment });
    }
  }
  return results;
}

export async function enrollStudent(studentId: string, courseId: string) {
  const ref = doc(db, 'courses', courseId, 'enrollments', studentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      studentId,
      courseId,
      progress: 0,
      completedLessons: [],
      enrolledAt: serverTimestamp(),
    });
  }
}

export async function markLessonComplete(
  studentId: string, courseId: string, lessonId: string, xpReward = 50
): Promise<void> {
  const batch = writeBatch(db);
  const enrollRef = doc(db, 'courses', courseId, 'enrollments', studentId);
  const snap = await getDoc(enrollRef);
  if (!snap.exists()) return;
  const enrollment = snap.data() as Enrollment;
  if (enrollment.completedLessons?.includes(lessonId)) return;

  // Count total lessons to compute progress
  const modSnap = await getDocs(collection(db, 'courses', courseId, 'modules'));
  let totalLessons = 0;
  for (const m of modSnap.docs) {
    const ls = await getDocs(collection(db, 'courses', courseId, 'modules', m.id, 'lessons'));
    totalLessons += ls.size;
  }
  const completed = (enrollment.completedLessons?.length ?? 0) + 1;
  const progress = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

  batch.update(enrollRef, {
    completedLessons: arrayUnion(lessonId),
    progress,
  });
  batch.update(doc(db, 'users', studentId), {
    xp: increment(xpReward),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  // Award badges based on XP milestones
  await checkAndAwardBadges(studentId, (enrollment as any).xp || 0, xpReward);
}

async function checkAndAwardBadges(studentId: string, currentXp: number, gained: number) {
  const newXp = currentXp + gained;
  const milestones = [
    { threshold: 100, type: 'first_steps', name: 'First Steps', description: 'Earn your first 100 XP', icon: '🌱' },
    { threshold: 500, type: 'rising_star', name: 'Rising Star', description: 'Earn 500 XP', icon: '⭐' },
    { threshold: 1000, type: 'knowledge_seeker', name: 'Knowledge Seeker', description: 'Earn 1000 XP', icon: '📚' },
    { threshold: 5000, type: 'scholar', name: 'Scholar', description: 'Earn 5000 XP', icon: '🎓' },
  ];
  for (const m of milestones) {
    if (currentXp < m.threshold && newXp >= m.threshold) {
      const badgeRef = doc(db, 'badges', `${studentId}_${m.type}`);
      const snap = await getDoc(badgeRef);
      if (!snap.exists()) {
        await setDoc(badgeRef, {
          userId: studentId, type: m.type, name: m.name,
          description: m.description, icon: m.icon, awardedAt: serverTimestamp(),
        });
      }
    }
  }
}

// ─── Notes ────────────────────────────────────────────────────

export async function getLessonNote(userId: string, lessonId: string): Promise<string> {
  const snap = await getDoc(doc(db, 'lesson_notes', `${userId}_${lessonId}`));
  return snap.exists() ? (snap.data().content as string) : '';
}

export async function saveLessonNote(userId: string, lessonId: string, content: string) {
  await setDoc(doc(db, 'lesson_notes', `${userId}_${lessonId}`), {
    userId, lessonId, content, updatedAt: serverTimestamp(),
  });
}

// ─── Badges ───────────────────────────────────────────────────

export async function getUserBadges(userId: string): Promise<Badge[]> {
  const q = query(collection(db, 'badges'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Badge));
}

// ─── Live Classes ─────────────────────────────────────────────

export async function getLiveClassesForStudent(courseIds: string[]): Promise<LiveClass[]> {
  if (!courseIds.length) return [];
  const q = query(
    collection(db, 'live_classes'),
    where('courseId', 'in', courseIds.slice(0, 10)),
    where('status', 'in', ['scheduled', 'live']),
    orderBy('scheduledAt'),
    limit(5)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveClass));
}

export async function getLiveClassesForTeacher(teacherId: string): Promise<LiveClass[]> {
  const q = query(
    collection(db, 'live_classes'),
    where('teacherId', '==', teacherId),
    orderBy('scheduledAt'),
    limit(10)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveClass));
}

export async function createLiveClass(data: Omit<LiveClass, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'live_classes'), data);
  return ref.id;
}

// ─── Messages ─────────────────────────────────────────────────

export async function getMessages(userId: string): Promise<Message[]> {
  const q = query(
    collection(db, 'messages'),
    where('toId', '==', userId),
    orderBy('sentAt', 'desc'),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
}

export async function getSentMessages(userId: string): Promise<Message[]> {
  const q = query(
    collection(db, 'messages'),
    where('fromId', '==', userId),
    orderBy('sentAt', 'desc'),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
}

export async function sendMessage(msg: Omit<Message, 'id' | 'sentAt' | 'read'>) {
  await addDoc(collection(db, 'messages'), { ...msg, read: false, sentAt: serverTimestamp() });
}

export async function markMessageRead(messageId: string) {
  await updateDoc(doc(db, 'messages', messageId), { read: true });
}

// ─── Institutions ─────────────────────────────────────────────

export async function getInstitutions(): Promise<Institution[]> {
  const snap = await getDocs(query(collection(db, 'institutions'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Institution));
}

export async function createInstitution(data: Omit<Institution, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'institutions'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function deleteInstitution(id: string) {
  await deleteDoc(doc(db, 'institutions', id));
}

export async function updateInstitution(id: string, data: Partial<Institution>) {
  await updateDoc(doc(db, 'institutions', id), data);
}

// ─── Teacher Grade/Submissions ────────────────────────────────

export interface Submission {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  type: 'quiz';
  score?: number;
  maxScore: number;
  answers: { question: string; answer: string; correct: boolean }[];
  gradedFeedback?: string;
  submittedAt?: Timestamp;
}

export async function getSubmissionsForTeacher(teacherId: string): Promise<Submission[]> {
  const courses = await getTeacherCourses(teacherId);
  const results: Submission[] = [];
  for (const course of courses) {
    const q = query(collection(db, 'submissions'), where('courseId', '==', course.id), orderBy('submittedAt', 'desc'), limit(20));
    const snap = await getDocs(q);
    snap.docs.forEach(d => results.push({ id: d.id, ...d.data() } as Submission));
  }
  return results;
}

export async function saveSubmission(data: Omit<Submission, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'submissions'), { ...data, submittedAt: serverTimestamp() });
  return ref.id;
}

export async function gradeSubmission(submissionId: string, score: number, feedback: string) {
  await updateDoc(doc(db, 'submissions', submissionId), { score, gradedFeedback: feedback });
}

// ─── Admin Stats ──────────────────────────────────────────────

export async function getPlatformStats(): Promise<{ students: number; teachers: number; courses: number }> {
  const [sSnap, tSnap, cSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
    getDocs(query(collection(db, 'users'), where('role', '==', 'teacher'))),
    getDocs(collection(db, 'courses')),
  ]);
  return { students: sSnap.size, teachers: tSnap.size, courses: cSnap.size };
}

// ─── Parent / Child ───────────────────────────────────────────

export async function linkChildToParent(parentId: string, childEmail: string): Promise<{ success: boolean; childName?: string; error?: string }> {
  const child = await getUserByEmail(childEmail);
  if (!child) return { success: false, error: 'No user found with that email address.' };
  if (child.data.role !== 'student') return { success: false, error: 'That account is not a student account.' };
  await updateDoc(doc(db, 'users', parentId), {
    childIds: arrayUnion(child.id),
    updatedAt: serverTimestamp(),
  });
  return { success: true, childName: child.data.name };
}

export async function getChildrenProfiles(parentId: string): Promise<{ id: string; data: UserProfile }[]> {
  const parent = await getUser(parentId);
  if (!parent?.childIds?.length) return [];
  const results: { id: string; data: UserProfile }[] = [];
  for (const cid of parent.childIds) {
    const u = await getUser(cid);
    if (u) results.push({ id: cid, data: u });
  }
  return results;
}

export async function seedDemoData(adminId: string): Promise<{ coursesCreated: number; lessonsCreated: number }> {
  const { SEED_COURSES } = await import('./seed-data');
  let coursesCreated = 0;
  let lessonsCreated = 0;

  for (const seedCourse of SEED_COURSES) {
    const courseId = await createCourse({
      title: seedCourse.title,
      description: seedCourse.description,
      subject: seedCourse.subject,
      thumbnailUrl: seedCourse.thumbnailUrl,
      ownerId: adminId,
      ownerName: 'Demo Teacher',
      status: 'published',
    });
    coursesCreated++;

    for (const seedModule of seedCourse.modules) {
      const moduleId = await createModule(courseId, {
        title: seedModule.title,
        description: seedModule.description,
        courseId,
        order: seedModule.order,
      });

      for (const seedLesson of seedModule.lessons) {
        const lessonId = await createLesson(courseId, moduleId, {
          title: seedLesson.title,
          moduleId,
          courseId,
          order: seedLesson.order,
          contentSources: seedLesson.contentSources,
          status: 'published',
        });
        await saveAiOutputsToLesson(courseId, moduleId, lessonId, seedLesson.aiOutputs);
        lessonsCreated++;
      }
    }
  }

  return { coursesCreated, lessonsCreated };
}

export async function getModules(courseId: string): Promise<Module[]> {
  const snap = await getDocs(query(collection(db, 'courses', courseId, 'modules'), orderBy('order', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Module));
}

export async function getEnrollmentsForCourse(courseId: string): Promise<{ studentId: string; progress: number; completedLessons: string[] }[]> {
  const snap = await getDocs(collection(db, 'courses', courseId, 'enrollments'));
  return snap.docs.map(d => {
    const data = d.data();
    return { studentId: d.id, progress: data.progress ?? 0, completedLessons: data.completedLessons ?? [] };
  });
}

// ─── Grades ───────────────────────────────────────────────────

export interface Grade {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  lessonId?: string;
  assignmentId?: string;
  examId?: string;
  type: 'quiz' | 'assignment' | 'exam' | 'participation' | 'custom';
  label: string;
  score: number;
  maxScore: number;
  weight?: number;
  teacherNote?: string;
  gradedAt?: Timestamp;
  gradedBy?: string;
}

export interface GradeWeights {
  quiz: number;
  assignment: number;
  exam: number;
  participation: number;
}

const DEFAULT_WEIGHTS: GradeWeights = { quiz: 30, assignment: 40, exam: 20, participation: 10 };

export async function createGrade(grade: Omit<Grade, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'grades'), { ...grade, gradedAt: serverTimestamp() });
  return ref.id;
}

export async function updateGrade(gradeId: string, updates: Partial<Grade>) {
  await updateDoc(doc(db, 'grades', gradeId), updates);
}

export async function getGradesForCourse(courseId: string): Promise<Grade[]> {
  const q = query(collection(db, 'grades'), where('courseId', '==', courseId), orderBy('gradedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Grade));
}

export async function getGradesForStudent(studentId: string): Promise<Grade[]> {
  const q = query(collection(db, 'grades'), where('studentId', '==', studentId), orderBy('gradedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Grade));
}

export async function getGradeWeights(courseId: string): Promise<GradeWeights> {
  const snap = await getDoc(doc(db, 'grade_weights', courseId));
  return snap.exists() ? (snap.data() as GradeWeights) : DEFAULT_WEIGHTS;
}

export async function setGradeWeights(courseId: string, weights: GradeWeights) {
  await setDoc(doc(db, 'grade_weights', courseId), weights);
}

export async function deleteGrade(gradeId: string) {
  await deleteDoc(doc(db, 'grades', gradeId));
}

// ─── Assignments ──────────────────────────────────────────────

export interface Assignment {
  id: string;
  courseId: string;
  moduleId?: string;
  title: string;
  description: string;
  dueDate: Timestamp;
  maxScore: number;
  submissionType: 'text' | 'link' | 'any';
  status: 'draft' | 'published';
  allowLate: boolean;
  createdBy: string;
  createdAt?: Timestamp;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  courseId: string;
  content?: string;
  linkUrl?: string;
  submittedAt?: Timestamp;
  isLate: boolean;
  score?: number;
  feedback?: string;
  gradedAt?: Timestamp;
  integrityScore?: number;
  integrityFlag?: boolean;
}

export async function createAssignment(data: Omit<Assignment, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'assignments'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateAssignment(id: string, data: Partial<Assignment>) {
  await updateDoc(doc(db, 'assignments', id), data);
}

export async function deleteAssignment(id: string) {
  await deleteDoc(doc(db, 'assignments', id));
}

export async function getAssignmentsForCourse(courseId: string): Promise<Assignment[]> {
  const q = query(collection(db, 'assignments'), where('courseId', '==', courseId), orderBy('dueDate', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
}

export async function getAssignmentsForStudent(courseIds: string[]): Promise<Assignment[]> {
  if (!courseIds.length) return [];
  const results: Assignment[] = [];
  for (const cid of courseIds) {
    const q = query(collection(db, 'assignments'), where('courseId', '==', cid), where('status', '==', 'published'), orderBy('dueDate', 'asc'));
    const snap = await getDocs(q);
    snap.docs.forEach(d => results.push({ id: d.id, ...d.data() } as Assignment));
  }
  return results;
}

export async function submitAssignment(data: Omit<AssignmentSubmission, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'assignment_submissions'), { ...data, submittedAt: serverTimestamp() });
  return ref.id;
}

export async function getAssignmentSubmissions(assignmentId: string): Promise<AssignmentSubmission[]> {
  const q = query(collection(db, 'assignment_submissions'), where('assignmentId', '==', assignmentId), orderBy('submittedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AssignmentSubmission));
}

export async function getStudentSubmissionsForCourse(studentId: string, courseId: string): Promise<AssignmentSubmission[]> {
  const q = query(collection(db, 'assignment_submissions'), where('studentId', '==', studentId), where('courseId', '==', courseId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AssignmentSubmission));
}

export async function gradeAssignmentSubmission(submissionId: string, score: number, feedback: string) {
  await updateDoc(doc(db, 'assignment_submissions', submissionId), { score, feedback, gradedAt: serverTimestamp() });
}

// ─── Exams ────────────────────────────────────────────────────

export interface ExamQuestion {
  id: string;
  type: 'multiple_choice' | 'short_answer' | 'true_false';
  question: string;
  options?: string[];
  answer: string;
  points: number;
  explanation?: string;
}

export interface Exam {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  questions: ExamQuestion[];
  timeLimit?: number;
  passingScore: number;
  status: 'draft' | 'published';
  availableFrom?: Timestamp;
  availableTo?: Timestamp;
  createdBy: string;
  createdAt?: Timestamp;
}

export interface ExamSubmission {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  courseId: string;
  answers: Record<string, string>;
  score: number;
  maxScore: number;
  passed: boolean;
  timeTakenSeconds?: number;
  submittedAt?: Timestamp;
}

export async function createExam(data: Omit<Exam, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'exams'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateExam(id: string, data: Partial<Exam>) {
  await updateDoc(doc(db, 'exams', id), data);
}

export async function deleteExam(id: string) {
  await deleteDoc(doc(db, 'exams', id));
}

export async function getExamsForCourse(courseId: string): Promise<Exam[]> {
  const q = query(collection(db, 'exams'), where('courseId', '==', courseId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam));
}

export async function getPublishedExamsForStudent(courseIds: string[]): Promise<Exam[]> {
  if (!courseIds.length) return [];
  const results: Exam[] = [];
  for (const cid of courseIds) {
    const q = query(collection(db, 'exams'), where('courseId', '==', cid), where('status', '==', 'published'));
    const snap = await getDocs(q);
    snap.docs.forEach(d => results.push({ id: d.id, ...d.data() } as Exam));
  }
  return results;
}

export async function submitExam(data: Omit<ExamSubmission, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'exam_submissions'), { ...data, submittedAt: serverTimestamp() });
  return ref.id;
}

export async function getExamSubmissions(examId: string): Promise<ExamSubmission[]> {
  const q = query(collection(db, 'exam_submissions'), where('examId', '==', examId), orderBy('submittedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamSubmission));
}

export async function getStudentExamSubmission(examId: string, studentId: string): Promise<ExamSubmission | null> {
  const q = query(collection(db, 'exam_submissions'), where('examId', '==', examId), where('studentId', '==', studentId), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as ExamSubmission);
}

// ─── Calendar Events ──────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Timestamp;
  endDate?: Timestamp;
  type: 'assignment' | 'exam' | 'event' | 'holiday' | 'class' | 'payment';
  courseId?: string;
  audience: 'all' | 'students' | 'teachers' | 'parents';
  createdBy: string;
  createdAt?: Timestamp;
}

export async function getCalendarEvents(options: { courseId?: string; audience?: string } = {}): Promise<CalendarEvent[]> {
  let q;
  if (options.courseId) {
    q = query(collection(db, 'calendar_events'), where('courseId', '==', options.courseId), orderBy('startDate', 'asc'));
  } else {
    q = query(collection(db, 'calendar_events'), orderBy('startDate', 'asc'), limit(100));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent));
}

export async function createCalendarEvent(data: Omit<CalendarEvent, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'calendar_events'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function deleteCalendarEvent(id: string) {
  await deleteDoc(doc(db, 'calendar_events', id));
}

// ─── Announcements ────────────────────────────────────────────

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  audience: 'all' | 'students' | 'teachers' | 'parents';
  courseId?: string;
  pinned: boolean;
  createdBy: string;
  createdByName: string;
  createdAt?: Timestamp;
  expiresAt?: Timestamp;
}

export async function getAnnouncements(audience: string, courseId?: string): Promise<Announcement[]> {
  const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Announcement))
    .filter(a => a.audience === 'all' || a.audience === audience || (courseId && a.courseId === courseId));
}

export async function createAnnouncement(data: Omit<Announcement, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'announcements'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateAnnouncement(id: string, data: Partial<Announcement>) {
  await updateDoc(doc(db, 'announcements', id), data);
}

export async function deleteAnnouncement(id: string) {
  await deleteDoc(doc(db, 'announcements', id));
}

// ─── Notifications ────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'grade' | 'assignment' | 'announcement' | 'message' | 'exam' | 'integrity' | 'payment' | 'general';
  link?: string;
  read: boolean;
  createdAt?: Timestamp;
}

export async function createNotification(data: Omit<Notification, 'id'>): Promise<void> {
  await addDoc(collection(db, 'notifications'), { ...data, read: false, createdAt: serverTimestamp() });
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(20));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
  const snap = await getDocs(q);
  return snap.size;
}

export async function markNotificationRead(notifId: string) {
  await updateDoc(doc(db, 'notifications', notifId), { read: true });
}

export async function markAllNotificationsRead(userId: string) {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}

// ─── Chat Messages ────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  type: 'text' | 'announcement';
  createdAt?: Timestamp;
}

export async function sendChatMessage(data: Omit<ChatMessage, 'id'>): Promise<void> {
  await addDoc(collection(db, 'chat_messages'), { ...data, createdAt: serverTimestamp() });
}

export async function getChatMessages(roomId: string): Promise<ChatMessage[]> {
  const q = query(collection(db, 'chat_messages'), where('roomId', '==', roomId), orderBy('createdAt', 'asc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
}

export async function deleteChatMessage(msgId: string) {
  await deleteDoc(doc(db, 'chat_messages', msgId));
}

// ─── Academic Integrity ───────────────────────────────────────

export interface IntegrityReport {
  id: string;
  submissionId?: string;
  submissionType: 'assignment' | 'exam' | 'upload';
  studentId: string;
  studentName: string;
  courseId: string;
  assignmentTitle?: string;
  contentSnippet: string;
  aiScore: number;
  plagiarismScore: number;
  flags: string[];
  recommendation: string;
  status: 'pending' | 'clean' | 'suspicious' | 'violation';
  reviewedBy?: string;
  resolution?: string;
  createdAt?: Timestamp;
}

export async function createIntegrityReport(data: Omit<IntegrityReport, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'integrity_reports'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function getIntegrityReportsForTeacher(teacherId: string): Promise<IntegrityReport[]> {
  const courses = await getTeacherCourses(teacherId);
  const results: IntegrityReport[] = [];
  for (const c of courses) {
    const q = query(collection(db, 'integrity_reports'), where('courseId', '==', c.id), orderBy('createdAt', 'desc'), limit(20));
    const snap = await getDocs(q);
    snap.docs.forEach(d => results.push({ id: d.id, ...d.data() } as IntegrityReport));
  }
  return results;
}

export async function updateIntegrityReport(id: string, data: Partial<IntegrityReport>) {
  await updateDoc(doc(db, 'integrity_reports', id), data);
}

// ─── Invoices / Billing ───────────────────────────────────────

export interface Invoice {
  id: string;
  studentId: string;
  studentName: string;
  parentId?: string;
  courseId?: string;
  description: string;
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate: Timestamp;
  paidAt?: Timestamp;
  discount?: number;
  stripePaymentIntentId?: string;
  createdBy: string;
  createdAt?: Timestamp;
}

export async function createInvoice(data: Omit<Invoice, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'invoices'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateInvoiceStatus(invoiceId: string, status: Invoice['status'], paidAt?: Date) {
  const updates: Record<string, unknown> = { status };
  if (paidAt) updates.paidAt = Timestamp.fromDate(paidAt);
  await updateDoc(doc(db, 'invoices', invoiceId), updates);
}

export async function getInvoicesForStudent(studentId: string): Promise<Invoice[]> {
  const q = query(collection(db, 'invoices'), where('studentId', '==', studentId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
}

export async function getInvoicesForTeacher(teacherId: string): Promise<Invoice[]> {
  const q = query(collection(db, 'invoices'), where('createdBy', '==', teacherId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
}

export async function getAllInvoices(): Promise<Invoice[]> {
  const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
}

export async function deleteInvoice(id: string) {
  await deleteDoc(doc(db, 'invoices', id));
}

// ─── Resources ────────────────────────────────────────────────

export interface Resource {
  id: string;
  title: string;
  description?: string;
  type: 'pdf' | 'video' | 'link' | 'doc' | 'other';
  url: string;
  courseId?: string;
  subject?: string;
  tags: string[];
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt?: Timestamp;
  isPublic: boolean;
}

export async function createResource(data: Omit<Resource, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'resources'), { ...data, uploadedAt: serverTimestamp() });
  return ref.id;
}

export async function getResources(courseId?: string): Promise<Resource[]> {
  let q;
  if (courseId) {
    q = query(collection(db, 'resources'), where('courseId', '==', courseId), orderBy('uploadedAt', 'desc'));
  } else {
    q = query(collection(db, 'resources'), where('isPublic', '==', true), orderBy('uploadedAt', 'desc'), limit(50));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Resource));
}

export async function deleteResource(id: string) {
  await deleteDoc(doc(db, 'resources', id));
}

// ─── Behaviour / Merit Records ────────────────────────────────

export interface BehaviourRecord {
  id: string;
  studentId: string;
  studentName: string;
  courseId?: string;
  type: 'merit' | 'demerit' | 'commendation' | 'warning' | 'note';
  points: number;
  description: string;
  recordedBy: string;
  recordedByName: string;
  createdAt?: Timestamp;
}

export async function createBehaviourRecord(data: Omit<BehaviourRecord, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'behaviour_records'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function getBehaviourRecordsForStudent(studentId: string): Promise<BehaviourRecord[]> {
  const q = query(collection(db, 'behaviour_records'), where('studentId', '==', studentId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BehaviourRecord));
}

export async function getBehaviourRecordsForTeacher(teacherId: string): Promise<BehaviourRecord[]> {
  const q = query(collection(db, 'behaviour_records'), where('recordedBy', '==', teacherId), orderBy('createdAt', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BehaviourRecord));
}

// ─── Helpdesk Tickets ─────────────────────────────────────────

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  subject: string;
  description: string;
  category: 'technical' | 'academic' | 'billing' | 'general';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  response?: string;
  respondedAt?: Timestamp;
  createdAt?: Timestamp;
}

export async function createSupportTicket(data: Omit<SupportTicket, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'support_tickets'), { ...data, status: 'open', createdAt: serverTimestamp() });
  return ref.id;
}

export async function getSupportTickets(userId: string, role: string): Promise<SupportTicket[]> {
  let q;
  if (role === 'admin') {
    q = query(collection(db, 'support_tickets'), orderBy('createdAt', 'desc'), limit(50));
  } else {
    q = query(collection(db, 'support_tickets'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket));
}

export async function updateSupportTicket(id: string, data: Partial<SupportTicket>) {
  await updateDoc(doc(db, 'support_tickets', id), data);
}

// ─── Tasks (Student To-Do) ────────────────────────────────────

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  dueDate?: Timestamp;
  completed: boolean;
  priority: 'low' | 'normal' | 'high';
  courseId?: string;
  createdAt?: Timestamp;
}

export async function createTask(data: Omit<Task, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'tasks'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function getTasks(userId: string): Promise<Task[]> {
  const q = query(collection(db, 'tasks'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
}

export async function updateTask(id: string, data: Partial<Task>) {
  await updateDoc(doc(db, 'tasks', id), data);
}

export async function deleteTask(id: string) {
  await deleteDoc(doc(db, 'tasks', id));
}


// ─── Attendance ───────────────────────────────────────────────────────────────

export interface AttendanceEntry {
  studentId: string;
  studentName: string;
  status: 'present' | 'absent' | 'late' | 'excused';
}

export interface AttendanceRecord {
  id?: string;
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  teacherId: string;
  date: Timestamp;
  records: AttendanceEntry[];
}

export async function createAttendanceRecord(data: Omit<AttendanceRecord, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'attendance_records'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function getAttendanceForCourse(courseId: string): Promise<AttendanceRecord[]> {
  const q = query(collection(db, 'attendance_records'), where('courseId', '==', courseId), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
}

export async function getAttendanceForStudent(studentId: string): Promise<AttendanceRecord[]> {
  const snap = await getDocs(collection(db, 'attendance_records'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as AttendanceRecord))
    .filter(r => r.records.some(e => e.studentId === studentId));
}

export async function updateAttendanceRecord(id: string, data: Partial<AttendanceRecord>) {
  await updateDoc(doc(db, 'attendance_records', id), data);
}

// ─── Certificates ─────────────────────────────────────────────────────────────

export interface Certificate {
  id?: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  issuedAt: Timestamp;
  issuedBy: string;
  issuedByName: string;
}

export async function issueCertificate(data: Omit<Certificate, 'id'>): Promise<string> {
  const uuid = crypto.randomUUID();
  await setDoc(doc(db, 'certificates', uuid), { ...data, createdAt: serverTimestamp() });
  return uuid;
}

export async function getCertificatesForStudent(studentId: string): Promise<Certificate[]> {
  const q = query(collection(db, 'certificates'), where('studentId', '==', studentId), orderBy('issuedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Certificate));
}

export async function getCertificateByUUID(uuid: string): Promise<Certificate | null> {
  const snap = await getDoc(doc(db, 'certificates', uuid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Certificate;
}

// ─── User Sessions (anti-password-sharing) ───────────────────────────────────

export interface UserSession {
  id?: string;
  userId: string;
  deviceInfo: string;
  lastSeen: Timestamp;
  createdAt: Timestamp;
}

export async function upsertUserSession(userId: string, deviceInfo: string): Promise<boolean> {
  const q = query(collection(db, 'user_sessions'), where('userId', '==', userId), where('deviceInfo', '==', deviceInfo));
  const snap = await getDocs(q);
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, { lastSeen: serverTimestamp() });
    return false;
  }
  await addDoc(collection(db, 'user_sessions'), { userId, deviceInfo, lastSeen: serverTimestamp(), createdAt: serverTimestamp() });
  return true;
}

export async function getUserSessions(userId: string): Promise<UserSession[]> {
  const q = query(collection(db, 'user_sessions'), where('userId', '==', userId), orderBy('lastSeen', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as UserSession));
}

// ─── Parent Verification ──────────────────────────────────────────────────────

export interface ParentVerification {
  id?: string;
  parentId: string;
  parentName: string;
  parentEmail: string;
  studentEmail: string;
  studentId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
}

export async function createParentVerification(data: Omit<ParentVerification, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'parent_verifications'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function getPendingVerifications(): Promise<ParentVerification[]> {
  const q = query(collection(db, 'parent_verifications'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ParentVerification));
}

export async function updateVerificationStatus(id: string, status: 'approved' | 'rejected') {
  await updateDoc(doc(db, 'parent_verifications', id), { status });
}
