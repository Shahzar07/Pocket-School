'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { authedFetch } from '@/lib/api-client';
import { useAccountMode } from '@/hooks/use-account-mode';
import { useAuthSTORE } from '@/hooks/use-auth';
import { isOnboardingTrack, readWelcomeHue, type WelcomeState } from '@/lib/onboarding-course';
import { WelcomeFinish, WelcomeLessonCard, WelcomeResumeCard, WelcomeStars } from '@/components/onboarding/welcome-board';
import { useContentTranslation } from '@/hooks/use-content-translation';
import { readLanguage } from '@/lib/languages';
import { lessonTranslationFields } from '@/lib/onboarding-course';

function readState(data: Record<string, unknown>): WelcomeState | null {
  if (!isOnboardingTrack(data.track) || !Array.isArray(data.lessons)) return null;
  const lessons = data.lessons.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const options = Array.isArray(row.options) ? row.options.filter((option): option is string => typeof option === 'string') : [];
    if (typeof row.id !== 'string' || typeof row.title !== 'string' || options.length < 3) return [];
    const hue = readWelcomeHue(row.hue);
    return [{
      id: row.id,
      title: row.title,
      minutes: row.minutes === 3 ? 3 : 2,
      hue,
      body: typeof row.body === 'string' ? row.body : '',
      question: typeof row.question === 'string' ? row.question : '',
      options: [options[0] ?? '', options[1] ?? '', options[2] ?? ''] as [string, string, string],
      actionLabel: typeof row.actionLabel === 'string' ? row.actionLabel : 'Open',
      actionHref: typeof row.actionHref === 'string' ? row.actionHref : '/dashboard/welcome',
      checkCorrect: row.checkCorrect === true,
      actionDone: row.actionDone === true,
      done: row.done === true,
    }];
  });
  return {
    courseId: 'onboarding-welcome',
    track: data.track,
    trackTitle: typeof data.trackTitle === 'string' ? data.trackTitle : 'Welcome',
    blurb: typeof data.blurb === 'string' ? data.blurb : '',
    skipped: data.skipped === true,
    stars: typeof data.stars === 'number' ? data.stars : 0,
    streak: typeof data.streak === 'number' ? data.streak : 0,
    total: typeof data.total === 'number' ? data.total : lessons.length,
    complete: data.complete === true,
    badgeName: typeof data.badgeName === 'string' ? data.badgeName : 'Welcome star',
    showCard: data.showCard === true,
    lessons,
  };
}

function publishWelcome(next: WelcomeState | null) {
  if (!next || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('poket-welcome', { detail: next }));
}

function useWelcome() {
  const { user } = useAuthSTORE();
  const { mode } = useAccountMode();
  const [state, setState] = useState<WelcomeState | null>(null);

  const send = useCallback(async (op: string, extra?: Record<string, unknown>) => {
    const data = await authedFetch('/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({ op, mode: mode ?? '', ...extra }),
    });
    const next = readState(data);
    if (next) {
      setState(next);
      publishWelcome(next);
    }
    return next ? { ...next, correct: data.correct === true } : null;
  }, [mode]);

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<WelcomeState>).detail;
      if (detail?.track) setState(detail);
    };
    window.addEventListener('poket-welcome', onUpdate);
    return () => window.removeEventListener('poket-welcome', onUpdate);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void authedFetch(`/api/onboarding?mode=${encodeURIComponent(mode ?? '')}`)
      .then((data) => {
        if (cancelled) return;
        const next = readState(data);
        setState(next);
        publishWelcome(next);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => { cancelled = true; };
  }, [mode, user]);

  return { state, setState, send };
}

export function WelcomeResume() {
  const pathname = usePathname();
  const { state, setState, send } = useWelcome();
  const [skipping, setSkipping] = useState(false);

  useEffect(() => {
    if (!state) return;
    const href = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    void authedFetch('/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({ op: 'visit', href }),
    }).then((data) => {
      const next = readState(data);
      if (next) {
        setState(next);
        publishWelcome(next);
      }
    }).catch(() => {});
  }, [pathname, state?.track, setState]);

  if (!state?.showCard || pathname.startsWith('/dashboard/welcome')) return null;

  return (
    <WelcomeResumeCard
      state={state}
      skipping={skipping}
      onSkip={() => {
        setSkipping(true);
        void send('skip').finally(() => setSkipping(false));
      }}
    />
  );
}

