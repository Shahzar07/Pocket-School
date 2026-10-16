'use client';

import { useMemo, useState } from 'react';
import { Building2, Download, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CountrySelect } from '@/components/country-select';
import { countryName } from '@/lib/countries';
import {
  INSTITUTION_PLANS, INSTITUTION_STATUSES, INSTITUTION_TYPES, blankProfile, filterDirectory,
  institutionsToCsv, renewalState, seatUtilisation, type DirectoryFilter, type DirectoryRow,
  type InstitutionPlan, type InstitutionStatus, type InstitutionType, type LeadStatus,
} from '@/lib/enterprise';
import type { DemoLead } from '@/lib/institution-store';

const LEAD_COLUMNS: LeadStatus[] = ['new', 'contacted', 'qualified', 'demo', 'won', 'lost'];

function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function InstitutionDirectory({
  rows,
  leads,
  superAdmin,
  locale = 'en',
  busy,
  onOpen,
  onCreate,
  onBulk,
  onLead,
  onExport,
}: {
  rows: DirectoryRow[];
  leads: DemoLead[];
  superAdmin: boolean;
  locale?: string;
  busy?: boolean;
  onOpen: (id: string) => void;
  onCreate: (input: { name: string; profile: ReturnType<typeof blankProfile> }) => Promise<void>;
  onBulk: (ids: string[], action: 'suspend' | 'restore' | 'delete') => Promise<void>;
  onLead: (id: string, status: LeadStatus) => Promise<void>;
  onExport?: () => void;
}) {
  const [filter, setFilter] = useState<DirectoryFilter>({ query: '', status: 'all', type: 'all', plan: 'all', country: '' });
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [profile, setProfile] = useState(blankProfile());
  const visible = useMemo(() => filterDirectory(rows, filter), [rows, filter]);
  const allChecked = visible.length > 0 && visible.every((row) => selected.includes(row.id));

  const toggle = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Organisation management</p>
          <h1 className="font-heading text-4xl tracking-tight mt-2">Institutions</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            {superAdmin
              ? 'Every academy on Poket School. Search, filter, export, and open a tenant.'
              : 'Your academy. Other tenants stay out of this list.'}
          </p>
        </div>
        {superAdmin && (
          <Button className="rounded-full" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> Add institution
          </Button>
        )}
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Academies', rows.length],
          ['Active', rows.filter((row) => row.status === 'active').length],
          ['Suspended', rows.filter((row) => row.status === 'suspended').length],
          ['Leads', leads.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="font-heading text-3xl mt-1">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-border bg-card p-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="flex-1">
            <span className="text-[11px] font-semibold text-muted-foreground">Search</span>
            <span className="mt-1 flex items-center gap-2 rounded-xl border border-border px-3">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                aria-label="Search institutions"
                value={filter.query}
                onChange={(event) => setFilter({ ...filter, query: event.target.value })}
                className="h-10 w-full bg-transparent text-sm outline-none"
                placeholder="Name, domain, country, contact"
              />
            </span>
          </label>
          <FilterSelect label="Status" value={filter.status ?? 'all'} options={['all', ...INSTITUTION_STATUSES]} onChange={(status) => setFilter({ ...filter, status: status as DirectoryFilter['status'] })} />
          <FilterSelect label="Type" value={filter.type ?? 'all'} options={['all', ...INSTITUTION_TYPES]} onChange={(type) => setFilter({ ...filter, type: type as DirectoryFilter['type'] })} />
          <FilterSelect label="Plan" value={filter.plan ?? 'all'} options={['all', ...INSTITUTION_PLANS]} onChange={(plan) => setFilter({ ...filter, plan: plan as DirectoryFilter['plan'] })} />
        </div>
        <div className="max-w-xs">
          <CountrySelect
            label="Country"
            locale={locale}
            value={filter.country ?? ''}
            onChange={(country) => setFilter({ ...filter, country })}
          />
          {filter.country && (
            <button type="button" className="mt-1 text-xs font-semibold text-primary" onClick={() => setFilter({ ...filter, country: '' })}>
              Clear country
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" disabled={!selected.length || busy || !superAdmin} onClick={() => void onBulk(selected, 'suspend')}>Suspend</Button>
          <Button type="button" variant="outline" className="rounded-full" disabled={!selected.length || busy || !superAdmin} onClick={() => void onBulk(selected, 'restore')}>Restore</Button>
          <Button type="button" variant="outline" className="rounded-full" disabled={!selected.length || busy || !superAdmin} onClick={() => void onBulk(selected, 'delete')}>Delete</Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              onExport?.();
              download('poket-institutions.csv', institutionsToCsv(selected.length ? rows.filter((row) => selected.includes(row.id)) : visible), 'text/csv');
            }}
          >
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>

        {visible.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="mx-auto mb-3 w-10 h-10 text-primary/40" />
            <p className="font-heading text-2xl">No institutions match</p>
            <p className="text-sm text-muted-foreground mt-1">Add an academy or clear the filters.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3">
                      <input aria-label="Select all institutions" type="checkbox" checked={allChecked} onChange={() => setSelected(allChecked ? [] : visible.map((row) => row.id))} />
                    </th>
                    <th className="py-2 pr-3">Academy</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Plan</th>
                    <th className="py-2 pr-3">Seats</th>
                    <th className="py-2 pr-3">Renewal</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="py-3 pr-3">
                        <input aria-label={`Select ${row.name}`} type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} />
                      </td>
                      <td className="py-3 pr-3">
                        <button type="button" className="text-left" onClick={() => onOpen(row.id)}>
                          <span className="font-semibold">{row.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {row.subdomain ? `${row.subdomain}.poketschool.ai` : row.customDomain || row.domain || countryName(row.profile.country, locale) || 'No domain'}
                          </span>
                        </button>
                      </td>
                      <td className="py-3 pr-3 capitalize">{row.profile.type}</td>
                      <td className="py-3 pr-3 capitalize">{row.profile.plan}</td>
                      <td className="py-3 pr-3">{Math.round(seatUtilisation(row.profile.seatsUsed, row.profile.seatCount) * 100)}%</td>
                      <td className="py-3 pr-3 capitalize">{renewalState(row.profile.renewalOn, new Date().toISOString().slice(0, 10))}</td>
                      <td className="py-3 capitalize">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden space-y-3">
              {visible.map((row) => (
                <li key={row.id} className="rounded-2xl border border-border p-3">
                  <label className="flex items-start gap-3">
                    <input aria-label={`Select ${row.name}`} type="checkbox" className="mt-1" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} />
                    <button type="button" className="text-left" onClick={() => onOpen(row.id)}>
                      <span className="font-semibold">{row.name}</span>
                      <span className="block text-xs text-muted-foreground capitalize">{row.profile.type} · {row.profile.plan} · {row.status}</span>
                    </button>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {superAdmin && (
        <section className="space-y-3">
          <h2 className="font-heading text-3xl">Demo requests</h2>
          <p className="text-sm text-muted-foreground">Requests from the public site land here. Move a lead along, then open an academy when it is won.</p>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {LEAD_COLUMNS.map((status) => (
              <div key={status} className="rounded-2xl border border-border bg-card p-3 min-h-36">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{status}</p>
                <ul className="mt-2 space-y-2">
                  {leads.filter((lead) => lead.status === status).map((lead) => (
                    <li key={lead.id} className="rounded-xl bg-muted/40 p-2 text-sm">
                      <p className="font-semibold">{lead.organisation}</p>
                      <p className="text-xs text-muted-foreground">{lead.name} · {lead.seats} seats</p>
                      <label className="mt-2 block text-[11px]">
                        Move
                        <select
                          aria-label={`Move ${lead.organisation}`}
                          value={lead.status}
                          onChange={(event) => void onLead(lead.id, event.target.value as LeadStatus)}
                          className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2"
                        >
                          {LEAD_COLUMNS.map((next) => <option key={next} value={next}>{next}</option>)}
                        </select>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-3xl border border-border bg-card p-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void onCreate({ name, profile }).then(() => {
                setCreating(false);
                setName('');
                setProfile(blankProfile());
              });
            }}
          >
            <h2 className="font-heading text-2xl">Add institution</h2>
            <label className="block text-sm">
              Name
              <Input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-11 rounded-xl" />
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <FilterSelect label="Type" value={profile.type} options={[...INSTITUTION_TYPES]} onChange={(type) => setProfile({ ...profile, type: type as InstitutionType })} />
              <FilterSelect label="Plan" value={profile.plan} options={[...INSTITUTION_PLANS]} onChange={(plan) => setProfile({ ...profile, plan: plan as InstitutionPlan })} />
            </div>
            <CountrySelect label="Country" locale={locale} value={profile.country} onChange={(country) => setProfile({ ...profile, country })} />
            <label className="block text-sm">
              Seats
              <Input type="number" min={1} value={profile.seatCount || ''} onChange={(event) => setProfile({ ...profile, seatCount: Number(event.target.value) })} className="mt-1 h-11 rounded-xl" />
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 rounded-full" onClick={() => setCreating(false)}>Cancel</Button>
              <Button type="submit" className="flex-1 rounded-full" disabled={busy}>Create</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm min-w-32">
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 capitalize">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

export type { InstitutionStatus };
