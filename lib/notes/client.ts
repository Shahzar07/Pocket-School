/**
 * Owner reads and writes for sticky notes. The same documents are what the
 * app uses. Offline persistence on the Firestore client syncs edits after
 * a reconnect. Sharing and reminders are not written here.
 */

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  DEFAULT_BOARD,
  boardName,
  clampNoteText,
  cleanChecklist,
  noteColour,
  noteLink,
  type NoteCheck,
  type NoteColour,
  type NoteLink,
  type StickyNote,
} from './model';

function toNote(id: string, data: DocumentData): StickyNote {
  const linked = data.linkedTo as { type?: unknown; id?: unknown } | undefined;
  const share = data.share as { spaceId?: unknown; status?: unknown; at?: unknown } | undefined;
  const status = share?.status === 'live' || share?.status === 'held' || share?.status === 'blocked'
    ? share.status
    : null;
  return {
    id,
    text: typeof data.text === 'string' ? data.text : '',
    colour: noteColour(data.colour),
    pinned: data.pinned === true,
    order: typeof data.order === 'number' ? data.order : 0,
    board: boardName(typeof data.board === 'string' ? data.board : DEFAULT_BOARD),
    linkedTo: noteLink(linked?.type, linked?.id),
    remindAt: typeof data.remindAt === 'number' ? data.remindAt : null,
    remindedAt: typeof data.remindedAt === 'number' ? data.remindedAt : 0,
    checklist: cleanChecklist(data.checklist),
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
    deletedAt: typeof data.deletedAt === 'number' ? data.deletedAt : null,
    share: status && typeof share?.spaceId === 'string'
      ? { spaceId: share.spaceId, status, at: typeof share.at === 'number' ? share.at : 0 }
      : null,
  };
}

export function subscribeNotes(uid: string, onNotes: (notes: StickyNote[]) => void): () => void {
  const q = query(collection(db, 'users', uid, 'notes'), orderBy('order'));
  return onSnapshot(q, (snap) => {
    onNotes(snap.docs.map((item) => toNote(item.id, item.data())));
  }, () => onNotes([]));
}

export async function createNote(uid: string, input: {
  text: string;
  colour?: NoteColour;
  board?: string;
  linkedTo?: NoteLink;
  checklist?: NoteCheck[];
  remindAt?: number | null;
  order?: number;
}): Promise<string> {
  const ref = doc(collection(db, 'users', uid, 'notes'));
  const now = Date.now();
  const checklist = cleanChecklist(input.checklist);
  await setDoc(ref, {
    text: clampNoteText(input.text),
    colour: noteColour(input.colour),
    pinned: false,
    order: input.order ?? now,
    board: boardName(input.board ?? DEFAULT_BOARD),
    linkedTo: noteLink(input.linkedTo?.type, input.linkedTo?.id),
    checklist,
    remindAt: typeof input.remindAt === 'number' ? input.remindAt : null,
    remindedAt: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
  return ref.id;
}

export async function patchNote(uid: string, id: string, patch: {
  text?: string;
  colour?: NoteColour;
  pinned?: boolean;
  board?: string;
  linkedTo?: NoteLink;
  checklist?: NoteCheck[];
  remindAt?: number | null;
  deletedAt?: number | null;
}): Promise<void> {
  const next: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.text !== undefined) next.text = clampNoteText(patch.text);
  if (patch.colour !== undefined) next.colour = noteColour(patch.colour);
  if (patch.pinned !== undefined) next.pinned = patch.pinned;
  if (patch.board !== undefined) next.board = boardName(patch.board);
  if (patch.linkedTo) next.linkedTo = noteLink(patch.linkedTo.type, patch.linkedTo.id);
  if (patch.checklist) next.checklist = cleanChecklist(patch.checklist);
  if (patch.remindAt !== undefined) {
    next.remindAt = patch.remindAt;
    next.remindedAt = 0;
  }
  if (patch.deletedAt !== undefined) next.deletedAt = patch.deletedAt;
  await updateDoc(doc(db, 'users', uid, 'notes', id), next);
}

export async function saveNoteOrder(uid: string, ids: readonly string[]): Promise<void> {
  const batch = writeBatch(db);
  const now = Date.now();
  ids.forEach((id, index) => {
    batch.update(doc(db, 'users', uid, 'notes', id), { order: index, updatedAt: now });
  });
  await batch.commit();
}
