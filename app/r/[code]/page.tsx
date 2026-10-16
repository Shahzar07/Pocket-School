'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function ReferralLanding() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code || '');

  useEffect(() => {
    const next = `/signup?ref=${encodeURIComponent(code)}`;
    fetch('/api/referral-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).finally(() => {
      window.location.replace(next);
    });
  }, [code]);

  return (
    <main className="min-h-screen grid place-items-center p-8">
      <p className="text-sm text-muted-foreground">Opening Poket School…</p>
    </main>
  );
}
