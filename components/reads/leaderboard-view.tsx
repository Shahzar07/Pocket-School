'use client';

import { useEffect, useState } from 'react';
import { useReadsT } from '@/lib/reads/i18n';
import { privacyBoard } from '@/lib/platform/leaderboard';
import type { BoardPeriod, BoardScope } from '@/lib/reads/leaderboard';
import { childHidden, setChildHidden } from '@/lib/shelf/storage';
import { useShelfProfile } from '@/components/shelf/profile-bar';

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
          <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={`h-9 rounded-full px-3 text-[13px] font-semibold ${period === p ? 'bg-[#203337] text-white' : 'border border-border'}`}>
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
      <ol className="overflow-hidden rounded-3xl border border-border bg-card">
        {rows.length === 0 && <li className="p-6 text-sm text-muted-foreground">{t('reads.board.empty')}</li>}
        {rows.map((row, i) => (
          <li key={row.entry.id} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
            <span className="w-8 font-heading text-[22px] tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">{row.entry.nickname.slice(0, 1)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {row.entry.nickname}
                {row.entry.id === 'lighthouse' && <span className="ml-2 text-[11px] font-bold uppercase tracking-wider text-primary">{t('reads.board.you')}</span>}
              </p>
              {row.place && <p className="truncate text-[12px] text-muted-foreground">{row.place}</p>}
            </div>
            <p className="text-sm font-semibold tabular-nums">{t('reads.board.minutes', { count: row.minutes })}</p>
          </li>
        ))}
      </ol>
      <aside className="rounded-3xl border border-border bg-[#10262C] p-6 text-white">
        <h2 className="font-heading text-[26px]">{t('reads.board.safety')}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">{t('reads.board.safetyBody')}</p>
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
