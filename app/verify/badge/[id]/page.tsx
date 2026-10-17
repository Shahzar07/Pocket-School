'use client';

import { use, useEffect, useState } from 'react';

interface BadgeView {
  name: string;
  learner: string;
  studentNumber: string;
  issuedAt: string;
  linkedInUrl: string;
  shares: { linkedin: string };
}

export default function BadgeVerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [badge, setBadge] = useState<BadgeView | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/verify/badge/${encodeURIComponent(id)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data: BadgeView | null) => setBadge(data))
      .catch(() => setBadge(null));
  }, [id]);

  return (
    <main className="min-h-screen bg-[#F6F1E7] px-5 py-12 text-[#203337]">
      <article className="mx-auto max-w-xl rounded-[28px] border border-[#203337]/10 bg-white p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Poket School badge</p>
        {badge === undefined ? <p className="mt-4 text-sm">Opening this badge…</p> : null}
        {badge === null ? <p className="mt-4 text-sm">This badge is not on the record.</p> : null}
        {badge ? (
          <>
            <h1 className="mt-2 font-heading text-4xl tracking-tight">{badge.name}</h1>
            {badge.learner ? <p className="mt-2 text-sm">{badge.learner}</p> : null}
            {badge.studentNumber ? <p className="mt-1 font-mono text-sm">{badge.studentNumber}</p> : null}
            <p className="mt-2 text-sm">Issued {badge.issuedAt.slice(0, 10)}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#1E6A83]">Verified by Poket School</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
              <a className="rounded-full bg-[#203337] px-4 py-2 text-white" href={badge.linkedInUrl} target="_blank" rel="noreferrer">Add to LinkedIn</a>
              <a className="rounded-full border border-[#203337] px-4 py-2" href={badge.shares.linkedin} target="_blank" rel="noreferrer">Share to LinkedIn</a>
            </div>
          </>
        ) : null}
      </article>
    </main>
  );
}
