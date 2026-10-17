'use client';

import { FormEvent, useState } from 'react';
import { BRAND } from '@/lib/brand';
import { PARTNER_TYPES } from '@/lib/community/partners';

const field = 'min-h-12 w-full rounded-xl border px-3 font-normal';

export function PartnersForm() {
  const [orgName, setOrgName] = useState('');
  const [type, setType] = useState('school');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [message, setMessage] = useState('');
  const [companyFax, setCompanyFax] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNote('');
    try {
      const response = await fetch('/api/community-partners', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgName, type, country, region, contactName, email, phone, website, message, companyFax }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; comingSoon?: boolean; message?: string; stored?: boolean };
      if (data.comingSoon) setNote(data.message || 'Partner applications are coming soon.');
      else if (!response.ok) setNote(data.error || 'Try again in a moment.');
      else setNote(data.stored ? 'Sent. A person will review this. Nothing is granted yet.' : 'Sent.');
    } catch {
      setNote('Partner applications are coming soon.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={event => void submit(event)} className="grid gap-3 rounded-3xl border bg-white p-5">
      <h2 className="text-2xl font-semibold" style={{ color: BRAND.blueDeep }}>Tell us about your organisation</h2>
      <label className="grid gap-1 text-sm font-semibold">Organisation
        <input className={field} style={{ borderColor: '#D5E3E7' }} value={orgName} onChange={event => setOrgName(event.target.value)} aria-label="Organisation" />
      </label>
      <label className="grid gap-1 text-sm font-semibold">Partner type
        <select className={field} style={{ borderColor: '#D5E3E7' }} value={type} onChange={event => setType(event.target.value)} aria-label="Partner type">
          {PARTNER_TYPES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">Country
          <input className={field} style={{ borderColor: '#D5E3E7' }} value={country} onChange={event => setCountry(event.target.value)} aria-label="Country" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">Region
          <input className={field} style={{ borderColor: '#D5E3E7' }} value={region} onChange={event => setRegion(event.target.value)} aria-label="Region" />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-semibold">Contact name
        <input className={field} style={{ borderColor: '#D5E3E7' }} value={contactName} onChange={event => setContactName(event.target.value)} aria-label="Contact name" />
      </label>
      <label className="grid gap-1 text-sm font-semibold">Email
        <input className={field} style={{ borderColor: '#D5E3E7' }} type="email" value={email} onChange={event => setEmail(event.target.value)} aria-label="Email" />
      </label>
      <label className="grid gap-1 text-sm font-semibold">Phone
        <input className={field} style={{ borderColor: '#D5E3E7' }} value={phone} onChange={event => setPhone(event.target.value)} aria-label="Phone" />
      </label>
      <label className="grid gap-1 text-sm font-semibold">Website
        <input className={field} style={{ borderColor: '#D5E3E7' }} value={website} onChange={event => setWebsite(event.target.value)} aria-label="Website" placeholder="https://" />
      </label>
      <label className="grid gap-1 text-sm font-semibold">Message
        <textarea className="min-h-24 rounded-xl border p-3 font-normal" style={{ borderColor: '#D5E3E7' }} value={message} onChange={event => setMessage(event.target.value)} aria-label="Message" />
      </label>
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px' }}>
        <input tabIndex={-1} autoComplete="off" value={companyFax} onChange={event => setCompanyFax(event.target.value)} />
      </div>
      <button type="submit" disabled={busy} className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-semibold" style={{ background: BRAND.cyan, color: BRAND.ink, border: `1px solid ${BRAND.blueDeep}` }}>
        Send application
      </button>
      <p className="text-sm" style={{ color: BRAND.blueDeep }}>Applying grants nothing until an admin verifies the organisation.</p>
      {note ? <p className="text-sm font-semibold" style={{ color: BRAND.ink }}>{note}</p> : null}
    </form>
  );
}
