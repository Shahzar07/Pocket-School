'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { createNote, patchNote, subscribeNotes } from '@/lib/notes/client';
import { colourFill, linkedNotes, type NoteLink, type StickyNote } from '@/lib/notes/model';

export function NoteDock({
  link,
  match = 'exact',
  title,
  previewNotes,
  startOpen = false,
}: {
  link: NoteLink;
  match?: 'exact' | 'type';
  title?: string;
  previewNotes?: StickyNote[];
  startOpen?: boolean;
}) {
  const { user } = useAuthSTORE();
  const [open, setOpen] = useState(startOpen);
  const [notes, setNotes] = useState<StickyNote[]>(previewNotes ?? []);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (previewNotes) {
      setNotes(previewNotes);
      return;
    }
    if (!user) return;
    return subscribeNotes(user.uid, setNotes);
  }, [previewNotes, user]);

  const shown = linkedNotes(notes, link, match, Date.now());
  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    if (previewNotes || !user) {
      setNotes((current) => [{
        id: `local-${current.length + 1}`,
        text,
        colour: 'cyan',
        pinned: false,
        order: current.length,
        board: 'My board',
        linkedTo: link,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }, ...current]);
      setDraft('');
      setOpen(true);
      return;
    }
    await createNote(user.uid, { text, colour: 'cyan', linkedTo: link });
    setDraft('');
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="z-30 mt-8 inline-flex items-center gap-2 rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 py-3 text-sm font-semibold text-[#203337] shadow-[0_12px_30px_rgba(32,51,55,0.16)] max-lg:static lg:fixed lg:bottom-4 lg:end-4 lg:mt-0"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add note
      </button>
      {open ? (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-white/70 bg-[#F4F6F6]/95 p-4 shadow-[-16px_0_40px_rgba(32,51,55,0.12)] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Notes</p>
              <h2 className="font-heading text-2xl text-[#203337]">{title || 'Linked notes'}</h2>
            </div>
            <button type="button" aria-label="Close notes" onClick={() => setOpen(false)} className="rounded-full p-2 text-[#203337]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void add(); }}>
            <textarea
              aria-label="New linked note"
              value={draft}
              maxLength={2000}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Add a note for this page"
              className="min-h-20 w-full rounded-2xl border border-[#E7EDED] bg-white px-3 py-2 text-sm text-[#203337]"
            />
            <button type="submit" className="mt-2 rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 py-2 text-sm font-semibold text-[#203337]">Save note</button>
          </form>
          <div className="mt-4 space-y-3 overflow-y-auto">
            {shown.length === 0 ? <p className="text-sm text-[#5F7074]">No notes linked here yet.</p> : null}
            {shown.map((item) => {
              const paint = colourFill(item.colour);
              return (
                <article key={item.id} className="rounded-2xl p-3 text-sm text-[#203337]" style={{ background: paint.fill, boxShadow: '0 10px 24px rgba(32,51,55,0.08)', transform: 'rotate(-0.6deg)' }}>
                  <p>{item.text}</p>
                  {user && !previewNotes ? (
                    <button type="button" className="mt-2 text-xs font-semibold text-[#1E6A83]" onClick={() => { void patchNote(user.uid, item.id, { deletedAt: Date.now() }); }}>
                      Move to trash
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </aside>
      ) : null}
    </>
  );
}
