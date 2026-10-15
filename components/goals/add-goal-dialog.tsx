'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { checklistId, type GoalCategory, type GoalDraft, type GoalRecurrence, type GoalTargetKind } from '@/lib/insights/goals';
import { GOAL_ON_TIME_BONUS, GOAL_STREAK_BONUS } from '@/lib/sparks';
import { isoDateKey } from '@/lib/insights/dates';

const CATEGORIES: GoalCategory[] = ['study', 'revision', 'practice', 'reading', 'other'];

function defaultDeadline(): string {
  const d = new Date();
  d.setHours(d.getHours() + 2);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function AddGoalDialog({
  open, onClose, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (draft: GoalDraft) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GoalCategory>('study');
  const [estimateMinutes, setEstimateMinutes] = useState(25);
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [dateKey, setDateKey] = useState(isoDateKey());
  const [endDate, setEndDate] = useState('');
  const [recurrence, setRecurrence] = useState<GoalRecurrence>('none');
  const [targetKind, setTargetKind] = useState<GoalTargetKind>('free_text');
  const [freeTextTarget, setFreeTextTarget] = useState('');
  const [unitTitle, setUnitTitle] = useState('');
  const [lessons, setLessons] = useState('');
  const [checkText, setCheckText] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onCreate({
        title: title.trim(),
        category,
        estimateMinutes,
        deadline,
        dateKey,
        endDate: endDate || undefined,
        recurrence,
        targetKind,
        freeTextTarget: freeTextTarget.trim() || undefined,
        unitTitle: unitTitle.trim() || undefined,
        lessonIds: lessons.split('\n').map(l => l.trim()).filter(Boolean),
        checklist: checkText.split('\n').map(l => l.trim()).filter(Boolean).map(label => ({ id: checklistId(), label, done: false })),
        reminderMinutes,
      });
      setTitle('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="add-goal-title">
      <div className="bg-card border border-border rounded-2xl shadow-[var(--shadow-card)] w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">New goal</p>
          <h2 id="add-goal-title" className="font-heading text-2xl text-foreground">Add a goal</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Finish on time and the server adds {GOAL_ON_TIME_BONUS} Sparks, plus {GOAL_STREAK_BONUS} when the streak reaches three days.
          </p>
        </div>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What will you finish?" aria-label="Goal title" />
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(item => (
            <button key={item} type="button" onClick={() => setCategory(item)}
              className={`h-8 px-3 rounded-full text-xs font-semibold capitalize ${category === item ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {item}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted-foreground">Date
            <Input type="date" value={dateKey} onChange={e => setDateKey(e.target.value)} className="mt-1" />
          </label>
          <label className="text-xs text-muted-foreground">Deadline
            <Input type="time" value={deadline} onChange={e => setDeadline(e.target.value)} className="mt-1" />
          </label>
          <label className="text-xs text-muted-foreground">Minutes
            <Input type="number" min={5} max={180} value={estimateMinutes} onChange={e => setEstimateMinutes(Number(e.target.value) || 25)} className="mt-1" />
          </label>
          <label className="text-xs text-muted-foreground">Repeats
            <select value={recurrence} onChange={e => setRecurrence(e.target.value as GoalRecurrence)} className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2 text-sm">
              <option value="none">Once</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
        </div>
        {recurrence !== 'none' && (
          <label className="text-xs text-muted-foreground">Repeat until
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1" />
          </label>
        )}
        <div className="flex gap-1.5">
          {(['free_text', 'unit', 'lessons'] as GoalTargetKind[]).map(kind => (
            <button key={kind} type="button" onClick={() => setTargetKind(kind)}
              className={`h-8 px-3 rounded-full text-xs font-semibold ${targetKind === kind ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
              {kind === 'free_text' ? 'Free text' : kind === 'unit' ? 'A unit' : 'Lessons'}
            </button>
          ))}
        </div>
        {targetKind === 'free_text' && (
          <Input value={freeTextTarget} onChange={e => setFreeTextTarget(e.target.value)} placeholder="Describe the target" aria-label="Free text target" />
        )}
        {targetKind === 'unit' && (
          <Input value={unitTitle} onChange={e => setUnitTitle(e.target.value)} placeholder="Unit name" aria-label="Unit" />
        )}
        {targetKind === 'lessons' && (
          <textarea value={lessons} onChange={e => setLessons(e.target.value)} placeholder="One lesson per line" rows={3} className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
        )}
        <textarea value={checkText} onChange={e => setCheckText(e.target.value)} placeholder="Checklist, one step per line" rows={3} className="w-full rounded-lg border border-border bg-background p-2 text-sm" aria-label="Checklist" />
        <label className="text-xs text-muted-foreground">Remind me (minutes before)
          <Input type="number" min={0} value={reminderMinutes} onChange={e => setReminderMinutes(Number(e.target.value) || 0)} className="mt-1" />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Save goal'}</Button>
        </div>
      </div>
    </div>
  );
}
