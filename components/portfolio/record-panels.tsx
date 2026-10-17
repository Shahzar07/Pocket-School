'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { linkedInCertificationUrl, shareLinks } from '@/lib/credentials/badge-model';
import { CV_TEMPLATES, sourceLabel, type PortfolioConsent, type RecordItem } from '@/lib/portfolio';
import type { DestinationBoard } from '@/lib/destinations';

export function RecordPanels({
  name,
  studentNumber,
  items,
  summary,
  bullets,
  nudges,
  reason,
  consent,
}: {
  name: string;
  studentNumber: string;
  items: readonly RecordItem[];
  summary: string;
  bullets: readonly string[];
  nudges: readonly string[];
  reason: string;
  consent: PortfolioConsent;
}) {
  const verified = items.filter((item) => item.source === 'verified');
  const reported = items.filter((item) => item.source === 'self_reported');
  const qr = studentNumber ? `https://poketschool.ai/portfolio/${studentNumber}` : '';
  const [organizationId, setOrganizationId] = useState('');
  useEffect(() => {
    fetch('/api/auth/linkedin')
      .then((response) => response.json())
      .then((data: { organizationId?: string }) => {
        if (typeof data.organizationId === 'string') setOrganizationId(data.organizationId);
      })
      .catch(() => undefined);
  }, []);
  return (
    <section className="rounded-[28px] border border-[#1A3C34]/10 bg-white p-6 text-[#1A3C34]">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C8922A]">Lifelong record</p>
      <h2 className="mt-1 font-heading text-3xl tracking-tight">{name || 'Learner'}</h2>
      <p className="mt-1 font-mono text-sm">{studentNumber || 'Student number follows this account'}</p>
      <p className="mt-3 text-sm leading-relaxed">{reason}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <ItemColumn title="Verified by Poket School" items={verified} organizationId={organizationId} />
        <ItemColumn title="Self-reported" items={reported} organizationId={organizationId} />
      </div>
      {nudges.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {nudges.map((nudge) => <li key={nudge}>{nudge}</li>)}
        </ul>
      )}
      <div className="mt-5 rounded-2xl bg-[#F6F1E7] p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C8922A]">ET AI draft</p>
        <p className="mt-2 text-sm leading-relaxed">{summary || 'ET AI writes from recorded achievements after you ask for a draft.'}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-[#1A3C34]/80">Review this. ET AI does not add achievements you have not recorded.</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {CV_TEMPLATES.map((template) => (
          <span key={template} className={`rounded-full px-3 py-1 ${consent.template === template ? 'bg-brand-ink text-white' : 'bg-brand-mist text-brand-ink'}`}>
            {template} CV
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm">CV PDF, JSON, and LinkedIn-friendly text. Scores stay off until you include them.</p>
      <p className="mt-1 text-sm">Public portfolio: {consent.publicPortfolio ? 'requested' : 'off'}. Sharing with former schools: {consent.sharePortfolioWithSchools ? 'on' : 'off'}.</p>
      {qr ? (
        <div className="mt-4 inline-flex items-center gap-3 rounded-2xl border border-[#1A3C34]/10 p-3">
          <QRCodeSVG value={qr} size={88} fgColor="#1A3C34" bgColor="#ffffff" />
          <p className="max-w-[16rem] text-xs leading-relaxed">LinkedIn Featured and the Contact info website field use {qr}</p>
        </div>
      ) : null}
    </section>
  );
}

function ItemColumn({ title, items, organizationId }: { title: string; items: readonly RecordItem[]; organizationId: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 space-y-2 text-sm">
        {items.length === 0 ? <li className="text-[#1A3C34]/70">Nothing in this column yet.</li> : null}
        {items.map((item) => {
          const dated = item.when.match(/\d{4}-\d{2}-\d{2}/);
          const showLinkedIn = (item.kind === 'certificate' || item.kind === 'badge') && item.verifyUrl;
          return (
            <li key={item.id} className="rounded-xl border border-[#1A3C34]/10 px-3 py-2">
              <p className="font-medium">{item.title}</p>
              <p className="text-[#1A3C34]/80">{[item.detail, item.when].filter(Boolean).join(' · ')}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#C8922A]">{sourceLabel(item.source)}</p>
              {item.verifyUrl ? <p className="truncate text-xs">{item.verifyUrl}</p> : null}
              {showLinkedIn ? (
                <p className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
                  <a href={linkedInCertificationUrl({
                    name: item.title,
                    organizationId,
                    issuedAt: dated ? `${dated[0]}T00:00:00.000Z` : '2020-01-01T00:00:00.000Z',
                    certUrl: item.verifyUrl,
                    certId: item.id,
                  })} target="_blank" rel="noreferrer">Add to LinkedIn</a>
                  <a href={shareLinks(item.verifyUrl, item.title).linkedin} target="_blank" rel="noreferrer">Share to LinkedIn</a>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DestinationBoardView({ board }: { board: DestinationBoard & { note?: string } }) {
  return (
    <section className="rounded-[28px] border border-[#1A3C34]/10 bg-white p-6 text-[#1A3C34]">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3C8DFF]">Alumni destinations</p>
      <h2 className="mt-1 font-heading text-3xl tracking-tight">Where alumni go next</h2>
      <p className="mt-2 text-sm leading-relaxed">{board.note || 'Groups under five stay hidden.'} Names appear only when that alumnus opts in.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <BucketList title="Institution" rows={board.institutions} />
        <BucketList title="Country" rows={board.countries} />
        <BucketList title="Course" rows={board.courses} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <BucketList title="Hired" rows={board.outcomes.filter((row) => row.label === 'Hired')} />
        <BucketList title="Studying" rows={board.outcomes.filter((row) => row.label === 'Studying')} />
      </div>
      {board.named.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {board.named.map((person) => (
            <li key={`${person.name}-${person.destination}`}>{person.name} · {person.destination}{person.course ? ` · ${person.course}` : ''}</li>
          ))}
        </ul>
      )}
      {board.testimonials.length > 0 && (
        <div className="mt-4 rounded-2xl bg-[#F8E7C4] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]">Outcomes shared by alumni</p>
          {board.testimonials.map((item) => (
            <blockquote key={item.quote} className="mt-2 text-sm leading-relaxed">“{item.quote}” — {item.name}</blockquote>
          ))}
        </div>
      )}
      {board.hiddenBuckets > 0 ? <p className="mt-3 text-xs">{board.hiddenBuckets} small groups stay hidden.</p> : null}
    </section>
  );
}

function BucketList({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {rows.length === 0 ? <li className="text-[#1A3C34]/70">No group of five yet.</li> : null}
        {rows.map((row) => <li key={row.label}>{row.label} · {row.count}</li>)}
      </ul>
    </div>
  );
}
