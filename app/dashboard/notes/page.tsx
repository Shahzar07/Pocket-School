'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { NotesBoard, type StudyGroupOption } from '@/components/notes/notes-board';
import { createNote, patchNote, saveNoteOrder, subscribeNotes } from '@/lib/notes/client';
import type { NoteAction, StickyNote } from '@/lib/notes/model';

export default function NotesPage() {
  const { user } = useAuthSTORE();
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [groups, setGroups] = useState<StudyGroupOption[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeNotes(user.uid, setNotes);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let live = true;
    authedFetch('/api/notes')
      .then((data) => {
        if (!live || !Array.isArray(data.groups)) return;
        setGroups(data.groups.flatMap((item) => {
          if (!item || typeof item !== 'object') return [];
          const row = item as { id?: unknown; title?: unknown; kind?: unknown };
          if (typeof row.id !== 'string') return [];
          return [{ id: row.id, title: typeof row.title === 'string' ? row.title : 'Study group', kind: typeof row.kind === 'string' ? row.kind : 'class' }];
        }));
      })
      .catch(() => setGroups([]));
    return () => { live = false; };
  }, [user]);

  if (!user) {
    return <p className="p-8 text-sm text-[#203337]">Sign in to open your notes.</p>;
  }

  return (
    <NotesBoard
      notes={notes}
      groups={groups}
      onCreate={(input) => createNote(user.uid, {
        text: input.text,
        colour: input.colour,
        board: input.board,
        checklist: input.checklist ? [{ id: '1', text: input.text, done: false }] : [],
      })}
      onPatch={(id, patch) => patchNote(user.uid, id, patch)}
      onReorder={(ids) => saveNoteOrder(user.uid, ids)}
      onAsk={async (action: NoteAction, noteIds) => {
        const data = await authedFetch('/api/notes', {
          method: 'POST',
          body: JSON.stringify({ action, noteIds }),
        });
        const cards = Array.isArray(data.cards)
          ? data.cards.flatMap((card) => {
            if (!card || typeof card !== 'object') return [];
            const row = card as { front?: unknown; back?: unknown };
            return typeof row.front === 'string' && typeof row.back === 'string' ? [{ front: row.front, back: row.back }] : [];
          })
          : [];
        return { text: typeof data.text === 'string' ? data.text : '', cards };
      }}
      onShare={async (id, spaceId) => {
        const data = await authedFetch('/api/notes', {
          method: 'POST',
          body: JSON.stringify({ action: 'share', noteId: id, spaceId }),
        });
        return typeof data.status === 'string' ? data.status : 'held';
      }}
      onUnshare={(id) => authedFetch('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ action: 'unshare', noteId: id }),
      }).then(() => undefined)}
    />
  );
}
