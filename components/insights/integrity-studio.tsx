'use client';

import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { IntegrityNotice } from './integrity-notice';
import { copyrightLine } from '@/lib/insights/copyright';
import { buildPdf } from '@/lib/insights/pdf';
import { downloadBytes } from './boards';
import { deskChecks, seedCard, seedCase, seedConcerns, seedReexam } from '@/lib/insights/integrity-seed';
import { applyReview, recordVerdict } from '@/lib/insights/reexam';
import { cardPdfLines, parentSign } from '@/lib/insights/report-card-model';
import { DEFAULT_NOTIFY_SETTINGS } from '@/lib/insights/concerns';

export type DeskSide = 'student' | 'parent' | 'teacher' | 'institution';

export function IntegrityStudio({ side }: { side: DeskSide }) {
  const drafted = useMemo(() => seedCase(), []);
  const reexam = useMemo(() => seedReexam(), []);
  const concerns = useMemo(() => seedConcerns(), []);
  const [review, setReview] = useState<string>('pending');
  const [confirmed, setConfirmed] = useState(false);
  const [appeal, setAppeal] = useState('');
  const [appealSent, setAppealSent] = useState(false);
  const [reply, setReply] = useState('Read with Mina.');
  const [signed, setSigned] = useState(false);
  const checks = deskChecks(side);
  const decisions = confirmed || side === 'parent' ? ['confirmed'] : ['pending'];
  const card = seedCard(decisions);
  const subject = card.subjects[0];
  const visibleConcerns = side === 'institution'
    ? concerns.filter(flag => flag.notify.includes('institution'))
    : concerns;
  const verifyUrl = 'https://poketschool.ai/verify/report/rc_mina_t4';

  return (
    <div className="space-y-5" data-integrity-studio={side} data-integrity-note={card.integrityNote ? 'shown' : 'hidden'} data-signed={signed ? 'yes' : 'no'} data-appeal={appealSent ? 'sent' : 'open'} data-review={review}>
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Integrity and report cards</p>
        <h1 className="font-heading text-3xl text-foreground mt-1">A flag is a signal for a person</h1>
        <p className="text-sm text-muted-foreground mt-1">Nothing on this desk changes a mark by itself.</p>
      </header>

      {(side === 'student' || side === 'teacher') && <IntegrityNotice />}

      <section className="rounded-3xl border border-border p-5 space-y-2" data-section="flag" style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--ps-violet) 14%, var(--card)), var(--card) 72%)' }}>
        <p className="font-semibold">Fractions essay · confidence {drafted.score}</p>
        <p className="text-sm">{drafted.studentSummary}</p>
        <ul className="text-sm space-y-1">
          {drafted.evidence.map(item => (
            <li key={item.label}><span className="font-semibold">{item.label}.</span> {item.detail}</li>
          ))}
        </ul>
        {side === 'student' && (
          appealSent ? <p className="text-sm">Appeal sent. Your teacher will record the outcome.</p> : (
            <form className="space-y-2" onSubmit={event => { event.preventDefault(); if (appeal.trim()) setAppealSent(true); }}>
              <textarea className="w-full rounded-xl border border-border p-3 text-sm" rows={2} value={appeal} onChange={event => setAppeal(event.target.value)} aria-label="Appeal note" placeholder="What should your teacher reconsider?" />
              <button type="submit" className="rounded-full border border-border px-4 py-2 text-sm font-semibold">Send appeal</button>
            </form>
          )
        )}
      </section>

      {side !== 'student' && (
        <section className="rounded-3xl border border-border p-5 space-y-2" data-section="inbox" style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--ps-amber) 12%, var(--card)), var(--card) 72%)' }}>
          <p className="font-semibold">Flags inbox</p>
          <p className="text-sm text-muted-foreground">Quiet hours {DEFAULT_NOTIFY_SETTINGS.quietStart}–{DEFAULT_NOTIFY_SETTINGS.quietEnd}. Push waits. The inbox still updates.</p>
          <ul className="text-sm space-y-1">
            {visibleConcerns.map(flag => (
              <li key={flag.kind} data-concern={flag.kind}>{flag.title} · {flag.severity}. {flag.detail}</li>
            ))}
          </ul>
          {side === 'institution' && <p className="text-sm">Wellbeing check-ins stay with the parent and the teacher.</p>}
        </section>
      )}

      {side === 'teacher' && (
        <section className="rounded-3xl border border-border p-5 space-y-3" data-section="reexam" style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--ps-sky) 12%, var(--card)), var(--card) 72%)' }}>
          <p className="font-semibold">Review</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-full border border-border px-4 py-2 text-sm" onClick={() => setReview(applyReview('dismiss').decision)}>Dismiss</button>
            <button type="button" className="rounded-full border border-border px-4 py-2 text-sm" onClick={() => setReview(applyReview('discuss').decision)}>Discuss</button>
            <button type="button" className="rounded-full border border-border px-4 py-2 text-sm" onClick={() => setReview(applyReview('reexam').decision)}>Request re-examination</button>
            <button type="button" className="rounded-full border border-border px-4 py-2 text-sm" onClick={() => setConfirmed(true)}>Confirm</button>
            <button type="button" className="rounded-full border border-border px-4 py-2 text-sm" onClick={() => { setConfirmed(false); setReview(recordVerdict('clear').decision); }}>Clear</button>
          </div>
          <p className="text-sm capitalize">Status: {review}</p>
          <p className="text-sm">{reexam.variant.note}</p>
          <ul className="text-sm list-disc pl-5">
            {reexam.variant.questions.map(question => <li key={question.id}>{question.prompt}</li>)}
          </ul>
          <p className="text-sm">Proctored-lite: focus lock, {reexam.proctor.timerMinutes} minute timer, paste off.</p>
          <p className="text-sm font-semibold">Viva</p>
          <ul className="text-sm list-disc pl-5">{reexam.viva.map(question => <li key={question}>{question}</li>)}</ul>
          <p className="text-sm">AI recommendation: {reexam.comparison.recommendation.split('_').join(' ')}. {reexam.comparison.reasons[0]}</p>
          <p className="text-sm text-muted-foreground">Audit: opened by Ada · review recorded · teacher decision is the last word.</p>
        </section>
      )}

      <section className="rounded-3xl border border-border p-5 space-y-3" data-section="report-card" style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--ps-emerald) 12%, var(--card)), var(--card) 72%)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{card.template.heading}</p>
            <h2 className="text-2xl font-semibold">{card.studentName}</h2>
            <p className="text-sm text-muted-foreground">{card.termId} {card.year} · {card.template.label}</p>
          </div>
          {card.template.logoUrl && <img src={card.template.logoUrl} alt="" className="h-12 w-12 rounded-xl bg-muted object-contain" />}
        </div>
        {subject && (
          <div className="text-sm space-y-1">
            <p className="font-semibold">{subject.courseTitle} · grade {subject.grade} · {subject.percent}%</p>
            <p>Bloom mastery {subject.bloomMastery}. Attendance {subject.attendanceRate}%. Behaviour {subject.behaviour}. Effort {subject.effort}. Goals {subject.goalsAchieved} of {subject.goalsSet}.</p>
            <p>{subject.signedOff ? `Signed off by ${subject.teacherName}.` : 'Waiting for the subject teacher.'}</p>
            <p>{subject.comment}</p>
            {card.comparison[0]?.delta != null && <p>Compared with last term: {card.comparison[0].previous}% to {card.comparison[0].current}% ({card.comparison[0].delta > 0 ? '+' : ''}{card.comparison[0].delta}).</p>}
          </div>
        )}
        {card.integrityNote ? <p className="text-sm" data-note>{card.integrityNote}</p> : <p className="text-sm text-muted-foreground">No integrity note. A note is added only after a teacher confirms a case.</p>}
        <div className="flex flex-wrap items-center gap-4">
          <QRCodeSVG value={verifyUrl} size={96} />
          <p className="text-xs text-muted-foreground max-w-xs">The QR opens the grade only. Comments and integrity notes stay on the private card. {copyrightLine(2026)}</p>
        </div>
        {(side === 'teacher' || side === 'institution') && (
          <button
            type="button"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
            onClick={() => downloadBytes('mina-t4.pdf', buildPdf(card.template.heading, cardPdfLines(card, verifyUrl), 2026), 'application/pdf')}
          >
            Download PDF
          </button>
        )}
        {side === 'institution' && <p className="text-sm">Bulk publish for class A: 3 cards, one push to each linked parent after quiet hours.</p>}
        {side === 'parent' && (
          signed ? <p className="text-sm">Signed by Pat. Reply saved.</p> : (
            <form className="space-y-2" onSubmit={event => { event.preventDefault(); parentSign({ parentId: 'parent1', parentName: 'Pat', reply, at: '2026-10-15T12:00:00.000Z' }); setSigned(true); }}>
              <textarea className="w-full rounded-xl border border-border p-3 text-sm" rows={2} value={reply} onChange={event => setReply(event.target.value)} aria-label="Parent reply" />
              <button type="submit" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Acknowledge and e-sign</button>
            </form>
          )
        )}
      </section>

      <ul className="sr-only" data-checks={checks.every(check => check.actual === check.expected) ? 'pass' : 'fail'}>
        {checks.map(check => (
          <li key={check.label} data-check={check.actual === check.expected ? 'pass' : 'fail'}>{check.label}: {String(check.actual)} expected {String(check.expected)}</li>
        ))}
      </ul>
    </div>
  );
}
