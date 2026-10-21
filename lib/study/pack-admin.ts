import { EXAM_PACKS, type ExamPack } from './exam-packs';

/** Legacy browser copy. The live catalog is the `exam_packs` collection. */
export const PACK_STORE_KEY = 'poket-exam-packs';
/** Set after the admin desk has offered the local copy to Firestore once. */
export const PACK_IMPORT_KEY = 'poket-exam-packs-imported';

export interface PackStore {
  packs: ExamPack[];
  removed: string[];
}

export const EMPTY_PACK_STORE: PackStore = { packs: [], removed: [] };

export function listPacks(store: PackStore = EMPTY_PACK_STORE): ExamPack[] {
  const byId = new Map(EXAM_PACKS.map((pack) => [pack.id, pack]));
  for (const id of store.removed) byId.delete(id);
  for (const pack of store.packs) byId.set(pack.id, pack);
  return [...byId.values()];
}

export function savePack(store: PackStore, pack: ExamPack): PackStore {
  return {
    packs: [...store.packs.filter((item) => item.id !== pack.id), pack],
    removed: store.removed.filter((id) => id !== pack.id),
  };
}

export function deletePack(store: PackStore, id: string): PackStore {
  return {
    packs: store.packs.filter((item) => item.id !== id),
    removed: store.removed.includes(id) ? store.removed : [...store.removed, id],
  };
}

export function readPackStore(raw: string | null): PackStore {
  if (!raw) return EMPTY_PACK_STORE;
  try {
    const parsed = JSON.parse(raw) as Partial<PackStore>;
    return {
      packs: Array.isArray(parsed.packs) ? parsed.packs.filter((pack) => pack && typeof pack.id === 'string' && typeof pack.name === 'string') : [],
      removed: Array.isArray(parsed.removed) ? parsed.removed.filter((id) => typeof id === 'string') : [],
    };
  } catch {
    return EMPTY_PACK_STORE;
  }
}
