'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCard, EmptyState, StatCard } from '@/components/dashboard';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { authedFetch, postJSON } from '@/lib/authed-fetch';
import { EMERGENCY_TYPES } from '@/lib/emergency/policy';
import {
  ADDRESSED_TO,
  HOTLINE_CATEGORIES,
  HOTLINE_PRIORITIES,
  HOTLINE_STATUSES,
} from '@/lib/hotline/policy';

interface TicketRow {
  id: string;
  category: string;
  priority: string;
  status: string;
  body: string;
  slaDueAt: number;
  addressedTo: string;
  solvedAt: number;
  satisfaction: { rating?: number } | null;
}

interface Analytics {
  byCategory: { category: string; n: number }[];
  slaCompliance: number | null;
  averageResolutionMs: number | null;
  satisfaction: number | null;
  overdue: number | null;
}

const SAMPLE_NOW = Date.now();

const SAMPLE_TICKETS: TicketRow[] = [
  {
    id: 'sample-late',
    category: 'attendance',
    priority: 'medium',
    status: 'in_progress',
    body: 'Late pickup on Thursday',
    slaDueAt: SAMPLE_NOW + 3 * 60 * 60 * 1000,
    addressedTo: 'teacher',
    solvedAt: 0,
    satisfaction: null,
  },
  {
    id: 'sample-bus',
    category: 'transport',
    priority: 'high',
    status: 'pending',
    body: 'The bus was late twice this week',
    slaDueAt: SAMPLE_NOW - 40 * 60 * 1000,
    addressedTo: 'academic_lead',
    solvedAt: 0,
    satisfaction: null,
  },
  {
    id: 'sample-solved',
    category: 'academic',
    priority: 'low',
    status: 'solved',
    body: 'Homework load this week',
    slaDueAt: SAMPLE_NOW - 2 * 24 * 60 * 60 * 1000,
    addressedTo: 'teacher',
    solvedAt: SAMPLE_NOW - 60 * 60 * 1000,
    satisfaction: null,
  },
];

const SAMPLE_ANALYTICS: Analytics = {
  byCategory: [
    { category: 'attendance', n: 8 },
    { category: 'academic', n: 6 },
  ],
  slaCompliance: 0.84,
  averageResolutionMs: 18 * 60 * 60 * 1000,
  satisfaction: 4.2,
  overdue: 5,
};

function titleCase(value: string): string {
  return value.replace(/_/g, ' ');
}

