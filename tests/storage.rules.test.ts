import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { getMetadata, ref, uploadBytes } from 'firebase/storage';

const hostEnv = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199';
const [host, portText] = hostEnv.split(':');
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-poket',
    storage: {
      rules: readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8'),
      host,
      port: Number(portText),
    },
  });
});

after(async () => {
  await env.cleanup();
});

function storageFor(uid: string, claims: Record<string, string>) {
  return env.authenticatedContext(uid, claims).storage();
}

describe('creator store storage rules', { timeout: 180_000 }, () => {
  it('lets the public read thumbs and previews, and only store staff write images under 5 MB', async () => {
    const admin = storageFor('store-admin', { adminRole: 'admin', role: 'admin' });
    const editor = storageFor('store-editor', { adminRole: 'content_editor', role: 'admin' });
    const support = storageFor('store-support', { adminRole: 'support', role: 'admin' });
    const student = storageFor('store-student', { role: 'student' });
    const anon = env.unauthenticatedContext().storage();
    const thumb = 'store/products/rules-demo/thumbs/cover.webp';
    const preview = 'store/products/rules-demo/preview/1.png';

    await assertSucceeds(uploadBytes(ref(admin, thumb), png, { contentType: 'image/webp' }));
    await assertSucceeds(getMetadata(ref(anon, thumb)));
    await assertSucceeds(uploadBytes(ref(editor, preview), png, { contentType: 'image/png' }));
    await assertSucceeds(getMetadata(ref(anon, preview)));
    await assertFails(uploadBytes(ref(student, 'store/products/rules-demo/thumbs/no.webp'), png, { contentType: 'image/webp' }));
    await assertFails(uploadBytes(ref(support, 'store/products/rules-demo/thumbs/no.webp'), png, { contentType: 'image/webp' }));
    await assertFails(uploadBytes(ref(anon, 'store/products/rules-demo/preview/no.png'), png, { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(admin, 'store/products/rules-demo/thumbs/paper.pdf'), pdf, { contentType: 'application/pdf' }));
    const huge = new Uint8Array(5 * 1024 * 1024 + 1);
    await assertFails(uploadBytes(ref(admin, 'store/products/rules-demo/thumbs/huge.webp'), huge, { contentType: 'image/webp' }));
  });

  it('keeps paper and mark scheme private, separate, and limited to 50 MB PDFs', async () => {
    const admin = storageFor('store-admin-pdf', { adminRole: 'super_admin', role: 'admin' });
    const editor = storageFor('store-editor-pdf', { adminRole: 'content_editor', role: 'admin' });
    const student = storageFor('store-student-pdf', { role: 'student' });
    const anon = env.unauthenticatedContext().storage();
    const paper = 'store/products/rules-demo/private/paper.pdf';
    const scheme = 'store/products/rules-demo/private/markscheme.pdf';

    await assertSucceeds(uploadBytes(ref(admin, paper), pdf, { contentType: 'application/pdf' }));
    await assertSucceeds(uploadBytes(ref(editor, scheme), pdf, { contentType: 'application/pdf' }));
    await assertFails(getMetadata(ref(anon, paper)));
    await assertFails(getMetadata(ref(student, scheme)));
    await assertFails(getMetadata(ref(admin, paper)));
    await assertFails(uploadBytes(ref(student, paper), pdf, { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(admin, 'store/products/rules-demo/private/combined.pdf'), pdf, { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(admin, paper), png, { contentType: 'image/png' }));
    const huge = new Uint8Array(50 * 1024 * 1024 + 1);
    await assertFails(uploadBytes(ref(admin, 'store/products/rules-over/private/paper.pdf'), huge, { contentType: 'application/pdf' }));
  });
});
