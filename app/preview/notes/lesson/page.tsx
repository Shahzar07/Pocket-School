import { NoteDock } from '@/components/notes/note-dock';
import type { StickyNote } from '@/lib/notes/model';

const notes: StickyNote[] = [
  {
    id: 'photo',
    text: 'The chloroplast diagram needs labels for grana and stroma.',
    colour: 'cyan',
    pinned: false,
    order: 0,
    board: 'Biology',
    linkedTo: { type: 'lesson', id: 'photosynthesis' },
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  },
  {
    id: 'equation',
    text: 'Carbon dioxide + water → glucose + oxygen.',
    colour: 'sky',
    pinned: true,
    order: 1,
    board: 'Biology',
    linkedTo: { type: 'lesson', id: 'photosynthesis' },
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  },
];

export default function PreviewLessonNotesPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F6] px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-[28px] border border-[#E7EDED] bg-white p-6 text-[#203337] shadow-[0_16px_40px_rgba(32,51,55,0.06)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1E6A83]">Lesson</p>
        <h1 className="mt-2 font-heading text-4xl">Photosynthesis</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#203337]">
          Plants trap light in chlorophyll. The light reactions sit in the thylakoid membrane. The Calvin cycle builds sugar in the stroma.
        </p>
      </article>
      <NoteDock link={{ type: 'lesson', id: 'photosynthesis' }} title="Photosynthesis" previewNotes={notes} startOpen />
    </main>
  );
}