function slaLabel(due: number, now: number, status: string): string {
  if (status === 'solved' || status === 'closed') return 'SLA closed';
  const delta = due - now;
  const minutes = Math.max(1, Math.round(Math.abs(delta) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const clock = hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
  return delta < 0 ? `Overdue by ${clock}` : `Due in ${clock}`;
}

function useClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function fieldClass(): string {
  return 'min-h-12 w-full rounded-xl border border-border bg-card px-3 text-sm font-normal';
}

function AuditBar({
  kind,
  id,
  sample,
  onNote,
}: {
  kind: 'hotline' | 'emergency';
  id: string;
  sample: boolean;
  onNote: (text: string) => void;
}) {
  const verify = async () => {
    if (sample || !id) {
      onNote(id ? 'Chain matches. This sample desk does not call the server.' : 'Open a ticket or an alert first.');
      return;
    }
    const response = await authedFetch(`/api/${kind}/verify?id=${encodeURIComponent(id)}`);
    const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
    onNote(response.ok ? 'Chain matches.' : (data.error || 'The chain did not verify.'));
  };
  const exportHref = (format: 'csv' | 'pdf') => (
    sample || !id ? undefined : `/api/${kind}/export?id=${encodeURIComponent(id)}&format=${format}`
  );
  return (
    <section className="rounded-[18px] border border-border bg-card p-4 grid gap-3">
      <h2 className="font-heading text-xl">Audit log</h2>
      <p className="text-sm text-muted-foreground">Verify integrity checks the hash chain. Export is CSV or PDF for a school lead.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void verify()} className="min-h-12 rounded-xl bg-primary px-4 font-semibold text-primary-foreground">Verify integrity</button>
        <a className="min-h-12 inline-flex items-center rounded-xl border border-border px-4 font-semibold" href={exportHref('csv') ?? '#'} onClick={event => { if (!exportHref('csv')) event.preventDefault(); }}>CSV</a>
        <a className="min-h-12 inline-flex items-center rounded-xl border border-border px-4 font-semibold" href={exportHref('pdf') ?? '#'} onClick={event => { if (!exportHref('pdf')) event.preventDefault(); }}>PDF</a>
      </div>
    </section>
  );
}

export function ParentHotlineLive({
  sample = false,
  childIds = [],
}: {
  sample?: boolean;
  childIds?: string[];
}) {
  const now = useClock();
  const [tickets, setTickets] = useState<TicketRow[]>(sample ? SAMPLE_TICKETS : []);
  const [studentId, setStudentId] = useState(childIds[0] ?? (sample ? 'child-sample' : ''));
  const [category, setCategory] = useState('attendance');
  const [priority, setPriority] = useState('medium');
  const [addressedTo, setAddressedTo] = useState('teacher');
  const [body, setBody] = useState(sample ? 'Late pickup on Thursday' : '');
  const [authoritiesRequired, setAuthoritiesRequired] = useState('unsure');
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState('5');
  const [busy, setBusy] = useState(false);
  const [auditId, setAuditId] = useState(sample ? SAMPLE_TICKETS[0].id : '');

  useEffect(() => {
    if (childIds[0]) setStudentId(childIds[0]);
  }, [childIds]);

  useEffect(() => {
    if (sample) return;
    let gone = false;
    void (async () => {
      const response = await authedFetch('/api/hotline/list');
      const data = await response.json().catch(() => ({})) as { error?: string } | TicketRow[];
      if (gone) return;
      if (Array.isArray(data)) setTickets(data.filter(row => typeof row.body === 'string'));
      else if (data.error) setNote(data.error);
    })();
    return () => { gone = true; };
  }, [sample]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNote('');
    if (sample) {
      const created: TicketRow = {
        id: `sample-${tickets.length + 1}`,
        category,
        priority,
        status: 'pending',
        body,
        slaDueAt: Date.now() + 8 * 60 * 60 * 1000,
        addressedTo,
        solvedAt: 0,
        satisfaction: null,
      };
      setTickets(current => [created, ...current]);
      setAuditId(created.id);
      setNote('Sent to the school.');
      setBusy(false);
      return;
    }
    try {
      const created = await postJSON<{ id: string; slaDueAt: number }>('/api/hotline/create', {
        studentId,
        category,
        priority,
        addressedTo,
        body,
        authoritiesRequired,
      });
      setTickets(current => [{
        id: created.id,
        category,
        priority,
        status: 'pending',
        body,
        slaDueAt: created.slaDueAt,
        addressedTo,
        solvedAt: 0,
        satisfaction: null,
      }, ...current]);
      setAuditId(created.id);
      setBody('');
      setNote('Sent to the school.');
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const act = async (id: string, kind: 'comment' | 'rate' | 'reopen') => {
    setBusy(true);
    setNote('');
    if (sample) {
      if (kind === 'reopen') {
        setTickets(current => current.map(row => row.id === id ? { ...row, status: 'pending' } : row));
      }
      setNote(kind === 'rate' ? 'Rating saved.' : kind === 'reopen' ? 'Reopened.' : 'Comment sent.');
      setBusy(false);
      return;
    }
    try {
      if (kind === 'comment') await postJSON('/api/hotline/comment', { ticketId: id, body: comment });
      if (kind === 'rate') await postJSON('/api/hotline/rate', { ticketId: id, rating: Number(rating), comment });
      if (kind === 'reopen') await postJSON('/api/hotline/reopen', { ticketId: id });
      if (kind === 'reopen') setTickets(current => current.map(row => row.id === id ? { ...row, status: 'pending' } : row));
      setNote(kind === 'rate' ? 'Rating saved.' : kind === 'reopen' ? 'Reopened.' : 'Comment sent.');
      setComment('');
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow="Poket School"
        title="School hotline"
        description="Write to your child’s school. Safeguarding notes go only to the principal or the safeguarding lead."
      />
      <form onSubmit={event => void create(event)} className="grid gap-3 rounded-[24px] border border-border bg-card p-4">
        <h2 className="font-heading text-xl">New ticket</h2>
        {childIds.length > 1 ? (
          <label className="grid gap-1 text-sm font-semibold">Child
            <select className={fieldClass()} value={studentId} onChange={event => setStudentId(event.target.value)} aria-label="Child">
              {childIds.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
        ) : (
          <label className="grid gap-1 text-sm font-semibold">Child
            <input className={fieldClass()} value={studentId} onChange={event => setStudentId(event.target.value)} aria-label="Child" />
          </label>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold">Category
            <select className={fieldClass()} value={category} onChange={event => setCategory(event.target.value)} aria-label="Category">
              {HOTLINE_CATEGORIES.map(item => <option key={item} value={item}>{titleCase(item)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Priority
            <select className={fieldClass()} value={priority} onChange={event => setPriority(event.target.value)} aria-label="Priority">
              {HOTLINE_PRIORITIES.map(item => <option key={item} value={item}>{titleCase(item)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Send to
            <select className={fieldClass()} value={addressedTo} onChange={event => setAddressedTo(event.target.value)} aria-label="Send to">
              {ADDRESSED_TO.map(item => <option key={item} value={item}>{titleCase(item)}</option>)}
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-sm font-semibold">What should the school know
          <textarea className="min-h-24 rounded-xl border border-border p-3 font-normal" value={body} onChange={event => setBody(event.target.value)} aria-label="What should the school know" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">Authorities
          <select className={fieldClass()} value={authoritiesRequired} onChange={event => setAuthoritiesRequired(event.target.value)} aria-label="Authorities">
            <option value="unsure">Not sure yet</option>
            <option value="yes">To be informed</option>
            <option value="no">Not required</option>
          </select>
        </label>
        <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-primary px-4 font-semibold text-primary-foreground">Send to the school</button>
      </form>
      {note ? <AlertCard tone="good" title="Hotline" detail={note} /> : null}
      {tickets.length === 0 ? (
        <Panel><EmptyState title="No tickets yet" detail="A ticket you send will stay here so you can follow it." /></Panel>
      ) : tickets.map(ticket => (
        <article key={ticket.id} className="grid gap-3 rounded-[24px] border border-border bg-card p-4">
          <div className="flex flex-wrap gap-2">
            <span className="min-h-9 inline-flex items-center rounded-full bg-muted px-3 text-xs font-bold">{titleCase(ticket.status)}</span>
            <span className="min-h-9 inline-flex items-center rounded-full bg-muted px-3 text-xs font-bold">{titleCase(ticket.category)}</span>
            <span className="min-h-9 inline-flex items-center rounded-full bg-muted px-3 text-xs font-bold">{slaLabel(ticket.slaDueAt, now, ticket.status)}</span>
          </div>
          <h2 className="font-heading text-xl">{ticket.body}</h2>
          <p className="text-sm text-muted-foreground">With the {titleCase(ticket.addressedTo)}.</p>
          <label className="grid gap-1 text-sm font-semibold">Reply
            <input className={fieldClass()} value={comment} onChange={event => setComment(event.target.value)} aria-label="Reply" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => { setAuditId(ticket.id); void act(ticket.id, 'comment'); }} className="min-h-12 rounded-xl border border-border px-4 font-semibold">Send reply</button>
            <label className="min-h-12 inline-flex items-center gap-2 text-sm font-semibold">Rate
              <select className="min-h-12 rounded-xl border border-border px-2" value={rating} onChange={event => setRating(event.target.value)} aria-label="Rate">
                {['1', '2', '3', '4', '5'].map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <button type="button" disabled={busy} onClick={() => void act(ticket.id, 'rate')} className="min-h-12 rounded-xl border border-border px-4 font-semibold">Save rating</button>
            {ticket.status === 'solved' ? (
              <button type="button" disabled={busy} onClick={() => void act(ticket.id, 'reopen')} className="min-h-12 rounded-xl border border-border px-4 font-semibold">Reopen</button>
            ) : null}
          </div>
        </article>
      ))}
      <AuditBar kind="hotline" id={auditId} sample={sample} onNote={setNote} />
    </DashPage>
  );
}

export function StaffHotlineLive({ sample = false }: { sample?: boolean }) {
  const now = useClock();
  const [tickets, setTickets] = useState<TicketRow[]>(sample ? SAMPLE_TICKETS : []);
  const [analytics, setAnalytics] = useState<Analytics | null>(sample ? SAMPLE_ANALYTICS : null);
  const [filter, setFilter] = useState('all');
  const [note, setNote] = useState('');
  const [auditId, setAuditId] = useState(sample ? SAMPLE_TICKETS[0].id : '');
  const [status, setStatus] = useState('in_progress');

  useEffect(() => {
    if (sample) return;
    let gone = false;
    void (async () => {
      const [listRes, statsRes] = await Promise.all([
        authedFetch('/api/hotline/list'),
        authedFetch('/api/hotline/analytics'),
      ]);
      const list = await listRes.json().catch(() => ([]));
      const stats = await statsRes.json().catch(() => null);
      if (gone) return;
      if (Array.isArray(list)) setTickets(list.filter(row => typeof row.body === 'string'));
      if (stats && typeof stats === 'object' && 'byCategory' in stats) setAnalytics(stats as Analytics);
    })();
    return () => { gone = true; };
  }, [sample]);

  const visible = useMemo(() => tickets.filter(ticket => {
    if (filter === 'overdue') return ticket.status !== 'solved' && ticket.status !== 'closed' && ticket.slaDueAt < now;
    if (filter === 'all') return true;
    return ticket.status === filter;
  }), [filter, now, tickets]);

  const filters = [
    ['all', 'All'],
    ['pending', 'Pending'],
    ['in_progress', 'In progress'],
    ['kiv', 'Keep in view'],
    ['solved', 'Solved'],
    ['overdue', 'Overdue'],
  ] as const;

  const setTicketStatus = async (id: string) => {
    if (sample) {
      setTickets(current => current.map(row => row.id === id ? { ...row, status } : row));
      setNote('Status saved on this sample desk.');
      return;
    }
    try {
      await postJSON('/api/hotline/status', { ticketId: id, status });
      setTickets(current => current.map(row => row.id === id ? { ...row, status } : row));
      setNote('Status saved.');
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Try again in a moment.');
    }
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow="Poket School"
        title="Hotline queue"
        description="Filter the desk. Bullying and safeguarding tickets stay with the principal and the safeguarding lead."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="SLA compliance" value={analytics?.slaCompliance == null ? 'Hidden' : `${Math.round(analytics.slaCompliance * 100)}%`} hint="Hidden when fewer than 5 are solved" ring={analytics?.slaCompliance == null ? undefined : Math.round(analytics.slaCompliance * 100)} />
        <StatCard label="Satisfaction" value={analytics?.satisfaction == null ? 'Hidden' : String(analytics.satisfaction)} hint="Groups under 5 stay hidden" />
        <StatCard label="Overdue" value={analytics?.overdue == null ? 'Hidden' : String(analytics.overdue)} hint="Open tickets past the SLA" />
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} className={`min-h-12 rounded-xl px-4 font-semibold ${filter === id ? 'bg-primary text-primary-foreground' : 'border border-border bg-card'}`}>{label}</button>
        ))}
      </div>
      {visible.length === 0 ? (
        <Panel><EmptyState title="Nothing in this filter" detail="Try another status, or wait for a new ticket." /></Panel>
      ) : visible.map(ticket => (
        <article key={ticket.id} className="grid gap-3 rounded-[24px] border border-border bg-card p-4">
          <div className="flex flex-wrap gap-2">
            <span className="min-h-9 inline-flex items-center rounded-full bg-muted px-3 text-xs font-bold">{titleCase(ticket.category)}</span>
            <span className="min-h-9 inline-flex items-center rounded-full bg-muted px-3 text-xs font-bold">{titleCase(ticket.priority)}</span>
            <span className="min-h-9 inline-flex items-center rounded-full bg-muted px-3 text-xs font-bold">{slaLabel(ticket.slaDueAt, now, ticket.status)}</span>
          </div>
          <h2 className="font-heading text-xl">{ticket.body}</h2>
          <p className="text-sm text-muted-foreground">{titleCase(ticket.status)}. Assigned toward the {titleCase(ticket.addressedTo)}.</p>
          <div className="flex flex-wrap gap-2">
            <select className={fieldClass()} style={{ width: 'auto' }} value={status} onChange={event => setStatus(event.target.value)} aria-label="Status">
              {HOTLINE_STATUSES.map(item => <option key={item} value={item}>{titleCase(item)}</option>)}
            </select>
            <button type="button" onClick={() => { setAuditId(ticket.id); void setTicketStatus(ticket.id); }} className="min-h-12 rounded-xl bg-primary px-4 font-semibold text-primary-foreground">Save status</button>
          </div>
        </article>
      ))}
      {note ? <AlertCard tone="good" title="Queue" detail={note} /> : null}
      <AuditBar kind="hotline" id={auditId} sample={sample} onNote={setNote} />
    </DashPage>
  );
}

export function EmergencyLive({ sample = false }: { sample?: boolean }) {
  const [alertId, setAlertId] = useState(sample ? 'sample-alert' : '');
  useEffect(() => {
    if (sample) return;
    const id = new URLSearchParams(window.location.search).get('id') ?? '';
    if (/^[A-Za-z0-9_-]{1,128}$/.test(id)) setAlertId(id);
  }, [sample]);
  const [type, setType] = useState('missing_child');
  const [title, setTitle] = useState(sample ? 'Missing child near the school gate' : '');
  const [description, setDescription] = useState(sample ? 'Last seen at the gate after dismissal. Police reference is on the draft.' : '');
  const [subjectName, setSubjectName] = useState('');
  const [publicDescription, setPublicDescription] = useState(sample ? 'Last seen at the gate after dismissal. Clothes: a blue shirt.' : '');
  const [approveName, setApproveName] = useState(false);
  const [approvePhoto, setApprovePhoto] = useState(false);
  const [approveDescription, setApproveDescription] = useState(sample);
  const [agency, setAgency] = useState(sample ? 'PDRM' : '');
  const [contact, setContact] = useState(sample ? '999' : '');
  const [referenceNumber, setReferenceNumber] = useState(sample ? 'PDRM-2026-1044' : '');
  const [guardianName, setGuardianName] = useState('');
  const [relation, setRelation] = useState('parent');
  const [signature, setSignature] = useState('');
  const [signatureKind, setSignatureKind] = useState<'typed' | 'drawn'>('typed');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>(sample ? ['Draft created. A second verified staff member confirms it.'] : []);

  const run = async (label: string, path: string, body: Record<string, unknown>) => {
    setBusy(true);
    setNote('');
    if (sample) {
      setLog(current => [`${label} recorded on this sample desk.`, ...current]);
      setNote(`${label} recorded.`);
      setBusy(false);
      return;
    }
    try {
      const result = await postJSON<{ id?: string }>(path, body);
      if (result.id && path.endsWith('/create')) setAlertId(result.id);
      setLog(current => [`${label} saved.`, ...current]);
      setNote(`${label} saved.`);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow="Poket School"
        title="Emergency desk"
        description="A principal drafts the alert. A second verified staff member confirms it before anyone else sees it."
      />
      <form
        className="grid gap-3 rounded-[24px] border border-border bg-card p-4"
        onSubmit={event => {
          event.preventDefault();
          void run('Draft', '/api/emergency/create', {
            type,
            title,
            description,
            subjectName,
            publicDescription: type === 'missing_child' ? publicDescription : '',
            approveName: type === 'missing_child' && approveName,
            approvePhoto: type === 'missing_child' && approvePhoto,
            approveDescription: type === 'missing_child' && approveDescription,
            agency,
            contact,
            referenceNumber,
            reconfirmHours: 24,
            authoritiesRequired: type === 'missing_child' ? 'yes' : 'unsure',
          });
        }}
      >
        <h2 className="font-heading text-xl">Create a draft</h2>
        <label className="grid gap-1 text-sm font-semibold">Type
          <select className={fieldClass()} value={type} onChange={event => setType(event.target.value)} aria-label="Alert type">
            {EMERGENCY_TYPES.map(item => <option key={item} value={item}>{titleCase(item)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">Title
          <input className={fieldClass()} value={title} onChange={event => setTitle(event.target.value)} aria-label="Alert title" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">Description
          <textarea className="min-h-24 rounded-xl border border-border p-3 font-normal" value={description} onChange={event => setDescription(event.target.value)} aria-label="Alert description" />
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold">Authority
            <input className={fieldClass()} value={agency} onChange={event => setAgency(event.target.value)} aria-label="Authority" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Contact
            <input className={fieldClass()} value={contact} onChange={event => setContact(event.target.value)} aria-label="Authority contact" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Reference
            <input className={fieldClass()} value={referenceNumber} onChange={event => setReferenceNumber(event.target.value)} aria-label="Authority reference" />
          </label>
        </div>
        <p className="text-sm text-muted-foreground">Review is every 24 hours. A missing child draft needs the authority before it is saved. Receiving and sharing an Amber alert is free. Publishing stays with a tier 3 principal or a tier 4 partner.</p>
        {type === 'missing_child' ? (
          <div className="grid gap-2">
            <label className="grid gap-1 text-sm font-semibold">Public description
              <textarea className="min-h-24 rounded-xl border border-border p-3 font-normal" value={publicDescription} onChange={event => setPublicDescription(event.target.value)} aria-label="Public description" />
            </label>
            <p className="text-sm text-muted-foreground">A child name, photo, and this description stay off the public page until you approve them.</p>
            <label className="flex min-h-12 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={approveName} onChange={event => setApproveName(event.target.checked)} /> Approve the name</label>
            <label className="flex min-h-12 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={approvePhoto} onChange={event => setApprovePhoto(event.target.checked)} /> Approve the photo</label>
            <label className="flex min-h-12 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={approveDescription} onChange={event => setApproveDescription(event.target.checked)} /> Approve the public description</label>
          </div>
        ) : null}
        <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-primary px-4 font-semibold text-primary-foreground">Save draft</button>
      </form>

      <section className="grid gap-3 rounded-[24px] border border-border bg-card p-4">
        <h2 className="font-heading text-xl">Second person confirms</h2>
        <label className="grid gap-1 text-sm font-semibold">Alert id
          <input className={fieldClass()} value={alertId} onChange={event => setAlertId(event.target.value)} aria-label="Alert id" />
        </label>
        <p className="text-sm text-muted-foreground">Paste the draft id. You cannot confirm an alert you created.</p>
        <button type="button" disabled={busy} onClick={() => void run('Confirmation', '/api/emergency/confirm', { alertId })} className="min-h-12 rounded-xl bg-primary px-4 font-semibold text-primary-foreground">Confirm and publish</button>
      </section>

      <form
        className="grid gap-3 rounded-[24px] border border-border bg-card p-4"
        onSubmit={event => {
          event.preventDefault();
          void run('Guardian consent', '/api/emergency/consent', {
            alertId,
            details: 'Name, photo, and the school region may be shared with the named authority.',
            photo: true,
            regions: ['school region'],
            channels: ['public page', 'push'],
            disclaimer: 'This page is not a replacement for emergency services.',
            guardianName,
            relation,
            signature,
            signatureKind,
            subjectName,
          });
        }}
      >
        <h2 className="font-heading text-xl">Guardian consent</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">Guardian name
            <input className={fieldClass()} value={guardianName} onChange={event => setGuardianName(event.target.value)} aria-label="Guardian name" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Relation
            <input className={fieldClass()} value={relation} onChange={event => setRelation(event.target.value)} aria-label="Relation" />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-semibold">Signature
          <select className={fieldClass()} value={signatureKind} onChange={event => setSignatureKind(event.target.value === 'drawn' ? 'drawn' : 'typed')} aria-label="Signature kind">
            <option value="typed">Typed</option>
            <option value="drawn">Drawn</option>
          </select>
        </label>
        <input className={fieldClass()} value={signature} onChange={event => setSignature(event.target.value)} aria-label="Signature" placeholder="Type the guardian name as the signature" />
        <button type="submit" disabled={busy} className="min-h-12 rounded-xl border border-border px-4 font-semibold">Record consent</button>
      </form>

      <section className="grid gap-3 rounded-[24px] border border-border bg-card p-4">
        <h2 className="font-heading text-xl">Authorities</h2>
        <p className="text-sm text-muted-foreground">Public sharing stays off until the authority is informed.</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run('Authorities', '/api/emergency/authorities', {
            alertId,
            status: 'informed',
            agency,
            contact,
            reference: referenceNumber,
          })}
          className="min-h-12 rounded-xl border border-border px-4 font-semibold"
        >
          Record the authority
        </button>
        <button type="button" disabled={busy} onClick={() => void run('24 hour review', '/api/emergency/review', { alertId })} className="min-h-12 rounded-xl border border-border px-4 font-semibold">Re-confirm for 24 hours</button>
      </section>

      <form
        className="grid gap-3 rounded-[24px] border border-border bg-card p-4"
        onSubmit={event => {
          event.preventDefault();
          void run('Retraction', '/api/emergency/retract', { alertId, reason });
        }}
      >
        <h2 className="font-heading text-xl">Retract</h2>
        <label className="grid gap-1 text-sm font-semibold">Reason
          <input className={fieldClass()} value={reason} onChange={event => setReason(event.target.value)} aria-label="Retraction reason" />
        </label>
        <button type="submit" disabled={busy} className="min-h-12 rounded-xl border border-border px-4 font-semibold">Retract this alert</button>
      </form>

      {log.length > 0 ? (
        <section className="rounded-[24px] border border-border bg-card p-4">
          <h2 className="font-heading text-xl">Steps</h2>
          <ul className="mt-2 grid gap-2">
            {log.map(line => <li key={line} className="text-sm">{line}</li>)}
          </ul>
        </section>
      ) : null}
      {note ? <AlertCard tone="good" title="Emergency" detail={note} /> : null}
      <p className="text-sm text-muted-foreground">The public page is /amber/{alertId || 'id'} with an OG image. Shares are logged from that page.</p>
      <AuditBar kind="emergency" id={alertId} sample={sample} onNote={setNote} />
    </DashPage>
  );
}
