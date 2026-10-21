'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashPage } from '@/components/dash-ui';
import { LevelMenu } from '@/components/level-menu';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/authed-fetch';
import { boardsForLevel } from '@/lib/essay/board-styles';
import { GRADE_SCALES } from '@/lib/study/grades';
import { officialSubjectOptions } from '@/lib/study/pack-catalog';
import { PACK_IMPORT_KEY, PACK_STORE_KEY, readPackStore } from '@/lib/study/pack-admin';
import { packCopy as copy } from '@/lib/study/pack-copy';
import { flowCopy } from '@/lib/study/official-flow-copy';
import { adminHref, type AdminStepId } from '@/lib/study/official-flow';
import { slugPackId } from '@/lib/study/pack-record';
import type { AuthoredQuestion, ExamPack, PackTopic, PackUnit } from '@/lib/study/exam-packs';
import type { GradeScaleId } from '@/lib/study/types';
import { AdminTrail, OfficialNav } from '@/components/study/official-chrome';

const DRAFT_KEY = 'poket-exam-pack-draft';
const SCALES = ['igcse', 'alevel', 'spm', 'ib', 'percent'] as const;
const field = 'mt-1 h-11 w-full rounded-xl border px-3';

function blankQuestion(): AuthoredQuestion {
  return { question: '', marks: 3, solution: '', markScheme: '', image: '', examinerTip: '' };
}

function blankPack(): ExamPack {
  return {
    id: '',
    name: '',
    board: 'School syllabus',
    level: 'IGCSE',
    subject: 'Mathematics',
    learnerLevel: 'igcse',
    boardStyle: 'cambridge-igcse',
    scale: 'igcse',
    blurb: '',
    accent: '#1E6A83',
    status: 'draft',
    freeFirstTopic: true,
    units: [{ id: 'unit-1', title: 'Topics', topics: [{ id: 'topic-1', title: 'First topic', weight: 3, questions: [blankQuestion()] }] }],
  };
}

function editable(pack: ExamPack): ExamPack {
  return {
    ...blankPack(),
    ...pack,
    status: pack.status === 'hidden' ? 'draft' : (pack.status ?? 'published'),
    freeFirstTopic: pack.freeFirstTopic !== false,
    units: pack.units.map((unit) => ({
      ...unit,
      topics: unit.topics.map((topic) => ({
        ...topic,
        questions: topic.questions?.length ? topic.questions : [blankQuestion()],
      })),
    })),
  };
}

