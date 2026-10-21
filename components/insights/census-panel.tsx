'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { authedFetch } from '@/lib/api-client';
import { LevelMenu } from '@/components/level-menu';
import { LEARNER_LEVELS } from '@/lib/levels';
import { insightsCsv, type InsightsView } from '@/lib/insights/census';
import { toast } from 'sonner';

const WorldMap = dynamic(() => import('@/components/insights/world-map').then((mod) => mod.WorldMap), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-2xl bg-[#203337]" aria-hidden />,
});

const COLOURS = ['#203337', '#1E6A83', '#E36A4F', '#3C8DFF', '#2F6F62', '#7DCEA0'];

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function Card({ title, children, csvName, headers, rows }: {
  title: string;
  children: ReactNode;
  csvName: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <section className="rounded-3xl border border-[#203337]/10 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-[#203337]">{title}</h2>
        <Button type="button" variant="outline" className="h-8 rounded-full border-[#1E6A83] text-[#203337]" onClick={() => download(csvName, insightsCsv(headers, rows))}>
          Export CSV
        </Button>
      </div>
      {children}
    </section>
  );
}

function asView(value: Record<string, unknown>): InsightsView | null {
  if (value.suppressed !== true && value.suppressed !== false) return null;
  if (typeof value.population !== 'number') return null;
  return value as unknown as InsightsView;
}

