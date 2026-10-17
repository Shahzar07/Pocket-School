import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import {
  defaultAutomation,
  readAutomation,
  type AutomationEvent,
  type AutomationRuleId,
  type AutomationSettings,
} from '../site-automation';

const DOC = 'settings/site_automation';

export async function loadAutomation(): Promise<AutomationSettings> {
  try {
    const snap = await adminDb().doc(DOC).get();
    if (!snap.exists) return defaultAutomation();
    return readAutomation(snap.data());
  } catch {
    return defaultAutomation();
  }
}

export async function saveAutomation(settings: AutomationSettings, actorId: string): Promise<void> {
  await adminDb().doc(DOC).set({
    rules: settings.rules,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
}

export async function logAutomation(event: {
  rule: AutomationRuleId | string;
  outcome: AutomationEvent['outcome'];
  summary: string;
  actorId?: string;
  refId?: string;
}): Promise<void> {
  await adminDb().collection('automation_events').add({
    rule: event.rule,
    outcome: event.outcome,
    summary: event.summary.slice(0, 280),
    actorId: event.actorId ?? '',
    refId: event.refId ?? '',
    at: new Date().toISOString(),
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function recentAutomation(limit = 30): Promise<AutomationEvent[]> {
  const snap = await adminDb().collection('automation_events').orderBy('at', 'desc').limit(limit).get();
  return snap.docs.map((row) => {
    const data = row.data();
    return {
      id: row.id,
      rule: typeof data.rule === 'string' ? data.rule : '',
      outcome: data.outcome === 'held' || data.outcome === 'refused' || data.outcome === 'override' ? data.outcome : 'auto',
      summary: typeof data.summary === 'string' ? data.summary : '',
      at: typeof data.at === 'string' ? data.at : '',
    };
  });
}
