'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { authedFetch } from '@/lib/api-client';
import { BROADCAST_CATEGORIES, DESK_QUEUES } from '@/lib/admin/desk';
import { DEFAULT_FLAGS, FEATURE_FLAG_LABELS, FEATURE_FLAGS, type FeatureFlag } from '@/lib/feature-flags';
import { Sparkline, StatCard, TileLink } from '@/components/dashboard';
import { useAuthSTORE } from '@/hooks/use-auth';

type Row = { id: string; title: string; detail: string };
type Snapshot = {
  comingSoon?: boolean;
  staffRole?: string | null;
  scope?: string;
  identityHidden?: boolean;
  counts?: Record<string, number>;
  queues?: Record<string, Row[]>;
  refunds?: Row[];
  kpis?: { signups: number; active: number; revenue: number; alerts: number; reports: number; slaBreaches: number };
  series?: { signups: number[]; alerts: number[] };
  flags?: { id: string; on: boolean }[];
  helplines?: { id: string; country: string; name: string; number: string }[];
  rota?: { timezone: string; slots: number };
  termsVersion?: string;
};

const TILES: { id: string; label: string; href: string; hint: string; category: 'people' | 'learning' | 'payments' | 'safety' | 'insights' | 'settings' | 'community' | 'careers' }[] = [
  { id: 'queues', label: 'Queues', href: '/dashboard/admin/queues', hint: 'What needs a decision', category: 'safety' },
  { id: 'users', label: 'People', href: '/dashboard/admin/users', hint: 'Roles, tiers, suspension', category: 'people' },
  { id: 'institutions', label: 'Institutions', href: '/dashboard/admin/institutions', hint: 'Schools and approvals', category: 'people' },
  { id: 'courses', label: 'Courses', href: '/dashboard/admin/courses', hint: 'ET AI and the catalogue', category: 'learning' },
  { id: 'payments', label: 'Payments', href: '/dashboard/admin/payments', hint: 'Subscriptions and pricing', category: 'payments' },
  { id: 'finance', label: 'Refunds', href: '/dashboard/admin/finance', hint: 'Family billing and refunds', category: 'payments' },
  { id: 'partners', label: 'Perks', href: '/dashboard/admin/partners', hint: 'Cards, student ID, merchants', category: 'payments' },
  { id: 'safety', label: 'Safety Desk', href: '/dashboard/admin/safety-desk', hint: 'Tickets and the on-call rota', category: 'safety' },
  { id: 'amber', label: 'Amber', href: '/dashboard/admin/emergency', hint: 'Publish approvals', category: 'safety' },
  { id: 'network', label: 'Network', href: '/dashboard/admin/moderation', hint: 'Reports, strikes, appeals', category: 'community' },
  { id: 'founders', label: 'Founders', href: '/dashboard/network', hint: 'Groups and founders', category: 'community' },
  { id: 'progress', label: 'Progress', href: '/dashboard/institution/progress', hint: 'Alerts and accountability', category: 'insights' },
  { id: 'alumni', label: 'Alumni', href: '/dashboard/institution/alumni', hint: 'Career desk and extras', category: 'careers' },
  { id: 'pulse', label: 'Insights', href: '/dashboard/admin/pulse', hint: 'Signups, revenue, SLA', category: 'insights' },
  { id: 'platform', label: 'Platform', href: '/dashboard/admin/platform', hint: 'Flags, broadcast, helplines', category: 'settings' },
  { id: 'activity', label: 'Activity', href: '/dashboard/admin/activity', hint: 'Audit chain export', category: 'insights' },
];

const buttonClass = 'inline-flex min-h-12 items-center rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]';
const fieldClass = 'min-h-12 w-full rounded-2xl border border-border bg-card px-3 text-sm';