export function CensusPanel({
  institutionId = '',
  locked = false,
  sample,
}: {
  institutionId?: string;
  locked?: boolean;
  sample?: InsightsView;
}) {
  const [view, setView] = useState<InsightsView | null>(sample ?? null);
  const [loading, setLoading] = useState(!sample);
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [gender, setGender] = useState('');
  const [level, setLevel] = useState('');
  const [scopeId, setScopeId] = useState(institutionId);
  const [from, setFrom] = useState('2026-10-01');
  const [to, setTo] = useState('2026-10-17');
  const [institutions, setInstitutions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (sample) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (scopeId) params.set('institutionId', scopeId);
    if (country) params.set('country', country);
    if (state) params.set('state', state);
    if (gender) params.set('gender', gender);
    if (level) params.set('level', level);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    setLoading(true);
    authedFetch(`/api/insights?${params.toString()}`)
      .then((body) => {
        const next = asView(body);
        if (!cancelled && next) setView(next);
      })
      .catch((error: unknown) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Could not load insights.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sample, scopeId, country, state, gender, level, from, to]);

  useEffect(() => {
    if (!view || locked) return;
    setInstitutions((current) => {
      const map = new Map(current.map((row) => [row.id, row]));
      for (const school of view.schools) {
        if (school.kind === 'verified' && school.id) map.set(school.id, { id: school.id, name: school.name });
      }
      return [...map.values()];
    });
  }, [view, locked]);

  const shown = view;
  const countryRows = shown?.countries ?? [];
  const focus = country ? countryRows.find((place) => place.country === country) : undefined;
  const stateRows = focus ? focus.states : (shown?.states ?? []);
  const levels = useMemo(() => {
    const names = new Set<string>(LEARNER_LEVELS.map((item) => item.label));
    for (const row of shown?.levels ?? []) names.add(row.name);
    return [...names];
  }, [shown]);

  return (
    <DashPage>
      <DashHeader
        eyebrow={<span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1E6A83]">Grouped statistics</span>}
        title="Insights"
        accent={locked ? 'Your institution' : 'Platform'}
        description="Counts update when someone signs up, studies, or spends Sparks. Groups smaller than five people are hidden. Charts never show one student."
      />
      <form className="grid gap-3 rounded-3xl bg-[#203337] p-4 text-[#E9F7FA] md:grid-cols-3 xl:grid-cols-6" onSubmit={(event) => event.preventDefault()}>
        <label className="text-xs font-semibold uppercase tracking-wider">From
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white" aria-label="From date" />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider">To
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white" aria-label="To date" />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider">Country
          <select value={country} onChange={(event) => { setCountry(event.target.value); setState(''); }} className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-[#102820] px-3 text-sm" aria-label="Country filter">
            <option value="">All countries</option>
            {countryRows.map((place) => <option key={place.country} value={place.country}>{place.country}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider">State
          <select value={state} onChange={(event) => setState(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-[#102820] px-3 text-sm" aria-label="State filter">
            <option value="">All states</option>
            {stateRows.map((row) => <option key={row.name} value={row.name}>{row.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider">Gender
          <select value={gender} onChange={(event) => setGender(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-[#102820] px-3 text-sm" aria-label="Gender filter">
            <option value="">All</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider">Level
          <LevelMenu ariaLabel="Level filter" value={level} valueKind="label" allowEmpty emptyLabel="All levels" extra={levels.filter((name) => name && !LEARNER_LEVELS.some((item) => item.label === name))} onChange={setLevel} />
        </label>
        {!locked && (
          <label className="text-xs font-semibold uppercase tracking-wider md:col-span-2">Institution
            <select value={scopeId} onChange={(event) => setScopeId(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-[#102820] px-3 text-sm" aria-label="Institution filter">
              <option value="">Whole platform</option>
              {institutions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
        )}
      </form>

      {loading && <p className="text-sm text-[#203337]">Loading grouped counts…</p>}
      {shown?.suppressed && (
        <p className="rounded-2xl bg-[#E9F7FA] px-4 py-3 text-sm text-[#203337]">This view has fewer than five people, so the charts stay empty.</p>
      )}

      {shown && !shown.suppressed && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['People', shown.population, '#203337'],
              ['Daily active', shown.active.dau, '#1E6A83'],
              ['Weekly active', shown.active.wau, '#E36A4F'],
              ['Monthly active', shown.active.mau, '#3C8DFF'],
            ].map(([label, value, colour]) => (
              <article key={String(label)} className="rounded-3xl p-4 text-white" style={{ background: String(colour) }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/80">{label}</p>
                <p className="mt-1 font-heading text-3xl">{value}</p>
              </article>
            ))}
          </div>

          <Card
            title="Where people are"
            csvName="insights-places.csv"
            headers={['country', 'state', 'students', 'parents', 'teachers', 'institutions']}
            rows={countryRows.flatMap((place) => [
              [place.country, '', place.students, place.parents, place.teachers, place.institutions],
              ...place.states.map((row) => [place.country, row.name, row.students, row.parents, row.teachers, row.institutions]),
            ])}
          >
            <WorldMap places={countryRows} selected={country} onPick={(code) => { setCountry(code); setState(''); }} />
            <p className="mt-2 text-xs text-[#203337]/70">Gold marks more students. Click a country for its states. Cities come from the signup region, never a precise location.</p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stateRows}>
                  <CartesianGrid stroke="#F6F1E7" />
                  <XAxis dataKey="name" tick={{ fill: '#203337', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#203337', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="students" fill="#203337" radius={6} />
                  <Bar dataKey="parents" fill="#1E6A83" radius={6} />
                  <Bar dataKey="teachers" fill="#3C8DFF" radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Gender" csvName="insights-gender.csv" headers={['gender', 'count']} rows={[['female', shown.gender.female], ['male', shown.gender.male]]}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ name: 'Female', value: shown.gender.female }, { name: 'Male', value: shown.gender.male }]} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80}>
                      <Cell fill="#E36A4F" />
                      <Cell fill="#3C8DFF" />
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Level" csvName="insights-levels.csv" headers={['level', 'count']} rows={shown.levels.map((row) => [row.name, row.count])}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shown.levels}>
                    <CartesianGrid stroke="#F6F1E7" />
                    <XAxis dataKey="name" tick={{ fill: '#203337', fontSize: 11 }} interval={0} angle={-20} height={50} />
                    <YAxis tick={{ fill: '#203337', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={6}>
                      {shown.levels.map((row, index) => <Cell key={row.name} fill={COLOURS[index % COLOURS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Age band" csvName="insights-age.csv" headers={['band', 'count']} rows={shown.ageBands.map((row) => [row.band, row.count])}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shown.ageBands}>
                    <CartesianGrid stroke="#F6F1E7" />
                    <XAxis dataKey="band" tick={{ fill: '#203337', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#203337', fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1E6A83" radius={6} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card
              title="Account type"
              csvName="insights-accounts.csv"
              headers={['type', 'count']}
              rows={[
                ['student', shown.roles.student],
                ['parent', shown.roles.parent],
                ['teacher', shown.roles.teacher],
                ['independent students', shown.membership.independent],
                ['institution students', shown.membership.institution],
              ]}
            >
              <ul className="grid grid-cols-2 gap-2 text-sm text-[#203337]">
                <li className="rounded-2xl bg-[#F6F1E7] px-3 py-3">Students <strong className="block text-xl">{shown.roles.student}</strong></li>
                <li className="rounded-2xl bg-[#E9F7FA] px-3 py-3">Parents <strong className="block text-xl">{shown.roles.parent}</strong></li>
                <li className="rounded-2xl bg-[#E7F0FF] px-3 py-3">Teachers <strong className="block text-xl">{shown.roles.teacher}</strong></li>
                <li className="rounded-2xl bg-[#FDE8E3] px-3 py-3">Independent <strong className="block text-xl">{shown.membership.independent}</strong></li>
                <li className="col-span-2 rounded-2xl bg-[#203337] px-3 py-3 text-[#E9F7FA]">Institution students <strong className="block text-xl">{shown.membership.institution}</strong></li>
              </ul>
            </Card>
          </div>

          <Card
            title="Schools"
            csvName="insights-schools.csv"
            headers={['school', 'kind', 'country', 'state', 'students']}
            rows={shown.schools.map((row) => [row.name, row.kind, row.country, row.state, row.count])}
          >
            <table className="w-full text-left text-sm text-[#203337]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-[#203337]/60">
                  <th className="py-2">School</th>
                  <th>Kind</th>
                  <th>Place</th>
                  <th>Students</th>
                </tr>
              </thead>
              <tbody>
                {shown.schools.map((row) => (
                  <tr key={`${row.kind}-${row.name}`} className="border-t border-[#203337]/10">
                    <td className="py-2 font-semibold">{row.name}</td>
                    <td>{row.kind === 'verified' ? 'Verified institution' : 'Self-reported'}</td>
                    <td>{row.country} · {row.state}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card
            title="Cities"
            csvName="insights-cities.csv"
            headers={['city', 'students']}
            rows={shown.cities.map((row) => [row.name, row.count])}
          >
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shown.cities}>
                  <CartesianGrid stroke="#F6F1E7" />
                  <XAxis dataKey="name" tick={{ fill: '#203337', fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#203337', fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3C8DFF" radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card
            title="Growth and engagement"
            csvName="insights-growth.csv"
            headers={['day', 'signups', 'active', 'enrolments', 'sparksSpent', 'sparksIssued']}
            rows={shown.series.map((row) => [row.day, row.signups, row.active, row.enrolments, row.sparksSpent, row.sparksIssued])}
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={shown.series}>
                  <CartesianGrid stroke="#F6F1E7" />
                  <XAxis dataKey="day" tick={{ fill: '#203337', fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#203337', fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="signups" stroke="#1E6A83" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="active" stroke="#203337" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="enrolments" stroke="#3C8DFF" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sparksIssued" stroke="#2F6F62" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sparksSpent" stroke="#E36A4F" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card
            title="Retention by signup month"
            csvName="insights-retention.csv"
            headers={['cohort', 'size', 'retained']}
            rows={shown.retention.map((row) => [row.cohort, row.size, row.retained])}
          >
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shown.retention}>
                  <CartesianGrid stroke="#F6F1E7" />
                  <XAxis dataKey="cohort" tick={{ fill: '#203337', fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#203337', fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="size" fill="#203337" radius={6} />
                  <Bar dataKey="retained" fill="#1E6A83" radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </DashPage>
  );
}
