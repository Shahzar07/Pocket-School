'use client';

import Link from 'next/link';
import type { WelcomeHue, WelcomeLessonView, WelcomeState } from '@/lib/onboarding-course';

const HUE: Record<WelcomeHue, { wash: string; chip: string; ink: string }> = {
  forest: { wash: 'bg-[#E7F0EC]', chip: 'bg-[#1A3C34]', ink: 'text-[#1A3C34]' },
  gold: { wash: 'bg-[#F8E7C4]', chip: 'bg-[#C8922A]', ink: 'text-[#8A6418]' },
  coral: { wash: 'bg-[#FDE4DC]', chip: 'bg-[#E36A4F]', ink: 'text-[#9A3E2C]' },
  blue: { wash: 'bg-[#E3EFFF]', chip: 'bg-[#3C8DFF]', ink: 'text-[#1D4E93]' },
};

export function WelcomeStars({ count, total }: { count: number; total: number }) {
  return (
    <p className="flex flex-wrap items-center gap-1 text-sm font-semibold text-[#1A3C34]" aria-label={`${count} of ${total} stars`}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index < count ? 'text-[#C8922A]' : 'text-[#1A3C34]/20'} aria-hidden>
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
    <section className="mb-4 overflow-hidden rounded-3xl border border-[#1A3C34]/15 bg-[#F6F1E7] text-[#1A3C34] shadow-[0_12px_40px_rgba(26,60,52,0.08)]">
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#E36A4F]">Welcome course · free</p>
          <h2 className="mt-1 font-heading text-2xl">{state.trackTitle}</h2>
          <p className="mt-1 max-w-xl text-sm text-[#1A3C34]/80">{state.blurb}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <WelcomeStars count={state.stars} total={state.total} />
            <span className="rounded-full bg-[#E36A4F] px-3 py-1 text-xs font-bold text-white">
              {state.streak} lesson streak
            </span>
            {next && <span className="text-sm">Next: {next.title}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/welcome" className="inline-flex h-11 items-center rounded-full bg-[#1A3C34] px-5 text-sm font-semibold text-white">
            Continue
          </Link>
          {onSkip && (
            <button type="button" onClick={onSkip} disabled={skipping} className="inline-flex h-11 items-center rounded-full border border-[#1A3C34]/20 px-4 text-sm font-semibold">
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
    <article className={`rounded-3xl border border-[#1A3C34]/10 p-5 sm:p-6 ${hue.wash}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white ${hue.chip}`}>
          {lesson.minutes} min
        </span>
        {lesson.done && <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#1A3C34]">Star earned</span>}
      </div>
      <h3 className="mt-3 font-heading text-3xl text-[#1A3C34]">{lesson.title}</h3>
      {lesson.body.split(/\n\n+/).map((paragraph) => (
        <p key={paragraph.slice(0, 24)} className="mt-3 max-w-2xl text-sm leading-relaxed text-[#1A3C34]/90">{paragraph}</p>
      ))}
      <fieldset className="mt-5 space-y-2" disabled={pending || lesson.checkCorrect}>
        <legend className="text-sm font-semibold text-[#1A3C34]">{lesson.question}</legend>
        {lesson.options.map((option, index) => {
          const picked = selected === index || (lesson.checkCorrect && selected === index);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect?.(index)}
              className={`block w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium ${picked ? 'border-[#1A3C34] bg-white' : 'border-transparent bg-white/70 hover:bg-white'}`}
              aria-pressed={picked}
            >
              {option}
            </button>
          );
        })}
      </fieldset>
      {note && <p className="mt-2 text-sm font-medium text-[#1A3C34]">{note}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#3C8DFF]">Do this in Poket School</p>
          <p className="text-sm font-semibold text-[#1A3C34]">{lesson.actionLabel}</p>
        </div>
        {lesson.actionDone ? (
          <span className="rounded-full bg-[#1A3C34] px-3 py-1 text-xs font-bold text-white">Ticked</span>
        ) : (
          <Link href={lesson.actionHref} className="inline-flex h-10 items-center rounded-full bg-[#3C8DFF] px-4 text-sm font-semibold text-white">
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
    <section className="rounded-3xl bg-[#1A3C34] p-6 text-white">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#F8E7C4]">Welcome star</p>
      <h2 className="mt-1 font-heading text-3xl">You finished {state.trackTitle}</h2>
      <p className="mt-2 max-w-xl text-sm text-white/80">
        The badge is on your account. The certificate is ready to share. This course did not spend or award Sparks.
        {state.track === 'student' || state.track === 'independent'
          ? ' Your student number and QR are on the certificate.'
          : ''}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {state.certificateId && (
          <Link href={`/verify/${state.certificateId}`} className="inline-flex h-11 items-center rounded-full bg-[#C8922A] px-5 text-sm font-semibold text-[#1A3C34]">
            Open certificate
          </Link>
        )}
        <span className="inline-flex h-11 items-center rounded-full bg-white/10 px-4 text-sm">0 Sparks</span>
      </div>
    </section>
  );
}
