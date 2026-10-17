/**
 * Sticky notes. Private to the owner. This module decides colour, order,
 * trash, sharing, and when a reminder may send. It does not call ET AI.
 */

import { asAgeTier, isMinorTier, type AgeTier } from '../age-tier';

export const NOTE_TEXT_MAX = 2000;
export const BOARD_NAME_MAX = 80;
export const CHECK_TEXT_MAX = 200;
export const CHECKLIST_MAX = 40;
export const DEFAULT_BOARD = 'My board';
export const TRASH_MS = 30 * 24 * 60 * 60 * 1000;

export const NOTE_COLOURS = [
  { id: 'cyan', label: 'Cyan', fill: '#D4F6F2', ink: '#203337' },
  { id: 'sky', label: 'Sky', fill: '#D7EAF8', ink: '#203337' },
  { id: 'coral', label: 'Coral', fill: '#F6E2DC', ink: '#203337' },
  { id: 'success', label: 'Green', fill: '#D7EFE6', ink: '#203337' },
  { id: 'lilac', label: 'Lilac', fill: '#E7E1F5', ink: '#203337' },
  { id: 'white', label: 'White', fill: '#FFFFFF', ink: '#203337' },
] as const;

export type NoteColour = (typeof NOTE_COLOURS)[number]['id'];
export type NoteLinkType = 'lesson' | 'course' | 'assignment' | 'exam' | 'none';
export type NoteAction = 'flashcards' | 'summarise' | 'plan';

export interface NoteLink {
  type: NoteLinkType;
  id: string;
}

export interface NoteCheck {
  id: string;
  text: string;
  done: boolean;
}

export interface NoteShare {
  spaceId: string;
  status: 'live' | 'held' | 'blocked';
  at: number;
}

export interface StickyNote {
  id: string;
  text: string;
  colour: NoteColour;
  pinned: boolean;
  order: number;
  board: string;
  linkedTo: NoteLink;
  remindAt?: number | null;
  remindedAt?: number;
  checklist?: NoteCheck[];
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  share?: NoteShare | null;
}

const LINK_TYPES: readonly NoteLinkType[] = ['lesson', 'course', 'assignment', 'exam', 'none'];

export function noteColour(value: unknown): NoteColour {
  return NOTE_COLOURS.some((item) => item.id === value) ? value as NoteColour : 'white';
}

export function colourFill(id: NoteColour): { fill: string; ink: string } {
  const found = NOTE_COLOURS.find((item) => item.id === id) ?? NOTE_COLOURS[5];
  return { fill: found.fill, ink: found.ink };
}

export function clampNoteText(value: string): string {
  return value.slice(0, NOTE_TEXT_MAX);
}

export function boardName(value: string): string {
  const clean = value.trim().slice(0, BOARD_NAME_MAX);
  return clean || DEFAULT_BOARD;
}

export function noteLink(type: unknown, id: unknown): NoteLink {
  const kind = LINK_TYPES.includes(type as NoteLinkType) ? type as NoteLinkType : 'none';
  return { type: kind, id: typeof id === 'string' ? id.slice(0, 120) : '' };
}

export function cleanChecklist(value: unknown): NoteCheck[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, CHECKLIST_MAX).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { id?: unknown; text?: unknown; done?: unknown };
    const text = typeof row.text === 'string' ? row.text.trim().slice(0, CHECK_TEXT_MAX) : '';
    if (!text) return [];
    const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim().slice(0, 40) : `c${index}`;
    return [{ id, text, done: row.done === true }];
  });
}

export function sortNotes(notes: readonly StickyNote[]): StickyNote[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.order !== b.order) return a.order - b.order;
    return b.updatedAt - a.updatedAt;
  });
}

export function reorderNotes(notes: readonly StickyNote[], fromId: string, toId: string): StickyNote[] {
  const sorted = sortNotes(notes);
  const from = sorted.findIndex((note) => note.id === fromId);
  const to = sorted.findIndex((note) => note.id === toId);
  if (from < 0 || to < 0 || from === to) return sorted;
  const next = [...sorted];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((note, index) => ({ ...note, order: index }));
}