export function PackDesk({ step }: { step: AdminStepId }) {
  const { user } = useAuthSTORE();
  const [packs, setPacks] = useState<ExamPack[]>([]);
  const [draft, setDraft] = useState<ExamPack>(blankPack);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(DRAFT_KEY);
    if (stored) {
      try { setDraft(editable(JSON.parse(stored) as ExamPack)); } catch { /* keep blank */ }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft, ready]);

  useEffect(() => {
    if (!ready || !user || draft.status === 'published') return;
    if (!draft.name.trim() || draft.units.every((unit) => unit.topics.every((topic) => !topic.title.trim()))) return;
    const timer = window.setTimeout(() => {
      const id = slugPackId(draft.name, draft.id);
      void authedFetch('/api/admin/exam-packs', {
        method: 'POST',
        body: JSON.stringify({ action: 'save', pack: { ...draft, id, status: 'draft', name: draft.name.trim() } }),
      }).then((res) => {
        if (res.ok) setNotice(flowCopy.draftSaved);
      }).catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [draft, ready, user]);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      const store = readPackStore(window.localStorage.getItem(PACK_STORE_KEY));
      const imported = window.localStorage.getItem(PACK_IMPORT_KEY) === '1';
      const shouldImport = !imported && (store.packs.length > 0 || store.removed.length > 0);
      try {
        const res = await authedFetch('/api/admin/exam-packs', shouldImport ? { method: 'POST', body: JSON.stringify({ action: 'import', store }) } : undefined);
        const data = await res.json().catch(() => ({})) as { packs?: ExamPack[]; error?: string };
        if (!res.ok) throw new Error(data.error || copy.loadFailed);
        if (cancel) return;
        setPacks(Array.isArray(data.packs) ? data.packs : []);
        if (res.ok) window.localStorage.setItem(PACK_IMPORT_KEY, '1');
      } catch (err) {
        if (!cancel) setNotice(err instanceof Error ? err.message : copy.loadFailed);
      }
    };
    void load();
    return () => { cancel = true; };
  }, []);

  function updateUnit(unitIndex: number, unit: PackUnit) {
    setDraft((current) => ({ ...current, units: current.units.map((item, index) => index === unitIndex ? unit : item) }));
  }
  function updateTopic(unitIndex: number, topicIndex: number, topic: PackTopic) {
    const unit = draft.units[unitIndex];
    if (!unit) return;
    updateUnit(unitIndex, { ...unit, topics: unit.topics.map((item, index) => index === topicIndex ? topic : item) });
  }

  async function remove(id: string) {
    if (!window.confirm(copy.deleteConfirm)) return;
    setSaving(true);
    try {
      const res = await authedFetch('/api/admin/exam-packs', { method: 'DELETE', body: JSON.stringify({ id }) });
      const data = await res.json() as { packs?: ExamPack[]; error?: string };
      if (!res.ok) throw new Error(data.error || copy.deleteFailed);
      if (Array.isArray(data.packs)) setPacks(data.packs);
      if (draft.id === id) {
        setDraft(blankPack());
        window.sessionStorage.removeItem(DRAFT_KEY);
      }
      setNotice(copy.delete);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : copy.deleteFailed);
    } finally {
      setSaving(false);
    }
  }

  async function save(status: 'draft' | 'published') {
    const id = slugPackId(draft.name, draft.id);
    if (!id || !draft.name.trim()) return;
    setSaving(true);
    try {
      const res = await authedFetch('/api/admin/exam-packs', {
        method: 'POST',
        body: JSON.stringify({ action: 'save', pack: { ...draft, id, status, name: draft.name.trim(), blurb: draft.blurb.trim() } }),
      });
      const data = await res.json() as { packs?: ExamPack[] };
      if (Array.isArray(data.packs)) setPacks(data.packs);
      setDraft(blankPack());
      window.sessionStorage.removeItem(DRAFT_KEY);
      setNotice(status === 'published' ? flowCopy.publish : flowCopy.draftSaved);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const order: AdminStepId[] = ['pack', 'units', 'questions', 'preview', 'publish'];
  const index = order.indexOf(step);
  const back = index > 0 ? adminHref(order[index - 1]!) : undefined;
  const next = index < order.length - 1 ? adminHref(order[index + 1]!) : undefined;

  return (
    <DashPage className="w-full px-4 sm:px-6">
      <div data-exam-pack-desk data-pack-desk-step={step} className="flex min-h-[70vh] flex-col">
        <p className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">{flowCopy.deskTitle}</p>
        <h1 className="mt-2 font-heading text-3xl">{flowCopy.adminTrail}</h1>
        <div className="mt-3"><AdminTrail currentId={step} /></div>
        {notice ? <p className="mt-3 text-sm text-[#1E6A83] dark:text-[#3FE0D0]" role="status" data-draft-status>{notice}</p> : null}
        {step === 'pack' ? (
          <div className="mt-6">
            <p className="text-sm"><Link className="font-semibold text-[#1E6A83]" href="/dashboard/studio/exams/packs">{copy.studentLink} →</Link></p>
            <ul className="mt-4 divide-y divide-border rounded-2xl border" data-exam-pack-list>
              {packs.map((pack) => (
                <li key={pack.id} className="flex items-center justify-between gap-3 px-3 py-3">
                  <span><span className="block font-semibold">{pack.name}</span><span className="text-sm text-[#1E6A83]">{pack.subject || 'Mathematics'} · {pack.level}</span></span>
                  <span className="flex shrink-0 gap-3">
                    <button type="button" className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]" onClick={() => setDraft(editable(pack))}>{copy.edit} →</button>
                    <button type="button" className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]" aria-label={copy.delete} disabled={saving} onClick={() => void remove(pack.id)}>{copy.delete} →</button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid gap-3 sm:grid-cols-2" data-exam-pack-form>
              <label className="text-sm font-semibold">{copy.name}<input className={field} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label className="text-sm font-semibold">{copy.subject}
                <select className={field} aria-label={copy.subject} value={draft.subject || 'Mathematics'} onChange={(event) => setDraft({ ...draft, subject: event.target.value })}>
                  {officialSubjectOptions().map((item) => <option key={item.slug} value={item.label}>{item.label}</option>)}
                </select>
              </label>
              <div className="text-sm font-semibold">{copy.learnerLevel}
                <div className="mt-1 font-normal">
                  <LevelMenu value={draft.learnerLevel || 'igcse'} ariaLabel={copy.learnerLevel} className="w-full" onChange={(nextLevel) => {
                    const boards = boardsForLevel(nextLevel);
                    const boardStyle = boards.some((item) => item.id === draft.boardStyle) ? draft.boardStyle : (boards[0]?.id ?? '');
                    setDraft({ ...draft, learnerLevel: nextLevel, boardStyle });
                  }} />
                </div>
              </div>
              <label className="text-sm font-semibold">{copy.examBoard}
                <select className={field} aria-label={copy.examBoard} value={draft.boardStyle || ''} onChange={(event) => setDraft({ ...draft, boardStyle: event.target.value })}>
                  {boardsForLevel(draft.learnerLevel || 'igcse').map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">{copy.scale}
                <select className={field} aria-label={copy.scale} value={draft.scale} onChange={(event) => setDraft({ ...draft, scale: event.target.value as GradeScaleId })}>
                  {SCALES.map((id) => <option key={id} value={id}>{GRADE_SCALES[id].label}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">{copy.level}<input className={field} value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value })} /></label>
              <label className="text-sm font-semibold">{copy.board}<input className={field} value={draft.board} onChange={(event) => setDraft({ ...draft, board: event.target.value })} /></label>
              <label className="text-sm font-semibold sm:col-span-2">{copy.description}<textarea className="mt-1 w-full rounded-xl border px-3 py-2" rows={3} value={draft.blurb} onChange={(event) => setDraft({ ...draft, blurb: event.target.value })} /></label>
            </div>
          </div>
        ) : null}
        {step === 'units' ? (
          <div className="mt-6">
            {draft.units.map((unit, unitIndex) => (
              <fieldset key={`${unit.id}-${unitIndex}`} className="mt-4 grid gap-3 rounded-2xl border p-3">
                <label className="text-sm font-semibold">{copy.unitTitle}<input className={field} value={unit.title} onChange={(event) => updateUnit(unitIndex, { ...unit, title: event.target.value })} /></label>
                {unit.topics.map((topic, topicIndex) => (
                  <div key={`${topic.id}-${topicIndex}`} className="grid gap-2 sm:grid-cols-[1fr_6rem]">
                    <label className="text-sm font-semibold">{copy.topicTitle}<input className={field} value={topic.title} onChange={(event) => updateTopic(unitIndex, topicIndex, { ...topic, title: event.target.value })} /></label>
                    <label className="text-sm font-semibold">{copy.weight}<input className={field} type="number" min={1} max={5} value={topic.weight} onChange={(event) => updateTopic(unitIndex, topicIndex, { ...topic, weight: Number(event.target.value) || 1 })} /></label>
                  </div>
                ))}
                <button type="button" className="h-10 justify-self-start text-sm font-semibold text-[#1E6A83]" onClick={() => updateUnit(unitIndex, { ...unit, topics: [...unit.topics, { id: `topic-${unit.topics.length + 1}`, title: '', weight: 3, questions: [blankQuestion()] }] })}>{copy.addTopic} →</button>
              </fieldset>
            ))}
            <button type="button" className="mt-3 text-sm font-semibold text-[#1E6A83]" onClick={() => setDraft({ ...draft, units: [...draft.units, { id: `unit-${draft.units.length + 1}`, title: '', topics: [{ id: 'topic-1', title: '', weight: 3, questions: [blankQuestion()] }] }] })}>{copy.addUnit} →</button>
          </div>
        ) : null}
        {step === 'questions' ? (
          <div className="mt-6">
            {draft.units.map((unit, unitIndex) => unit.topics.map((topic, topicIndex) => (
              <fieldset key={`${unit.id}-${topic.id}`} className="mt-4 grid gap-2 rounded-2xl border p-3">
                <p className="text-sm font-semibold">{unit.title} · {topic.title}</p>
                {(topic.questions ?? []).map((question, questionIndex) => (
                  <div key={questionIndex} className="grid gap-2">
                    <label className="text-sm font-semibold">{copy.question}<textarea className="mt-1 w-full rounded-xl border px-3 py-2" rows={2} placeholder={copy.questionHint} value={question.question} onChange={(event) => {
                      const questions = [...(topic.questions ?? [])];
                      questions[questionIndex] = { ...question, question: event.target.value };
                      updateTopic(unitIndex, topicIndex, { ...topic, questions });
                    }} /></label>
                    <label className="text-sm font-semibold">{copy.marks}<input className={field} type="number" min={1} max={12} value={question.marks} onChange={(event) => {
                      const questions = [...(topic.questions ?? [])];
                      questions[questionIndex] = { ...question, marks: Number(event.target.value) || 1 };
                      updateTopic(unitIndex, topicIndex, { ...topic, questions });
                    }} /></label>
                    <label className="text-sm font-semibold">{copy.worked}<textarea className="mt-1 w-full rounded-xl border px-3 py-2" rows={2} value={question.solution} onChange={(event) => {
                      const questions = [...(topic.questions ?? [])];
                      questions[questionIndex] = { ...question, solution: event.target.value };
                      updateTopic(unitIndex, topicIndex, { ...topic, questions });
                    }} /></label>
                    <label className="text-sm font-semibold">{copy.scheme}<textarea className="mt-1 w-full rounded-xl border px-3 py-2" rows={2} value={question.markScheme} onChange={(event) => {
                      const questions = [...(topic.questions ?? [])];
                      questions[questionIndex] = { ...question, markScheme: event.target.value };
                      updateTopic(unitIndex, topicIndex, { ...topic, questions });
                    }} /></label>
                    <label className="text-sm font-semibold">{copy.paper}<input className={field} value={question.paper ?? ''} onChange={(event) => {
                      const questions = [...(topic.questions ?? [])];
                      questions[questionIndex] = { ...question, paper: event.target.value };
                      updateTopic(unitIndex, topicIndex, { ...topic, questions });
                    }} /></label>
                    <label className="text-sm font-semibold">{copy.image}<input className={field} value={question.image ?? ''} placeholder={copy.imageHint} onChange={(event) => {
                      const questions = [...(topic.questions ?? [])];
                      questions[questionIndex] = { ...question, image: event.target.value };
                      updateTopic(unitIndex, topicIndex, { ...topic, questions });
                    }} /></label>
                    <label className="text-sm font-semibold">{flowCopy.examinerTip}<textarea className="mt-1 w-full rounded-xl border px-3 py-2" rows={2} value={question.examinerTip ?? ''} onChange={(event) => {
                      const questions = [...(topic.questions ?? [])];
                      questions[questionIndex] = { ...question, examinerTip: event.target.value };
                      updateTopic(unitIndex, topicIndex, { ...topic, questions });
                    }} /></label>
                  </div>
                ))}
                <button type="button" className="h-10 justify-self-start text-sm font-semibold text-[#1E6A83]" onClick={() => updateTopic(unitIndex, topicIndex, { ...topic, questions: [...(topic.questions ?? []), blankQuestion()] })}>{copy.addQuestion} →</button>
              </fieldset>
            )))}
          </div>
        ) : null}
        {step === 'preview' ? (
          <div className="mt-6" data-pack-preview>
            <p className="text-sm text-[#1E6A83]">{flowCopy.previewNote}</p>
            <h2 className="mt-3 font-heading text-2xl">{draft.name || copy.name}</h2>
            <p className="text-sm">{draft.subject} · {draft.level} · {draft.board}</p>
            {draft.units.map((unit) => (
              <div key={unit.id} className="mt-4">
                <p className="text-sm font-semibold">{unit.title}</p>
                {unit.topics.map((topic) => (
                  <p key={topic.id} className="flex justify-between border-b py-2 text-sm"><span>{topic.title}</span><span aria-hidden>→</span></p>
                ))}
              </div>
            ))}
          </div>
        ) : null}
        {step === 'publish' ? (
          <div className="mt-6 flex flex-wrap gap-3" data-pack-publish>
            <button type="button" className="h-11 rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83]" disabled={saving} onClick={() => void save('draft')}>{flowCopy.saveDraft}</button>
            <button type="button" className="h-11 rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]" disabled={saving} onClick={() => void save('published')}>{flowCopy.publish} →</button>
          </div>
        ) : null}
        <OfficialNav
          backHref={back}
          nextHref={step === 'publish' ? undefined : next}
          nextLabel={step === 'preview' || step === 'publish' ? flowCopy.publish : flowCopy.next}
          onNext={step === 'publish' ? () => void save('published') : undefined}
          nextDisabled={step === 'publish' ? saving || !draft.name.trim() : false}
        />
      </div>
    </DashPage>
  );
}
