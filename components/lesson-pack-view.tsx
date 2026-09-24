'use client';

/**
 * Renders a tiered LessonPack as the finished teaching material it is:
 * textbook prose for the explainer, proper cards for Key Case Law, a marked
 * question list for the assessment, tick boxes for a competency checklist.
 *
 * Everything is driven off the tier's own field set, so a Tier 1 lesson never
 * renders an empty "Key Case Law" heading and a Tier 4 lesson never renders a
 * Mock Exam. Anything the parser could not place still reaches the reader via
 * the raw markdown fallback.
 */

import { MathMarkdown } from '@/components/math-markdown';
import { normalizeMarkdown } from '@/components/lesson-format-views';
import type { LessonPack, CaseLawEntry, StatuteEntry } from '@/lib/curriculum-tiers';
import { describeSelection, LAW_STAGES } from '@/lib/curriculum-tiers';
import { Scale, BookMarked, Gavel, CheckSquare, Target, ClipboardList } from 'lucide-react';

/* ── Small shared pieces ────────────────────────────────────── */

function Field({ label, children, icon }: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {icon}{label}
      </h3>
      <div className="text-sm leading-relaxed text-foreground">{children}</div>
    </section>
  );
}

function Prose({ text }: { text: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-7">
      <MathMarkdown>{normalizeMarkdown(text)}</MathMarkdown>
    </div>
  );
}

function Pills({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-muted text-foreground">{t}</span>
      ))}
    </div>
  );
}

