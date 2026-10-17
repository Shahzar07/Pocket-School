'use client';

import { useEffect, useState } from 'react';
import { SafetyTermsNotice } from '@/components/safety/disclaimer';
import { authedFetch, postJSON } from '@/lib/authed-fetch';
import { BRAND } from '@/lib/brand';
import { DESK_NOT_EMERGENCY, channelsFor, mandatoryReportingNote } from '@/lib/bullying/authority-referral';
import { emergencyNumber } from '@/lib/emergency/policy';

interface Channel {
  id: string;
  agency: string;
  how: string;
  sourceUrl: string;
  phone: string;
}

interface Partner {
  id: string;
  name: string;
  kind: string;
  country: string;
}

const buttonStyle = {
  background: BRAND.cyan,
  color: BRAND.ink,
  border: `1px solid ${BRAND.blueDeep}`,
} as const;

const SAMPLE_TEXT = 'sexual exploitation';

export function AuthorityDesk({
  reportId,
  country = 'Malaysia',
  sample = false,
}: {
  reportId: string;
  country?: string;
  sample?: boolean;
}) {
  const [place, setPlace] = useState(country);
  const [channels, setChannels] = useState<Channel[]>(() => (
    sample ? channelsFor(country, SAMPLE_TEXT).map(row => ({
      id: row.id,
      agency: row.agency,
      how: row.how,
      sourceUrl: row.sourceUrl,
      phone: row.phone,
    })) : []
  ));
  const [partners, setPartners] = useState<Partner[]>([]);
  const [mandatory, setMandatory] = useState(() => (
    sample ? mandatoryReportingNote(country, SAMPLE_TEXT) : { note: '', sourceUrl: '' }
  ));
  const [choice, setChoice] = useState<'refer' | 'not_needed' | ''>('');
  const [reason, setReason] = useState('');
  const [channelId, setChannelId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [summary, setSummary] = useState('');
  const [reference, setReference] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [withhold, setWithhold] = useState(false);
  const [withholdReason, setWithholdReason] = useState('');
  const [referralId, setReferralId] = useState('');
  const [pack, setPack] = useState('');
  const [outcome, setOutcome] = useState('');
  const [message, setMessage] = useState('');
  const [termsAcked, setTermsAcked] = useState(sample);
  const number = emergencyNumber(place);
  const needsTerms = () => {
    if (sample || termsAcked) return false;
    setMessage('Read the safety terms and tap I understand. An emergency call does not wait for this.');
    return true;
  };

  useEffect(() => {
    if (sample || !reportId) return;
    let gone = false;
    void authedFetch(`/api/bullying/authority?reportId=${encodeURIComponent(reportId)}`)
      .then(async (res) => res.json().catch(() => ({})))
      .then((data: {
        country?: string;
        channels?: Channel[];
        partners?: Partner[];
        mandatory?: { note: string; sourceUrl: string };
      }) => {
        if (gone) return;
        if (typeof data.country === 'string' && data.country) setPlace(data.country);
        if (Array.isArray(data.channels)) setChannels(data.channels);
        if (Array.isArray(data.partners)) setPartners(data.partners);
        if (data.mandatory) setMandatory(data.mandatory);
      })
      .catch(() => undefined);
    return () => { gone = true; };
  }, [reportId, sample]);

  const decide = async (decision: 'refer' | 'not_needed') => {
    setChoice(decision);
    if (decision === 'not_needed' && reason.trim().length < 3) {
      setMessage('Write why it is not needed. Nothing was sent.');
      return;
    }
    if (sample) {
      setMessage(decision === 'refer'
        ? 'Recorded for this preview. Nothing was sent.'
        : 'Not needed is saved only with a reason. Nothing was sent.');
      return;
    }
    if (needsTerms()) return;
    setMessage('');
    try {
      await postJSON('/api/bullying/authority-decision', { reportId, decision, reason });
      setMessage(decision === 'refer' ? 'Marked to refer. Nothing was sent.' : 'Recorded as not needed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Try again in a moment.');
    }
  };

  const send = async () => {
    if (sample) {
      setMessage('Nothing was sent from this preview.');
      return;
    }
    if (needsTerms()) return;
    setMessage('');
    try {
      const result = await postJSON<{ status: string; id?: string; channel?: string; pack?: string }>('/api/bullying/authority-send', {
        reportId,
        send: true,
        summary,
        channelId: partnerId ? '' : channelId,
        partnerId,
        reference,
        evidenceId,
        withholdStudent: withhold,
        withholdReason,
      });
      if (result.id) setReferralId(result.id);
      setPack(result.pack ?? '');
      setMessage(result.channel && result.channel !== 'partner'
        ? 'Saved as a referral pack. Submit it on the official page. Nothing was emailed.'
        : 'The referral was sent. The reporter is not named.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Try again in a moment.');
    }
  };

  const saveOutcome = async () => {
    if (sample) {
      setMessage('Outcome stays in this preview. Nothing was sent.');
      return;
    }
    if (!referralId) {
      setMessage('Send the referral before recording an outcome.');
      return;
    }
    if (needsTerms()) return;
    setMessage('');
    try {
      await postJSON('/api/bullying/authority-outcome', { id: referralId, outcome });
      setMessage('Outcome saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Try again in a moment.');
    }
  };

  return (
    <section className="rounded-3xl border bg-white p-5 grid gap-3" style={{ color: BRAND.ink }}>
      <h2 className="text-2xl font-semibold" style={{ color: BRAND.blueDeep }}>Refer to the authorities</h2>
      <p className="text-4xl font-extrabold">Call {number}</p>
      <p className="font-semibold">{DESK_NOT_EMERGENCY}</p>
      <SafetyTermsNotice sample={sample} emergencyNumber={number} onAcked={() => setTermsAcked(true)} />
      <p>A Desk member sends this. Nothing is sent automatically. The reporter is not named.</p>
      {sample ? <p className="text-sm">Sample case. Nothing is sent from this preview.</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="inline-flex min-h-12 items-center rounded-xl px-4 font-semibold" style={buttonStyle} onClick={() => void decide('refer')}>Refer</button>
        <button type="button" className="inline-flex min-h-12 items-center rounded-xl border px-4 font-semibold" style={{ borderColor: BRAND.blueDeep, color: BRAND.blueDeep }} onClick={() => void decide('not_needed')}>Not needed</button>
      </div>
      {choice === 'not_needed' ? (
        <label className="grid gap-1 text-sm font-semibold">
          Why it is not needed
          <textarea
            className="min-h-20 rounded-xl border p-3 font-normal"
            style={{ borderColor: '#D5E3E7' }}
            value={reason}
            aria-label="Why it is not needed"
            onChange={event => setReason(event.target.value)}
          />
          <button type="button" className="inline-flex min-h-12 items-center rounded-xl border px-4 font-semibold" style={{ borderColor: BRAND.blueDeep, color: BRAND.blueDeep }} onClick={() => void decide('not_needed')}>Save decision</button>
        </label>
      ) : null}
      <h3 className="text-lg font-semibold" style={{ color: BRAND.blueDeep }}>Verified partners</h3>
      {partners.length === 0 ? <p>No verified partner is on file for this country.</p> : partners.map(partner => (
        <label key={partner.id} className="flex min-h-12 items-center gap-2 text-sm">
          <input
            type="radio"
            name="authority-partner"
            checked={partnerId === partner.id}
            onChange={() => { setPartnerId(partner.id); setChannelId(''); }}
          />
          <span>{partner.name}</span>
        </label>
      ))}
      <h3 className="text-lg font-semibold" style={{ color: BRAND.blueDeep }}>Official channel</h3>
      {channels.length === 0 ? <p>No verified official channel is on file for this country.</p> : channels.map(channel => (
        <label key={channel.id} className="grid gap-1 text-sm">
          <span className="flex min-h-12 items-center gap-2">
            <input
              type="radio"
              name="authority-channel"
              checked={channelId === channel.id}
              onChange={() => { setChannelId(channel.id); setPartnerId(''); }}
            />
            <span className="font-semibold">{channel.agency}</span>
            {channel.phone ? <span>{channel.phone}</span> : null}
          </span>
          <span>{channel.how}</span>
          <a href={channel.sourceUrl} className="break-all underline" style={{ color: BRAND.blueDeep }}>{channel.sourceUrl}</a>
        </label>
      ))}
      {mandatory.note ? (
        <p>
          <span className="font-semibold" style={{ color: BRAND.blueDeep }}>Mandatory reporting. </span>
          {mandatory.note}{' '}
          {mandatory.sourceUrl ? <a href={mandatory.sourceUrl} className="break-all underline" style={{ color: BRAND.blueDeep }}>{mandatory.sourceUrl}</a> : null}
        </p>
      ) : null}
      <label className="grid gap-1 text-sm font-semibold">
        Case summary
        <textarea
          className="min-h-24 rounded-xl border p-3 font-normal"
          style={{ borderColor: '#D5E3E7' }}
          value={summary}
          aria-label="Case summary"
          placeholder="A short account with no names"
          onChange={event => setSummary(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Official reference
        <input
          className="min-h-12 rounded-xl border px-3 font-normal"
          style={{ borderColor: '#D5E3E7' }}
          value={reference}
          aria-label="Official reference"
          onChange={event => setReference(event.target.value)}
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
        <input type="checkbox" checked={withhold} onChange={event => setWithhold(event.target.checked)} />
        <span>Do not tell the student</span>
      </label>
      {withhold ? (
        <label className="grid gap-1 text-sm font-semibold">
          Write why telling the student would put them at risk.
          <textarea
            className="min-h-20 rounded-xl border p-3 font-normal"
            style={{ borderColor: '#D5E3E7' }}
            value={withholdReason}
            aria-label="Write why telling the student would put them at risk."
            onChange={event => setWithholdReason(event.target.value)}
          />
        </label>
      ) : null}
      <button type="button" className="inline-flex min-h-12 items-center rounded-xl px-4 font-semibold" style={buttonStyle} onClick={() => void send()}>Send referral</button>
      {pack ? <pre className="whitespace-pre-wrap rounded-xl border p-3 text-sm" style={{ borderColor: '#D5E3E7' }}>{pack}</pre> : null}
      <label className="grid gap-1 text-sm font-semibold">
        What the authority did
        <textarea
          className="min-h-20 rounded-xl border p-3 font-normal"
          style={{ borderColor: '#D5E3E7' }}
          value={outcome}
          aria-label="What the authority did"
          onChange={event => setOutcome(event.target.value)}
        />
      </label>
      <button type="button" className="inline-flex min-h-12 items-center rounded-xl border px-4 font-semibold" style={{ borderColor: BRAND.blueDeep, color: BRAND.blueDeep }} onClick={() => void saveOutcome()}>Save outcome</button>
      {message ? <p className="text-sm font-semibold">{message}</p> : null}
    </section>
  );
}
