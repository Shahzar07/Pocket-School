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
