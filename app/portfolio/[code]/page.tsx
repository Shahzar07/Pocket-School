'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CvDocument } from '@/components/portfolio/cv-builder';
import { composeCv, designFromTheme, readPortfolioTheme, type PortfolioTheme } from '@/lib/cv-builder';
import { sourceLabel, type ItemSource, type RecordItem } from '@/lib/portfolio';

interface PublicItem {
  id: string;
  source: ItemSource;
  kind: string;
  section: string;
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
  theme?: PortfolioTheme;
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

  const doc = useMemo(() => {
    if (!profile) return null;
    const theme = readPortfolioTheme(profile.theme);
    const items: RecordItem[] = profile.items.map((item) => ({
      id: item.id,
      source: item.source,
      kind: item.kind,
      title: item.title,
      detail: item.detail,
      when: item.when,
      verifyUrl: item.verifyUrl,
      evidenceLink: '',
      section: item.section,
    }));
    return composeCv({
      name: profile.name,
      items,
      design: designFromTheme(theme, profile.summary),
    });
  }, [profile]);

  return (
    <main className="min-h-screen bg-[#F6F1E7] px-5 py-12 text-[#203337]">
      <article className="mx-auto max-w-3xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Poket School portfolio</p>
        {profile === undefined ? <p className="mt-4 text-sm">Opening this portfolio…</p> : null}
        {profile === null ? <p className="mt-4 text-sm leading-relaxed">This portfolio is private. A learner under 18 stays private until a parent approves sharing.</p> : null}
        {profile && doc ? (
          <>
            <div className="mt-4">
              <CvDocument doc={doc} />
            </div>
            <p className="mt-3 text-xs">{profile.studentNumber}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {profile.items.filter((item) => item.verifyUrl).map((item) => (
                <li key={`${item.source}-${item.id}`}>
                  <a href={item.verifyUrl} className="text-xs underline">{sourceLabel(item.source)} · {item.verifyUrl}</a>
                </li>
              ))}
            </ul>
            <div className="mt-6 inline-flex items-center gap-3 rounded-[28px] bg-white px-4 py-3">
              <QRCodeSVG value={profile.qrUrl} size={88} fgColor="#203337" bgColor="#ffffff" />
              <p className="text-xs">{profile.qrUrl}</p>
            </div>
          </>
        ) : null}
      </article>
    </main>
  );
}
