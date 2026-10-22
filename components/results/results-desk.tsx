'use client';

import { useEffect, useState } from 'react';
import { FlowNav } from '@/components/flow/flow-nav';
import { FlowTrail } from '@/components/flow/flow-trail';
import { ApiError, authedFetch, bearerHeaders } from '@/lib/api-client';
import { flowNeighbor } from '@/lib/flow/steps';
import { RESULT_COPY as COPY } from '@/lib/results/copy';
import { SCHOOL_BOARDS } from '@/lib/pathways/catalog';
import {
  parseDesk,
  RESULT_LEVELS,
  RESULT_STEPS,
  usesSchoolBoards,
  validBoard,
  type DeskView,
  type ResultStepId,
} from '@/lib/results/model';

const panel = 'min-w-0 max-w-full rounded-2xl border border-[#1E6A83]/20 bg-white p-4 text-[#203337] dark:border-[#3FE0D0]/25 dark:bg-[#1A1918] dark:text-[#E7F4F2]';
const label = 'mb-1 block text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]';
const field = 'w-full rounded-xl border border-[#1E6A83]/30 bg-white px-3 py-2 text-[#203337] dark:border-[#3FE0D0]/30 dark:bg-[#0B1417] dark:text-[#E7F4F2]';
const quiet = 'text-sm text-[#1E6A83] dark:text-[#3FE0D0]';

interface Draft {
  id: string;
  level: string;
  subject: string;
  board: string;
  grade: string;
  session: string;
}

const emptyDraft = (): Draft => ({ id: '', level: '', subject: '', board: '', grade: '', session: '' });

function problemFor(step: ResultStepId, draft: Draft): string {
  if (step === 'level' && !draft.level) return COPY.levelMissing;
  if (step === 'subject') {
    if (draft.subject.trim().length < 1) return COPY.subjectMissing;
    if (!validBoard(draft.level, draft.board)) return usesSchoolBoards(draft.level) ? COPY.boardMissing : COPY.bodyMissing;
  }
  if (step === 'grade') {
    if (draft.grade.trim().length < 1) return COPY.gradeMissing;
    if (draft.session.trim().length < 1) return COPY.sessionMissing;
  }
  return '';
}

