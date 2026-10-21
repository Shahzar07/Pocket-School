'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { authedFetch } from '@/lib/authed-fetch';
import type { AuthoredQuestion, ExamPack, PackTopic, PackUnit } from '@/lib/study/exam-packs';
import { PACK_IMPORT_KEY, PACK_STORE_KEY, readPackStore } from '@/lib/study/pack-admin';
import { packCopy as copy } from '@/lib/study/pack-copy';
import { slugPackId } from '@/lib/study/pack-record';

const SCALES = ['igcse', 'alevel', 'spm', 'ib', 'percent'] as const;

function blankQuestion(): AuthoredQuestion {
  return { question: '', marks: 3, solution: '', markScheme: '' };
}

function blankPack(): ExamPack {
  return {
    id: '',
    name: '',
    board: 'School syllabus',
    level: 'IGCSE',
    scale: 'igcse',
    blurb: '',
    accent: '#1E6A83',
    status: 'draft',
    freeFirstTopic: true,
    units: [{
      id: 'unit-1',
      title: 'Topics',
      topics: [{ id: 'topic-1', title: 'First topic', weight: 3, questions: [blankQuestion()] }],
    }],
  };
}

function editable(pack: ExamPack): ExamPack {
  return {
    ...blankPack(),
    ...pack,
    status: pack.status === 'hidden' ? 'draft' : (pack.status ?? 'published'),
    freeFirstTopic: pack.freeFirstTopic !== false,
    units: pack.units.map(unit => ({
      ...unit,
      topics: unit.topics.map(topic => ({
        ...topic,
        questions: topic.questions?.length ? topic.questions : [blankQuestion()],
      })),
    })),
  };
}

async function readPacks(res: Response): Promise<ExamPack[]> {
  const data = await res.json().catch(() => ({})) as { packs?: ExamPack[]; error?: string };
  if (!res.ok) throw new Error(data.error || copy.loadFailed);
  return Array.isArray(data.packs) ? data.packs : [];
}

