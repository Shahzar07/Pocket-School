'use client';

import { use, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { sourceLabel, type ItemSource } from '@/lib/portfolio';

interface PublicItem {
  source: ItemSource;
  title: string;
  detail: string;
  when: string;
  verifyUrl: string;
}

interface PublicPortfolio {
  name: string;
  studentNumber: string;
  summary: string;
  qrUrl: string;
  items: PublicItem[];
}

export default function PublicPortfolioPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [profile, setProfile] = useState<PublicPortfolio | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/portfolio?number=${encodeURIComponent(code)}`)
      .then((response) => response.json())
      .then((data: { profile?: PublicPortfolio | null }) => setProfile(data.profile ?? null))
      .catch(() => setProfile(null));
  }, [code]);

  return (
    <main className="min-h-screen bg-[#F6F1E7] px-5 py-12 text-[#1A3C34]">
      <article className="mx-auto max-w-xl rounded-[28px] border border-[#1A3C34]/10 bg-white p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C8922A]">Poket School portfolio</p>
        {profile === undefined ? <p className="mt-4 text-sm">Opening this portfolio…</p> : null}
        {profile === null ? <p className="mt-4 text-sm leading-relaxed">This portfolio is private. A learner under 18 stays private until a parent approves sharing.</p> : null}
        {profile ? (
          <>
            <h1 className="mt-2 font-heading text-4xl tracking-tight">{profile.name}</h1>
            <p className="mt-1 font-mono text-xs">{profile.studentNumber}</p>
            {profile.summary ? <p className="mt-4 text-sm leading-relaxed">{profile.summary}</p> : null}
            <ul className="mt-4 space-y-3 text-sm">
              {profile.items.map((item) => (
                <li key={`${item.source}-${item.title}`}>
                  <p className="font-medium">{item.title}</p>
                  <p>{[item.detail, item.when].filter(Boolean).join(' · ')}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#C8922A]">{sourceLabel(item.source)}</p>
                  {item.verifyUrl ? <a href={item.verifyUrl} className="text-xs underline">{item.verifyUrl}</a> : null}
                </li>
              ))}
            </ul>
            <div className="mt-6 inline-flex items-center gap-3">
              <QRCodeSVG value={profile.qrUrl} size={88} fgColor="#1A3C34" bgColor="#ffffff" />
              <p className="text-xs">{profile.qrUrl}</p>
            </div>
          </>
        ) : null}
      </article>
    </main>
  );
}
