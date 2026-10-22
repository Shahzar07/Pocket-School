'use client';

import Link from 'next/link';
import type { WelcomeHue, WelcomeLessonView, WelcomeState } from '@/lib/onboarding-course';

const HUE: Record<WelcomeHue, { wash: string; chip: string; ink: string }> = {
  deep: { wash: 'bg-wash', chip: 'bg-blue-deep text-white', ink: 'text-ink' },
  mid: { wash: 'bg-card', chip: 'bg-brand-primary text-white', ink: 'text-foreground' },
  bright: { wash: 'bg-wash', chip: 'bg-[#6FBBCE] text-[#203337]', ink: 'text-ink' },
  mist: { wash: 'bg-card', chip: 'bg-brand-primary text-white', ink: 'text-foreground' },
};

export function WelcomeStars({ count, total, className = 'text-ink' }: { count: number; total: number; className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-1 text-sm font-semibold ${className}`} aria-label={`${count} of ${total} stars`}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index < count ? 'text-current' : 'opacity-30'} aria-hidden>
          ★
        </span>
      ))}
      <span className="ms-1">{count} / {total}</span>
    </p>
  );
}

export function WelcomeResumeCard({
  state,
  onSkip,
  skipping,
}: {
  state: WelcomeState;
  onSkip?: () => void;
  skipping?: boolean;
}) {
  const next = state.lessons.find((lesson) => !lesson.done) ?? state.lessons[0];
  return (
    <section className="mb-4 overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-[0_12px_40px_rgba(30,106,131,0.08)]">
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Welcome course · free</p>
          <h2 className="mt-1 font-heading text-2xl text-foreground">{state.trackTitle}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{state.blurb}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <WelcomeStars count={state.stars} total={state.total} className="text-foreground" />
            <span className="rounded-full bg-[#6FBBCE] px-3 py-1 text-xs font-bold text-[#203337]">
              {state.streak} lesson streak
            </span>
            {next && <span className="text-sm text-foreground">Next: {next.title}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/welcome" className="inline-flex h-11 items-center rounded-full bg-blue-deep px-5 text-sm font-semibold text-white">
            Continue
          </Link>
          {onSkip && (
            <button type="button" onClick={onSkip} disabled={skipping} className="inline-flex h-11 items-center rounded-full border border-border px-4 text-sm font-semibold text-foreground">
              {skipping ? 'Skipping…' : 'Skip for now'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function WelcomeLessonCard({
  lesson,
  selected,
  onSelect,
  pending,
  note,
}: {
  lesson: WelcomeLessonView;
  selected?: number | null;
  onSelect?: (choice: number) => void;
  pending?: boolean;
  note?: string;
}) {
  const hue = HUE[lesson.hue];
  return (
    <article className={`rounded-3xl border border-line p-5 sm:p-6 ${hue.wash}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${hue.chip}`}>
          {lesson.minutes} min
        </span>
        {lesson.done && <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-ink">Star earned</span>}
      </div>
      <h3 className={`mt-3 font-heading text-3xl ${hue.ink}`}>{lesson.title}</h3>
      {lesson.body.split(/\n\n+/).map((paragraph) => (
        <p key={paragraph.slice(0, 24)} className={`mt-3 max-w-2xl text-sm leading-relaxed ${hue.ink}`}>{paragraph}</p>
      ))}
      <fieldset className="mt-5 space-y-2" disabled={pending || lesson.checkCorrect}>
        <legend className={`text-sm font-semibold ${hue.ink}`}>{lesson.question}</legend>
        {lesson.options.map((option, index) => {
          const picked = selected === index || (lesson.checkCorrect && selected === index);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect?.(index)}
              className={`block w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium text-[#203337] ${picked ? 'border-[#1E6A83] bg-white' : 'border-transparent bg-white/70 hover:bg-white'}`}
              aria-pressed={picked}
            >
              {option}
            </button>
          );
        })}
      </fieldset>
      {note && <p className={`mt-2 text-sm font-medium ${hue.ink}`}>{note}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-deep">Do this in Poket School</p>
          <p className="text-sm font-semibold text-ink">{lesson.actionLabel}</p>
        </div>
        {lesson.actionDone ? (
          <span className="rounded-full bg-blue-deep px-3 py-1 text-xs font-bold text-white">Ticked</span>
        ) : (
          <Link href={lesson.actionHref} className="inline-flex h-10 items-center rounded-full bg-brand-primary px-4 text-sm font-semibold text-white">
            Open
          </Link>
        )}
      </div>
    </article>
  );
}

export function WelcomeFinish({ state }: { state: WelcomeState }) {
  if (!state.complete) return null;
  return (
    <section className="rounded-3xl bg-blue-deep p-6 text-white">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-bright">Welcome star</p>
      <h2 className="mt-1 font-heading text-3xl">You finished {state.trackTitle}</h2>
      <p className="mt-2 max-w-xl text-sm text-white/80">
        The Welcome star is on your account. This course did not issue a certificate, and it did not spend or award Sparks.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex h-11 items-center rounded-full bg-brand-primary px-5 text-sm font-semibold text-white">{state.badgeName}</span>
        <span className="inline-flex h-11 items-center rounded-full bg-white/10 px-4 text-sm">0 Sparks</span>
      </div>
    </section>
  );
}
