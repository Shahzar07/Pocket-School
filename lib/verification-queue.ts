import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from './firebase';
import type { ParentVerification } from './db';

/** Every parent-link review an admin can see, newest first. */
export async function listVerifications(max = 500): Promise<ParentVerification[]> {
  const snap = await getDocs(query(collection(db, 'parent_verifications'), limit(max)));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() } as ParentVerification))
    .sort((a, b) => {
      const at = a.createdAt?.toMillis?.() ?? 0;
      const bt = b.createdAt?.toMillis?.() ?? 0;
      return bt - at;
    });
}
