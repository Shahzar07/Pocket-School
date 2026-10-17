'use client';

import { useEffect } from 'react';
import { authedFetch } from '@/lib/api-client';

/** Records a real visit on pages that sit outside the dashboard shell. */
export function WelcomePing() {
  useEffect(() => {
    const href = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    void authedFetch('/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({ op: 'visit', href }),
    }).catch(() => {});
  }, []);
  return null;
}
