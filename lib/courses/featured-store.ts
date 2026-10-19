'use client';

import { collection, doc, getDoc, getDocs, increment, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getEnrollmentsForCourse, getGradesForCourse, updateCourse, updateGrade, type Course } from '@/lib/db';
import { mergePlan, type FeaturedKind } from '@/lib/courses/placement';

export interface ShowcaseBook {
  id: string;
  title: string;
  status: string;
  allocateMarketplace: boolean;
  priceUsd: number;
  readingLevel: string;
  cover: string;
  featured: boolean;
  priority: number;
  featuredFrom: string;
  featuredUntil: string;
}

export interface FeaturedStat {
  id: string;
  impressions: number;
  clicks: number;
}

export async function listShowcaseBooks(): Promise<ShowcaseBook[]> {
  try {
    const snap = await getDocs(query(
      collection(db, 'books'),
      where('status', '==', 'published'),
      where('allocateMarketplace', '==', true),
    ));
    return snap.docs.map((row) => {
      const data = row.data();
      const showcase = (data.showcase ?? {}) as Record<string, unknown>;
      const brief = (data.coverBrief ?? {}) as { artSrc?: string };
      return {
        id: row.id,
        title: typeof data.title === 'string' && data.title.trim() ? data.title : 'PoketReads',
        status: 'published',
        allocateMarketplace: true,
        priceUsd: typeof data.priceUsd === 'number' ? data.priceUsd : 0,
        readingLevel: typeof data.readingLevel === 'string' ? data.readingLevel : '',
        cover: typeof brief.artSrc === 'string' ? brief.artSrc : '',
        featured: showcase.featured === true,
        priority: typeof showcase.priority === 'number' ? showcase.priority : 0,
        featuredFrom: typeof showcase.from === 'string' ? showcase.from : '',
        featuredUntil: typeof showcase.until === 'string' ? showcase.until : '',
      };
    });
  } catch {
    return [];
  }
}

export async function saveBookShowcase(bookId: string, showcase: {
  featured: boolean;
  priority: number;
  from: string;
  until: string;
}): Promise<void> {
  await updateDoc(doc(db, 'books', bookId), { showcase });
}

export async function listFeaturedStats(): Promise<FeaturedStat[]> {
  try {
    const snap = await getDocs(collection(db, 'featured_stats'));
    return snap.docs.map((row) => {
      const data = row.data();
      return {
        id: row.id,
        impressions: typeof data.impressions === 'number' ? data.impressions : 0,
        clicks: typeof data.clicks === 'number' ? data.clicks : 0,
      };
    });
  } catch {
    return [];
  }
}

/** Guests may add one impression or one click. Failures stay off the screen. */
export async function bumpFeaturedStat(id: string, field: 'impressions' | 'clicks', meta: { kind: FeaturedKind; title: string }): Promise<void> {
  const ref = doc(db, 'featured_stats', id);
  try {
    await updateDoc(ref, { [field]: increment(1) });
    return;
  } catch {
    /* The first view creates the counter. */
  }
  const created = {
    impressions: field === 'impressions' ? 1 : 0,
    clicks: field === 'clicks' ? 1 : 0,
    kind: meta.kind,
    title: meta.title.slice(0, 180),
  };
  try {
    await setDoc(ref, created);
  } catch {
    try {
      await updateDoc(ref, { [field]: increment(1) });
    } catch {
      /* A counter must not block the carousel. */
    }
  }
}

/**
 * Copy enrolments onto the kept course and retarget grades.
 * The other course stays in the database and leaves the marketplace.
 */
export async function mergeDuplicateCourse(keepId: string, dropId: string): Promise<{ enrolments: number; grades: number }> {
  const plan = mergePlan(keepId, dropId);
  if ('error' in plan) throw new Error(plan.error);
  const dropSnap = await getDoc(doc(db, 'courses', dropId));
  if (!dropSnap.exists()) throw new Error('The course to merge was not found.');
  const drop = { id: dropSnap.id, ...dropSnap.data() } as Course;
  const [keepRows, dropRows] = await Promise.all([
    getEnrollmentsForCourse(keepId),
    getEnrollmentsForCourse(dropId),
  ]);
  const held = new Set(keepRows.map((row) => row.studentId));
  let enrolments = 0;
  for (const row of dropRows) {
    if (held.has(row.studentId)) continue;
    const source = await getDoc(doc(db, 'courses', dropId, 'enrollments', row.studentId));
    if (!source.exists()) continue;
    await setDoc(doc(db, 'courses', keepId, 'enrollments', row.studentId), {
      ...source.data(),
      courseId: keepId,
    });
    enrolments += 1;
  }
  const grades = await getGradesForCourse(dropId);
  for (const grade of grades) {
    await updateGrade(grade.id, { courseId: keepId });
  }
  await updateCourse(dropId, {
    placement: {
      marketplace: 'hidden',
      featured: false,
      core: drop.placement?.core ?? false,
      levels: drop.placement?.levels ?? [],
      institutionIds: drop.placement?.institutionIds ?? [],
      priority: 0,
      featuredFrom: '',
      featuredUntil: '',
      mergedInto: keepId,
    },
    featured: false,
    marketplaceApproved: false,
    isPublic: false,
  });
  return { enrolments, grades: grades.length };
}
