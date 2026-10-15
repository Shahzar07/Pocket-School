'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DashPage, DashHeader, Panel, PanelHeader, StatCard, EmptyState } from '@/components/dash-ui';
import { FocusTimer } from '@/components/goals/focus-timer';
import { computeGoalStreak, type ChecklistItem, type GoalLike } from '@/lib/insights/goals';
import { weeklyInsights } from '@/lib/insights/analytics';
import { Flame, Target, Check } from 'lucide-react';
import { isoDateKey, addDays, weekdayOf } from '@/lib/insights/dates';

export interface WorkspaceGoal extends GoalLike {
  id: string;
  checklist?: ChecklistItem[];
  reflection?: string;
  progress?: number;
  cosignedBy?: string;
  source?: 'student' | 'parent' | 'ai';
  focusMinutes?: number;
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function GoalsWorkspace({
  goals,
  viewer,
  childName,
  onAdd,
  onToggle,
  onReflect,
  onComplete,
  onLogFocus,
  onAcceptSuggestion,
  onCosign,
  suggestions = [],
  insights,
}: {
  goals: WorkspaceGoal[];
  viewer: 'student' | 'parent';
  childName?: string;
  onAdd: () => void;
  onToggle: (goal: WorkspaceGoal, itemId: string) => void;
  onReflect: (goal: WorkspaceGoal, text: string) => void;
  onComplete: (goal: WorkspaceGoal) => void;
  onLogFocus: (goal: WorkspaceGoal, actual: number, planned: number) => void;
  onAcceptSuggestion?: (title: string, minutes: number, category: WorkspaceGoal['category']) => void;
  onCosign?: (goal: WorkspaceGoal) => void;
  suggestions?: { id: string; title: string; status: string }[];
  insights?: { retention: number | null; cramming: number | null; readiness: number | null; goalCompletion: number | null };
}) {
  const today = isoDateKey();
  const streak = computeGoalStreak(goals);
  const todayGoals = goals.filter(g => g.dateKey === today);
  const done = todayGoals.filter(g => g.status === 'completed').length;
  const [openId, setOpenId] = useState<string | null>(todayGoals[0]?.id ?? null);
  const cards = weeklyInsights({
    retention: insights?.retention ?? null,
    cramming: insights?.cramming ?? null,
    readiness: insights?.readiness ?? null,
    streak,
    weakBloom: null,
    goalCompletion: insights?.goalCompletion ?? (todayGoals.length ? Math.round((100 * done) / todayGoals.length) : null),
  });

  const week = useMemo(() => {
    const start = addDays(today, -weekdayOf(today));
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [today]);

  return (
    <DashPage>
      <DashHeader
        eyebrow={viewer === 'parent' ? 'Family' : 'Learning'}
        title={viewer === 'parent' ? 'Goals for' : 'Your goals'}
        accent={childName}
        description="A goal can cover a unit, a list of lessons, or a note to yourself. Lessons and quizzes move the progress. Parents can suggest and co-sign."
        actions={viewer === 'student' ? (
          <Button onClick={onAdd} className="h-10 px-4 rounded-xl font-semibold text-[13px]">Add goal</Button>
        ) : undefined}
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Target} label="Today" value={`${done}/${todayGoals.length || 0}`} index={0} />
        <StatCard icon={Flame} label="Streak" value={`${streak}d`} index={1} />
        <StatCard icon={Check} label="Co-signed" value={goals.filter(g => g.cosignedBy).length} index={2} />
      </div>

      <Panel>
        <PanelHeader title="This week" />
        <div className="grid grid-cols-7 gap-2">
          {week.map(day => {
            const items = goals.filter(g => g.dateKey === day);
            const finished = items.length > 0 && items.every(g => g.status === 'completed' || g.status === 'excused');
            return (
              <div key={day} className={`rounded-xl border p-2 min-h-24 ${day === today ? 'border-primary' : 'border-border'}`}>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">{DAY[weekdayOf(day)]}</p>
                <p className="text-xs font-semibold mb-1">{day.slice(8)}</p>
                {items.length === 0 && <p className="text-[10px] text-muted-foreground">—</p>}
                {items.slice(0, 3).map(g => (
                  <p key={g.id} className={`text-[10px] truncate ${finished ? 'text-primary' : ''}`}>{g.title}</p>
                ))}
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid lg:grid-cols-[1.4fr_0.8fr] gap-4">
        <Panel>
          <PanelHeader title={viewer === 'parent' ? 'Open goals' : 'Today'} />
          {todayGoals.length === 0 ? (
            <EmptyState icon={Target} title="Nothing set for today" body="Add a goal beside Resume learning, or from here." />
          ) : todayGoals.map(goal => (
            <article key={goal.id} className="border border-border rounded-xl p-3 mb-3">
              <button type="button" className="w-full text-left" onClick={() => setOpenId(goal.id === openId ? null : goal.id)}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm">{goal.title}</p>
                  <span className="text-[11px] uppercase text-muted-foreground">{goal.status.replace('_', ' ')}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {goal.targetKind === 'unit' ? goal.unitTitle || 'Unit' : goal.targetKind === 'lessons' ? `${goal.lessonIds?.length ?? 0} lessons` : goal.freeTextTarget || 'Free text'}
                  {goal.progress != null ? ` · ${goal.progress}%` : ''}
                  {goal.cosignedBy ? ' · Co-signed' : ''}
                </p>
              </button>
              {openId === goal.id && (
                <div className="mt-3 space-y-3">
                  {(goal.checklist ?? []).map(item => (
                    <label key={item.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={item.done} disabled={viewer === 'parent'} onChange={() => onToggle(goal, item.id)} />
                      <span className={item.done ? 'line-through text-muted-foreground' : ''}>{item.label}</span>
                    </label>
                  ))}
                  {viewer === 'student' && goal.status !== 'completed' && (
                    <FocusTimer estimateMinutes={goal.estimateMinutes ?? 25} onLog={(actual, planned) => onLogFocus(goal, actual, planned)} />
                  )}
                  {viewer === 'student' && (
                    <textarea
                      defaultValue={goal.reflection ?? ''}
                      placeholder="What did you notice?"
                      rows={2}
                      className="w-full rounded-lg border border-border p-2 text-sm"
                      onBlur={e => onReflect(goal, e.target.value)}
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    {viewer === 'student' && goal.status !== 'completed' && (
                      <Button type="button" onClick={() => onComplete(goal)}>Mark complete</Button>
                    )}
                    {viewer === 'parent' && onCosign && !goal.cosignedBy && (
                      <Button type="button" variant="outline" onClick={() => onCosign(goal)}>Co-sign</Button>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}
        </Panel>
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Suggested" meta="One click adds it" />
            {cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">Suggestions appear when retention, cramming, or readiness has something to say.</p>
            ) : cards.map(card => (
              <div key={card.id} className="mb-3">
                <p className="text-sm font-semibold">{card.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.body}</p>
                {viewer === 'student' && onAcceptSuggestion && (
                  <Button type="button" variant="outline" className="mt-2 h-8" onClick={() => onAcceptSuggestion(card.suggestedGoal.title, card.suggestedGoal.estimateMinutes, card.suggestedGoal.category)}>
                    Add as goal
                  </Button>
                )}
              </div>
            ))}
          </Panel>
          {suggestions.length > 0 && (
            <Panel>
              <PanelHeader title="From a parent" />
              {suggestions.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <p className="text-sm">{s.title}</p>
                  {viewer === 'student' && s.status === 'pending' && onAcceptSuggestion && (
                    <Button type="button" variant="outline" className="h-8" onClick={() => onAcceptSuggestion(s.title, 25, 'study')}>Accept</Button>
                  )}
                </div>
              ))}
            </Panel>
          )}
        </div>
      </div>
    </DashPage>
  );
}
