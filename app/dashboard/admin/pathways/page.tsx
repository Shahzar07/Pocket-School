'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AI_TEACHERS } from '@/lib/ai-teachers';
import { can, resolveStaffRole } from '@/lib/admin-console';
import { db } from '@/lib/firebase';
import {
  PATHWAYS,
  copyPathway,
  parsePathway,
  type PathwayRecord,
  type PathwayStage,
  type PathwaySubject,
} from '@/lib/pathways/catalog';
import { useAuthSTORE } from '@/hooks/use-auth';
import { ThemeToggle } from '@/components/theme-toggle';

const field = 'mt-1 w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground';

export default function PathwaysDeskPage() {
  const { profile } = useAuthSTORE();
  const staff = resolveStaffRole(profile ? { email: profile.email, role: profile.role, adminRole: profile.adminRole } : null);
  const allowed = can(staff, 'content');
  const [rows, setRows] = useState<PathwayRecord[]>(() => PATHWAYS.map((item) => copyPathway(item)));
  const [slug, setSlug] = useState(PATHWAYS[0]?.slug ?? 'primary');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const draft = rows.find((item) => item.slug === slug) ?? rows[0];

  useEffect(() => {
    if (!allowed) return;
    let cancel = false;
    const load = async () => {
      const next = PATHWAYS.map((item) => copyPathway(item));
      for (const item of next) {
        try {
          const snap = await getDoc(doc(db, 'pathwayPages', item.slug));
          if (!snap.exists()) continue;
          const parsed = parsePathway(snap.data(), item.slug);
          if (!parsed) continue;
          const index = next.findIndex((row) => row.slug === item.slug);
          if (index >= 0) next[index] = parsed;
        } catch {
          if (!cancel) setNotice('A saved pathway could not be read. The catalogue copy is still here.');
        }
      }
      if (!cancel) setRows(next);
    };
    void load();
    return () => { cancel = true; };
  }, [allowed]);

  const update = (patch: Partial<PathwayRecord>) => {
    setRows((current) => current.map((item) => (item.slug === slug ? { ...item, ...patch } : item)));
  };

  const updateStage = (stageId: string, patch: Partial<PathwayStage>) => {
    if (!draft) return;
    update({
      stages: draft.stages.map((stage) => (stage.id === stageId ? { ...stage, ...patch } : stage)),
    });
  };

  const updateSubject = (stageId: string, index: number, patch: Partial<PathwaySubject>) => {
    if (!draft) return;
    update({
      stages: draft.stages.map((stage) => {
        if (stage.id !== stageId) return stage;
        return {
          ...stage,
          subjects: stage.subjects.map((subject, subjectIndex) => (subjectIndex === index ? { ...subject, ...patch } : subject)),
        };
      }),
    });
  };

  const save = async () => {
    if (!draft) return;
    const parsed = parsePathway({ ...draft, updatedAt: Date.now() }, draft.slug);
    if (!parsed) {
      setNotice('Check the stages, subjects, teacher, and links before saving.');
      return;
    }
    setBusy(true);
    try {
      await setDoc(doc(db, 'pathwayPages', parsed.slug), parsed);
      update(parsed);
      setNotice('Saved. The public page uses this copy.');
    } catch {
      setNotice('Save failed. An admin login is required.');
    } finally {
      setBusy(false);
    }
  };

  if (!draft) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background text-foreground" data-pathway-editor="1">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-foreground/15 bg-background px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83] dark:text-[#3FE0D0]">Admin</p>
          <h1 className="text-2xl" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>Pathways</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]" href="/dashboard/admin">Admin desk</Link>
          <Link className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]" href={`/${draft.slug}`}>View page</Link>
          <ThemeToggle />
          <button type="button" className="inline-flex min-h-11 items-center rounded-full bg-[#3FE0D0] px-4 text-sm font-bold text-[#203337] disabled:opacity-60" onClick={() => void save()} disabled={!allowed || busy}>
            {busy ? 'Saving' : 'Save'}
          </button>
        </div>
      </header>
      {!allowed ? (
        <p className="px-4 py-8 text-sm" role="status">Pathways are edited by admins.</p>
      ) : (
        <div className="grid min-h-0 flex-1 gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Pathway pages" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {rows.map((item) => (
              <button key={item.slug} type="button" className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold ${item.slug === draft.slug ? 'bg-[#3FE0D0] text-[#203337]' : 'border border-foreground/15 text-foreground'}`} onClick={() => setSlug(item.slug)}>
                {item.title}
              </button>
            ))}
          </nav>
          <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); void save(); }}>
            {notice ? <p className="text-sm" role="status">{notice}</p> : null}
            <label className="block text-sm font-semibold">Title
              <input className={field} value={draft.title} onChange={(event) => update({ title: event.target.value })} />
            </label>
            <label className="block text-sm font-semibold">Overview
              <textarea className={field} rows={4} value={draft.overview} onChange={(event) => update({ overview: event.target.value })} />
            </label>
            <label className="block text-sm font-semibold">Who it is for
              <textarea className={field} rows={3} value={draft.audience} onChange={(event) => update({ audience: event.target.value })} />
            </label>
            <label className="block text-sm font-semibold">Entry
              <textarea className={field} rows={3} value={draft.entry} onChange={(event) => update({ entry: event.target.value })} />
            </label>
            <label className="block text-sm font-semibold">Duration
              <textarea className={field} rows={2} value={draft.duration} onChange={(event) => update({ duration: event.target.value })} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">Price on the card
                <input className={field} value={draft.priceLabel} onChange={(event) => update({ priceLabel: event.target.value })} />
              </label>
              <label className="block text-sm font-semibold">Disclaimer
                <input className={field} value={draft.disclaimer} onChange={(event) => update({ disclaimer: event.target.value })} />
              </label>
            </div>
            <label className="block text-sm font-semibold">Price detail
              <textarea className={field} rows={3} value={draft.priceDetail} onChange={(event) => update({ priceDetail: event.target.value })} />
            </label>
            <label className="block text-sm font-semibold">Included, one item per line
              <textarea className={field} rows={4} value={draft.included.join('\n')} onChange={(event) => update({ included: lines(event.target.value) })} />
            </label>
            <label className="block text-sm font-semibold">Exam boards, one per line
              <textarea className={field} rows={3} value={draft.boards.join('\n')} onChange={(event) => update({ boards: lines(event.target.value) })} />
            </label>
            <label className="block text-sm font-semibold">Assessment note
              <textarea className={field} rows={3} value={draft.boardNote} onChange={(event) => update({ boardNote: event.target.value })} />
            </label>
            {draft.stages.map((stage) => (
              <fieldset key={stage.id} className="space-y-3 rounded-2xl border border-foreground/15 p-4">
                <legend className="px-1 text-sm font-bold">Stage</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">Anchor
                    <input className={field} value={stage.id} aria-label={`Anchor for ${stage.title}`} onChange={(event) => updateStage(stage.id, { id: event.target.value })} />
                  </label>
                  <label className="block text-sm font-semibold">Stage title
                    <input className={field} value={stage.title} aria-label={`Title for ${stage.id}`} onChange={(event) => updateStage(stage.id, { title: event.target.value })} />
                  </label>
                </div>
                <label className="block text-sm font-semibold">Stage note
                  <textarea className={field} rows={3} value={stage.note} aria-label={`Note for ${stage.title}`} onChange={(event) => updateStage(stage.id, { note: event.target.value })} />
                </label>
                <ul className="space-y-3">
                  {stage.subjects.map((subject, index) => (
                    <li key={`${stage.id}-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_140px_minmax(0,1fr)_auto]">
                      <label className="block text-xs font-semibold">Subject
                        <input className={field} value={subject.name} aria-label={`Subject ${index + 1} in ${stage.title}`} onChange={(event) => updateSubject(stage.id, index, { name: event.target.value })} />
                      </label>
                      <label className="block text-xs font-semibold">Kind
                        <select className={field} value={subject.kind} aria-label={`Kind ${index + 1} in ${stage.title}`} onChange={(event) => updateSubject(stage.id, index, { kind: event.target.value === 'core' ? 'core' : 'optional' })}>
                          <option value="core">Core</option>
                          <option value="optional">Optional</option>
                        </select>
                      </label>
                      <label className="block text-xs font-semibold">ET teacher
                        <select className={field} value={subject.teacherId} aria-label={`Teacher ${index + 1} in ${stage.title}`} onChange={(event) => updateSubject(stage.id, index, { teacherId: event.target.value })}>
                          {AI_TEACHERS.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                          ))}
                        </select>
                      </label>
                      <button type="button" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]" onClick={() => updateStage(stage.id, { subjects: stage.subjects.filter((_, subjectIndex) => subjectIndex !== index) })}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]" onClick={() => updateStage(stage.id, { subjects: [...stage.subjects, { name: 'New subject', kind: 'optional', teacherId: 'et-english', source: 'standard' }] })}>
                  Add subject
                </button>
              </fieldset>
            ))}
            <fieldset className="space-y-3 rounded-2xl border border-foreground/15 p-4">
              <legend className="px-1 text-sm font-bold">Questions</legend>
              {draft.faqs.map((faq, index) => (
                <div key={index} className="grid gap-2">
                  <label className="block text-xs font-semibold">Question {index + 1}
                    <input className={field} value={faq.question} onChange={(event) => update({ faqs: draft.faqs.map((item, itemIndex) => itemIndex === index ? { ...item, question: event.target.value } : item) })} />
                  </label>
                  <label className="block text-xs font-semibold">Answer {index + 1}
                    <textarea className={field} rows={2} value={faq.answer} onChange={(event) => update({ faqs: draft.faqs.map((item, itemIndex) => itemIndex === index ? { ...item, answer: event.target.value } : item) })} />
                  </label>
                </div>
              ))}
            </fieldset>
            <button type="button" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]" onClick={() => {
              const fresh = PATHWAYS.find((item) => item.slug === draft.slug);
              if (fresh) update(copyPathway(fresh));
              setNotice('Restored the catalogue copy. Save to publish it.');
            }}>
              Restore catalogue copy
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function lines(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}
