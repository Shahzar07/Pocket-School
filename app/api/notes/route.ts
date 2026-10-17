import { NextRequest, NextResponse } from 'next/server';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { listStudyGroups, runNoteAction, shareNote, unshareNote } from '@/lib/notes/server';
import type { NoteAction } from '@/lib/notes/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIONS: readonly NoteAction[] = ['flashcards', 'summarise', 'plan'];

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) return NextResponse.json({ groups: [] });
  return runGet(req, async (user) => ({ groups: await listStudyGroups(user.uid) }));
}

export async function POST(req: NextRequest) {
  return runPost(req, async (user, body) => {
    const action = typeof body.action === 'string' ? body.action : '';
    if (!isAdminConfigured()) {
      if (action === 'groups') return { groups: [] };
      if (ACTIONS.includes(action as NoteAction)) throw new ActionError('INVALID', 'ET AI is coming soon.');
      throw new ActionError('INVALID', 'Study group sharing is coming soon.');
    }
    if (ACTIONS.includes(action as NoteAction) && !process.env.OPENROUTER_API_KEY) {
      throw new ActionError('INVALID', 'ET AI is coming soon.');
    }
    if (action === 'groups') return { groups: await listStudyGroups(user.uid) };
    if (action === 'share') {
      const noteId = typeof body.noteId === 'string' ? body.noteId : '';
      const spaceId = typeof body.spaceId === 'string' ? body.spaceId : '';
      if (!noteId || !spaceId) throw new ActionError('VALIDATION', 'Choose a note and a study group.');
      return shareNote(user.uid, noteId, spaceId);
    }
    if (action === 'unshare') {
      const noteId = typeof body.noteId === 'string' ? body.noteId : '';
      if (!noteId) throw new ActionError('VALIDATION', 'Choose a note.');
      await unshareNote(user.uid, noteId);
      return { status: 'private' };
    }
    if (!ACTIONS.includes(action as NoteAction)) throw new ActionError('VALIDATION', 'Choose an ET AI action.');
    const noteIds = Array.isArray(body.noteIds) ? body.noteIds.filter((id): id is string => typeof id === 'string') : [];
    return runNoteAction(user.uid, action as NoteAction, noteIds);
  });
}
