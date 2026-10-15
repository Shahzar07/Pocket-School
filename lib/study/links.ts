import type { PlanItem } from './types';

/** Where a plan item opens. */
export function itemHref(prepId: string, it: PlanItem) {
  if (it.asset === 'mock') return `/dashboard/studio/exam-prep/${prepId}/mock`;
  return `/dashboard/studio/exam-prep/${prepId}/topic/${it.topicId}?tab=${it.asset}&item=${encodeURIComponent(it.id)}`;
}
