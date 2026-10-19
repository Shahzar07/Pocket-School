'use client';

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COPYRIGHT_DECLARATION, COPYRIGHT_VERSION, namesMatch, type SignatureContext } from '@/lib/courses/copyright';
import { SIGN } from '@/lib/courses/sign-copy';

export async function writeCopyrightSignature(input: {
  uid: string;
  typedFullName: string;
  profileName: string;
  role: string;
  context: SignatureContext;
  courseId: string;
  locale: string;
}): Promise<string> {
  if (!namesMatch(input.typedFullName, input.profileName)) {
    throw new Error(SIGN.mismatch);
  }
  let ip = '';
  try {
    const response = await fetch('/api/copyright/ip');
    const body = await response.json() as { ip?: string };
    ip = typeof body.ip === 'string' ? body.ip.slice(0, 80) : '';
  } catch {
    ip = '';
  }
  const ref = await addDoc(collection(db, 'copyright_signatures'), {
    uid: input.uid,
    typedFullName: input.typedFullName.trim().replace(/\s+/g, ' '),
    role: input.role,
    context: input.context,
    courseId: input.courseId,
    institutionId: '',
    declarationVersion: COPYRIGHT_VERSION,
    text: COPYRIGHT_DECLARATION,
    signedAt: serverTimestamp(),
    ip,
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent.slice(0, 300),
    locale: input.locale || 'en',
  });
  return ref.id;
}
