import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const DATABASE_ID = 'ai-studio-5cdc1a69-b213-49e8-8c41-756df00d9e15';

const emulatorReady = EMULATOR.startsWith('127.0.0.1') || EMULATOR.startsWith('localhost');

describe('completing a module as a test student', { skip: !emulatorReady }, () => {
    const studentId = 'student-cert';
    const courseId = 'course-cert';
    const moduleId = 'module-cells';

    let completeLesson: typeof import('./actions').completeLesson;
    let syncModuleCertificates: typeof import('./actions').syncModuleCertificates;
    let firestore: import('firebase-admin/firestore').Firestore;

    before(async () => {
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
    });

    after(async () => {
      if (!firestore) return;
      const certs = await firestore.collection('certificates').where('studentId', '==', studentId).get();
      await Promise.all(certs.docs.map((doc) => doc.ref.delete()));
      const keys = await firestore.collection('certificate_keys').where('studentId', '==', studentId).get();
      await Promise.all(keys.docs.map((doc) => doc.ref.delete()));
    });

    it('records progress when the last published lesson is finished and does not award a certificate', async () => {
      const draft = await completeLesson(studentId, courseId, 'draft-b', 50, true);
      assert.equal(draft.accepted, false);
      assert.equal(draft.certificate, null);

      const missing = completeLesson(studentId, courseId, 'does-not-exist');
      await assert.rejects(missing, (err: unknown) => {
        assert.equal((err as { code?: string }).code, 'NOT_FOUND');
        return true;
      });

      const first = await completeLesson(studentId, courseId, 'pub-a', 50, true);
      assert.equal(first.accepted, true);
      assert.equal(first.progress, 50);
      assert.equal(first.certificate, null);
      assert.equal(first.balance, 10);

      const repeat = await completeLesson(studentId, courseId, 'pub-a', 50, true);
      assert.equal(repeat.already, true);
      assert.equal(repeat.balance, 10);

      const done = await completeLesson(studentId, courseId, 'pub-c', 50, true);
      assert.equal(done.progress, 100);
      assert.equal(done.certificate, null);

      const again = await completeLesson(studentId, courseId, 'pub-c', 50, true);
      assert.equal(again.certificate, null);
      const all = await firestore.collection('certificates').where('studentId', '==', studentId).get();
      assert.equal(all.size, 0);

      const enrollment = await firestore.doc(`courses/${courseId}/enrollments/${studentId}`).get();
      assert.equal(enrollment.data()?.progress, 100);
      const completed = enrollment.data()?.completedLessons as string[];
      for (const lessonId of ['pub-a', 'pub-c', 'draft-b', 'ghost-lesson']) {
        assert.equal(completed.includes(lessonId), true);
      }
      assert.equal(completed.includes('only-draft'), false);

      const draftOnly = await completeLesson(studentId, courseId, 'only-draft');
      assert.equal(draftOnly.accepted, false);

      const synced = await syncModuleCertificates(studentId, studentId, courseId);
      assert.deepEqual(synced.issued, []);
      const stillNone = await firestore.collection('certificates').where('studentId', '==', studentId).get();
      assert.equal(stillNone.size, 0);
    });
});
