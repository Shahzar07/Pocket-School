'use client';

import { useEffect, useMemo, useState } from 'react';
import { useReadsT } from '@/lib/reads/i18n';
import { privacyBoard } from '@/lib/platform/leaderboard';
import type { BoardPeriod, BoardScope } from '@/lib/reads/leaderboard';
import { childHidden, setChildHidden } from '@/lib/shelf/storage';
import { useShelfProfile } from '@/components/shelf/profile-bar';
import { LeaderboardPodium } from '@/components/leaderboard/podium';
import { rankMovement } from '@/lib/design/chart-colours';

const SCOPES: BoardScope[] = ['global', 'country', 'city', 'school', 'friends'];
const PERIODS: BoardPeriod[] = ['week', 'month', 'all'];

export function LeaderboardView() {
  const t = useReadsT();
  const { profile } = useShelfProfile();
  const [scope, setScope] = useState<BoardScope>('global');
  const [period, setPeriod] = useState<BoardPeriod>('week');
  const [hidden, setHidden] = useState(false);

  useEffect(() => { setHidden(childHidden()); }, []);

  const rows = privacyBoard(scope, period, hidden);
  const movement = useMemo(() => {
    const other: BoardPeriod = period === 'week' ? 'month' : period === 'month' ? 'all' : 'month';
    const compared = privacyBoard(scope, other, hidden);
    const previous = new Map(compared.map((row, index) => [row.entry.id, index + 1]));
    return new Map(rows.map((row, index) => [row.entry.id, rankMovement(previous.get(row.entry.id), index + 1)]));
  }, [hidden, period, rows, scope]);
  const scopeLabel: Record<BoardScope, 'reads.board.global' | 'reads.board.country' | 'reads.board.city' | 'reads.board.school' | 'reads.board.friends'> = {
    global: 'reads.board.global', country: 'reads.board.country', city: 'reads.board.city', school: 'reads.board.school', friends: 'reads.board.friends',
  };
  const periodLabel: Record<BoardPeriod, 'reads.board.week' | 'reads.board.month' | 'reads.board.all'> = {
    week: 'reads.board.week', month: 'reads.board.month', all: 'reads.board.all',
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-[40px] tracking-[-0.04em] sm:text-[52px]">{t('reads.board.title')}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('reads.board.lead')}</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {PERIODS.map(p => (
          <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={`h-9 rounded-full px-3 text-[13px] font-semibold ${period === p ? 'bg-foreground text-background' : 'border border-border'}`}>
            {t(periodLabel[p])}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {SCOPES.map(s => (
          <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={`h-9 rounded-full px-3 text-[13px] font-semibold ${scope === s ? 'bg-primary text-primary-foreground' : 'border border-border'}`}>
            {t(scopeLabel[s])}
          </button>
        ))}
      </div>
      <LeaderboardPodium
        empty={t('reads.board.empty')}
        entries={rows.map(row => ({
          id: row.entry.id,
          label: row.entry.nickname,
          score: row.minutes,
          scoreLabel: t('reads.board.minutes', { count: row.minutes }),
          isYou: row.entry.id === 'lighthouse',
          streak: row.entry.streak,
          rankDelta: movement.get(row.entry.id) ?? 0,
        }))}
      />
      <aside className="rounded-3xl border border-primary bg-primary p-6 text-primary-foreground">
        <h2 className="font-heading text-[26px]">{t('reads.board.safety')}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary-foreground/90">{t('reads.board.safetyBody')}</p>
        {(profile.kind === 'parent' || profile.kind === 'reader') && (
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={hidden}
              onChange={e => { setChildHidden(e.target.checked); setHidden(e.target.checked); }}
            />
            {t('reads.board.hide')}
          </label>
        )}
      </aside>
    </div>
  );
}