export function AdminDesk({ view }: { view: 'home' | 'queues' | 'platform' | 'pulse' }) {
  const { profile } = useAuthSTORE();
  const [desk, setDesk] = useState<Snapshot | null>(null);
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<{ users: Row[]; institutions: Row[]; tickets: Row[] } | null>(null);
  const [reason, setReason] = useState('');

  const load = () => {
    authedFetch('/api/admin/desk')
      .then(data => setDesk(data as Snapshot))
      .catch(error => setNote(error instanceof Error ? error.message : 'The admin desk could not be loaded.'));
  };

  useEffect(() => { load(); }, []);

  const act = (body: Record<string, unknown>) => {
    authedFetch('/api/admin/desk', { method: 'POST', body: JSON.stringify(body) })
      .then(data => {
        setNote(data.comingSoon ? 'This admin tool is coming soon.' : 'Saved. Nothing was granted beyond this decision.');
        load();
      })
      .catch(error => setNote(error instanceof Error ? error.message : 'That action did not save.'));
  };

  const search = () => {
    authedFetch(`/api/admin/desk?q=${encodeURIComponent(query)}`)
      .then(data => setHits({
        users: Array.isArray(data.users) ? data.users as Row[] : [],
        institutions: Array.isArray(data.institutions) ? data.institutions as Row[] : [],
        tickets: Array.isArray(data.tickets) ? data.tickets as Row[] : [],
      }))
      .catch(error => setNote(error instanceof Error ? error.message : 'Search did not finish.'));
  };

  const name = profile?.name?.split(' ')[0] || 'Admin';
  const kpis = desk?.kpis;

  return (
    <div className="space-y-5 pb-24">
      <header className="ps-hero-panel rounded-[24px] px-5 py-6 text-white">
        <p className="text-sm font-medium">Admin desk</p>
        <h1 className="font-heading text-4xl tracking-tight">{name}</h1>
        <p className="mt-1 max-w-xl text-sm">
          {desk?.staffRole === 'super_admin' ? 'Super admin. The whole platform.' : `Admin. Scoped to ${desk?.scope || 'your institution or region'}.`}
        </p>
        {desk?.identityHidden ? <p className="mt-2 text-sm">Safeguarding names stay hidden unless you are the safeguarding lead.</p> : null}
      </header>

      {desk?.comingSoon || note === 'This admin tool is coming soon.' ? (
        <p className="rounded-[18px] bg-card px-4 py-3 text-sm">This admin tool is coming soon.</p>
      ) : null}
      {note ? <p className="text-sm text-[#1E6A83]">{note}</p> : null}

      {view === 'home' ? (
        <>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); search(); }}>
            <label className="sr-only" htmlFor="desk-search">Search users, institutions, and tickets</label>
            <input id="desk-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search users, institutions, tickets" className={fieldClass} />
            <button type="submit" className={buttonClass}>Search</button>
          </form>
          {hits ? <SearchHits hits={hits} reason={reason} onReason={setReason} onAct={act} /> : null}
          <section aria-label="Top tasks" className="grid gap-3 sm:grid-cols-3">
            <TileLink href="/dashboard/admin/queues" label="Open queues" hint="Decisions waiting" category="safety" badge={queueTotal(desk?.counts)} />
            <TileLink href="/dashboard/admin/safety-desk" label="Safety Desk" hint="SLA timers" category="safety" badge={desk?.counts?.safety} />
            <TileLink href="/dashboard/admin/users" label="Review accounts" hint="Role and tier" category="people" />
          </section>
          <section aria-label="At a glance" className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Signups" value={String(kpis?.signups ?? 0)} hint="Last 30 days" series={desk?.series?.signups} />
            <StatCard label="Active users" value={String(kpis?.active ?? 0)} hint="Last 7 days" />
            <StatCard label="SLA breaches" value={String(kpis?.slaBreaches ?? 0)} hint="Open safety tickets" />
          </section>
          <section aria-label="Tools">
            <h2 className="mb-3 font-heading text-xl">Tools</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {TILES.map(tile => (
                <TileLink key={tile.id} href={tile.href} label={tile.label} hint={tile.hint} category={tile.category} badge={desk?.counts?.[tile.id]} />
              ))}
            </div>
          </section>
        </>
      ) : null}

      {view === 'queues' ? <Queues desk={desk} reason={reason} onReason={setReason} onAct={act} /> : null}
      {view === 'platform' ? <Platform desk={desk} onAct={act} superAdmin={desk?.staffRole === 'super_admin'} /> : null}
      {view === 'pulse' ? <Pulse desk={desk} /> : null}
    </div>
  );
}

