'use client';

import { useMemo, useState } from 'react';
import { Check, GripVertical, Pin, Plus, Search, Trash2 } from 'lucide-react';
import { DashHeader, DashPage } from '@/components/dash-ui';
import {
  NOTE_COLOURS,
  colourFill,
  filterNotes,
  reorderNotes,
  type NoteAction,
  type NoteColour,
  type NoteLinkType,
  type StickyNote,
} from '@/lib/notes/model';

export interface StudyGroupOption {
  id: string;
  title: string;
  kind: string;
}

const LINKS: { id: NoteLinkType | 'all'; label: string }[] = [
  { id: 'all', label: 'All links' },
  { id: 'lesson', label: 'Lessons' },
  { id: 'course', label: 'Courses' },
  { id: 'assignment', label: 'Assignments' },
  { id: 'exam', label: 'Exams' },
  { id: 'none', label: 'Unlinked' },
];

export function NotesBoard({
  notes,
  groups = [],
  now = Date.now(),
  onCreate,
  onPatch,
  onReorder,
  onAsk,
  onShare,
  onUnshare,
}: {
  notes: StickyNote[];
  groups?: StudyGroupOption[];
  now?: number;
  onCreate: (input: { text: string; colour: NoteColour; board: string; checklist: boolean }) => Promise<void> | void;
  onPatch: (id: string, patch: Partial<StickyNote>) => Promise<void> | void;
  onReorder: (ids: string[]) => Promise<void> | void;
  onAsk?: (action: NoteAction, ids: string[]) => Promise<{ text: string; cards: { front: string; back: string }[] }>;
  onShare?: (id: string, spaceId: string) => Promise<string>;
  onUnshare?: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [colour, setColour] = useState<NoteColour>('cyan');
  const [board, setBoard] = useState('My board');
  const [checklist, setChecklist] = useState(false);
  const [search, setSearch] = useState('');
  const [boardFilter, setBoardFilter] = useState('all');
  const [link, setLink] = useState<NoteLinkType | 'all'>('all');
  const [trash, setTrash] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [dragId, setDragId] = useState('');
  const [note, setNote] = useState('');
  const [answer, setAnswer] = useState<{ text: string; cards: { front: string; back: string }[] } | null>(null);

  const boards = useMemo(() => ['My board', ...notes.map((item) => item.board).filter((name, index, all) => name && all.indexOf(name) === index && name !== 'My board')], [notes]);
  const shown = filterNotes(notes, { now, search, board: boardFilter, link, trash });

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    await onCreate({ text, colour, board, checklist });
    setDraft('');
    setNote('Note added.');
  };

  const dropOn = async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = reorderNotes(shown, dragId, targetId);
    setDragId('');
    await onReorder(next.map((item) => item.id));
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow="Private to you"
        title="Notes"
        description="Sticky notes sync across web and the app. They stay on your account until you share one."
      />
      <form
        className="rounded-[24px] border border-[#E7EDED] bg-white/80 p-4 shadow-[0_12px_30px_rgba(32,51,55,0.06)] backdrop-blur"
        onSubmit={(event) => { event.preventDefault(); void add(); }}
      >
        <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]" htmlFor="note-draft">Quick add</label>
        <textarea
          id="note-draft"
          value={draft}
          maxLength={2000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a note"
          className="mt-2 min-h-20 w-full resize-none rounded-2xl border border-[#E7EDED] bg-white px-3 py-2 text-sm text-[#203337]"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {NOTE_COLOURS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-pressed={colour === item.id}
              onClick={() => setColour(item.id)}
              className="h-8 w-8 rounded-full border"
              style={{ background: item.fill, borderColor: colour === item.id ? '#1E6A83' : '#E7EDED' }}
            />
          ))}
          <input
            aria-label="Board name"
            value={board}
            maxLength={80}
            onChange={(event) => setBoard(event.target.value)}
            className="rounded-full border border-[#E7EDED] px-3 py-1.5 text-sm text-[#203337]"
          />
          <button
            type="button"
            aria-pressed={checklist}
            onClick={() => setChecklist((value) => !value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${checklist ? 'border-[#1E6A83] bg-[#3FE0D0] text-[#203337]' : 'border-[#E7EDED] text-[#1E6A83]'}`}
          >
            Checklist
          </button>
          <button type="submit" className="inline-flex items-center gap-1 rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 py-1.5 text-sm font-semibold text-[#203337]">
            <Plus className="h-4 w-4" aria-hidden />
            Add note
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#1E6A83]" aria-hidden />
          <input
            aria-label="Search notes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            className="w-full rounded-full border border-[#E7EDED] bg-white py-2 pl-9 pr-3 text-sm text-[#203337]"
          />
        </label>
        <select aria-label="Filter by board" value={boardFilter} onChange={(event) => setBoardFilter(event.target.value)} className="rounded-full border border-[#E7EDED] bg-white px-3 py-2 text-sm text-[#203337]">
          <option value="all">All boards</option>
          {boards.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select aria-label="Filter by link" value={link} onChange={(event) => setLink(event.target.value as NoteLinkType | 'all')} className="rounded-full border border-[#E7EDED] bg-white px-3 py-2 text-sm text-[#203337]">
          {LINKS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <button type="button" aria-pressed={trash} onClick={() => setTrash((value) => !value)} className={`rounded-full border px-3 py-2 text-sm font-semibold ${trash ? 'border-[#1E6A83] bg-[#3FE0D0] text-[#203337]' : 'border-[#E7EDED] text-[#1E6A83]'}`}>
          Trash
        </button>
      </div>

      {shown.length === 0 ? <p className="text-sm text-[#5F7074]">{trash ? 'Trash is empty. Deleted notes stay for 30 days.' : 'No notes on this board yet.'}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((item, index) => {
          const paint = colourFill(item.colour);
          return (
            <article
              key={item.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => { void dropOn(item.id); }}
              className="rounded-[22px] p-4"
              style={{
                background: paint.fill,
                color: paint.ink,
                transform: item.pinned ? 'none' : `rotate(${index % 2 === 0 ? -1.3 : 1.15}deg)`,
                boxShadow: '0 16px 34px rgba(32, 51, 55, 0.1)',
                border: '1px solid rgba(255,255,255,0.9)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  draggable={!trash}
                  aria-label="Drag to reorder"
                  className="cursor-grab text-[#1E6A83]"
                  onDragStart={() => setDragId(item.id)}
                >
                  <GripVertical className="h-4 w-4" aria-hidden />
                </button>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1E6A83]">{item.board}</p>
                <button type="button" aria-label={item.pinned ? 'Unpin note' : 'Pin note'} aria-pressed={item.pinned} onClick={() => { void onPatch(item.id, { pinned: !item.pinned }); }}>
                  <Pin className="h-4 w-4" style={{ color: item.pinned ? '#1E6A83' : '#5F7074' }} />
                </button>
              </div>
              <textarea
                aria-label="Note text"
                value={item.text}
                maxLength={2000}
                onChange={(event) => { void onPatch(item.id, { text: event.target.value }); }}
                className="min-h-24 w-full resize-none bg-transparent text-sm text-[#203337] outline-none"
              />
              {(item.checklist ?? []).length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {item.checklist?.map((check) => (
                    <li key={check.id}>
                      <button
                        type="button"
                        className="flex items-start gap-2 text-left text-sm text-[#203337]"
                        onClick={() => {
                          const checklist = (item.checklist ?? []).map((row) => row.id === check.id ? { ...row, done: !row.done } : row);
                          void onPatch(item.id, { checklist });
                        }}
                      >
                        <span className="mt-0.5 grid h-4 w-4 place-items-center rounded border border-[#1E6A83]">{check.done ? <Check className="h-3 w-3" /> : null}</span>
                        <span className={check.done ? 'line-through opacity-70' : ''}>{check.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-[#1E6A83]">
                {item.linkedTo.type === 'none' ? 'Not linked' : item.linkedTo.type}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-[11px] text-[#1E6A83]">
                  Remind
                  <input
                    aria-label="Reminder"
                    type="datetime-local"
                    className="ml-2 rounded-full border border-[#1E6A83]/30 bg-white/70 px-2 py-1 text-[11px] text-[#203337]"
                    onChange={(event) => {
                      const value = event.target.value ? new Date(event.target.value).getTime() : null;
                      void onPatch(item.id, { remindAt: value });
                    }}
                  />
                </label>
                <button type="button" className="text-[#1E6A83]" aria-label={trash ? 'Restore note' : 'Move to trash'} onClick={() => { void onPatch(item.id, { deletedAt: trash ? null : now }); }}>
                  <Trash2 className="h-4 w-4" />
                </button>
                <label className="inline-flex items-center gap-1 text-[11px] text-[#203337]">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}
                  />
                  Use with ET AI
                </label>
              </div>
              {onShare ? (
                <div className="mt-3">
                  <p className="text-[11px] text-[#5F7074]">Sharing is off until you choose a study group.</p>
                  {item.share?.status === 'live' ? (
                    <button type="button" className="mt-1 text-xs font-semibold text-[#1E6A83]" onClick={() => { void onUnshare?.(item.id); }}>Stop sharing</button>
                  ) : (
                    <select
                      aria-label="Share with a study group"
                      defaultValue=""
                      className="mt-1 w-full rounded-full border border-[#E7EDED] bg-white/80 px-2 py-1 text-xs text-[#203337]"
                      onChange={(event) => {
                        const spaceId = event.target.value;
                        if (!spaceId) return;
                        void onShare(item.id, spaceId).then((status) => setNote(status === 'live' ? 'Shared with your study group.' : 'ET AI held this note. It was not shared.')).catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : 'Could not share this note.'));
                      }}
                    >
                      <option value="">Keep private</option>
                      {groups.map((group) => <option key={group.id} value={group.id}>{group.title}</option>)}
                    </select>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {onAsk ? (
        <div className="flex flex-wrap gap-2">
          {([
            ['flashcards', 'Turn notes into flashcards'],
            ['summarise', 'Summarise my notes'],
            ['plan', 'Make a revision plan from these'],
          ] as const).map(([action, label]) => (
            <button
              key={action}
              type="button"
              className="rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 py-2 text-sm font-semibold text-[#203337]"
              onClick={() => {
                if (selected.length === 0) {
                  setNote('Choose at least one note first.');
                  return;
                }
                void onAsk(action, selected).then((result) => { setAnswer(result); setNote(''); }).catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : 'ET AI is unavailable.'));
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {answer?.cards.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {answer.cards.map((card) => (
            <li key={card.front} className="rounded-2xl border border-[#E7EDED] bg-white p-3 text-sm text-[#203337]">
              <p className="font-semibold">{card.front}</p>
              <p className="mt-1 text-[#1E6A83]">{card.back}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {answer?.text ? <p className="rounded-2xl bg-white p-4 text-sm text-[#203337]">{answer.text}</p> : null}
      {note ? <p className="text-sm text-[#203337]">{note}</p> : null}
    </DashPage>
  );
}
