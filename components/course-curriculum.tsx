'use client';

/**
 * Course curriculum accordion — the "Course content" section a learner scans
 * before enrolling: chapters they can expand, every lesson with its type,
 * duration and what study formats it already carries.
 *
 * It works for both states. Before enrolment the lessons are listed but not
 * linked, with the first one openable as a free preview; after enrolment every
 * lesson links straight into the player.
 */

import { useState } from 'react';
import Link from 'next/link';
import type { Lesson, Module } from '@/lib/db';
import {
  ChevronDown, FileText, Video, ClipboardList, Award, Radio, FolderOpen,
  Lock, PlayCircle, CheckCircle2,
} from 'lucide-react';

export interface CurriculumUnit { module: Module; lessons: Lesson[] }

const TYPE_META: Record<string, { icon: typeof FileText; label: string }> = {
  lesson: { icon: FileText, label: 'Lesson' },
  video: { icon: Video, label: 'Video' },
  assignment: { icon: ClipboardList, label: 'Assignment' },
  assessment: { icon: Award, label: 'Assessment' },
  live: { icon: Radio, label: 'Live session' },
  resource: { icon: FolderOpen, label: 'Resources' },
};

/** Minutes → "1h 20m" / "45m", the way a course listing states length. */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes < 1) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Total teaching minutes across every lesson in the course. */
export function totalMinutes(units: CurriculumUnit[]): number {
  return units.reduce(
    (sum, u) => sum + u.lessons.reduce((n, l) => n + (l.durationMinutes ?? 0), 0),
    0,
  );
}

export function lessonCount(units: CurriculumUnit[]): number {
  return units.reduce((n, u) => n + u.lessons.length, 0);
}

/** Study formats a lesson already has generated, for the "includes" chips. */
function lessonFormats(lesson: Lesson): string[] {
  const o = lesson.aiOutputs;
  if (!o) return [];
  const out: string[] = [];
  if (o.videoScript) out.push('Video');
  if (o.audioScript) out.push('Audio');
  if (o.quiz?.length) out.push('Quiz');
  if (o.flashcards?.length) out.push('Flashcards');
  if (o.notes) out.push('Notes');
  if (o.mindmap) out.push('Mind map');
  if (o.slides?.length) out.push('Slides');
  return out;
}

export function CourseCurriculum({
  units, courseId, enrolled, completedLessonIds = [],
}: {
  units: CurriculumUnit[];
  courseId: string;
  /** Enrolled learners get real links; everyone else sees a locked list. */
  enrolled: boolean;
  completedLessonIds?: string[];
}) {
  // First chapter open by default: a collapsed list tells a visitor nothing.
  const [open, setOpen] = useState<Record<string, boolean>>(
    () => (units[0] ? { [units[0].module.id]: true } : {}),
  );
  const allOpen = units.length > 0 && units.every(u => open[u.module.id]);

  if (units.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        The chapter breakdown for this course is not published yet.
      </p>
    );
  }

  const done = new Set(completedLessonIds);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{units.length}</span> chapters
        </span>
        <span aria-hidden>·</span>
        <span>
          <span className="font-semibold text-foreground">{lessonCount(units)}</span> lessons
        </span>
        {totalMinutes(units) > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>
              <span className="font-semibold text-foreground">{formatDuration(totalMinutes(units))}</span> total
            </span>
          </>
        )}
        <button
          type="button"
          onClick={() => setOpen(allOpen ? {} : Object.fromEntries(units.map(u => [u.module.id, true])))}
          className="ml-auto text-sm font-semibold text-teal-700 hover:underline"
        >
          {allOpen ? 'Collapse all chapters' : 'Expand all chapters'}
        </button>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
        {units.map((u, ui) => {
          const isOpen = Boolean(open[u.module.id]);
          const mins = u.lessons.reduce((n, l) => n + (l.durationMinutes ?? 0), 0);
          return (
            <section key={u.module.id}>
              <button
                type="button"
                onClick={() => setOpen(p => ({ ...p, [u.module.id]: !p[u.module.id] }))}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-muted/40 hover:bg-muted/70 transition-colors"
              >
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? '' : '-rotate-90'}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-foreground truncate">
                    {u.module.unitNumber ? `Chapter ${u.module.unitNumber}: ` : ''}{u.module.title}
                  </span>
                  {u.module.description && (
                    <span className="block text-xs text-muted-foreground truncate mt-0.5">{u.module.description}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                  {u.lessons.length} lesson{u.lessons.length === 1 ? '' : 's'}
                  {mins > 0 && ` · ${formatDuration(mins)}`}
                </span>
              </button>

              {isOpen && (
                <ul className="divide-y divide-border/60">
                  {u.lessons.map((l, li) => {
                    const meta = TYPE_META[l.lessonType ?? 'lesson'] ?? TYPE_META.lesson;
                    const Icon = meta.icon;
                    // One free preview per course: the very first lesson.
                    const previewable = ui === 0 && li === 0;
                    const unlocked = enrolled || previewable;
                    const formats = lessonFormats(l);
                    const isDone = done.has(l.id);

                    const row = (
                      <span className="flex items-start gap-3 px-4 py-3">
                        <span className="shrink-0 mt-0.5">
                          {isDone
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            : unlocked
                              ? <PlayCircle className="w-4 h-4 text-teal-600" />
                              : <Lock className="w-4 h-4 text-muted-foreground/60" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className={`text-sm ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {l.title}
                            </span>
                            {previewable && !enrolled && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
                                Free preview
                              </span>
                            )}
                            {l.isUnitQuiz && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                                Mastery quiz
                              </span>
                            )}
                          </span>
                          {formats.length > 0 && (
                            <span className="block mt-1 text-[11px] text-muted-foreground">
                              Includes {formats.join(' · ')}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 flex items-center gap-2 text-[11px] text-muted-foreground whitespace-nowrap">
                          <Icon className="w-3.5 h-3.5" />
                          {l.durationMinutes ? formatDuration(l.durationMinutes) : meta.label}
                        </span>
                      </span>
                    );

                    return (
                      <li key={l.id}>
                        {unlocked ? (
                          <Link
                            href={`/dashboard/student/courses/${courseId}/lessons/${l.id}`}
                            className="block hover:bg-muted/40 transition-colors"
                          >
                            {row}
                          </Link>
                        ) : (
                          <span className="block cursor-default">{row}</span>
                        )}
                      </li>
                    );
                  })}
                  {u.lessons.length === 0 && (
                    <li className="px-4 py-3 text-xs text-muted-foreground">No lessons in this chapter yet.</li>
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
