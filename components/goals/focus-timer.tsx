'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { focusSeconds, resolvePomodoro } from '@/lib/insights/goals';
import { isCountedActive, subscribeCounted } from '@/lib/activity/presence-store';

export function FocusTimer({
  estimateMinutes, workMinutes, breakMinutes, onLog, title, pauseWhenHidden = true,
}: {
  estimateMinutes: number;
  workMinutes?: number;
  breakMinutes?: number;
  onLog?: (actualMinutes: number, plannedMinutes: number) => Promise<void> | void;
  title?: string;
  /** Pause when the tab is hidden. On by default so a background tab does not count. */
  pauseWhenHidden?: boolean;
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

  const pause = () => {
    if (openStart) setSegments(prev => [...prev, { start: openStart, end: Date.now() }]);
    setOpenStart(null);
    setRunning(false);
  };

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    const stop = () => {
      setOpenStart((current) => {
        if (current) setSegments((prev) => [...prev, { start: current, end: Date.now() }]);
        return null;
      });
      setRunning(false);
    };
    const onHide = () => {
      if (pauseWhenHidden && (document.hidden || !isCountedActive())) stop();
    };
    const unsub = subscribeCounted(() => {
      if (pauseWhenHidden && !isCountedActive()) stop();
    });
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', onHide);
    return () => {
      window.clearInterval(id);
      unsub();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', onHide);
    };
  }, [running, pauseWhenHidden]);

  const elapsed = focusSeconds([
    ...segments,
    ...(openStart ? [{ start: openStart, end: now }] : []),
  ]);
  const planned = plan.rounds * plan.work;

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
    await onLog?.(minutes, planned);
  };

  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60);

  return (
    <section aria-label={title ? `Focus timer for ${title}` : 'Focus timer'} className="rounded-[28px] border border-[#1E6A83] bg-white p-4 flex flex-wrap items-center gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1E6A83]">Focus</p>
        {title ? <p className="text-sm font-semibold text-[#203337]">{title}</p> : null}
        <p className="text-2xl font-semibold tabular-nums text-[#203337]">{mm}:{String(ss).padStart(2, '0')}</p>
        <p className="text-[11px] text-[#1E6A83]">{plan.rounds} × {plan.work} min{plan.breakMinutes ? ` · ${plan.breakMinutes} min break` : ''}</p>
      </div>
      {!running ? (
        <Button type="button" onClick={start} className="h-9 border border-[#1E6A83] bg-[#3FE0D0] text-[#203337]">{segments.length ? 'Resume' : 'Start'}</Button>
      ) : (
        <Button type="button" variant="outline" onClick={pause} className="h-9">Pause</Button>
      )}
      <Button type="button" variant="secondary" onClick={finish} disabled={elapsed < 5} className="h-9">Log time</Button>
    </section>
  );
}
