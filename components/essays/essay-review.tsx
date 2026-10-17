'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { EssayGrades } from '@/components/essays/essay-grades';
import { essayLevelLabel } from '@/lib/essays/coaching';
import { ESSAY_FLAG_STATUS } from '@/lib/essays/config';
import { markEssay } from '@/lib/essays/mark';
import { readEssays, readPolicy, statusText, writeEssays, writePolicy, type StoredEssay } from '@/lib/essays/store';
import { planningAllowed } from '@/lib/essays/submit';
import { updateIntegrityCase } from '@/lib/insights/client';
import { useAuthSTORE } from '@/hooks/use-auth';

export function EssayReview() {
  const pathname = usePathname() ?? '';
  const user = useAuthSTORE(state => state.user);
  const profileName = useAuthSTORE(state => state.profile?.name);
  const deskHref = pathname.startsWith('/dashboard') ? '/dashboard/studio/essays' : '/studio/essays';
  const [essays, setEssays] = useState<StoredEssay[]>([]);
  const [planningEnabled, setPlanningEnabled] = useState(true);

  useEffect(() => {
    setEssays(readEssays());
    setPlanningEnabled(readPolicy().planningEnabled);
  }, []);

  function save(next: StoredEssay[]) {
    writeEssays(next);
    setEssays(next);
  }

  function togglePlanning(enabled: boolean) {
    writePolicy({ planningEnabled: enabled });
    setPlanningEnabled(enabled);
  }

  async function release(item: StoredEssay) {
    const mark = markEssay({ body: item.body, prompt: item.prompt, level: item.level });
    const nextItem: StoredEssay = {
      ...item,
      mark,
      status: 'released',
      message: 'A teacher released this essay for marking.',
      assist: [...item.assist, {
        at: Date.now(),
        kind: 'override',
        note: 'A teacher released marking after a flag that appears AI-generated. The flag stays in this log.',
      }],
      updatedAt: Date.now(),
    };
    save(essays.map(essay => essay.id === item.id ? nextItem : essay));
    toast.success('Marking released.');
    if (item.caseId && user) {
      await updateIntegrityCase(item.caseId, {
        decision: 'no_action',
        studentSummary: 'A teacher released this essay for marking.',
        teacherId: user.uid,
        teacherName: profileName || 'Teacher',
      }).catch(() => undefined);
    }
  }

  const flagged = essays.filter(essay => essay.status === 'flagged');
  const marked = essays.filter(essay => essay.status !== 'flagged');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={deskHref} className="text-sm font-semibold text-primary hover:underline">Back to ET Essays</Link>
      </div>
      <section className="rounded-2xl border border-border bg-card p-4">
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input
            aria-label="Planning help"
            type="checkbox"
            checked={planningEnabled}
            onChange={event => togglePlanning(event.target.checked)}
            className="h-4 w-4"
          />
          Planning help
        </label>
        <p className="mt-2 text-sm text-muted-foreground">
          {planningAllowed({ planningEnabled })
            ? 'Students can plan with ET AI. Turn this off for an assessment or an exam.'
            : 'Planning help is off for this assessment. Students can still write and submit.'}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl tracking-[-0.03em]">Flagged work</h2>
        {flagged.length === 0 && <p className="text-sm text-muted-foreground">No essay is waiting on a flag.</p>}
        {flagged.map(essay => (
          <article key={essay.id} className="space-y-3 rounded-2xl border border-border bg-card p-4" data-testid="flagged-essay">
            <header>
              <p className="font-semibold">{essay.title}</p>
              <p className="text-sm font-semibold" data-testid="review-status">{ESSAY_FLAG_STATUS}</p>
              <p className="mt-1 text-sm text-muted-foreground">{essay.message}</p>
            </header>
            <p className="text-sm whitespace-pre-wrap">{essay.body}</p>
            <Evidence essay={essay} />
            <button type="button" data-testid="release-marking" onClick={() => void release(essay)} className="h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
              Release marking
            </button>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl tracking-[-0.03em]">Marked work</h2>
        {marked.length === 0 && <p className="text-sm text-muted-foreground">No marked essay on this device yet.</p>}
        {marked.map(essay => (
          <article key={essay.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <header>
              <p className="font-semibold">{essay.title}</p>
              <p className="text-sm text-muted-foreground">{essayLevelLabel(essay.level)} · {statusText(essay)}</p>
            </header>
            {essay.mark && <EssayGrades mark={essay.mark} />}
            {essay.question && <p className="text-sm text-muted-foreground">{essay.question.guidance}</p>}
            <p className="text-sm"><span className="font-semibold">Question. </span>{essay.prompt || 'No question yet.'}</p>
            <Evidence essay={essay} />
          </article>
        ))}
      </section>
    </div>
  );
}

function Evidence({ essay }: { essay: StoredEssay }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Integrity log</h3>
      {essay.assist.length === 0 && <p className="text-sm text-muted-foreground">No ET AI assist is recorded on this essay.</p>}
      <ul className="space-y-1 text-sm text-muted-foreground">
        {essay.assist.map((entry, index) => <li key={`${entry.kind}-${entry.at}-${index}`}>{entry.note}</li>)}
      </ul>
      {essay.evidence.length > 0 && (
        <ul className="space-y-1 text-sm">
          {essay.evidence.map(item => <li key={item.label}><span className="font-semibold">{item.label}. </span>{item.detail}</li>)}
        </ul>
      )}
    </div>
  );
}
