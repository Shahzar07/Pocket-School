import 'server-only';

import type { LearningEventName } from '@/lib/events';

export interface LearningEmission {
  uid: string;
  event: LearningEventName;
  day: string;
  eventId?: string;
  payload?: Record<string, unknown>;
}

type Listener = (emission: LearningEmission) => Promise<void>;

const listeners: Listener[] = [];
let ready: Promise<void> | null = null;

export function onLearningEvent(listener: Listener): void {
  listeners.push(listener);
}

async function ensureListeners(): Promise<void> {
  if (!ready) {
    ready = import('@/lib/server/gamification').then(mod => {
      mod.listenForServerEvents();
    });
  }
  await ready;
}

/** Server code emits. The gamification listener applies the award. */
export async function emitLearningEvent(emission: LearningEmission): Promise<void> {
  await ensureListeners();
  for (const listener of listeners) {
    await listener(emission);
  }
}