export function ResultsDesk() {
  const [ready, setReady] = useState(false);
  const [desk, setDesk] = useState<DeskView | null>(null);
  const [mode, setMode] = useState<'list' | 'entry'>('list');
  const [step, setStep] = useState<ResultStepId>('level');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [lookup, setLookup] = useState('');

  async function load(studentId = '') {
    const query = studentId ? `?student=${encodeURIComponent(studentId)}` : '';
    const data = parseDesk(await authedFetch(`/api/results${query}`));
    setDesk(data);
    setLookup(data.studentId);
    return data;
  }

  useEffect(() => {
    let cancelled = false;
    const student = new URLSearchParams(window.location.search).get('student') ?? '';
    load(student).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof ApiError ? reason.message : COPY.forbidden);
    }).finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  function startNew() {
    setDraft(emptyDraft());
    setFile(null);
    setStep('level');
    setMode('entry');
    setError('');
    setNotice('');
  }

  function startEdit(id: string) {
    const row = desk?.rows.find((item) => item.id === id);
    if (!row) return;
    setDraft({
      id: row.id,
      level: row.level,
      subject: row.subject,
      board: row.board,
      grade: row.grade,
      session: row.session,
    });
    setFile(null);
    setStep('level');
    setMode('entry');
    setError('');
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      let fileBase64 = '';
      let fileName = '';
      let mime = '';
      if (file) {
        if (file.size > 2 * 1024 * 1024) throw new ApiError(COPY.fileLarge, 'BAD_REQUEST', 400);
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        fileBase64 = btoa(binary);
        fileName = file.name;
        mime = file.type;
      }
      await authedFetch('/api/results', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save',
          id: draft.id || undefined,
          level: draft.level,
          subject: draft.subject,
          board: draft.board,
          grade: draft.grade,
          session: draft.session,
          fileBase64: fileBase64 || undefined,
          fileName: fileName || undefined,
          mime: mime || undefined,
        }),
      });
      await load(desk?.studentId ?? '');
      setMode('list');
      setNotice(COPY.saved);
    } catch (reason: unknown) {
      setError(reason instanceof ApiError ? reason.message : COPY.forbidden);
    } finally {
      setSaving(false);
    }
  }

  function go(direction: -1 | 1) {
    if (saving) return;
    if (direction === 1) {
      const problem = problemFor(step, draft);
      if (problem) {
        setError(problem);
        return;
      }
      if (step === 'certificate') {
        void save();
        return;
      }
    }
    setError('');
    const next = flowNeighbor(RESULT_STEPS, step, direction);
    if (next) setStep(next.id as ResultStepId);
    else if (direction === -1) setMode('list');
  }

  async function share(enabled: boolean) {
    setError('');
    try {
      await authedFetch('/api/results', { method: 'POST', body: JSON.stringify({ action: 'share', enabled }) });
      await load();
    } catch (reason: unknown) {
      setError(reason instanceof ApiError ? reason.message : COPY.forbidden);
    }
  }

  async function verify(id: string) {
    setError('');
    try {
      await authedFetch('/api/results', { method: 'POST', body: JSON.stringify({ action: 'verify', id }) });
      await load(desk?.studentId ?? lookup);
    } catch (reason: unknown) {
      setError(reason instanceof ApiError ? reason.message : COPY.forbidden);
    }
  }

  async function remove(id: string) {
    setError('');
    try {
      await authedFetch('/api/results', { method: 'POST', body: JSON.stringify({ action: 'remove', id }) });
      await load();
    } catch (reason: unknown) {
      setError(reason instanceof ApiError ? reason.message : COPY.forbidden);
    }
  }

  async function openCertificate(id: string, fileName: string) {
    try {
      const headers = await bearerHeaders();
      const res = await fetch(`/api/results/file?id=${encodeURIComponent(id)}`, { headers });
      if (!res.ok) throw new ApiError(COPY.fileFailed, 'REQUEST_FAILED', res.status);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName || 'certificate';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason: unknown) {
      setError(reason instanceof ApiError ? reason.message : COPY.fileFailed);
    }
  }

  const role = desk?.role ?? 'student';

  return (
    <div data-results-desk="1" data-results-live={ready ? '1' : '0'} data-results-role={role} className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <div data-results-panel className={panel}>
        <h1 className="text-2xl font-semibold text-[#203337] dark:text-[#E7F4F2]">{COPY.title}</h1>
        <p data-results-disclaimer className="mt-2 text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.disclaimer}</p>
        {error ? <p className="mt-3 text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{notice}</p> : null}
        {!ready ? <p className={`mt-4 ${quiet}`}>{COPY.opening}</p> : null}

        {ready && mode === 'list' ? (
          <div className="mt-4 flex flex-col gap-4">
            {role === 'parent' ? <p className={quiet}>{COPY.parentRead}</p> : null}
            {desk?.canVerify ? <p className={quiet}>{COPY.adminNote}</p> : null}
            {desk?.needsStudent ? (
              <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void load(lookup); }}>
                <label className="min-w-0 flex-1" htmlFor="result-learner">{COPY.lookup}
                  <input id="result-learner" className={`${field} mt-1`} value={lookup} onChange={(event) => setLookup(event.target.value)} />
                </label>
                <button type="submit" className="h-11 self-end rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]">{COPY.openLearner}</button>
              </form>
            ) : null}
            {(desk?.children.length ?? 0) > 1 ? (
              <label className={label} htmlFor="result-child">{COPY.lookup}
                <select id="result-child" className={`${field} mt-1`} value={desk?.studentId ?? ''} onChange={(event) => void load(event.target.value)}>
                  {desk?.children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
                </select>
              </label>
            ) : null}
            {desk?.canEdit ? (
              <button type="button" className="h-11 w-fit rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]" onClick={startNew}>{COPY.record}</button>
            ) : null}
            {desk?.share ? (
              <div data-results-share={desk.share.enabled ? 'on' : 'off'} className="rounded-xl border border-[#1E6A83]/20 p-3">
                <p className="text-sm font-semibold">{desk.share.enabled ? COPY.sharingOn : COPY.sharingOff}</p>
                {desk.share.enabled && desk.share.path ? (
                  <a className="mt-1 block break-all text-sm font-semibold text-[#1E6A83] underline dark:text-[#3FE0D0]" href={desk.share.path} data-results-link>{desk.share.path}</a>
                ) : null}
                <p className={`mt-1 ${quiet}`}>{COPY.filePrivate}</p>
                <button type="button" className="mt-2 h-10 rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83] dark:border-[#3FE0D0] dark:text-[#3FE0D0]" onClick={() => void share(!desk.share?.enabled)}>
                  {desk.share.enabled ? COPY.turnOff : COPY.turnOn}
                </button>
              </div>
            ) : null}
            {desk && desk.rows.length === 0 && !desk.needsStudent ? <p className={quiet}>{COPY.empty}</p> : null}
            <ul className="flex flex-col gap-3">
              {desk?.rows.map((row) => (
                <li key={row.id} data-result-id={row.id} data-result-subject={row.subject} data-result-status={row.status} className="rounded-xl border border-[#1E6A83]/20 p-3">
                  <p className="font-semibold">{row.subject}</p>
                  <p className={quiet}>{row.levelLabel} · {row.board} · {row.grade} · {row.session}</p>
                  <p className="mt-1 text-sm font-semibold">{row.statusLabel}</p>
                  {row.hasFile ? (
                    <button type="button" className="mt-2 text-sm font-semibold text-[#1E6A83] underline dark:text-[#3FE0D0]" onClick={() => void openCertificate(row.id, row.fileName || 'certificate')}>{COPY.fileOpen}</button>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {desk.canEdit ? <button type="button" className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]" onClick={() => startEdit(row.id)}>{COPY.edit}</button> : null}
                    {desk.canEdit && row.status === 'self-reported' ? <button type="button" className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]" onClick={() => void remove(row.id)}>{COPY.remove}</button> : null}
                    {desk.canVerify && row.status !== 'verified' ? <button type="button" className="h-10 rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]" onClick={() => void verify(row.id)}>{COPY.verify}</button> : null}
                  </div>
                </li>
              ))}
            </ul>
            <section>
              <h2 className="text-lg font-semibold">{COPY.progress}</h2>
              {desk && desk.progress.length === 0 ? <p className={`mt-1 ${quiet}`}>{COPY.progressEmpty}</p> : null}
              {desk?.progress.map((group) => (
                <div key={group.session} data-results-progress={group.session} className="mt-2">
                  <p className="text-sm font-semibold">{group.session}</p>
                  <ul>
                    {group.entries.map((entry) => (
                      <li key={`${group.session}-${entry.subject}`} className={quiet}>{entry.levelLabel} · {entry.subject} · {entry.grade}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          </div>
        ) : null}

        {ready && mode === 'entry' ? (
          <div className="mt-4 flex flex-col gap-4">
            <FlowTrail steps={RESULT_STEPS} currentId={step} onSelect={(id) => {
              const index = RESULT_STEPS.findIndex((item) => item.id === id);
              const current = RESULT_STEPS.findIndex((item) => item.id === step);
              if (index < 0) return;
              if (index > current) return;
              setStep(id as ResultStepId);
            }} />
            {step === 'level' ? (
              <div>
                <p className={quiet}>{COPY.levelHelp}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {RESULT_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      data-result-level={level.value}
                      aria-pressed={draft.level === level.value}
                      className={draft.level === level.value
                        ? 'rounded-full bg-[#3FE0D0] px-4 py-2 text-sm font-semibold text-[#203337]'
                        : 'rounded-full border border-[#1E6A83] px-4 py-2 text-sm font-semibold text-[#1E6A83] dark:border-[#3FE0D0] dark:text-[#3FE0D0]'}
                      onClick={() => setDraft((current) => ({
                        ...current,
                        level: level.value,
                        board: usesSchoolBoards(level.value) ? (usesSchoolBoards(current.level) ? current.board : '') : current.board,
                      }))}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {step === 'subject' ? (
              <div className="flex flex-col gap-3">
                <p className={quiet}>{usesSchoolBoards(draft.level) ? COPY.boardHelp : COPY.bodyHelp}</p>
                <label className={label} htmlFor="result-subject">{COPY.subject}
                  <input id="result-subject" className={`${field} mt-1`} value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} />
                </label>
                {usesSchoolBoards(draft.level) ? (
                  <label className={label} htmlFor="result-board">{COPY.board}
                    <select id="result-board" className={`${field} mt-1`} value={draft.board} onChange={(event) => setDraft((current) => ({ ...current, board: event.target.value }))}>
                      <option value="">{COPY.boardMissing}</option>
                      {SCHOOL_BOARDS.map((board) => <option key={board} value={board}>{board}</option>)}
                    </select>
                  </label>
                ) : (
                  <label className={label} htmlFor="result-board">{COPY.awardingBody}
                    <input id="result-board" className={`${field} mt-1`} value={draft.board} onChange={(event) => setDraft((current) => ({ ...current, board: event.target.value }))} />
                  </label>
                )}
              </div>
            ) : null}
            {step === 'grade' ? (
              <div className="flex flex-col gap-3">
                <label className={label} htmlFor="result-grade">{COPY.grade}
                  <input id="result-grade" className={`${field} mt-1`} value={draft.grade} onChange={(event) => setDraft((current) => ({ ...current, grade: event.target.value }))} />
                </label>
                <p className={quiet}>{COPY.gradeHelp}</p>
                <label className={label} htmlFor="result-session">{COPY.session}
                  <input id="result-session" className={`${field} mt-1`} value={draft.session} onChange={(event) => setDraft((current) => ({ ...current, session: event.target.value }))} />
                </label>
                <p className={quiet}>{COPY.sessionHelp}</p>
              </div>
            ) : null}
            {step === 'certificate' ? (
              <div className="flex flex-col gap-2">
                <p className={quiet}>{COPY.certificateOptional}</p>
                <p className={quiet}>{COPY.certificateTypes}</p>
                <label className={label} htmlFor="result-file">{COPY.certificate}
                  <input id="result-file" className={`${field} mt-1`} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                </label>
              </div>
            ) : null}
            <FlowNav
              onBack={() => go(-1)}
              onNext={() => go(1)}
              backLabel={step === 'level' ? COPY.allResults : undefined}
              nextLabel={step === 'certificate' ? COPY.save : undefined}
              nextDisabled={saving}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
