'use client';

import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { shareLinks } from '@/lib/credentials/badge-model';
import {
  APPLICATION_STATUSES,
  linkedInPack,
  type ApplicationStatus,
  type JobApplication,
} from '@/lib/linkedin';
import type { RecordItem } from '@/lib/portfolio';

interface ShareLinkRow {
  token: string;
  label: string;
  expiresOn: string;
  revoked: boolean;
  open: boolean;
  tracker: { total: number; latest: string; items: { title: string; count: number }[] };
}

interface VerificationRequestRow {
  id: string;
  itemTitle: string;
  note: string;
  visitorLabel: string;
  status: string;
}

export function LinkedInCopy({ name, studentNumber, items }: { name: string; studentNumber: string; items: readonly RecordItem[] }) {
  const pack = linkedInPack({
    name,
    studentNumber,
    items: items.map((item) => ({ source: item.source, kind: item.kind, title: item.title, detail: item.detail, when: item.when })),
  });
  const share = pack.featured ? shareLinks(pack.featured, `${name} on Poket School`) : null;
  return (
    <section className="rounded-[28px] border border-[#203337]/10 bg-white p-6 text-[#203337]">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]">LinkedIn</p>
      <h2 className="mt-1 font-heading text-3xl tracking-tight">Featured and contact</h2>
      <p className="mt-2 text-sm leading-relaxed">Paste the portfolio link into LinkedIn Featured and into Contact info as a website. The text below is ready for About, Experience, and Education.</p>
      {pack.featured ? (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <QRCodeSVG value={pack.featured} size={88} fgColor="#203337" bgColor="#ffffff" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold">Featured</p>
            <p className="truncate">{pack.featured}</p>
            <p className="mt-2 font-semibold">Contact info website</p>
            <p className="truncate">{pack.website}</p>
            {share ? <a className="mt-2 inline-flex text-sm font-semibold text-[#3C8DFF]" href={share.linkedin} target="_blank" rel="noreferrer">Share to LinkedIn</a> : null}
          </div>
        </div>
      ) : null}
      <CopyBlock title="About" text={pack.about} />
      <CopyBlock title="Experience" text={pack.experience} />
      <CopyBlock title="Education" text={pack.education} />
    </section>
  );
}

function CopyBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-4 rounded-2xl bg-[#F6F1E7] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1E6A83]">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
    </div>
  );
}