/** Numbered questions with their marks pulled out into a chip. */
function QuestionList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((q, i) => {
        const m = q.match(/\((\d+(?:\s*(?:to|–|-)\s*\d+)?)\s*marks?\)\s*$/i);
        const body = m ? q.slice(0, m.index).trim() : q;
        return (
          <li key={i} className="flex gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
            <span className="shrink-0 w-6 h-6 rounded-lg bg-teal-50 text-teal-700 text-xs font-bold grid place-items-center">
              {i + 1}
            </span>
            <span className="flex-1 text-sm leading-relaxed">{body.replace(/^\d+[).]\s*/, '')}</span>
            {m && (
              <span className="shrink-0 self-start text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {m[1]} marks
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Law: the case law card ─────────────────────────────────── */

function CaseCard({ entry, index }: { entry: CaseLawEntry; index: number }) {
  const rows: [string, string | undefined][] = [
    ['Facts', entry.facts],
    ['Held', entry.held],
    ['Judge(s)', entry.judges],
    ['Ratio Decidendi', entry.ratio],
    ['Obiter Dicta', entry.obiter],
    ['Significance', entry.significance],
  ];
  return (
    <article className="rounded-2xl border border-rose-200/70 bg-rose-50/30 overflow-hidden">
      <header className="flex items-start gap-2.5 px-4 py-3 border-b border-rose-200/60 bg-rose-50/70">
        <span className="shrink-0 mt-0.5 w-6 h-6 rounded-lg bg-rose-600 text-white text-xs font-bold grid place-items-center">
          {index}
        </span>
        <div className="min-w-0">
          <h4 className="font-heading text-sm font-bold text-rose-900 leading-snug">{entry.name}</h4>
          {entry.court && <p className="text-[11px] text-rose-700/80 mt-0.5">{entry.court}</p>}
        </div>
      </header>
      <dl className="px-4 py-3 space-y-2.5">
        {rows.filter(([, v]) => v && v.trim()).map(([label, v]) => (
          <div key={label}>
            <dt className="text-[10px] font-bold uppercase tracking-widest text-rose-700/70">{label}</dt>
            <dd className="text-sm leading-relaxed text-foreground mt-0.5">{v}</dd>
          </div>
        ))}
      </dl>
      {entry.examHighlight && (
        <p className="flex items-start gap-2 px-4 py-2.5 border-t border-rose-200/60 bg-amber-50/70 text-[13px] leading-relaxed text-amber-900">
          <Target className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span><span className="font-bold">Exam highlight: </span>{entry.examHighlight}</span>
        </p>
      )}
    </article>
  );
}

function StatuteCard({ entry }: { entry: StatuteEntry }) {
  const rows: [string, string | undefined][] = [
    ['Relevant Section(s)', entry.sections],
    ['Provision', entry.provision],
    ['Purpose', entry.purpose],
    ['Key Judicial Interpretation', entry.interpretation],
    ['Significance', entry.significance],
  ];
  return (
    <article className="rounded-2xl border border-indigo-200/70 bg-indigo-50/25 overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-indigo-200/60 bg-indigo-50/70">
        <Gavel className="w-4 h-4 text-indigo-700 shrink-0" />
        <h4 className="font-heading text-sm font-bold text-indigo-900 leading-snug">{entry.name}</h4>
      </header>
      <dl className="px-4 py-3 space-y-2.5">
        {rows.filter(([, v]) => v && v.trim()).map(([label, v]) => (
          <div key={label}>
            <dt className="text-[10px] font-bold uppercase tracking-widest text-indigo-700/70">{label}</dt>
            <dd className="text-sm leading-relaxed text-foreground mt-0.5">{v}</dd>
          </div>
        ))}
      </dl>
      {entry.examHighlight && (
        <p className="flex items-start gap-2 px-4 py-2.5 border-t border-indigo-200/60 bg-amber-50/70 text-[13px] leading-relaxed text-amber-900">
          <Target className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span><span className="font-bold">Exam highlight: </span>{entry.examHighlight}</span>
        </p>
      )}
    </article>
  );
}

/* ── The pack ───────────────────────────────────────────────── */

export function LessonPackView({ pack, showHeader = true }: { pack: LessonPack; showHeader?: boolean }) {
  // A pack that never parsed (an old lesson, or a model that ignored the field
  // labels) still shows its content rather than an empty page.
  if (!pack.explainer && !pack.keyCaseLaw?.length) {
    return <Prose text={pack.raw} />;
  }

  const isLaw = pack.tier === 'tier4';
  const stageLabel = LAW_STAGES.find(s => s.id === pack.lawStage)?.label;

  return (
    <div className="space-y-6">
      {showHeader && (
        <header className="space-y-2 pb-4 border-b border-border">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
              {describeSelection(pack)}
            </span>
            {pack.blooms && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                {pack.blooms}
              </span>
            )}
            {pack.duration && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {pack.duration}
              </span>
            )}
            {isLaw && stageLabel && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                {stageLabel} depth
              </span>
            )}
          </div>
          {pack.title && <h2 className="font-heading text-2xl font-bold leading-tight">{pack.title}</h2>}
        </header>
      )}

      {pack.objectives?.length ? (
        <Field label="Objectives" icon={<Target className="w-3 h-3" />}>
          <ul className="space-y-1.5">
            {pack.objectives.map((o, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </Field>
      ) : null}

      {pack.vocabulary?.length ? (
        <Field label="Vocabulary" icon={<BookMarked className="w-3 h-3" />}>
          <Pills items={pack.vocabulary} />
        </Field>
      ) : null}

      {pack.mnemonic && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Mnemonic</p>
          <p className="text-sm font-medium text-amber-900 mt-1">“{pack.mnemonic}”</p>
        </div>
      )}

      {pack.explainer && (
        /* The explainer is the lesson. It is deliberately rendered as plain
         * flowing prose with no field label above it, exactly as the spec
         * requires a student to read it. */
        <Prose text={pack.explainer} />
      )}

      {pack.keyCaseLaw?.length ? (
        <Field label={`Key Case Law · ${pack.keyCaseLaw.length} cases`} icon={<Scale className="w-3 h-3" />}>
          <div className="space-y-3">
            {pack.keyCaseLaw.map((c, i) => <CaseCard key={i} entry={c} index={i + 1} />)}
          </div>
        </Field>
      ) : null}

      {pack.keyStatutes?.length ? (
        <Field label="Key Statutes" icon={<Gavel className="w-3 h-3" />}>
          <div className="space-y-3">
            {pack.keyStatutes.map((s, i) => <StatuteCard key={i} entry={s} />)}
          </div>
        </Field>
      ) : null}

      {pack.practicalBrief && (
        <Field label="Practical Brief" icon={<ClipboardList className="w-3 h-3" />}>
          <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3"><Prose text={pack.practicalBrief} /></div>
        </Field>
      )}

      {pack.caseStudy && (
        <Field label={pack.subjectType === 'technical' ? 'Structured Problem' : 'Case Study'}>
          <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3"><Prose text={pack.caseStudy} /></div>
        </Field>
      )}

      {pack.questions?.length ? (
        <Field label={pack.totalMarks ? `Questions · ${pack.totalMarks} total` : 'Questions'}>
          <QuestionList items={pack.questions} />
        </Field>
      ) : null}

      {pack.mockExam?.length ? (
        <Field label={pack.totalMarks ? `Mock Exam · ${pack.totalMarks} total` : 'Mock Exam'}>
          <QuestionList items={pack.mockExam} />
        </Field>
      ) : null}

      {pack.activity && <Field label="Activity"><Prose text={pack.activity} /></Field>}
      {pack.deliverable && <Field label="Deliverable"><Prose text={pack.deliverable} /></Field>}
      {pack.assignment && <Field label="Assignment"><Prose text={pack.assignment} /></Field>}

      {pack.competencyChecklist?.length ? (
        <Field label="Competency Checklist" icon={<CheckSquare className="w-3 h-3" />}>
          <ul className="space-y-1.5">
            {pack.competencyChecklist.map((c, i) => (
              <li key={i} className="flex gap-2.5 items-start rounded-xl border border-border bg-card px-3 py-2">
                <span className="mt-0.5 w-4 h-4 rounded border-2 border-teal-400 shrink-0" />
                <span className="text-sm">{c}</span>
              </li>
            ))}
          </ul>
        </Field>
      ) : null}

      {pack.rubric?.length ? (
        <Field label="Assessment Rubric">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left px-3 py-2">Criteria</th><th className="text-left px-3 py-2 w-24">Weighting</th><th className="text-left px-3 py-2">Description</th></tr>
              </thead>
              <tbody>
                {pack.rubric.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{r.criteria}</td>
                    <td className="px-3 py-2 text-amber-700 font-bold">{r.weighting}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Field>
      ) : null}

      {pack.stretchTask && (
        <Field label="Stretch Task">
          <div className="rounded-2xl border border-violet-200 bg-violet-50/40 px-4 py-3"><Prose text={pack.stretchTask} /></div>
        </Field>
      )}

      {pack.problemQ && (
        <Field label="Problem Q">
          <div className="rounded-2xl border border-violet-200 bg-violet-50/40 px-4 py-3"><Prose text={pack.problemQ} /></div>
        </Field>
      )}

      {pack.summary && (
        <Field label="Summary">
          <p className="text-sm leading-relaxed italic text-muted-foreground">{pack.summary}</p>
        </Field>
      )}
    </div>
  );
}
