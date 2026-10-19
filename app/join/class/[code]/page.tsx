'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuthSTORE } from '@/hooks/use-auth';
import { JOIN } from '@/lib/courses/join-class-copy';

export default function JoinClassroomPage() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code ?? '');
  const { user, loading } = useAuthSTORE();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (!user) return;
    setBusy(true);
    setMessage('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/classrooms/join', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const body = await response.json() as { error?: string; status?: string; className?: string };
      if (!response.ok) {
        setMessage(body.error || JOIN.failed);
        return;
      }
      setMessage(`${body.className || ''} ${body.status === 'active' ? JOIN.active : JOIN.pending}`.trim());
    } catch {
      setMessage(JOIN.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center gap-4 px-4 py-16">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83]">{JOIN.eyebrow}</p>
      <h1 className="font-heading text-4xl text-[#203337]">{JOIN.title}</h1>
      <p className="text-sm leading-relaxed text-[#203337]/80">{JOIN.lede}</p>
      <p className="font-mono text-lg text-[#203337]" data-join-code="1">{code}</p>
      {loading ? <p className="text-sm text-[#1E6A83]">{JOIN.signingIn}</p> : null}
      {!loading && !user ? (
        <div className="flex flex-wrap gap-2">
          <p className="w-full text-sm text-[#1E6A83]">{JOIN.needAccount}</p>
          <Link className="inline-flex min-h-11 items-center rounded-full bg-[#1E6A83] px-4 text-sm font-semibold text-white" href={`/login?next=/join/class/${encodeURIComponent(code)}`}>{JOIN.signIn}</Link>
          <Link className="inline-flex min-h-11 items-center rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#203337]" href="/signup">{JOIN.signUp}</Link>
        </div>
      ) : null}
      {user ? (
        <button type="button" data-join-class="1" disabled={busy} onClick={() => void join()} className="min-h-11 w-fit rounded-full bg-[#3FE0D0] px-5 text-sm font-bold text-[#203337]">
          {JOIN.action}
        </button>
      ) : null}
      {message ? <p className="text-sm text-[#203337]" data-join-message="1">{message}</p> : null}
    </main>
  );
}
