'use client';

import { useState } from 'react';
import { ModeSwitch } from '@/components/account/mode-switch';
import { MODE_NAMES, writeActiveMode, type AccountMode } from '@/lib/account-modes';

export function ModePreview({
  initialMode,
  menuOpen,
  learner,
}: {
  initialMode: AccountMode;
  menuOpen: boolean;
  learner: boolean;
}) {
  const [mode, setMode] = useState<AccountMode>(initialMode);
  const [open, setOpen] = useState(menuOpen);
  const [teachingOn, setTeachingOn] = useState(!learner);
  const [headline, setHeadline] = useState('');
  const [accepted, setAccepted] = useState(false);
  const modes: AccountMode[] = teachingOn
    ? (learner ? ['student', 'teacher'] : ['student', 'teacher', 'parent'])
    : ['student'];

  const choose = (next: AccountMode) => {
    writeActiveMode(next);
    setMode(next);
    setOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground" data-mode-preview data-active-mode={mode}>
      <header className="flex h-[72px] items-center justify-between gap-4 border-b border-border px-6">
        <p className="font-heading text-lg">Poket School</p>
        <div className="flex items-center gap-3">
          <ModeSwitch
            modes={modes}
            active={mode}
            onSwitch={choose}
            onBecomeInstructor={!teachingOn ? () => setOpen(true) : undefined}
          />
          <button
            type="button"
            aria-label="Account menu"
            className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
            onClick={() => setOpen(value => !value)}
          >
            S
          </button>
        </div>
      </header>
      {open && (
        <div role="menu" data-account-menu className="absolute end-6 top-16 z-10 w-72 rounded-2xl border border-border bg-card p-2 shadow-lg">
          <div className="px-2 py-2">
            <p className="text-sm font-semibold">Sara Rahman</p>
            <p className="text-xs text-muted-foreground">{MODE_NAMES[mode]}</p>
          </div>
          <ModeSwitch
            layout="menu"
            modes={modes}
            active={mode}
            onSwitch={choose}
            onBecomeInstructor={!teachingOn ? () => setOpen(true) : undefined}
          />
          <p className="px-2 py-2 text-sm font-semibold">My profile & settings</p>
        </div>
      )}
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {mode === 'student' && (
          <section data-learner-shelf className="space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Learning</p>
            <h1 className="font-heading text-4xl">Your learning space</h1>
            <p className="text-sm text-muted-foreground">Your courses, progress, certificates, and Sparks. Classes you teach and children you monitor stay in the other views.</p>
            <article data-enrollment className="rounded-3xl border border-border bg-card p-5">
              <h2 className="font-heading text-2xl">Cells and systems</h2>
              <p className="text-sm text-muted-foreground">Progress 40%</p>
            </article>
            <article data-certificate className="rounded-3xl border border-border bg-card p-5">
              <h2 className="font-heading text-2xl">Science skills</h2>
              <p className="text-sm text-muted-foreground">Certificate</p>
            </article>
            <p data-learner-sparks className="text-lg font-semibold">Sparks 120</p>
            {!teachingOn && (
              <form
                data-become-flow
                className="space-y-4 rounded-3xl border border-border bg-card p-6"
                onSubmit={event => {
                  event.preventDefault();
                  const box = event.currentTarget.querySelector('input[type="checkbox"]');
                  const agreed = box instanceof HTMLInputElement && box.checked;
                  if (!agreed || !headline.trim()) return;
                  setTeachingOn(true);
                  choose('teacher');
                }}
              >
                <h2 className="font-heading text-2xl">Become an instructor</h2>
                <p data-marketplace-gate className="text-sm text-muted-foreground">
                  Marketplace publishing stays in review until Poket School publishes the course. This step does not list a course for sale.
                </p>
                <label className="block text-sm font-semibold">
                  Headline
                  <input className="mt-1 w-full rounded-xl border border-border px-3 py-2" value={headline} onChange={event => setHeadline(event.target.value)} placeholder="e.g. Lower Secondary science" />
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={accepted} onChange={event => setAccepted(event.target.checked)} />
                  <span>I understand a marketplace course stays in review until Poket School publishes it.</span>
                </label>
                <button type="submit" className="h-10 rounded-full bg-[#203337] px-4 text-sm font-semibold text-white">Become an instructor</button>
              </form>
            )}
          </section>
        )}
        {mode === 'teacher' && (
          <section data-teaching-shelf className="space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Teaching</p>
            <h1 className="font-heading text-4xl">Classes you teach</h1>
            <p className="text-sm text-muted-foreground">Your own courses, certificates, and Sparks stay in Learning.</p>
            <article className="rounded-3xl border border-border bg-card p-5">
              <h2 className="font-heading text-2xl">Class 8A</h2>
              <p className="text-sm text-muted-foreground">24 students</p>
            </article>
          </section>
        )}
        {mode === 'parent' && (
          <section data-parent-shelf className="space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Parent view</p>
            <h1 className="font-heading text-4xl">Children you monitor</h1>
            <p className="text-sm text-muted-foreground">Your own courses, certificates, and Sparks stay in Learning.</p>
            <article className="rounded-3xl border border-border bg-card p-5">
              <h2 className="font-heading text-2xl">Amina Yusuf</h2>
              <p className="text-sm text-muted-foreground">Lower Secondary · weekly report on</p>
            </article>
          </section>
        )}
        <p className="text-xs text-muted-foreground">Admin accounts stay on the admin sign-in page, with a verification code. This preview does not change a live account.</p>
      </main>
    </div>
  );
}
