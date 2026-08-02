'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createDailyGoal, goalDateKey, GoalCategory } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Sparkles, Target } from 'lucide-react';

const CATEGORY_OPTIONS: { value: GoalCategory; label: string }[] = [
  { value: 'study', label: 'Study' },
  { value: 'revision', label: 'Revision' },
  { value: 'practice', label: 'Practice' },
  { value: 'reading', label: 'Reading' },
  { value: 'other', label: 'Other' },
];

const ESTIMATE_OPTIONS = [15, 30, 45, 60, 90];

const MAX_GOALS = 5;

interface Draft {
  key: string;
  title: string;
  category: GoalCategory;
  estimateMinutes: number;
  deadline: string;
}

/** Sensible default deadline: two hours from now, rounded to the next quarter. */
function defaultDeadline(offsetHours = 2): string {
  const d = new Date();
  d.setHours(d.getHours() + offsetHours);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function blankDraft(offsetHours = 2): Draft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    category: 'study',
    estimateMinutes: 30,
    deadline: defaultDeadline(offsetHours),
  };
}

interface Props {
  open: boolean;
  studentId: string;
  studentName: string;
  onDone: () => void;
}

/**
 * Full-screen, non-dismissible goal-setting gate. Students land here before they
 * can start any module for the day — Ayla asks for the commitment up front.
 */
export function DailyGoalsModal({ open, studentId, studentName, onDone }: Props) {
  const [drafts, setDrafts] = useState<Draft[]>([blankDraft()]);
  const [saving, setSaving] = useState(false);

  const firstName = (studentName || 'there').split(' ')[0];
  const valid = drafts.filter(d => d.title.trim().length > 0);

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts(prev => prev.map(d => (d.key === key ? { ...d, ...patch } : d)));

  const addRow = () =>
    setDrafts(prev => (prev.length >= MAX_GOALS ? prev : [...prev, blankDraft(2 + prev.length)]));

  const removeRow = (key: string) =>
    setDrafts(prev => (prev.length === 1 ? prev : prev.filter(d => d.key !== key)));

  const handleSubmit = async () => {
    if (!studentId || valid.length === 0 || saving) return;
    setSaving(true);
    try {
      const dateKey = goalDateKey();
      await Promise.all(
        valid.map(d =>
          createDailyGoal({
            studentId,
            studentName: studentName || 'Student',
            dateKey,
            title: d.title.trim(),
            category: d.category,
            estimateMinutes: d.estimateMinutes,
            deadline: d.deadline || '23:59',
            status: 'not_started',
          })
        )
      );
      toast.success(`${valid.length} goal${valid.length !== 1 ? 's' : ''} set for today.`);
      setDrafts([blankDraft()]);
      onDone();
    } catch {
      toast.error('Could not save your goals. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="daily-goals-gate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-[#070B14]/80 backdrop-blur-md overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Set your daily goals"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.21, 0.6, 0.35, 1] }}
            className="relative w-full max-w-2xl my-auto bg-card border border-border rounded-[2rem] overflow-hidden shadow-[0_24px_80px_-20px_rgba(15,23,42,0.45)]"
          >
            {/* Ayla band */}
            <div className="relative bg-[#070B14] p-6 sm:p-7 text-white overflow-hidden">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-[#1A73E8]/30 blur-[80px]" />
                <div className="absolute -bottom-24 -right-10 w-72 h-72 rounded-full bg-[#7C3AED]/25 blur-[80px]" />
              </div>
              <div className="relative flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1A73E8] to-[#7C3AED] flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(26,115,232,0.45)]">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">Ayla · AI Tutor</p>
                  <p className="text-[15px] leading-relaxed mt-2 text-white/90">
                    Good morning {firstName}. Before you start — what are you committing to today? Set your goals and
                    I&apos;ll check in with you.
                  </p>
                </div>
              </div>
            </div>

            {/* Drafts */}
            <div className="p-5 sm:p-7 space-y-4 max-h-[55vh] overflow-y-auto">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h2 className="font-heading text-2xl text-foreground">Today&apos;s goals</h2>
                <span className="text-xs text-muted-foreground ml-auto">{valid.length}/{MAX_GOALS}</span>
              </div>

              {drafts.map((d, i) => (
                <div key={d.key} className="bg-muted/30 border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <Input
                      value={d.title}
                      onChange={e => update(d.key, { title: e.target.value })}
                      placeholder="e.g. Finish algebra worksheet"
                      className="rounded-full h-10 flex-1"
                    />
                    {drafts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(d.key)}
                        aria-label="Remove goal"
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Category</span>
                      <select
                        value={d.category}
                        onChange={e => update(d.key, { category: e.target.value as GoalCategory })}
                        className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                      >
                        {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Estimate</span>
                      <select
                        value={d.estimateMinutes}
                        onChange={e => update(d.key, { estimateMinutes: Number(e.target.value) })}
                        className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                      >
                        {ESTIMATE_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Deadline</span>
                      <input
                        type="time"
                        value={d.deadline}
                        onChange={e => update(d.key, { deadline: e.target.value })}
                        className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                      />
                    </label>
                  </div>
                </div>
              ))}

              {drafts.length < MAX_GOALS && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addRow}
                  className="rounded-full h-10 px-4 font-semibold gap-2 w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" /> Add another goal
                </Button>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-3 justify-between bg-muted/20">
              <p className="text-xs text-muted-foreground">
                {valid.length === 0
                  ? 'Add at least one goal to continue.'
                  : `You're committing to ${valid.length} goal${valid.length !== 1 ? 's' : ''} today.`}
              </p>
              <Button
                onClick={handleSubmit}
                disabled={saving || valid.length === 0}
                className="rounded-full h-11 px-6 font-bold bg-gradient-to-r from-[#1A73E8] to-[#7C3AED] text-white hover:opacity-90 transition-opacity gap-2 shrink-0"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Commit to today'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default DailyGoalsModal;
