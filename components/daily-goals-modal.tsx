'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createDailyGoal, goalDateKey, type GoalCategory } from '@/lib/db';
import { greeting } from '@/lib/greeting';
import { GOAL_ON_TIME_BONUS } from '@/lib/sparks';
import { isAssignedSource, sourceLabel, type PlanLink } from '@/lib/study/planner';
import { toast } from 'sonner';
import { CloseControl, confirmIfDirty, useLayerDismiss } from '@/components/ui/close-control';
import {
  BookMarked, BookOpen, ClipboardList, GripVertical, Loader2, PenLine, Plus, RotateCcw, Star, Target, Trash2, User,
} from 'lucide-react';

const MAX_GOALS = 5;

const CHIPS: { value: GoalCategory; label: string; icon: typeof BookOpen }[] = [
  { value: 'study', label: 'Study', icon: BookOpen },
  { value: 'homework', label: 'Homework', icon: ClipboardList },
  { value: 'revision', label: 'Revision', icon: RotateCcw },
  { value: 'reading', label: 'Reading', icon: BookMarked },
  { value: 'practice', label: 'Practice test', icon: PenLine },
  { value: 'personal', label: 'Personal', icon: User },
];

const ESTIMATES = [15, 30, 45, 60];

export interface CheckInDraft {
  key: string;
  title: string;
  category: GoalCategory;
  estimateMinutes: number;
  deadline: string;
  priorityStar: boolean;
  source: 'self' | 'et_ai' | 'teacher' | 'parent';
  locked: boolean;
  persisted: boolean;
  link?: PlanLink;
  courseId?: string;
  courseLabel?: string;
  reason?: string;
}

export interface ReviewGoal {
  id: string;
  title: string;
  done: boolean;
}

interface Props {
  open: boolean;
  mode?: 'commit' | 'review';
  studentId: string;
  studentName: string;
  suggestions?: CheckInDraft[];
  assigned?: CheckInDraft[];
  streak?: number;
  minutesLeft?: number;
  reviewGoals?: ReviewGoal[];
  onDone: () => void;
  onToggleReview?: (id: string) => void;
}

