'use client';

import { useEffect, useState } from 'react';
import { authedFetch, postJSON } from '@/lib/authed-fetch';
import { BRAND } from '@/lib/brand';

interface NoticeRow {
  id: string;
  schoolName: string;
  side: string;
  status: string;
  task: string;
  contactSource: string;
}

const buttonStyle = {
  background: BRAND.cyan,
  color: BRAND.ink,
  border: `1px solid ${BRAND.blueDeep}`,
} as const;

export function InformSchool({
  reportId,
  victimSchoolName,
  bullySchoolName,
  victimOnPoket = false,
  bullyOnPoket = false,
  sample = false,
}: {
  reportId: string;
  victimSchoolName: string;
  bullySchoolName: string;
  victimOnPoket?: boolean;
  bullyOnPoket?: boolean;
  sample?: boolean;
}) {
  const [side, setSide] = useState<'victim' | 'bully'>('victim');
  const [summary, setSummary] = useState('');
  const [dates, setDates] = useState(sample ? '12 October 2026' : '');
  const [sourceUrl, setSourceUrl] = useState('');
  const [email, setEmail] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [seriousRisk, setSeriousRisk] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [message, setMessage] = useState('');
  const [ackUrl, setAckUrl] = useState('');
  const [notices, setNotices] = useState<NoticeRow[]>(sample ? [{
    id: 'sample-notice',
    schoolName: victimSchoolName || 'Sample Off Platform School',
    side: 'victim',
    status: 'find_contact',
    task: 'Find contact',
    contactSource: '',
  }] : []);

  useEffect(() => {
    if (sample || !reportId) return;
    let gone = false;
    void authedFetch(`/api/bullying/school-notice?reportId=${encodeURIComponent(reportId)}`)
      .then(async (res) => res.json().catch(() => ({})))
      .then((data: { notices?: NoticeRow[] }) => {
        if (!gone && Array.isArray(data.notices)) setNotices(data.notices);
      })
      .catch(() => undefined);
    return () => { gone = true; };
  }, [reportId, sample]);

  const chosen = side === 'bully'
    ? { name: bullySchoolName, onPoket: bullyOnPoket }
    : { name: victimSchoolName, onPoket: victimOnPoket };

  const submit = async (channel: 'email' | 'phone' | 'letter', reached: boolean, emailSend: boolean) => {
    if (chosen.onPoket) {
      setMessage('That school is on Poket School. Use the safeguarding referral.');
      return;
    }
    if (!chosen.name) {
      setMessage('Add the school name on the report first.');
      return;
    }
    if (sample) {
      setMessage(emailSend ? 'Nothing was sent from this preview.' : 'Find contact. Nothing was sent.');
      return;
    }
    setMessage('');
    try {
      const result = await postJSON<{ status: string; task?: string; ackUrl?: string }>('/api/bullying/school-notice', {
        reportId,
        side,
        summary,
        dates,
        sourceUrl,
        email,
        evidenceId,
        seriousRisk,
        overrideReason,
        channel,
        reached,
        send: emailSend,
      });
      setAckUrl(result.ackUrl ?? '');
      if (result.task) setMessage(`${result.task}. Nothing was sent.`);
      else if (result.status === 'sent') setMessage('The school has the notice. The reporter is not named.');
      else setMessage('Saved for review. Nothing was sent.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Try again in a moment.');
    }
  };

  return (
    <section className="rounded-3xl border bg-white p-5 grid gap-3" style={{ color: BRAND.ink }}>
      <h2 className="text-2xl font-semibold" style={{ color: BRAND.blueDeep }}>Inform a school</h2>
      <p>A Desk member reviews every notice. Nothing is sent until you send it. The reporter is not named.</p>
      {notices.map(notice => (
        <p key={notice.id} className="text-sm">
          <span className="font-semibold">{notice.schoolName || 'School'}</span>
          {notice.task ? ` · ${notice.task}` : ` · ${notice.status}`}
        </p>
      ))}
      <label className="grid gap-1 text-sm font-semibold">
        Which school
        <select
          className="min-h-12 rounded-xl border px-3 font-normal"
          style={{ borderColor: '#D5E3E7' }}
          value={side}
          aria-label="Which school"
          onChange={event => setSide(event.target.value === 'bully' ? 'bully' : 'victim')}
        >
          <option value="victim">{victimSchoolName || 'The student\'s school'}</option>
          <option value="bully">{bullySchoolName || 'The other student\'s school'}</option>
        </select>
      </label>
      {chosen.onPoket ? <p className="text-sm font-semibold">That school is on Poket School. Use the safeguarding referral.</p> : null}
      <label className="grid gap-1 text-sm font-semibold">
        Summary
        <textarea
          className="min-h-24 rounded-xl border p-3 font-normal"
          style={{ borderColor: '#D5E3E7' }}
          value={summary}
          aria-label="Summary"
          placeholder="A short account with no names"
          onChange={event => setSummary(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Dates
        <input
          className="min-h-12 rounded-xl border px-3 font-normal"
          style={{ borderColor: '#D5E3E7' }}
          value={dates}
          aria-label="Dates"
          onChange={event => setDates(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Official page
        <input
          className="min-h-12 rounded-xl border px-3 font-normal"
          style={{ borderColor: '#D5E3E7' }}
          value={sourceUrl}
          aria-label="Official page"
          placeholder="https://"
          onChange={event => setSourceUrl(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Official email
        <input
          className="min-h-12 rounded-xl border px-3 font-normal"
          style={{ borderColor: '#D5E3E7' }}
          value={email}
          aria-label="Official email"
          placeholder="Copied from the official page"
          onChange={event => setEmail(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Evidence record
        <input
          className="min-h-12 rounded-xl border px-3 font-normal"
          style={{ borderColor: '#D5E3E7' }}
          value={evidenceId}
          aria-label="Evidence record"
          onChange={event => setEvidenceId(event.target.value)}
        />
      </label>
      <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={seriousRisk} onChange={event => setSeriousRisk(event.target.checked)} />
        <span>Serious risk, tell the school without consent</span>
      </label>
      {seriousRisk ? (
        <label className="grid gap-1 text-sm font-semibold">
          Why this child is at serious risk
          <textarea
            className="min-h-20 rounded-xl border p-3 font-normal"
            style={{ borderColor: '#D5E3E7' }}
            value={overrideReason}
            aria-label="Why this child is at serious risk"
            onChange={event => setOverrideReason(event.target.value)}
          />
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="inline-flex min-h-12 items-center rounded-xl px-4 font-semibold" style={buttonStyle} onClick={() => void submit('email', false, true)}>Send notice</button>
        <button type="button" className="inline-flex min-h-12 items-center rounded-xl border px-4 font-semibold" style={{ borderColor: BRAND.blueDeep, color: BRAND.blueDeep }} onClick={() => void submit('phone', true, false)}>Log a phone call</button>
        <button type="button" className="inline-flex min-h-12 items-center rounded-xl border px-4 font-semibold" style={{ borderColor: BRAND.blueDeep, color: BRAND.blueDeep }} onClick={() => void submit('letter', true, false)}>Log a letter</button>
      </div>
      {message ? <p className="text-sm font-semibold">{message}</p> : null}
      {ackUrl ? <p className="break-all text-sm">Put this link on the letter. It is not emailed. {ackUrl}</p> : null}
    </section>
  );
}
