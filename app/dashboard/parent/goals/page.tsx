'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { excuseDailyGoal, getChildrenDailyGoals, updateDailyGoal, type DailyGoal } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GoalsWorkspace, type WorkspaceGoal } from '@/components/goals/goals-workspace';
import { DocumentDelivery } from '@/components/document-delivery';
import { textDocument } from '@/lib/documents/packet';
import { createSuggestion } from '@/lib/insights/client';
import { addDays, isoDateKey, weekdayOf } from '@/lib/insights/dates';

export default function ParentGoalsPage() {
  const { user, profile } = useAuthSTORE();
  const [rows, setRows] = useState<{ childId: string; childName: string; goals: DailyGoal[] }[]>([]);
  const [childId, setChildId] = useState('');
  const [suggestion, setSuggestion] = useState('');

  const load = async () => {
    if (!user) return;
    const data = await getChildrenDailyGoals(user.uid).catch(() => []);
    const all = await Promise.all(data.map(async row => ({
      ...row,
      goals: row.goals,
    })));
    setRows(all);
    setChildId(current => current || all[0]?.childId || '');
  };

  useEffect(() => { load(); }, [user]);

  const child = rows.find(row => row.childId === childId) ?? rows[0];
  const goals: WorkspaceGoal[] = (child?.goals ?? []).map(goal => ({ ...goal, id: goal.id }));

  return (
    <div className="space-y-4">
      {rows.length > 1 && (
        <div className="flex gap-2">
          {rows.map(row => (
            <Button key={row.childId} variant={row.childId === child?.childId ? 'default' : 'outline'} onClick={() => setChildId(row.childId)}>{row.childName}</Button>
          ))}
        </div>
      )}
      {child && (
        <DocumentDelivery
          documents={[textDocument({
            id: `goals-${child.childId}`,
            title: `Goals · ${child.childName}`,
            holderEmail: user?.email ?? undefined,
            studentId: child.childId,
            lines: child.goals.length ? child.goals.map(goal => `${goal.dateKey} · ${goal.title} · ${goal.status}`) : ['No goals yet.'],
          })]}
          studentIds={[child.childId]}
        />
      )}
      <GoalsWorkspace
        viewer="parent"
        childName={child?.childName}
        goals={goals}
        onAdd={() => {}}
        onToggle={() => {}}
        onReflect={() => {}}
        onComplete={() => {}}
        onLogFocus={() => {}}
        onCosign={async goal => {
          await updateDailyGoal(goal.id, { cosignedBy: profile?.name ?? 'Parent', cosignedAt: new Date().toISOString() });
          toast.success('Co-signed');
          await load();
        }}
        onCosignWeek={async () => {
          const today = isoDateKey();
          const start = addDays(today, -weekdayOf(today));
          const end = addDays(start, 6);
          const openGoals = goals.filter(goal => !goal.cosignedBy && goal.status !== 'excused' && goal.dateKey >= start && goal.dateKey <= end);
          await Promise.all(openGoals.map(goal => updateDailyGoal(goal.id, {
            cosignedBy: profile?.name ?? 'Parent',
            cosignedAt: new Date().toISOString(),
          })));
          toast.success('This week is co-signed');
          await load();
        }}
        onCheer={async (goal, emoji) => {
          if (!user) return;
          const reactions = [...(goal.reactions ?? []), { parentId: user.uid, emoji, at: new Date().toISOString() }];
          await updateDailyGoal(goal.id, { reactions });
          toast.success('Sent');
          await load();
        }}
      />
      {child && (
        <form className="max-w-xl flex gap-2" onSubmit={async event => {
          event.preventDefault();
          if (!user || !suggestion.trim()) return;
          await createSuggestion({ studentId: child.childId, parentId: user.uid, title: suggestion.trim(), parentName: profile?.name });
          setSuggestion('');
          toast.success('Suggestion sent. Your child can accept it.');
        }}>
          <Input value={suggestion} onChange={e => setSuggestion(e.target.value)} placeholder="Suggest a goal" aria-label="Suggest a goal" />
          <Button type="submit">Suggest</Button>
          <Button type="button" variant="outline" onClick={async () => {
            const open = (child.goals ?? []).find(g => g.status !== 'completed' && g.status !== 'excused');
            if (!open) return;
            await excuseDailyGoal(open.id, 'Excused by parent', profile?.name ?? 'Parent');
            toast.success('Excused');
            await load();
          }}>Excuse an open goal</Button>
        </form>
      )}
    </div>
  );
}