export function WelcomeHelpLink() {
  const { state, send } = useWelcome();
  const [busy, setBusy] = useState(false);
  return (
    <section className="rounded-3xl border border-line bg-background p-5 text-ink">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-deep">Welcome course</p>
      <h2 className="mt-1 font-heading text-2xl">Pick the welcome course back up</h2>
      <p className="mt-1 text-sm text-ink/80">
        {state?.complete
          ? 'You already earned the Welcome star. Open the course any time to read a lesson again.'
          : 'Skip hides the card on your dashboard. It does not delete the lessons.'}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void send('reopen').finally(() => setBusy(false));
        }}
        className="mt-4 inline-flex h-11 items-center rounded-full bg-blue-deep px-5 text-sm font-semibold text-white"
      >
        {busy ? 'Opening…' : 'Reopen the welcome course'}
      </button>
      <Link href="/dashboard/welcome" className="ms-3 inline-flex h-11 items-center text-sm font-semibold underline">
        Go to the lessons
      </Link>
    </section>
  );
}

function TranslatedLesson({
  lesson,
  selected,
  onSelect,
  pending,
  note,
}: {
  lesson: WelcomeState['lessons'][number];
  selected: number | null;
  onSelect: (choice: number) => void;
  pending: boolean;
  note: string;
}) {
  const source = lessonTranslationFields(lesson);
  const translation = useContentTranslation(`welcome:${lesson.id}`, source, readLanguage(), true);
  const values = translation.values;
  const shown = {
    ...lesson,
    title: values.title || lesson.title,
    body: values.body || lesson.body,
    question: values.question || lesson.question,
    options: [values.option0 || lesson.options[0], values.option1 || lesson.options[1], values.option2 || lesson.options[2]] as [string, string, string],
    actionLabel: values.action || lesson.actionLabel,
  };
  return (
    <div dir={translation.dir}>
      {translation.autoTranslated && (
        <button type="button" onClick={translation.toggle} className="mb-2 text-xs font-semibold text-blue-deep">
          {translation.showOriginal ? 'Show translation' : 'Show English'}
        </button>
      )}
      <WelcomeLessonCard lesson={shown} selected={lesson.checkCorrect ? null : selected} onSelect={onSelect} pending={pending} note={note} />
    </div>
  );
}

export function WelcomePlayer() {
  const { state, send } = useWelcome();
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    const onFocus = () => {
      const href = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      void send('visit', { href }).catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [send]);

  if (!state) {
    return <p className="text-sm text-muted-foreground">The welcome course opens when you are signed in.</p>;
  }

  const current = state.lessons.find((lesson) => !lesson.done) ?? state.lessons[state.lessons.length - 1];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="rounded-3xl bg-hero p-6 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-bright">Poket School · free welcome</p>
        <h1 className="mt-1 font-heading text-4xl">{state.trackTitle}</h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">{state.blurb} A star lands when the check is right and the task is ticked. No Sparks.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-2xl bg-white px-3 py-2 text-ink">
            <WelcomeStars count={state.stars} total={state.total} />
          </span>
          <span className="rounded-full bg-blue-bright text-ink px-3 py-1 text-xs font-bold">{state.streak} lesson streak</span>
        </div>
      </header>
      <ol className="grid gap-2 sm:grid-cols-2">
        {state.lessons.map((lesson, index) => (
          <li key={lesson.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-2 text-sm">
            <span className={lesson.done ? 'font-semibold text-ink' : 'text-muted-foreground'}>{index + 1}. {lesson.title}</span>
            <span className={lesson.done ? 'text-blue-deep' : 'text-ink/25'} aria-hidden>★</span>
          </li>
        ))}
      </ol>
      {state.complete ? <WelcomeFinish state={state} /> : current && (
        <TranslatedLesson
          lesson={current}
          selected={picked}
          pending={pending}
          note={note}
          onSelect={(choice) => {
            setPicked(choice);
            setPending(true);
            setNote('');
            void send('answer', { lessonId: current.id, choice }).then((next) => {
              setNote(next?.correct ? 'That check is in.' : 'Try another answer.');
              if (next?.correct) setPicked(null);
            }).catch(() => setNote('That answer could not be saved.')).finally(() => setPending(false));
          }}
        />
      )}
    </div>
  );
}
