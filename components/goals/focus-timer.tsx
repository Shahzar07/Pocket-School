'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { focusSeconds, resolvePomodoro } from '@/lib/insights/goals';

export function FocusTimer({
  estimateMinutes, workMinutes, breakMinutes, onLog,
}: {
  estimateMinutes: number;
  workMinutes?: number;
  breakMinutes?: number;
  onLog: (actualMinutes: number, plannedMinutes: number) => Promise<void> | void;
}) {
  const plan = resolvePomodoro({
    mode: workMinutes ? 'custom' : 'classic',
    workMinutes,
    breakMinutes,
    estimateMinutes,
  });
  const [running, setRunning] = useState(false);
  const [segments, setSegments] = useState<{ start: number; end: number }[]>([]);
  const [openStart, setOpenStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    const onHide = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [running]);

  const elapsed = focusSeconds([
    ...segments,
    ...(openStart ? [{ start: openStart, end: now }] : []),
  ]);
  const planned = plan.rounds * plan.work;

  const pause = () => {
    if (openStart) setSegments(prev => [...prev, { start: openStart, end: Date.now() }]);
    setOpenStart(null);
    setRunning(false);
  };

  const start = () => {
    setOpenStart(Date.now());
    setRunning(true);
  };

  const finish = async () => {
    const closed = openStart ? [...segments, { start: openStart, end: Date.now() }] : segments;
    setSegments(closed);
    setOpenStart(null);
    setRunning(false);
    const minutes = Math.max(1, Math.round(focusSeconds(closed) / 60));
    await onLog(minutes, planned);
  };

  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60);

  return (
    <div className="rounded-xl border border-border p-3 flex flex-wrap items-center gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Focus</p>
        <p className="text-2xl font-semibold tabular-nums">{mm}:{String(ss).padStart(2, '0')}</p>
        <p className="text-[11px] text-muted-foreground">{plan.rounds} × {plan.work} min{plan.breakMinutes ? ` · ${plan.breakMinutes} min break` : ''}</p>
      </div>
      {!running ? (
        <Button type="button" onClick={start} className="h-9">{segments.length ? 'Resume' : 'Start'}</Button>
      ) : (
        <Button type="button" variant="outline" onClick={pause} className="h-9">Pause</Button>
      )}
      <Button type="button" variant="secondary" onClick={finish} disabled={elapsed < 5} className="h-9">Log time</Button>
    </div>
  );
}
