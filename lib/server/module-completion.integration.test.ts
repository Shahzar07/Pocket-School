import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const DATABASE_ID = 'ai-studio-5cdc1a69-b213-49e8-8c41-756df00d9e15';

describe.skipIf(!EMULATOR.startsWith('127.0.0.1') && !EMULATOR.startsWith('localhost'))(
  'completing a module as a test student',
  () => {
    const studentId = 'student-cert';
    const courseId = 'course-cert';
    const moduleId = 'module-cells';

    let completeLesson: typeof import('./actions').completeLesson;
    let syncModuleCertificates: typeof import('./actions').syncModuleCertificates;
    let firestore: import('firebase-admin/firestore').Firestore;

    beforeAll(async () => {
      process.env.FIREBASE_PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-poket';
      const { getApps, initializeApp } = await import('firebase-admin/app');
      const { getFirestore } = await import('firebase-admin/firestore');
      const app = getApps()[0] ?? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
      firestore = getFirestore(app, DATABASE_ID);
      const actions = await import('./actions');
      completeLesson = actions.completeLesson;
      syncModuleCertificates = actions.syncModuleCertificates;

      await firestore.doc(`users/${studentId}`).set({
        name: 'Aisha Rahman', role: 'student', xp: 0, sparksBalance: 0, email: 'aisha@example.com',
      });
      await firestore.doc(`courses/${courseId}`).set({
        title: 'Biology', kind: 'curriculum', ownerId: 'teacher-cert', status: 'published',
      });
      await firestore.doc(`courses/${courseId}/modules/${moduleId}`).set({
        title: 'Cells and organisation', order: 1,
      });
      await firestore.doc(`courses/${courseId}/modules/module-draft`).set({
        title: 'Unpublished unit', order: 2,
      });
      await firestore.doc(`courses/${courseId}/modules/${moduleId}/lessons/pub-a`).set({
        title: 'Plant cells', status: 'published', order: 1,
      });
      await firestore.doc(`courses/${courseId}/modules/${moduleId}/lessons/draft-b`).set({
        title: 'Still being written', status: 'draft', order: 2,
      });
      await firestore.doc(`courses/${courseId}/modules/${moduleId}/lessons/pub-c`).set({
        title: 'Animal cells', status: 'published', order: 3,
      });
      await firestore.doc(`courses/${courseId}/modules/module-draft/lessons/only-draft`).set({
        title: 'Draft only', status: 'draft', order: 1,
      });
      await firestore.doc(`courses/${courseId}/enrollments/${studentId}`).set({
        studentId,
        courseId,
        progress: 0,
        completedLessons: ['draft-b', 'ghost-lesson'],
      });
    }, 30000);

    afterAll(async () => {
      if (!firestore) return;
      const certs = await firestore.collection('certificates').where('studentId', '==', studentId).get();
      await Promise.all(certs.docs.map((doc) => doc.ref.delete()));
      const keys = await firestore.collection('certificate_keys').where('studentId', '==', studentId).get();
      await Promise.all(keys.docs.map((doc) => doc.ref.delete()));
    });

    it('awards one verifiable certificate when the last published lesson is finished', async () => {
      const draft = await completeLesson(studentId, courseId, 'draft-b', 50, true);
      expect(draft.accepted).toBe(false);
      expect(draft.certificate).toBeNull();

      const missing = completeLesson(studentId, courseId, 'does-not-exist');
      await expect(missing).rejects.toMatchObject({ code: 'NOT_FOUND' });

      const first = await completeLesson(studentId, courseId, 'pub-a', 50, true);
      expect(first.accepted).toBe(true);
      expect(first.progress).toBe(50);
      expect(first.certificate).toBeNull();
      expect(first.balance).toBe(10);

      const repeat = await completeLesson(studentId, courseId, 'pub-a', 50, true);
      expect(repeat.already).toBe(true);
      expect(repeat.balance).toBe(10);

      const done = await completeLesson(studentId, courseId, 'pub-c', 50, true);
      expect(done.progress).toBe(100);
      expect(done.certificate?.fresh).toBe(true);
      expect(done.certificate?.studentName).toBe('Aisha Rahman');
      expect(done.certificate?.moduleTitle).toBe('Cells and organisation');
      expect(done.certificate?.courseTitle).toBe('Biology');
      expect(done.certificate?.issuedByName).toBe('Poket School');
      expect(done.certificate?.id).toMatch(/^[0-9a-f-]{36}$/);

      const saved = await firestore.doc(`certificates/${done.certificate?.id}`).get();
      expect(saved.exists).toBe(true);
      expect(saved.data()?.studentId).toBe(studentId);
      expect(saved.data()?.moduleId).toBe(moduleId);
      expect(saved.data()?.brand).toBe('Poket School');
      expect(saved.data()?.status).toBe('valid');
      expect(saved.data()?.issuedBy).toBe('poket-school');
      expect(typeof saved.data()?.disclaimer).toBe('string');

      const again = await completeLesson(studentId, courseId, 'pub-c', 50, true);
      expect(again.certificate).toBeNull();
      const all = await firestore.collection('certificates').where('studentId', '==', studentId).get();
      expect(all.size).toBe(1);

      const enrollment = await firestore.doc(`courses/${courseId}/enrollments/${studentId}`).get();
      expect(enrollment.data()?.progress).toBe(100);
      expect(enrollment.data()?.completedLessons).toEqual(expect.arrayContaining(['pub-a', 'pub-c', 'draft-b', 'ghost-lesson']));
      expect(enrollment.data()?.completedLessons).not.toContain('only-draft');

      const draftOnly = await completeLesson(studentId, courseId, 'only-draft');
      expect(draftOnly.accepted).toBe(false);

      const synced = await syncModuleCertificates(studentId, studentId, courseId);
      expect(synced.issued).toEqual([]);
      const stillOne = await firestore.collection('certificates').where('studentId', '==', studentId).get();
      expect(stillOne.size).toBe(1);
    }, 30000);
  },
);
