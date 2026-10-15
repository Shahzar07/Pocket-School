'use client';

import { useEffect, useState } from 'react';

/** A bar when the device has no network. The last opened lesson id stays in local storage. */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [lastTitle, setLastTitle] = useState('');

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    setLastTitle(localStorage.getItem('poket-last-lesson') ?? '');
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (online) return null;
  return (
    <div className="bg-amber-500 text-amber-950 text-sm font-semibold px-4 py-2 text-center" role="status">
      You are offline. {lastTitle ? `Last opened: ${lastTitle}. ` : ''}Open lessons need a connection. Your notes stay on this device until you save them.
    </div>
  );
}

export function rememberOfflineLesson(title: string) {
  try { localStorage.setItem('poket-last-lesson', title); } catch { /* private mode */ }
}