export function inTrash(note: { deletedAt?: number | null }, now: number): boolean {
  return typeof note.deletedAt === 'number' && note.deletedAt > 0 && now - note.deletedAt < TRASH_MS;
}

export function trashExpired(deletedAt: number | null | undefined, now: number): boolean {
  return typeof deletedAt === 'number' && deletedAt > 0 && now - deletedAt >= TRASH_MS;
}

export function filterNotes(
  notes: readonly StickyNote[],
  query: { board?: string; link?: NoteLinkType | 'all'; search?: string; trash?: boolean; now: number },
): StickyNote[] {
  const needle = (query.search ?? '').trim().toLowerCase();
  return sortNotes(notes.filter((note) => {
    const gone = typeof note.deletedAt === 'number' && note.deletedAt > 0;
    if (query.trash) {
      if (!inTrash(note, query.now)) return false;
    } else if (gone) return false;
    if (query.board && query.board !== 'all' && note.board !== query.board) return false;
    if (query.link && query.link !== 'all' && note.linkedTo.type !== query.link) return false;
    if (!needle) return true;
    const checks = (note.checklist ?? []).map((item) => item.text).join(' ');
    return `${note.text} ${note.board} ${checks}`.toLowerCase().includes(needle);
  }));
}

export function linkedNotes(
  notes: readonly StickyNote[],
  link: NoteLink,
  match: 'exact' | 'type',
  now: number,
): StickyNote[] {
  return filterNotes(notes, { now, link: link.type }).filter((note) => {
    if (match === 'type') return true;
    return note.linkedTo.id === link.id;
  });
}

export type ReminderDecision = 'send' | 'wait' | 'skip';

export function reminderDecision(input: {
  remindAt?: number | null;
  remindedAt?: number | null;
  deletedAt?: number | null;
  now: number;
  quiet: boolean;
}): ReminderDecision {
  if (typeof input.deletedAt === 'number' && input.deletedAt > 0) return 'skip';
  if (typeof input.remindAt !== 'number' || input.remindAt <= 0 || input.remindAt > input.now) return 'skip';
  if (typeof input.remindedAt === 'number' && input.remindedAt > 0) return 'skip';
  return input.quiet ? 'wait' : 'send';
}

export interface ShareSpace {
  kind: string;
  institutionId: string;
  memberIds: readonly string[];
  staffIds: readonly string[];
}

/** Sharing is off until the owner asks. Under-18s stay inside their own school. */
export function shareAllowed(input: {
  uid: string;
  ageTier: unknown;
  userInstitutionId: string;
  space: ShareSpace;
}): { ok: boolean; reason: string } {
  const member = input.space.memberIds.includes(input.uid) || input.space.staffIds.includes(input.uid);
  if (!member) return { ok: false, reason: 'You are not in that study group.' };
  const tier = asAgeTier(input.ageTier);
  if (!isMinorTier(tier)) return { ok: true, reason: '' };
  const school = input.userInstitutionId.trim();
  const sameSchool = school.length > 0 && input.space.institutionId.trim() === school;
  const classLike = input.space.kind === 'class' || input.space.kind === 'school';
  if (!sameSchool || !classLike) {
    return { ok: false, reason: 'Under-18 notes can only be shared inside your school.' };
  }
  return { ok: true, reason: '' };
}

export function noteActionPrompt(action: NoteAction, notes: readonly { text: string; checklist?: NoteCheck[] }[]): string {
  const body = notes.map((note, index) => {
    const checks = (note.checklist ?? []).map((item) => `${item.done ? '[x]' : '[ ]'} ${item.text}`).join('\n');
    return `Note ${index + 1}\n${note.text}${checks ? `\n${checks}` : ''}`;
  }).join('\n\n');
  const task = action === 'flashcards'
    ? 'Turn these notes into flashcards. Reply with JSON {"cards":[{"front":"...","back":"..."}]} and at most 12 cards.'
    : action === 'summarise'
      ? 'Summarise these notes in one short paragraph the student can reread.'
      : 'Make a revision plan from these notes. Use a numbered list of small steps across the next seven days.';
  return `${task} Use only the notes below. Do not add facts that are not in them.\n\n${body}`;
}

export function ageTierOf(value: unknown): AgeTier {
  return asAgeTier(value);
}