function blankDraft(): CheckInDraft {
  return {
    key: `self-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    category: 'study',
    estimateMinutes: 30,
    deadline: '',
    priorityStar: false,
    source: 'self',
    locked: false,
    persisted: false,
  };
}

export function DailyGoalsModal({
  open,
  mode = 'commit',
  studentId,
  studentName,
  suggestions = [],
  assigned = [],
  streak = 0,
  minutesLeft = 0,
  reviewGoals = [],
  onDone,
  onToggleReview,
}: Props) {
  const [drafts, setDrafts] = useState<CheckInDraft[]>([blankDraft()]);
  const [saving, setSaving] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const firstName = (studentName || 'there').split(' ')[0];

  useEffect(() => {
    if (!open || mode !== 'commit') return;
    const seeded = assigned.length ? assigned : [];
    setDrafts(seeded.length ? [...seeded, blankDraft()] : [blankDraft()]);
  }, [open, mode, assigned]);

  const planned = useMemo(
    () => drafts.filter((draft) => draft.title.trim()).reduce((sum, draft) => sum + draft.estimateMinutes, 0),
    [drafts],
  );
  const filled = drafts.filter((draft) => draft.title.trim());

  const update = (key: string, patch: Partial<CheckInDraft>) => {
    setDrafts((prev) => prev.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));
  };

  const addRow = () => {
    setDrafts((prev) => (prev.length >= MAX_GOALS ? prev : [...prev, blankDraft()]));
  };

  const removeRow = (key: string) => {
    setDrafts((prev) => prev.filter((draft) => draft.key !== key || draft.locked));
  };

  const onDrag = (from: string, to: string) => {
    if (!to || from === to) return;
    setDrafts((prev) => {
      const next = [...prev];
      const start = next.findIndex((draft) => draft.key === from);
      const end = next.findIndex((draft) => draft.key === to);
      if (start < 0 || end < 0) return prev;
      const [row] = next.splice(start, 1);
      next.splice(end, 0, row);
      return next;
    });
  };

  const saveRows = async (rows: CheckInDraft[]) => {
    const dateKey = goalDateKey();
    await Promise.all(rows.filter((row) => !row.persisted && row.title.trim()).map((row, index) => createDailyGoal({
      studentId,
      studentName: studentName || 'Student',
      dateKey,
      title: row.title.trim(),
      category: row.category,
      estimateMinutes: row.estimateMinutes,
      deadline: row.deadline || '23:59',
      status: 'not_started',
      source: row.source,
      link: row.link,
      courseId: row.courseId,
      courseLabel: row.courseLabel,
      priorityStar: row.priorityStar,
      priority: row.priorityStar ? 'high' : 'medium',
      parentVisibility: true,
      private: false,
      order: index,
      assignedByName: row.source === 'et_ai' ? 'ET AI' : row.source === 'teacher' ? 'Teacher' : row.source === 'parent' ? 'Parent' : undefined,
    })));
  };

  const handleCommit = async () => {
    if (!studentId || saving || filled.length === 0) return;
    setSaving(true);
    try {
      await saveRows(filled);
      toast.success(`${filled.length} goal${filled.length === 1 ? '' : 's'} set for today.`);
      onDone();
    } catch {
      toast.error('Could not save your goals. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    const locked = drafts.filter((draft) => draft.locked && !draft.persisted && draft.title.trim());
    setSaving(true);
    try {
      if (locked.length && studentId) await saveRows(locked);
      onDone();
    } catch {
      toast.error('Could not keep the assigned goals.');
    } finally {
      setSaving(false);
    }
  };

  const unsaved = mode === 'commit' && drafts.some((draft) => !draft.locked && !draft.persisted && draft.title.trim().length > 0);
  const finish = () => {
    if (mode === 'review') onDone();
    else void handleSkip();
  };
  useLayerDismiss(open, finish, unsaved);

  const doneCount = reviewGoals.filter((goal) => goal.done).length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="daily-goals-gate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#203337]/80 p-3 backdrop-blur-md sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="goals-checkin-title"
          onMouseDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (!confirmIfDirty(unsaved)) return;
            finish();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative my-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-[#1E6A83] bg-white shadow-[0_24px_80px_-20px_rgba(32,51,55,0.45)]"
          >
            <CloseControl onClose={finish} dirty={unsaved} className="absolute top-3 right-3 z-10 bg-white text-[#203337] hover:bg-white" />
            <div className="relative overflow-hidden p-6 text-white" style={{ background: 'var(--ps-hero)' }}>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#1E6A83] bg-[#3FE0D0] font-heading text-lg text-[#203337]" aria-hidden>
                  ET
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">ET AI</p>
                  <p id="goals-checkin-title" className="mt-2 text-[15px] leading-relaxed">
                    {greeting()} {firstName}. Before you start — what are you committing to today? Set your goals and I&apos;ll check in with you.
                  </p>
                </div>
              </div>
            </div>

            {mode === 'review' ? (
              <div className="space-y-4 p-5 sm:p-6">
                <h2 className="font-heading text-2xl text-[#203337]">Check in</h2>
                <p className="text-sm text-[#1E6A83]">Tick what you finished. Assigned goals stay on the list until they are done.</p>
                <ul className="space-y-2">
                  {reviewGoals.map((goal) => (
                    <li key={goal.id}>
                      <label className="flex items-center gap-3 rounded-2xl border border-[#E7EDED] px-3 py-2 text-sm text-[#203337]">
                        <input type="checkbox" checked={goal.done} onChange={() => onToggleReview?.(goal.id)} />
                        <span className={goal.done ? 'line-through text-[#5F7074]' : ''}>{goal.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                {celebrate || (reviewGoals.length > 0 && doneCount === reviewGoals.length) ? (
                  <p className="rounded-2xl bg-[#E9F7FA] px-4 py-3 text-sm font-semibold text-[#1E6A83]" role="status">
                    That is the day. {doneCount} of {reviewGoals.length} done, and the streak stays intact.
                  </p>
                ) : null}
                <div className="flex justify-end">
                  <button type="button" className="rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-5 py-2 text-sm font-semibold text-[#203337]" onClick={() => { setCelebrate(doneCount === reviewGoals.length && reviewGoals.length > 0); onDone(); }}>
                    Close check-in
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="max-h-[58vh] space-y-4 overflow-y-auto p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Target className="h-4 w-4 text-[#1E6A83]" aria-hidden />
                    <h2 className="font-heading text-2xl text-[#203337]">Today&apos;s goals</h2>
                    <span className="ml-auto text-xs text-[#1E6A83]">{filled.length}/{MAX_GOALS}</span>
                  </div>
                  <p className="text-sm text-[#1E6A83]">
                    {planned} min planned · {minutesLeft} min left today · streak {streak} · {GOAL_ON_TIME_BONUS} Sparks for an on-time goal
                  </p>
                  {suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2" aria-label="Suggestions">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion.key}
                          type="button"
                          className="rounded-full border border-[#1E6A83] bg-white px-3 py-1.5 text-left text-xs font-semibold text-[#1E6A83]"
                          onClick={() => setDrafts((prev) => {
                            if (prev.some((draft) => draft.title === suggestion.title) || prev.length >= MAX_GOALS) return prev;
                            const empty = prev.findIndex((draft) => !draft.title.trim() && !draft.locked);
                            if (empty >= 0) {
                              const next = [...prev];
                              next[empty] = { ...suggestion, key: prev[empty].key };
                              return next;
                            }
                            return [...prev, suggestion];
                          })}
                        >
                          {suggestion.title}
                        </button>
                      ))}
                    </div>
                  )}
                  {drafts.map((draft, index) => (
                    <article
                      key={draft.key}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData('text/plain', draft.key)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        onDrag(event.dataTransfer.getData('text/plain'), draft.key);
                      }}
                      className="space-y-3 rounded-2xl border border-[#E7EDED] bg-[#F7FBFC] p-4"
                    >
                      <div className="flex items-center gap-2">
                        <button type="button" className="text-[#1E6A83]" aria-label={`Reorder goal ${index + 1}`}>
                          <GripVertical className="h-4 w-4" />
                        </button>
                        <label className="sr-only" htmlFor={`goal-${draft.key}`}>Goal {index + 1}</label>
                        <input
                          id={`goal-${draft.key}`}
                          value={draft.title}
                          readOnly={draft.locked}
                          placeholder="e.g. Finish algebra worksheet"
                          className="h-10 flex-1 rounded-full border border-[#E7EDED] bg-white px-3 text-sm text-[#203337]"
                          onChange={(event) => update(draft.key, { title: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              addRow();
                            }
                          }}
                        />
                        <button
                          type="button"
                          aria-pressed={draft.priorityStar}
                          aria-label={draft.priorityStar ? 'Remove priority' : 'Mark as priority'}
                          className={draft.priorityStar ? 'text-[#1E6A83]' : 'text-[#5F7074]'}
                          onClick={() => update(draft.key, { priorityStar: !draft.priorityStar })}
                        >
                          <Star className="h-4 w-4" fill={draft.priorityStar ? 'currentColor' : 'none'} />
                        </button>
                        {!draft.locked && drafts.length > 1 && (
                          <button type="button" aria-label="Remove goal" className="text-[#203337]" onClick={() => removeRow(draft.key)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {draft.locked && <p className="text-xs font-semibold text-[#1E6A83]">{sourceLabel(draft.source)}. This one stays on the list.</p>}
                      <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
                        {CHIPS.map((chip) => {
                          const Icon = chip.icon;
                          const on = draft.category === chip.value;
                          return (
                            <button
                              key={chip.value}
                              type="button"
                              aria-pressed={on}
                              disabled={draft.locked}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${on ? 'border-[#1E6A83] bg-[#3FE0D0] text-[#203337]' : 'border-[#E7EDED] bg-white text-[#1E6A83]'}`}
                              onClick={() => update(draft.key, { category: chip.value })}
                            >
                              <Icon className="h-3.5 w-3.5" aria-hidden /> {chip.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-[#1E6A83]">Estimate</span>
                        {ESTIMATES.map((minutes) => (
                          <button
                            key={minutes}
                            type="button"
                            aria-pressed={draft.estimateMinutes === minutes}
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${draft.estimateMinutes === minutes ? 'border-[#1E6A83] bg-[#3FE0D0] text-[#203337]' : 'border-[#E7EDED] bg-white text-[#203337]'}`}
                            onClick={() => update(draft.key, { estimateMinutes: minutes })}
                          >
                            {minutes}
                          </button>
                        ))}
                        <label className="text-xs text-[#1E6A83]">
                          Custom
                          <input
                            type="number"
                            min={5}
                            max={180}
                            aria-label="Custom minutes"
                            className="ml-2 h-8 w-16 rounded-full border border-[#E7EDED] px-2 text-[#203337]"
                            value={ESTIMATES.includes(draft.estimateMinutes) ? '' : draft.estimateMinutes}
                            onChange={(event) => update(draft.key, { estimateMinutes: Math.max(5, Number(event.target.value) || 15) })}
                          />
                        </label>
                      </div>
                      <label className="flex flex-wrap items-center gap-2 text-xs text-[#1E6A83]">
                        Deadline
                        <input
                          type="time"
                          value={draft.deadline}
                          aria-label="Deadline"
                          className="h-8 rounded-full border border-[#E7EDED] bg-white px-2 text-[#203337]"
                          onChange={(event) => update(draft.key, { deadline: event.target.value })}
                        />
                        <button type="button" className="rounded-full border border-[#E7EDED] px-2 py-1 text-[#203337]" onClick={() => update(draft.key, { deadline: '' })}>
                          No deadline
                        </button>
                      </label>
                    </article>
                  ))}
                  {drafts.length < MAX_GOALS && (
                    <button type="button" className="inline-flex items-center gap-2 rounded-full border border-[#E7EDED] px-4 py-2 text-sm font-semibold text-[#203337]" onClick={addRow}>
                      <Plus className="h-4 w-4" /> Add another goal
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-3 border-t border-[#E7EDED] bg-[#F7FBFC] p-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[#203337]">
                    {filled.length === 0 ? 'Add a goal, or skip and come back later.' : `You're committing to ${filled.length} goal${filled.length === 1 ? '' : 's'} today.`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded-full border border-[#E7EDED] px-4 py-2 text-sm font-semibold text-[#203337]" onClick={() => { void handleSkip(); }} disabled={saving}>
                      Skip for today
                    </button>
                    <button
                      type="button"
                      disabled={saving || filled.length === 0}
                      onClick={() => { void handleCommit(); }}
                      className="inline-flex items-center gap-2 rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-5 py-2 text-sm font-bold text-[#203337] disabled:border-[#E7EDED] disabled:bg-[#E7EDED] disabled:text-[#203337]"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                      Commit to today
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function assignedDraftsFromGoals(goals: { id: string; title: string; category: GoalCategory; estimateMinutes: number; deadline: string; source?: string; link?: PlanLink; courseId?: string; courseLabel?: string }[]): CheckInDraft[] {
  return goals.filter((goal) => isAssignedSource(goal.source)).map((goal) => ({
    key: goal.id,
    title: goal.title,
    category: goal.category,
    estimateMinutes: goal.estimateMinutes,
    deadline: goal.deadline === '23:59' ? '' : goal.deadline,
    priorityStar: false,
    source: goal.source === 'teacher' || goal.source === 'parent' ? goal.source : 'et_ai',
    locked: true,
    persisted: true,
    link: goal.link,
    courseId: goal.courseId,
    courseLabel: goal.courseLabel,
  }));
}

export default DailyGoalsModal;
