'use client';

import { use, useEffect, useState } from 'react';
import type { PublicAlumniView } from '@/lib/alumni';

export default function PublicAlumniPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [profile, setProfile] = useState<PublicAlumniView | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/alumni?number=${encodeURIComponent(code)}`)
      .then((response) => response.json())
      .then((data: { profile?: PublicAlumniView | null }) => setProfile(data.profile ?? null))
      .catch(() => setProfile(null));
  }, [code]);

  return (
    <main className="min-h-screen bg-[#F6F1E7] px-5 py-12 text-[#1A3C34]">
      <article className="mx-auto max-w-xl rounded-[28px] border border-[#1A3C34]/10 bg-white p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C8922A]">Poket School alumni</p>
        {profile === undefined ? <p className="mt-4 text-sm">Opening this record…</p> : null}
        {profile === null ? <p className="mt-4 text-sm leading-relaxed">This profile is private. Certificate pages stay available from each certificate QR.</p> : null}
        {profile ? (
          <>
            <h1 className="mt-2 font-heading text-4xl tracking-tight">{profile.name}</h1>
            <p className="mt-2 text-sm">{profile.institutionName}{profile.level ? ` · ${profile.level}` : ''}</p>
            <p className="mt-1 font-mono text-xs">{profile.studentNumber}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {profile.certificates.map((title) => <li key={title}>{title}</li>)}
            </ul>
            <p className="mt-4 text-sm">{profile.badges} badge{profile.badges === 1 ? '' : 's'} on this account.</p>
          </>
        ) : null}
      </article>
    </main>
  );
}
