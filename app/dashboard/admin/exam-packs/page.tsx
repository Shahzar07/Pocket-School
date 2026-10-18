'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { PACK_STORE_KEY, deletePack, listPacks, readPackStore, savePack, type PackStore } from '@/lib/study/pack-admin';
import type { ExamPack } from '@/lib/study/exam-packs';

const BLANK: ExamPack = {
  id: '',
  name: '',
  board: 'School syllabus',
  level: 'IGCSE',
  scale: 'igcse',
  blurb: '',
  accent: '#1E6A83',
  units: [{ id: 'unit-1', title: 'Topics', topics: [{ id: 'topic-1', title: 'First topic', weight: 3 }] }],
};

export default function ExamPackAdminPage() {
  const [store, setStore] = useState<PackStore>({ packs: [], removed: [] });
  const [draft, setDraft] = useState<ExamPack>(BLANK);
  const packs = listPacks(store);

  useEffect(() => {
    setStore(readPackStore(window.localStorage.getItem(PACK_STORE_KEY)));
  }, []);

  const persist = (next: PackStore) => {
    setStore(next);
    window.localStorage.setItem(PACK_STORE_KEY, JSON.stringify(next));
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow="ET Maths"
        title="Exam packs"
        accent="for admins."
        description="Add, edit, or delete a syllabus pack. Students see the result on the maths packs page. This desk lives at /dashboard/admin/exam-packs."
      />
      <p className="text-sm">
        <Link className="font-semibold text-[#1E6A83]" href="/dashboard/studio/maths/packs">Open the student pack list</Link>
      </p>
      <ul className="divide-y divide-border rounded-3xl border border-border bg-card px-4">
        {packs.map((pack) => (
          <li key={pack.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="font-semibold">{pack.name}</p>
              <p className="text-sm text-muted-foreground">{pack.level} · {pack.board}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="h-10 rounded-full border px-3 text-sm font-semibold" onClick={() => setDraft(pack)}>Edit</button>
              <button type="button" className="h-10 rounded-full border px-3 text-sm font-semibold" onClick={() => persist(deletePack(store, pack.id))}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      <form className="grid gap-3 rounded-3xl border border-border bg-card p-4 sm:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        const id = (draft.id || draft.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (!id || !draft.name.trim()) return;
        persist(savePack(store, { ...draft, id, name: draft.name.trim(), blurb: draft.blurb.trim() }));
        setDraft({ ...BLANK, id: '' });
      }}>
        <label className="text-sm font-semibold">Name
          <input className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label className="text-sm font-semibold">Level
          <input className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value })} />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">Description
          <textarea className="mt-1 w-full rounded-xl border px-3 py-2" rows={3} value={draft.blurb} onChange={(event) => setDraft({ ...draft, blurb: event.target.value })} />
        </label>
        <button type="submit" className="h-11 rounded-full bg-[#1E6A83] px-4 text-sm font-semibold text-white sm:col-span-2">Save pack</button>
      </form>
    </DashPage>
  );
}
