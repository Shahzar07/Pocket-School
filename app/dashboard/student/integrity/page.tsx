'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { listIntegrityCases, saveReexamResponse, updateIntegrityCase } from '@/lib/insights/client';
import { IntegrityNotice } from '@/components/insights/integrity-notice';
import { toast } from 'sonner';

export default function StudentIntegrityPage() {
  const { user } = useAuthSTORE();
  const [cases, setCases] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
    setCases(await listIntegrityCases('studentId', user.uid).catch(() => []));
  };

  useEffect(() => { load(); }, [user]);

  return (
    <DashPage>
      <DashHeader
        eyebrow="Integrity"
        title="What we checked"
        description="This page stays. It shows the check, the evidence, and the teacher’s decision for you, your teacher, and an admin. A mark is never changed from here. You can appeal."
      />
      <IntegrityNotice />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border p-4" style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--ps-violet) 16%, var(--card)), var(--card))' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ps-violet)' }}>Open reviews</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{cases.length}</p>
        </div>
        <div className="rounded-2xl border border-border p-4" style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--ps-emerald) 16%, var(--card)), var(--card))' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ps-emerald)' }}>Appeals sent</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{cases.filter(item => item.appealStatus === 'submitted').length}</p>
        </div>
        <div className="rounded-2xl border border-border p-4" style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--ps-cyan-text) 16%, var(--card)), var(--card))' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ps-cyan-text)' }}>Waiting</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{cases.filter(item => item.decision === 'pending' || item.decision == null).length}</p>
        </div>
      </div>
      {cases.length === 0 && <p className="text-sm text-muted-foreground">No open reviews.</p>}
      {cases.map(item => {
        const evidence = Array.isArray(item.evidence) ? item.evidence as { label: string; detail: string }[] : [];
        return (
          <Panel key={item.id}>
            <p className="font-semibold">{String(item.assignmentTitle ?? 'Review')}</p>
            <p className="text-sm mt-1">{String(item.studentSummary ?? '')}</p>
            <p className="text-sm text-muted-foreground mt-1 capitalize">Decision: {String(item.decision ?? 'pending')}</p>
            <ul className="mt-2 text-sm space-y-1">{evidence.map(row => <li key={row.label}>{row.label}: {row.detail}</li>)}</ul>
            {item.decision === 'resit_ai_variant' && Array.isArray(item.questions) && (
              <form className="mt-3 space-y-2" onSubmit={async event => {
                event.preventDefault();
                const answers = (event.currentTarget.elements.namedItem('resit') as HTMLTextAreaElement | null)?.value ?? '';
                if (!answers.trim() || !user) return;
                await saveReexamResponse({
                  caseId: item.id,
                  studentId: user.uid,
                  teacherId: String(item.teacherId ?? ''),
                  answers,
                });
                toast.success('Re-examination sent to your teacher.');
              }}>
                <p className="text-sm font-semibold">Fresh sitting. Paste is left for the teacher to compare. Your original mark is unchanged.</p>
                <ul className="text-sm list-disc pl-5">
                  {(item.questions as { id?: string; prompt?: string }[]).map(question => (
                    <li key={question.id ?? question.prompt}>{question.prompt}</li>
                  ))}
                </ul>
                <textarea name="resit" className="w-full rounded-xl border border-border p-3 text-sm" rows={4} aria-label="Re-examination answer" />
                <Button type="submit">Send re-examination</Button>
              </form>
            )}
            {item.appealStatus === 'submitted' ? (
              <p className="text-sm mt-3">Appeal sent. Your teacher will record the outcome.</p>
            ) : (
              <form className="mt-3 space-y-2" onSubmit={async event => {
                event.preventDefault();
                const appealNote = (notes[item.id] ?? '').trim();
                if (!appealNote) return;
                await updateIntegrityCase(item.id, {
                  appealNote,
                  appealAt: new Date().toISOString(),
                  appealStatus: 'submitted',
                });
                toast.success('Appeal sent.');
                await load();
              }}>
                <textarea
                  className="w-full rounded-xl border border-border p-3 text-sm"
                  rows={3}
                  value={notes[item.id] ?? ''}
                  onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))}
                  placeholder="What should your teacher reconsider?"
                  aria-label="Appeal note"
                />
                <Button type="submit">Send appeal</Button>
              </form>
            )}
          </Panel>
        );
      })}
    </DashPage>
  );
}
