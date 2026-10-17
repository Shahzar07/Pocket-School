'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { classBoards } from '@/lib/gamification/engine';
import { friendlyError } from '@/lib/design/system';

export interface ClassBoardRow {
  id: string;
  name: string;
  leaderboardEnabled?: boolean;
  competitionsEnabled?: boolean;
}

export function ClassBoardControls({
  institutionId,
  classes,
}: {
  institutionId: string;
  classes: readonly ClassBoardRow[];
}) {
  const [rows, setRows] = useState(classes);
  const signature = classes.map(row => `${row.id}:${row.leaderboardEnabled}:${row.competitionsEnabled}`).join('|');
  useEffect(() => {
    setRows([...classes]);
  }, [signature, classes]);
  const save = async (row: ClassBoardRow, patch: Partial<ClassBoardRow>) => {
    const next = classBoards({ ...row, ...patch });
    setRows(current => current.map(item => item.id === row.id ? { ...item, ...next } : item));
    try {
      await authedFetch('/api/gamification/class', {
        method: 'POST',
        body: JSON.stringify({ institutionId, classId: row.id, ...next }),
      });
      toast.success('Class board updated.');
    } catch (error) {
      toast.error(friendlyError(error));
    }
  };
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">Add a class before choosing leaderboards or house competitions.</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map(row => {
        const settings = classBoards(row);
        return (
          <li key={row.id} className="rounded-2xl border border-border p-4 space-y-2">
            <p className="font-heading text-base text-foreground">{row.name}</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.leaderboardEnabled}
                onChange={event => void save(row, { leaderboardEnabled: event.target.checked })}
              />
              Show the class and school leaderboard
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.competitionsEnabled}
                onChange={event => void save(row, { competitionsEnabled: event.target.checked })}
              />
              House competitions for this class
            </label>
          </li>
        );
      })}
    </ul>
  );
}
