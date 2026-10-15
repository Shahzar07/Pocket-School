'use client';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PlannerEvent } from '@/lib/insights/planner';

export interface StoredYearPlan {
  id: string;
  label: string;
  brand: string;
  status: 'draft' | 'published';
  ownerId: string;
  institutionId: string;
  campusId: string;
  classId: string;
  yearGroup: string;
  termStart: string;
  termEnd: string;
  unitsText: string;
  events: PlannerEvent[];
  updatedAt: string;
}

const LOCAL_KEY = 'poket-year-plan';

function clean(plan: StoredYearPlan): StoredYearPlan {
  return JSON.parse(JSON.stringify(plan)) as StoredYearPlan;
}

export function readLocalPlan(): StoredYearPlan | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredYearPlan;
    return parsed?.events ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLocalPlan(plan: StoredYearPlan) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(plan));
  } catch {
    // The page still holds the plan for this visit.
  }
}

async function readRemote(collectionName: 'academic_calendars' | 'calendar_drafts', id: string): Promise<StoredYearPlan | null> {
  const snap = await getDoc(doc(db, collectionName, id));
  if (!snap.exists()) return null;
  const data = snap.data() as StoredYearPlan;
  return data?.events ? data : null;
}

export async function loadSchoolPlan(id: string, canEdit: boolean): Promise<StoredYearPlan | null> {
  try {
    if (canEdit) {
      const draft = await readRemote('calendar_drafts', id);
      if (draft) return draft;
    }
    const published = await readRemote('academic_calendars', id);
    if (published && (canEdit || published.status === 'published')) return published;
  } catch {
    // The school calendar is unreachable. This device's copy is the fallback.
  }
  const local = readLocalPlan();
  if (!local) return null;
  if (!canEdit && local.status !== 'published') return null;
  return local;
}

export async function saveSchoolPlan(plan: StoredYearPlan): Promise<{ notice: string }> {
  const stored = clean({ ...plan, updatedAt: new Date().toISOString() });
  writeLocalPlan(stored);
  const collectionName = stored.status === 'published' ? 'academic_calendars' : 'calendar_drafts';
  try {
    await setDoc(doc(db, collectionName, stored.id), stored);
    if (stored.status === 'published') {
      await setDoc(doc(db, 'calendar_drafts', stored.id), stored);
    }
    return {
      notice: stored.status === 'published'
        ? 'Published. Students and families can open this year.'
        : 'Draft saved on this device and for editors. Students do not see it yet.',
    };
  } catch {
    return { notice: 'Saved on this device. The school calendar could not be updated.' };
  }
}