export default function ExamPackAdminPage() {
  const [packs, setPacks] = useState<ExamPack[]>([]);
  const [draft, setDraft] = useState<ExamPack>(blankPack());
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      const store = readPackStore(window.localStorage.getItem(PACK_STORE_KEY));
      const imported = window.localStorage.getItem(PACK_IMPORT_KEY) === '1';
      const shouldImport = !imported && (store.packs.length > 0 || store.removed.length > 0);
      try {
        const res = await authedFetch('/api/admin/exam-packs', shouldImport ? {
          method: 'POST',
          body: JSON.stringify({ action: 'import', store }),
        } : undefined);
        const next = await readPacks(res);
        if (cancel) return;
        setPacks(next);
        if (res.ok) window.localStorage.setItem(PACK_IMPORT_KEY, '1');
        if (shouldImport) setNotice(copy.imported);
      } catch (err) {
        if (!cancel) setNotice(err instanceof Error ? err.message : copy.loadFailed);
      }
    };
    void load();
    return () => { cancel = true; };
  }, []);

  const updateUnit = (unitIndex: number, unit: PackUnit) => {
    setDraft(current => ({
      ...current,
      units: current.units.map((item, index) => index === unitIndex ? unit : item),
    }));
  };

  const updateTopic = (unitIndex: number, topicIndex: number, topic: PackTopic) => {
    const unit = draft.units[unitIndex];
    if (!unit) return;
    updateUnit(unitIndex, {
      ...unit,
      topics: unit.topics.map((item, index) => index === topicIndex ? topic : item),
    });
  };

  const save = async () => {
    const id = slugPackId(draft.name, draft.id);
    if (!id || !draft.name.trim()) return;
    setSaving(true);
    setNotice('');
    try {
      const res = await authedFetch('/api/admin/exam-packs', {
        method: 'POST',
        body: JSON.stringify({ action: 'save', pack: { ...draft, id, name: draft.name.trim(), blurb: draft.blurb.trim() } }),
      });
      setPacks(await readPacks(res));
      setDraft(blankPack());
    } catch (err) {
      setNotice(err instanceof Error ? err.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setNotice('');
    try {
      const res = await authedFetch('/api/admin/exam-packs', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      setPacks(await readPacks(res));
      if (draft.id === id) setDraft(blankPack());
    } catch (err) {
      setNotice(err instanceof Error ? err.message : copy.deleteFailed);
    }
  };

  return (
    <DashPage>
      <div data-exam-pack-desk>
        <DashHeader
          eyebrow="ET Maths"
          title="Exam packs"
          accent="for admins."
          description={copy.lead}
        />
        <p className="text-sm">
          <Link className="font-semibold text-[#1E6A83]" href="/dashboard/studio/maths/packs">Open the student pack list</Link>
        </p>
        {notice ? <p className="text-sm text-[#1E6A83]" role="status">{notice}</p> : null}
        <ul data-exam-pack-list className="divide-y divide-border rounded-3xl border border-border bg-card px-4">
          {packs.map(pack => (
            <li key={pack.id} data-pack-id={pack.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-semibold">{pack.name}</p>
                <p className="text-sm text-muted-foreground">{pack.level} · {pack.board} · {pack.status === 'draft' ? copy.draft : copy.published}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="h-10 rounded-full border px-3 text-sm font-semibold" onClick={() => setDraft(editable(pack))}>{copy.edit}</button>
                <button type="button" className="h-10 rounded-full border px-3 text-sm font-semibold" onClick={() => void remove(pack.id)}>{copy.delete}</button>
              </div>
            </li>
          ))}
        </ul>
        <form className="grid gap-3 rounded-3xl border border-border bg-card p-4" data-exam-pack-form onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">{copy.name}
              <input className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <label className="text-sm font-semibold">{copy.level}
              <input className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.level} onChange={event => setDraft({ ...draft, level: event.target.value })} />
            </label>
            <label className="text-sm font-semibold">{copy.board}
              <input className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.board} onChange={event => setDraft({ ...draft, board: event.target.value })} />
            </label>
            <label className="text-sm font-semibold">{copy.scale}
              <select className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.scale} onChange={event => setDraft({ ...draft, scale: event.target.value as ExamPack['scale'] })}>
                {SCALES.map(scale => <option key={scale} value={scale}>{scale}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">{copy.status}
              <select className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.status ?? 'draft'} onChange={event => setDraft({ ...draft, status: event.target.value as ExamPack['status'] })}>
                <option value="draft">{copy.draft}</option>
                <option value="published">{copy.published}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 self-end text-sm font-semibold">
              <input type="checkbox" checked={draft.freeFirstTopic !== false} onChange={event => setDraft({ ...draft, freeFirstTopic: event.target.checked })} />
              {copy.freeFirst}
            </label>
          </div>
          <label className="text-sm font-semibold">{copy.description}
            <textarea className="mt-1 w-full rounded-xl border px-3 py-2" rows={3} value={draft.blurb} onChange={event => setDraft({ ...draft, blurb: event.target.value })} />
          </label>
          {draft.units.map((unit, unitIndex) => (
            <fieldset key={`${unit.id}-${unitIndex}`} className="grid gap-3 rounded-2xl border border-border p-3">
              <label className="text-sm font-semibold">{copy.unitTitle}
                <input className="mt-1 h-11 w-full rounded-xl border px-3" value={unit.title} onChange={event => updateUnit(unitIndex, { ...unit, title: event.target.value })} />
              </label>
              {unit.topics.map((topic, topicIndex) => (
                <div key={`${topic.id}-${topicIndex}`} className="grid gap-2 rounded-xl bg-muted/40 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
                    <label className="text-sm font-semibold">{copy.topicTitle}
                      <input className="mt-1 h-11 w-full rounded-xl border px-3" value={topic.title} onChange={event => updateTopic(unitIndex, topicIndex, { ...topic, title: event.target.value })} />
                    </label>
                    <label className="text-sm font-semibold">{copy.weight}
                      <input type="number" min={1} max={5} className="mt-1 h-11 w-full rounded-xl border px-3" value={topic.weight} onChange={event => updateTopic(unitIndex, topicIndex, { ...topic, weight: Number(event.target.value) || 1 })} />
                    </label>
                  </div>
                  {(topic.questions ?? []).map((question, questionIndex) => (
                    <div key={questionIndex} className="grid gap-2">
                      <label className="text-sm font-semibold">{copy.question}
                        <textarea className="mt-1 w-full rounded-xl border px-3 py-2" rows={2} value={question.question} onChange={event => {
                          const questions = [...(topic.questions ?? [])];
                          questions[questionIndex] = { ...question, question: event.target.value };
                          updateTopic(unitIndex, topicIndex, { ...topic, questions });
                        }} />
                      </label>
                      <label className="text-sm font-semibold">{copy.marks}
                        <input type="number" min={1} max={12} className="mt-1 h-11 w-full rounded-xl border px-3" value={question.marks} onChange={event => {
                          const questions = [...(topic.questions ?? [])];
                          questions[questionIndex] = { ...question, marks: Number(event.target.value) || 1 };
                          updateTopic(unitIndex, topicIndex, { ...topic, questions });
                        }} />
                      </label>
                      <label className="text-sm font-semibold">{copy.worked}
                        <textarea className="mt-1 w-full rounded-xl border px-3 py-2" rows={2} value={question.solution} onChange={event => {
                          const questions = [...(topic.questions ?? [])];
                          questions[questionIndex] = { ...question, solution: event.target.value };
                          updateTopic(unitIndex, topicIndex, { ...topic, questions });
                        }} />
                      </label>
                      <label className="text-sm font-semibold">{copy.scheme}
                        <textarea className="mt-1 w-full rounded-xl border px-3 py-2" rows={2} value={question.markScheme} onChange={event => {
                          const questions = [...(topic.questions ?? [])];
                          questions[questionIndex] = { ...question, markScheme: event.target.value };
                          updateTopic(unitIndex, topicIndex, { ...topic, questions });
                        }} />
                      </label>
                    </div>
                  ))}
                  <button type="button" className="h-10 justify-self-start rounded-full border px-3 text-sm font-semibold" onClick={() => updateTopic(unitIndex, topicIndex, { ...topic, questions: [...(topic.questions ?? []), blankQuestion()] })}>{copy.addQuestion}</button>
                </div>
              ))}
              <button type="button" className="h-10 justify-self-start rounded-full border px-3 text-sm font-semibold" onClick={() => updateUnit(unitIndex, { ...unit, topics: [...unit.topics, { id: `topic-${unit.topics.length + 1}`, title: '', weight: 3, questions: [blankQuestion()] }] })}>{copy.addTopic}</button>
            </fieldset>
          ))}
          <button type="button" className="h-10 justify-self-start rounded-full border px-3 text-sm font-semibold" onClick={() => setDraft({ ...draft, units: [...draft.units, { id: `unit-${draft.units.length + 1}`, title: '', topics: [{ id: 'topic-1', title: '', weight: 3, questions: [blankQuestion()] }] }] })}>{copy.addUnit}</button>
          <button type="submit" disabled={saving} className="h-11 rounded-full bg-[#1E6A83] px-4 text-sm font-semibold text-white">{saving ? copy.saving : 'Save pack'}</button>
        </form>
      </div>
    </DashPage>
  );
}