function queueTotal(counts: Record<string, number> | undefined): number {
  if (!counts) return 0;
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

function SearchHits({ hits, reason, onReason, onAct }: {
  hits: { users: Row[]; institutions: Row[]; tickets: Row[] };
  reason: string;
  onReason: (value: string) => void;
  onAct: (body: Record<string, unknown>) => void;
}) {
  return (
    <section className="space-y-3 rounded-[24px] border border-border bg-card p-4">
      <h2 className="font-heading text-xl">Search results</h2>
      <label className="block text-sm font-semibold">
        Reason
        <input value={reason} onChange={event => onReason(event.target.value)} className={`${fieldClass} mt-1`} placeholder="Why this change" />
      </label>
      <HitList title="Users" rows={hits.users} extra={(row) => (
        <span className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={() => onAct({ action: 'suspend', id: row.id, reason })}>Suspend</button>
          <button type="button" className={buttonClass} onClick={() => onAct({ action: 'set-tier', id: row.id, tier: 2, reason })}>Set tier 2</button>
        </span>
      )} />
      <HitList title="Institutions" rows={hits.institutions} extra={(row) => (
        <button type="button" className={buttonClass} onClick={() => onAct({ action: 'institution-approve', id: row.id, reason })}>Approve</button>
      )} />
      <HitList title="Tickets" rows={hits.tickets} />
    </section>
  );
}

function HitList({ title, rows, extra }: { title: string; rows: Row[]; extra?: (row: Row) => ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#1E6A83]">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing matched.</p> : (
        <ul className="divide-y divide-border">
          {rows.map(row => (
            <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <span className="block font-semibold">{row.title}</span>
                <span className="block text-sm text-muted-foreground">{row.detail}</span>
              </span>
              {extra ? extra(row) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Queues({ desk, reason, onReason, onAct }: {
  desk: Snapshot | null;
  reason: string;
  onReason: (value: string) => void;
  onAct: (body: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold">
        Reason for the next decision
        <input value={reason} onChange={event => onReason(event.target.value)} className={`${fieldClass} mt-1`} />
      </label>
      {DESK_QUEUES.map(queue => {
        const rows = desk?.queues?.[queue.id] ?? [];
        return (
          <section key={queue.id} id={queue.id} className="rounded-[24px] border border-border bg-card p-4">
            <h2 className="font-heading text-xl">{queue.label}</h2>
            <p className="text-sm text-muted-foreground">{rows.length} waiting</p>
            {rows.length === 0 ? <p className="mt-2 text-sm">Nothing is waiting in this queue.</p> : (
              <ul className="mt-2 divide-y divide-border">
                {rows.map(row => (
                  <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      <span className="block font-semibold">{row.title}</span>
                      <span className="block text-sm text-muted-foreground">{row.detail}</span>
                    </span>
                    <QueueAction queue={queue.id} id={row.id} reason={reason} onAct={onAct} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <p className="text-sm">
        <Link href="/dashboard/admin/safety-desk" className="underline">Open the Safety Desk</Link>
        {' · '}
        <Link href="/dashboard/admin/moderation" className="underline">Open moderation</Link>
      </p>
    </div>
  );
}

function QueueAction({ queue, id, reason, onAct }: { queue: string; id: string; reason: string; onAct: (body: Record<string, unknown>) => void }) {
  if (queue === 'community') {
    return (
      <span className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={() => onAct({ action: 'community-review', id, decision: 'approved', reason })}>Approve</button>
        <button type="button" className={buttonClass} onClick={() => onAct({ action: 'community-review', id, decision: 'declined', reason })}>Decline</button>
      </span>
    );
  }
  if (queue === 'merchants') return <button type="button" className={buttonClass} onClick={() => onAct({ action: 'merchant-review', id, status: 'approved', reason })}>Approve merchant</button>;
  if (queue === 'offers') return <button type="button" className={buttonClass} onClick={() => onAct({ action: 'offer-review', id, status: 'live', reason })}>Approve offer</button>;
  if (queue === 'appeals') return <button type="button" className={buttonClass} onClick={() => onAct({ action: 'appeal', id, restore: true, reason })}>Restore</button>;
  if (queue === 'amber') return <button type="button" className={buttonClass} onClick={() => onAct({ action: 'amber-approve', id, reason })}>Add my approval</button>;
  if (queue === 'institutions') return <button type="button" className={buttonClass} onClick={() => onAct({ action: 'institution-approve', id, reason })}>Approve school</button>;
  if (queue === 'verification') return <span className="text-sm text-muted-foreground">Open the account and set the tier with a reason.</span>;
  return <span className="text-sm text-muted-foreground">Read only until a person sends it.</span>;
}

function Platform({ desk, onAct, superAdmin }: { desk: Snapshot | null; onAct: (body: Record<string, unknown>) => void; superAdmin: boolean }) {
  const [flagNote, setFlagNote] = useState('');
  const [broadcast, setBroadcast] = useState({ category: 'general', audience: 'all', body: '', confirmation: '' });
  const [helpline, setHelpline] = useState({ country: '', name: '', number: '', sourceUrl: '' });
  const [rota, setRota] = useState({ weekday: '1', start: '540', end: '1020', primaryUid: '', timezone: desk?.rota?.timezone || 'Asia/Kuala_Lumpur' });
  const [terms, setTerms] = useState({ version: desk?.termsVersion || '2026-10-17', reason: '' });

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-border bg-card p-4">
        <h2 className="font-heading text-xl">Kill switches</h2>
        <ul className="mt-3 grid gap-2">
          {(desk?.flags?.length ? desk.flags : FEATURE_FLAGS.map(id => ({ id, on: DEFAULT_FLAGS[id] }))).map(flag => (
            <li key={flag.id} className="flex items-center justify-between gap-3">
              <span>{FEATURE_FLAG_LABELS[flag.id as FeatureFlag] || flag.id}</span>
              <button type="button" className={buttonClass} disabled={!superAdmin} onClick={() => onAct({ action: 'flag', flag: flag.id, on: !flag.on })}>
                {flag.on ? 'On' : 'Off'}
              </button>
            </li>
          ))}
        </ul>
        {flagNote ? <p className="mt-2 text-sm">{flagNote}</p> : null}
        {!superAdmin ? <p className="mt-2 text-sm">Only a super admin can change a kill switch.</p> : null}
      </section>
      <section className="rounded-[24px] border border-border bg-card p-4">
        <h2 className="font-heading text-xl">Push broadcast</h2>
        <div className="mt-3 grid gap-2">
          <select aria-label="Broadcast category" className={fieldClass} value={broadcast.category} onChange={event => setBroadcast({ ...broadcast, category: event.target.value })}>
            {BROADCAST_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <input aria-label="Audience" className={fieldClass} value={broadcast.audience} onChange={event => setBroadcast({ ...broadcast, audience: event.target.value })} placeholder="Audience" />
          <textarea aria-label="Broadcast message" className={fieldClass} value={broadcast.body} onChange={event => setBroadcast({ ...broadcast, body: event.target.value })} placeholder="Message" />
          <input aria-label="Type SEND to confirm" className={fieldClass} value={broadcast.confirmation} onChange={event => setBroadcast({ ...broadcast, confirmation: event.target.value })} placeholder="Type SEND" />
          <button type="button" className={buttonClass} onClick={() => onAct({ action: 'broadcast', ...broadcast })}>Queue broadcast</button>
        </div>
      </section>
      <section className="rounded-[24px] border border-border bg-card p-4">
        <h2 className="font-heading text-xl">Helpline countries</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input aria-label="Country code" className={fieldClass} value={helpline.country} onChange={event => setHelpline({ ...helpline, country: event.target.value })} placeholder="MY" />
          <input aria-label="Helpline name" className={fieldClass} value={helpline.name} onChange={event => setHelpline({ ...helpline, name: event.target.value })} placeholder="Name" />
          <input aria-label="Helpline number" className={fieldClass} value={helpline.number} onChange={event => setHelpline({ ...helpline, number: event.target.value })} placeholder="Number" />
          <input aria-label="Source URL" className={fieldClass} value={helpline.sourceUrl} onChange={event => setHelpline({ ...helpline, sourceUrl: event.target.value })} placeholder="https://" />
        </div>
        <button type="button" className={`${buttonClass} mt-3`} onClick={() => onAct({ action: 'helpline', ...helpline })}>Save helpline</button>
        <ul className="mt-3 text-sm">
          {(desk?.helplines ?? []).map(row => <li key={row.id}>{row.country}: {row.name} {row.number}</li>)}
        </ul>
      </section>
      <section className="rounded-[24px] border border-border bg-card p-4">
        <h2 className="font-heading text-xl">On-call rota</h2>
        <p className="text-sm text-muted-foreground">{desk?.rota?.slots ?? 0} slots saved.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input aria-label="Weekday" className={fieldClass} value={rota.weekday} onChange={event => setRota({ ...rota, weekday: event.target.value })} />
          <input aria-label="Timezone" className={fieldClass} value={rota.timezone} onChange={event => setRota({ ...rota, timezone: event.target.value })} />
          <input aria-label="Start minute" className={fieldClass} value={rota.start} onChange={event => setRota({ ...rota, start: event.target.value })} />
          <input aria-label="End minute" className={fieldClass} value={rota.end} onChange={event => setRota({ ...rota, end: event.target.value })} />
          <input aria-label="Primary uid" className={fieldClass} value={rota.primaryUid} onChange={event => setRota({ ...rota, primaryUid: event.target.value })} placeholder="Primary account id" />
        </div>
        <button
          type="button"
          className={`${buttonClass} mt-3`}
          onClick={() => onAct({
            action: 'rota',
            timezone: rota.timezone,
            slots: [{ weekday: Number(rota.weekday), startMinutes: Number(rota.start), endMinutes: Number(rota.end), primaryUid: rota.primaryUid, backupUid: '' }],
          })}
        >
          Save rota slot
        </button>
      </section>
      <section className="rounded-[24px] border border-border bg-card p-4">
        <h2 className="font-heading text-xl">Safety terms</h2>
        <p className="text-sm text-muted-foreground">Version {terms.version}. A note does not rewrite the clauses.</p>
        <input aria-label="Terms reason" className={`${fieldClass} mt-3`} value={terms.reason} onChange={event => setTerms({ ...terms, reason: event.target.value })} placeholder="Why this note" />
        <button type="button" className={`${buttonClass} mt-3`} onClick={() => { setFlagNote(''); onAct({ action: 'terms-note', version: terms.version, reason: terms.reason }); }}>Save terms note</button>
      </section>
      <section className="rounded-[24px] border border-border bg-card p-4">
        <h2 className="font-heading text-xl">Refunds</h2>
        {(desk?.refunds ?? []).length === 0 ? <p className="mt-2 text-sm">No refund requests are in this view.</p> : (
          <ul className="mt-2 text-sm">
            {(desk?.refunds ?? []).map(row => <li key={row.id}>{row.title}: {row.detail}</li>)}
          </ul>
        )}
        <p className="mt-2 text-sm">Family billing stays on the finance desk.</p>
      </section>
    </div>
  );
}

function Pulse({ desk }: { desk: Snapshot | null }) {
  const kpis = desk?.kpis;
  const cards = [
    ['Signups', kpis?.signups ?? 0, desk?.series?.signups],
    ['Active users', kpis?.active ?? 0, undefined],
    ['Revenue', kpis?.revenue ?? 0, undefined],
    ['Alerts', kpis?.alerts ?? 0, desk?.series?.alerts],
    ['Reports', kpis?.reports ?? 0, undefined],
    ['SLA breaches', kpis?.slaBreaches ?? 0, undefined],
  ] as const;
  return (
    <section aria-label="Platform KPIs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(([label, value, series]) => (
        <article key={label} className="rounded-[24px] border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-heading text-4xl tabular-nums">{value}</p>
          {series ? <Sparkline series={[...series]} label={label} /> : null}
        </article>
      ))}
    </section>
  );
}
