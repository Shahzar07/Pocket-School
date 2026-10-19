'use client';

import { useState } from 'react';
import { NotesBoard } from '@/components/notes/notes-board';
import type { StickyNote } from '@/lib/notes/model';

const seed: StickyNote[] = [
  {
    id: 'cells',
    text: 'Photosynthesis: light reactions, then the Calvin cycle.',
    colour: 'cyan',
    pinned: true,
    order: 0,
    board: 'Biology',
    linkedTo: { type: 'lesson', id: 'photo' },
    checklist: [
      { id: '1', text: 'Label a chloroplast', done: true },
      { id: '2', text: 'Write the word equation', done: false },
    ],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  },
  {
    id: 'algebra',
    text: 'Complete the square before the mock.',
    colour: 'sky',
    pinned: false,
    order: 1,
    board: 'My board',
    linkedTo: { type: 'exam', id: 'paper-1' },
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  },
  {
    id: 'essay',
    text: 'Opening line for the coastal erosion essay.',
    colour: 'coral',
    pinned: false,
    order: 2,
    board: 'English',
    linkedTo: { type: 'assignment', id: 'essay-3' },
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  },
  {
    id: 'lab',
    text: 'Bring goggles. Record the temperature every minute.',
    colour: 'success',
    pinned: false,
    order: 3,
    board: 'Biology',
    linkedTo: { type: 'course', id: 'bio' },
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  },
  {
    id: 'poem',
    text: 'Three images, then the turn.',
    colour: 'lilac',
    pinned: false,
    order: 4,
    board: 'My board',
    linkedTo: { type: 'none', id: '' },
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  },
  {
    id: 'white',
    text: 'Ask for the mark scheme after class.',
    colour: 'white',
    pinned: false,
    order: 5,
    board: 'My board',
    linkedTo: { type: 'lesson', id: 'photo' },
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  },
];

export default function PreviewNotesPage() {
  const [notes, setNotes] = useState(seed);
  return (
    <main className="min-h-screen bg-[#F4F6F6] px-4 py-8">
      <p className="mx-auto mb-4 max-w-5xl text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Rochford demo · Amina Rahman, notes</p>
      <NotesBoard
        notes={notes}
        now={1_700_000_100_000}
        groups={[{ id: 'class-1', title: 'IGCSE Biology', kind: 'class' }]}
        onCreate={(input) => {
          setNotes((current) => [{
            id: `new-${current.length}`,
            text: input.text,
            colour: input.colour,
            pinned: false,
            order: current.length,
            board: input.board || 'My board',
            linkedTo: { type: 'none', id: '' },
            checklist: input.checklist ? [{ id: '1', text: 'Add a step', done: false }] : [],
            createdAt: 1_700_000_100_000,
            updatedAt: 1_700_000_100_000,
          }, ...current]);
        }}
        onPatch={(id, patch) => setNotes((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))}
        onReorder={(ids) => setNotes((current) => current.map((item) => {
          const index = ids.indexOf(item.id);
          return index < 0 ? item : { ...item, order: index };
        }))}
        onAsk={async (action) => action === 'flashcards'
          ? { text: '', cards: [{ front: 'Where do the light reactions happen?', back: 'In the thylakoid membrane.' }] }
          : { text: 'Review the chloroplast, then write the word equation once from memory.', cards: [] }}
        onShare={async () => 'live'}
      />
    </main>
  );
}
