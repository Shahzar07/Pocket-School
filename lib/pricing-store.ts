import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { reportContentChange } from './audit/report';
import {
  diffPricing,
  normalizePricing,
  seedPricing,
  type PricingConfig,
} from './pricing';

export interface PricingActor {
  actorId: string;
  actorEmail: string;
  actorName: string;
}

export interface PricingAuditEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  actorName: string;
  summary: string[];
  at?: { toDate?: () => Date };
}

/** Public read. Missing or unreadable documents fall back to the seed. */
export async function loadPricingConfig(): Promise<PricingConfig> {
  try {
    const snap = await getDoc(doc(db, 'pricing_config', 'current'));
    if (!snap.exists()) return seedPricing();
    return normalizePricing(snap.data());
  } catch {
    return seedPricing();
  }
}

/**
 * Admin write. The caller must already be an admin; Firestore rules reject
 * everyone else. An empty diff does not write an audit row.
 */
export async function savePricingConfig(next: PricingConfig, actor: PricingActor): Promise<string[]> {
  const clean = normalizePricing(next);
  const before = await loadPricingConfig();
  const summary = diffPricing(before, clean);
  if (summary.length === 0) return summary;
  await setDoc(doc(db, 'pricing_config', 'current'), clean);
  reportContentChange({
    action: 'pricing.edit',
    targetType: 'pricing',
    targetId: 'current',
    targetLabel: summary.join(', '),
    before,
    after: clean,
  });
  await addDoc(collection(db, 'pricing_audit'), {
    actorId: actor.actorId,
    actorEmail: actor.actorEmail,
    actorName: actor.actorName,
    at: serverTimestamp(),
    summary,
    before,
    after: clean,
  });
  return summary;
}

export async function loadPricingAudit(max = 20): Promise<PricingAuditEntry[]> {
  const snap = await getDocs(query(
    collection(db, 'pricing_audit'),
    orderBy('at', 'desc'),
    limit(max),
  ));
  return snap.docs.map(entry => {
    const data = entry.data() as Partial<PricingAuditEntry>;
    return {
      id: entry.id,
      actorId: typeof data.actorId === 'string' ? data.actorId : '',
      actorEmail: typeof data.actorEmail === 'string' ? data.actorEmail : '',
      actorName: typeof data.actorName === 'string' ? data.actorName : '',
      summary: Array.isArray(data.summary) ? data.summary.filter(line => typeof line === 'string') : [],
      at: data.at,
    };
  });
}