export function JobTracker({ items }: { items: readonly RecordItem[] }) {
  const [links, setLinks] = useState<ShareLinkRow[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [reminders, setReminders] = useState<JobApplication[]>([]);
  const [requests, setRequests] = useState<VerificationRequestRow[]>([]);
  const [linked, setLinked] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [label, setLabel] = useState('Company X - Analyst');
  const [days, setDays] = useState('30');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [link, setLink] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('applied');
  const [date, setDate] = useState('');
  const [shareToken, setShareToken] = useState('');
  const [reminderOn, setReminderOn] = useState('');
  const [jobText, setJobText] = useState('');
  const [bullets, setBullets] = useState<string[]>([]);

  const load = useCallback(() => {
    void authedFetch('/api/applications')
      .then((data) => {
        setLinks(Array.isArray(data.links) ? data.links as unknown as ShareLinkRow[] : []);
        setApplications(Array.isArray(data.applications) ? data.applications as unknown as JobApplication[] : []);
        setReminders(Array.isArray(data.reminders) ? data.reminders as unknown as JobApplication[] : []);
        setRequests(Array.isArray(data.requests) ? data.requests as unknown as VerificationRequestRow[] : []);
        setLinked(data.linkedInLinked === true);
      })
      .catch(() => undefined);
    void fetch('/api/auth/linkedin')
      .then((response) => response.json())
      .then((data: { enabled?: boolean }) => setSignIn(data.enabled === true))
      .catch(() => setSignIn(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="grid gap-6">
      <div className="rounded-[28px] border border-[#203337]/10 bg-white p-6 text-[#203337]">
        <h2 className="font-heading text-3xl tracking-tight">Job applications</h2>
        <p className="mt-2 text-sm leading-relaxed">Log a company, role, link, status, and date. Attach a share link for that application. Poket School reminds you here. It does not apply on LinkedIn for you.</p>
        {signIn ? (
          <button type="button" className="mt-3 text-sm font-semibold text-[#3C8DFF]" onClick={() => {
            void authedFetch('/api/auth/linkedin', { method: 'POST', body: '{}' })
              .then((data) => {
                if (typeof data.url === 'string') window.location.href = data.url;
              })
              .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not open LinkedIn.'));
          }}>
            {linked ? 'LinkedIn is linked. Link again' : 'Link LinkedIn'}
          </button>
        ) : <p className="mt-3 text-sm">Sign in with LinkedIn appears once the LinkedIn app keys are set.</p>}
        {reminders.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-2xl bg-[#E9F7FA] p-4 text-sm">
            {reminders.map((item) => <li key={item.id}>Reminder: {item.company} · {item.role} · {item.reminderOn}</li>)}
          </ul>
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Company" value={company} onChange={setCompany} />
          <Field label="Role" value={role} onChange={setRole} />
          <Field label="Job link" value={link} onChange={setLink} />
          <label className="text-sm">Status
            <select value={status} onChange={(event) => setStatus(event.target.value as ApplicationStatus)} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3">
              {APPLICATION_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <Field label="Date" value={date} onChange={setDate} />
          <label className="text-sm">Share link
            <select value={shareToken} onChange={(event) => setShareToken(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3">
              <option value="">None</option>
              {links.filter((item) => item.open).map((item) => <option key={item.token} value={item.token}>{item.label}</option>)}
            </select>
          </label>
          <Field label="Remind me on" value={reminderOn} onChange={setReminderOn} />
        </div>
        <button type="button" className="mt-4 h-11 rounded-full bg-[#203337] px-5 text-sm font-semibold text-white" onClick={() => {
          void authedFetch('/api/applications', {
            method: 'POST',
            body: JSON.stringify({ action: 'save-application', company, role, link, status, date, shareToken, reminderOn }),
          })
            .then(() => { toast.success('Application saved.'); load(); })
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not save the application.'));
        }}>
          Save application
        </button>
        <ul className="mt-4 space-y-2 text-sm">
          {applications.map((item) => (
            <li key={item.id} className="rounded-xl border border-[#203337]/10 px-3 py-2">
              {item.company} · {item.role} · {item.status} · {item.date}
              {item.link ? <a className="ml-2 text-[#3C8DFF]" href={item.link}>Posting</a> : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-[28px] border border-[#203337]/10 bg-white p-6 text-[#203337]">
        <h2 className="font-heading text-3xl tracking-tight">Employer share links</h2>
        <p className="mt-2 text-sm leading-relaxed">Each link expires. You see when it was opened, how many times, and which verified item was opened. A visitor’s note is stored only if they type one.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input value={label} onChange={(event) => setLabel(event.target.value)} className="h-11 flex-1 rounded-xl border border-border bg-background px-3" />
          <input value={days} onChange={(event) => setDays(event.target.value)} className="h-11 w-24 rounded-xl border border-border bg-background px-3" />
          <button type="button" className="h-11 rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-5 text-sm font-semibold text-[#203337]" onClick={() => {
            void authedFetch('/api/applications', {
              method: 'POST',
              body: JSON.stringify({ action: 'create-link', label, days: Number(days) }),
            })
              .then((data) => {
                toast.success(typeof data.url === 'string' ? data.url : 'Share link ready.');
                load();
              })
              .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not create the link.'));
          }}>
            Create link
          </button>
        </div>
        <ul className="mt-4 space-y-3 text-sm">
          {links.map((item) => (
            <li key={item.token} className="rounded-xl border border-[#203337]/10 px-3 py-2">
              <p className="font-medium">{item.label}</p>
              <p>{item.open ? `Open until ${item.expiresOn}` : 'Closed'} · {item.tracker.total} view{item.tracker.total === 1 ? '' : 's'}</p>
              {item.tracker.latest ? <p>Latest {item.tracker.latest}</p> : null}
              <ul>
                {item.tracker.items.map((opened) => <li key={opened.title}>{opened.title} · {opened.count}</li>)}
              </ul>
              {item.open ? (
                <button type="button" className="mt-1 text-xs font-semibold" onClick={() => {
                  void authedFetch('/api/applications', { method: 'POST', body: JSON.stringify({ action: 'revoke-link', token: item.token }) })
                    .then(() => load())
                    .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not close the link.'));
                }}>Close link</button>
              ) : null}
            </li>
          ))}
        </ul>
        {requests.filter((item) => item.status === 'open').length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Verification requests</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {requests.filter((item) => item.status === 'open').map((item) => (
                <li key={item.id} className="rounded-xl bg-[#F6F1E7] px-3 py-2">
                  <p>{item.itemTitle}</p>
                  <p>{item.note}{item.visitorLabel ? ` · ${item.visitorLabel}` : ''}</p>
                  <button type="button" className="mt-1 font-semibold" onClick={() => {
                    void authedFetch('/api/applications', { method: 'POST', body: JSON.stringify({ action: 'confirm-verification', requestId: item.id }) })
                      .then(() => { toast.success('You confirmed this item.'); load(); })
                      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not confirm.'));
                  }}>Confirm</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-[28px] border border-[#203337]/10 bg-white p-6 text-[#203337]">
        <h2 className="font-heading text-3xl tracking-tight">Tailor from the record</h2>
        <p className="mt-2 text-sm leading-relaxed">Paste a job description. ET AI restates verified achievements that already match. It does not add a skill from the posting.</p>
        <textarea value={jobText} onChange={(event) => setJobText(event.target.value)} className="mt-3 min-h-28 w-full rounded-xl border border-border bg-background p-3 text-sm" />
        <button type="button" className="mt-3 h-11 rounded-full bg-[#203337] px-5 text-sm font-semibold text-white" onClick={() => {
          void authedFetch('/api/applications', { method: 'POST', body: JSON.stringify({ action: 'tailor', jobText }) })
            .then((data) => setBullets(Array.isArray(data.bullets) ? data.bullets.filter((item): item is string => typeof item === 'string') : []))
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not tailor the bullets.'));
        }}>
          Tailor bullets
        </button>
        <ul className="mt-3 space-y-1 text-sm">
          {bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
        </ul>
        <p className="mt-2 text-xs">Reviewed from {items.filter((item) => item.source === 'verified').length} verified achievements.</p>
      </div>
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm">{label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" />
    </label>
  );
}
