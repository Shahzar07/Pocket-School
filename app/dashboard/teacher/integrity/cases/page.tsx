'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { appendIntegrityAudit, listIntegrityCases, saveIntegrityCase, updateIntegrityCase } from '@/lib/insights/client';
import { AUTOMATIC_PENALTY, INTEGRITY_DECISIONS, type IntegrityDecision } from '@/lib/insights/integrity';
import { toast } from 'sonner';

interface Draft {
  level: string;
  score: number;
  evidence: { label: string; detail: string; value?: number }[];
  recommendation: string;
  studentSummary: string;
  viva: string[];
  variant: string;
  automaticPenalty: false;
}

export default function IntegrityCasesPage() {
  const { user, profile } = useAuthSTORE();
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [submission, setSubmission] = useState('');
  const [comparison, setComparison] = useState('');
  const [pasteEvents, setPasteEvents] = useState(0);
  const [focusLosses, setFocusLosses] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cases, setCases] = useState<Array<Record<string, unknown> & { id: string }>>([]);

  const load = async () => {
    if (!user) return;
    setCases(await listIntegrityCases('teacherId', user.uid).catch(() => []));
  };

  useEffect(() => { load(); }, [user]);

  const build = async () => {
    try {
      const body = await authedFetch('/api/insights/integrity-draft', {
        method: 'POST',
        body: JSON.stringify({ assignmentTitle, submission, comparison, pasteEvents, focusLosses }),
      });
      setDraft(body as unknown as Draft);
    } catch {
      toast.error('Could not draft the case.');
    }
  };

  const openCase = async () => {
    if (!user || !draft || !studentId.trim()) return;
    const id = await saveIntegrityCase({
      studentId: studentId.trim(),
      studentName: studentName.trim() || 'Student',
      teacherId: user.uid,
      teacherName: profile?.name ?? 'Teacher',
      assignmentTitle: assignmentTitle || 'Submission',
      level: draft.level,
      score: draft.score,
      evidence: draft.evidence,
      recommendation: draft.recommendation,
      studentSummary: draft.studentSummary,
      viva: draft.viva,
      variant: draft.variant,
      decision: 'pending',
      automaticPenalty: AUTOMATIC_PENALTY,
    });
    await authedFetch('/api/insights/integrity-notify', { method: 'POST', body: JSON.stringify({ caseId: id }) }).catch(() => null);
    toast.success('Case opened. The teacher and parents are notified. No mark changes.');
    setDraft(null);
    await load();
  };

  const decide = async (id: string, decision: IntegrityDecision) => {
    if (!user) return;
    await updateIntegrityCase(id, { decision });
    await appendIntegrityAudit(id, {
      actorId: user.uid,
      actorName: profile?.name ?? 'Teacher',
      action: decision,
    });
    toast.success('Decision recorded.');
    await load();
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow="Integrity"
        title="A case,"
        accent="not a penalty"
        description="Paste, typing, focus, style, AI-likelihood, and similarity become evidence. The teacher decides. Nothing here changes a mark."
      />
      <Panel>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input value={studentId} onChange={event => setStudentId(event.target.value)} placeholder="Student id" aria-label="Student id" />
          <Input value={studentName} onChange={event => setStudentName(event.target.value)} placeholder="Student name" aria-label="Student name" />
          <Input value={assignmentTitle} onChange={event => setAssignmentTitle(event.target.value)} placeholder="Assignment title" aria-label="Assignment title" className="sm:col-span-2" />
        </div>
        <textarea className="mt-3 w-full rounded-xl border border-border p-3 text-sm" rows={4} value={submission} onChange={event => setSubmission(event.target.value)} placeholder="Submission text" aria-label="Submission" />
        <textarea className="mt-3 w-full rounded-xl border border-border p-3 text-sm" rows={3} value={comparison} onChange={event => setComparison(event.target.value)} placeholder="Text to compare, optional" aria-label="Comparison" />
        <div className="mt-3 flex gap-3">
          <label className="text-sm">Pastes <Input type="number" min={0} value={pasteEvents} onChange={event => setPasteEvents(Number(event.target.value) || 0)} /></label>
          <label className="text-sm">Focus losses <Input type="number" min={0} value={focusLosses} onChange={event => setFocusLosses(Number(event.target.value) || 0)} /></label>
        </div>
        <Button type="button" className="mt-3" onClick={build}>Build the case</Button>
      </Panel>
      {draft && (
        <Panel>
          <p className="text-sm font-semibold capitalize">{draft.level} · score {draft.score}</p>
          <p className="text-sm mt-2">{draft.recommendation}</p>
          <p className="text-sm text-muted-foreground mt-2">Student sees: {draft.studentSummary}</p>
          <ul className="mt-3 space-y-1 text-sm">{draft.evidence.map(item => <li key={item.label}>{item.label}: {item.detail}</li>)}</ul>
          <p className="text-sm mt-3 font-semibold">Viva</p>
          <ul className="text-sm list-disc pl-5">{draft.viva.map(question => <li key={question}>{question}</li>)}</ul>
          <p className="text-sm mt-3">{draft.variant}</p>
          <Button type="button" className="mt-3" onClick={openCase}>Open case and notify</Button>
        </Panel>
      )}
      {cases.map(item => (
        <Panel key={item.id}>
          <p className="font-semibold">{String(item.assignmentTitle ?? 'Case')} · {String(item.studentName ?? '')}</p>
          <p className="text-sm text-muted-foreground capitalize">{String(item.level)} · {String(item.decision ?? 'pending')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTEGRITY_DECISIONS.filter(option => option.id !== 'pending').map(option => (
              <Button key={option.id} type="button" variant="outline" onClick={() => decide(item.id, option.id)}>{option.label}</Button>
            ))}
          </div>
        </Panel>
      ))}
    </DashPage>
  );
}
