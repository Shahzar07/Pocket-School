'use client';

import { useEffect } from 'react';
import { doc, increment, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthSTORE } from '@/hooks/use-auth';
import { setCountedActive } from '@/lib/activity/presence-store';
import { HEARTBEAT_MS, presenceOf, shouldFlush, type DayActivity, type Presence } from '@/lib/activity/active-time';

const IDLE_MS = 5 * 60_000;

/** Counts active time in the dashboard and writes about once a minute. */
export function ActiveTimeTracker() {
  const { user } = useAuthSTORE();

  useEffect(() => {
    if (!user) return;
    let lastInput = Date.now();
    let lastTick = Date.now();
    let lastFlush = Date.now();
    let day: DayActivity = { dateKey: new Date().toISOString().slice(0, 10), activeMs: 0, idleMs: 0, hiddenMs: 0 };
    const mark = () => { lastInput = Date.now(); };
    const onVis = () => setCountedActive(!document.hidden && document.hasFocus());
    window.addEventListener('pointerdown', mark);
    window.addEventListener('keydown', mark);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onVis);
    window.addEventListener('focus', onVis);
    const timer = window.setInterval(() => {
      const now = Date.now();
      const presence: Presence = presenceOf({
        visible: !document.hidden,
        focused: document.hasFocus(),
        lastInputAt: lastInput,
        now,
        idleMs: IDLE_MS,
      });
      setCountedActive(presence === 'active');
      const slice = now - lastTick;
      lastTick = now;
      const key = new Date().toISOString().slice(0, 10);
      if (day.dateKey !== key) day = { dateKey: key, activeMs: 0, idleMs: 0, hiddenMs: 0 };
      if (presence === 'active') day = { ...day, activeMs: day.activeMs + slice };
      else if (presence === 'idle') day = { ...day, idleMs: day.idleMs + slice };
      else day = { ...day, hiddenMs: day.hiddenMs + slice };
      if (!shouldFlush(lastFlush, now, HEARTBEAT_MS)) return;
      lastFlush = now;
      const snapshot = day;
      day = { ...snapshot, activeMs: 0, idleMs: 0, hiddenMs: 0 };
      void setDoc(doc(db, 'users', user.uid, 'activity', snapshot.dateKey), {
        dateKey: snapshot.dateKey,
        activeMs: increment(snapshot.activeMs),
        idleMs: increment(snapshot.idleMs),
        hiddenMs: increment(snapshot.hiddenMs),
        updatedAt: now,
      }, { merge: true }).catch((error: unknown) => {
        console.error('Active time was not saved.', error instanceof Error ? error.message : error);
      });
    }, 15_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pointerdown', mark);
      window.removeEventListener('keydown', mark);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [user]);

  return null;
}
