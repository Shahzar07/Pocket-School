'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bearerHeaders } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { DashHeader, DashPage, Panel, PanelHeader } from '@/components/dash-ui';
import { buildXlsx } from '@/lib/insights/xlsx';
import {
  composeTemplate,
  countryFromTimeZone,
  eventsForViewer,
  isGeneratedEvent,
  monthCells,
  movePlannerEvent,
  rebuildPlan,
  replan,
  toIcs,
  upcomingReminders,
  YEAR_TEMPLATES,
  type PlannerEvent,
  type PlannerKind,
  type PlannerViewer,
  type YearPlan,
} from '@/lib/insights/planner';
import {
  calendarLink,
  importCalendarSheet,
  importCalendarText,
  importPastedDates,
  type ImportDraft,
} from '@/lib/insights/planner-import';
import { loadSchoolPlan, saveSchoolPlan, type StoredYearPlan } from '@/lib/planner-store';
import { nextTermName, parseTermFile, termsToLines } from '@/lib/terms';

const KINDS: PlannerKind[] = ['term', 'holiday', 'exam', 'closure', 'assessment', 'report', 'period', 'event', 'ptm', 'revision'];

const DOT: Record<string, string> = {
  holiday: 'bg-[var(--ps-cyan)]',
  exam: 'bg-violet-500',
  assessment: 'bg-rose-500',
  report: 'bg-emerald-500',
  period: 'bg-sky-500',
  term: 'bg-primary',
  event: 'bg-teal-500',
  ptm: 'bg-[var(--ps-cyan)]',
  closure: 'bg-stone-500',
  revision: 'bg-fuchsia-500',
};

export type PlannerRole = 'student' | 'teacher' | 'parent' | 'admin' | 'institution_admin';

function viewerOf(role: PlannerRole, scope: { campusId?: string; classId?: string; yearGroup?: string }): PlannerViewer {
  const mapped = role === 'admin' || role === 'institution_admin' ? 'institution' : role;
  return { role: mapped, ...scope };
}

function parseUnits(text: string): { id: string; title: string; lessons: string[] }[] {
  return text.split('\n').map(line => line.trim()).filter(Boolean).map((line, index) => {
    const [title, rest] = line.split(':');
    const lessons = (rest ?? '').split('|').map(part => part.trim()).filter(Boolean);
    return {
      id: `unit-${index + 1}`,
      title: (title || `Unit ${index + 1}`).trim(),
      lessons: lessons.length ? lessons : ['Lesson 1'],
    };
  });
}

function blankPlan(partial: Partial<StoredYearPlan>): StoredYearPlan {
  return {
    id: partial.id || 'school-year',
    label: partial.label || 'School year',
    brand: partial.brand || 'Poket School',
    status: 'draft',
    ownerId: partial.ownerId || 'local',
    institutionId: partial.institutionId || 'school',
    campusId: partial.campusId || '',
    classId: partial.classId || '',
    yearGroup: partial.yearGroup || '',
    termStart: partial.termStart || '2026-01-12',
    termEnd: partial.termEnd || '2026-11-20',
    unitsText: partial.unitsText || 'Fractions: Equal parts | Comparing\nDecimals: Tenths',
    events: partial.events || [],
    updatedAt: partial.updatedAt || '',
  };
}

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function YearPlanner({
  role,
  canEdit,
  persist,
  initial,
  today,
  ownerId = 'local',
  institutionId = 'school',
  brand = 'Poket School',
}: {
  role: PlannerRole;
  canEdit: boolean;
  persist: boolean;
  initial?: StoredYearPlan;
  today: string;
  ownerId?: string;
  institutionId?: string;
  brand?: string;
}) {
  const planId = `year-${institutionId || ownerId}`;
  const [plan, setPlan] = useState<StoredYearPlan>(() => initial ?? blankPlan({ id: planId, ownerId, institutionId, brand }));
  const [loading, setLoading] = useState(persist && !initial);
  const [notice, setNotice] = useState('');
  const [link, setLink] = useState('');
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => {
    const [year, month] = today.split('-').map(Number);
    return { year: year || 2026, month: (month || 1) - 1 };
  });

  useEffect(() => {
    if (!persist) return;
    let cancelled = false;
    loadSchoolPlan(planId, canEdit).then(stored => {
      if (cancelled) return;
      if (stored) setPlan(stored);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [persist, planId, canEdit]);

  const country = countryFromTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const scope = {
    campusId: plan.campusId || undefined,
    classId: plan.classId || undefined,
    yearGroup: plan.yearGroup || undefined,
  };
  const visible = useMemo(
    () => eventsForViewer(plan.events, viewerOf(role, scope)),
    [plan.events, plan.campusId, plan.classId, plan.yearGroup, role],
  );
  const units = useMemo(() => parseUnits(plan.unitsText), [plan.unitsText]);
  const pacing = useMemo(
    () => replan(units, plan.termStart, plan.termEnd, visible),
    [units, plan.termStart, plan.termEnd, visible],
  );
  const week = upcomingReminders(visible, today, 7);
  const selected = visible.find(event => event.id === selectedId) ?? null;
  const cells = monthCells(cursor.year, cursor.month);
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const replaceEvents = (events: PlannerEvent[], status: StoredYearPlan['status'] = 'draft') => {
    setPlan(current => ({ ...current, events, status }));
  };

  const applyDraft = (draft: ImportDraft) => {
    setNotice(draft.notice);
    if (!draft.events.length) return;
    setPlan(current => ({
      ...current,
      status: 'draft',
      events: [
        ...current.events.filter(event => event.source === 'manual' || event.source === 'template' || isGeneratedEvent(event)),
        ...draft.events,
      ],
    }));
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !canEdit) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx')) {
      applyDraft(importCalendarSheet(new Uint8Array(await file.arrayBuffer())));
      return;
    }
    if (name.endsWith('.ics') || name.endsWith('.csv') || name.endsWith('.txt')) {
      applyDraft(importCalendarText(file.name, await file.text()));
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch('/api/planner/import', { method: 'POST', headers: await bearerHeaders(), body });
      const payload = await response.json() as { events?: PlannerEvent[]; notice?: string };
      applyDraft({
        events: payload.events ?? [],
        notice: payload.notice || 'Nothing was published.',
        needsReview: true,
      });
    } catch {
      setNotice('The import service did not answer. ICS, CSV, and XLSX files still work on this device.');
    } finally {
      setBusy(false);
    }
  };

  const onLink = async () => {
    const checked = calendarLink(link);
    if (!checked.url) {
      setNotice(checked.notice);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/planner/import', {
        method: 'POST',
        headers: await bearerHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ url: checked.url }),
      });
      const payload = await response.json() as { events?: PlannerEvent[]; notice?: string };
      applyDraft({ events: payload.events ?? [], notice: payload.notice || checked.notice, needsReview: true });
    } catch {
      setNotice('That link could not be fetched. Download the ICS file and upload it.');
    } finally {
      setBusy(false);
    }
  };

  const schedule = () => {
    const next = rebuildPlan(units, plan.termStart, plan.termEnd, plan.events, scope);
    replaceEvents(next, plan.status === 'published' ? 'draft' : plan.status);
    setNotice('Releases, the assessment, and report cards were rebuilt around holidays and exam weeks. Publish when the dates are right.');
  };

  const move = (id: string, date: string) => {
    const moved = movePlannerEvent(plan.events, id, date);
    const next = moved.some(isGeneratedEvent) ? rebuildPlan(units, plan.termStart, plan.termEnd, moved, scope) : moved;
    replaceEvents(next, 'draft');
    setNotice('The date moved, so the teaching plan was rebuilt. It stays a draft until you publish.');
  };

  const patchSelected = (patch: Partial<PlannerEvent>) => {
    if (!selected) return;
    replaceEvents(plan.events.map(event => event.id === selected.id ? { ...event, ...patch, source: event.source === 'template' ? 'manual' : event.source } : event), 'draft');
  };

  const publish = async () => {
    if (!canEdit) return;
    const next = { ...plan, status: 'published' as const, id: planId, ownerId, institutionId, brand };
    setPlan(next);
    if (!persist) {
      setNotice('Published in this preview. On the school dashboard this writes the year students can see.');
      return;
    }
    const saved = await saveSchoolPlan(next);
    setNotice(saved.notice);
  };

  const saveDraft = async () => {
    const next = { ...plan, status: 'draft' as const, id: planId, ownerId, institutionId, brand };
    setPlan(next);
    if (!persist) {
      setNotice('Draft kept in this preview. Students do not see a draft.');
      return;
    }
    const saved = await saveSchoolPlan(next);
    setNotice(saved.notice);
  };

  const yearPlan: YearPlan = {
    id: plan.id,
    institutionId: plan.institutionId,
    label: plan.label,
    brand: plan.brand,
    visibility: 'school',
    ownerId: plan.ownerId,
    ownerRole: role === 'parent' ? 'parent' : role === 'teacher' ? 'teacher' : 'institution',
    events: visible,
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground p-6">Loading the school plan…</p>;
  }

  return (
    <DashPage>
      <DashHeader
        eyebrow="Poket School"
        title="School planner"
        description={plan.status === 'published'
          ? 'This plan is published. Moving a date rebuilds releases, assessments, and report cards, then waits for you to publish again.'
          : 'Imports and photos stay a draft until a person publishes the plan. Holidays and exam weeks are not teaching days.'}
        actions={canEdit ? (
          <Button type="button" className="rounded-full" onClick={publish}>
            {plan.status === 'published' ? 'Publish updates' : 'Publish this plan'}
          </Button>
        ) : undefined}
      />

      <Panel>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">This week</p>
        <h2 className="font-heading text-2xl mt-1">Today, {today}</h2>
        {week.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">Nothing due in the next 7 days for this campus, class, or level.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {week.map(item => (
              <li key={`${item.kind}-${item.date}-${item.title}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{item.title}</span>
                <span className="text-muted-foreground">{item.kind} · {item.date}</span>
              </li>
            ))}
          </ul>
        )}
        {notice && <p className="mt-3 text-sm text-foreground" role="status">{notice}</p>}
      </Panel>

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-5">
        <Panel>
          <PanelHeader title={monthLabel} action={
            <span className="flex gap-1">
              <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setCursor(current => ({ year: current.month === 0 ? current.year - 1 : current.year, month: current.month === 0 ? 11 : current.month - 1 }))} aria-label="Previous month">Prev</Button>
              <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setCursor(current => ({ year: current.month === 11 ? current.year + 1 : current.year, month: current.month === 11 ? 0 : current.month + 1 }))} aria-label="Next month">Next</Button>
            </span>
          } />
          <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="text-center">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              const key = day ? `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
              const items = day ? visible.filter(event => key >= event.date && key <= (event.endDate ?? event.date)) : [];
              const isToday = key === today;
              return (
                <div key={index} className={`min-h-16 rounded-xl border p-1 ${day ? 'border-border bg-background' : 'border-transparent'} ${isToday ? 'ring-2 ring-primary' : ''}`}>
                  {day && <p className={`text-xs font-semibold ${isToday ? 'text-primary' : ''}`}>{day}</p>}
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {items.slice(0, 3).map(event => (
                      <button key={event.id} type="button" className={`h-2 w-2 rounded-full ${DOT[event.kind] ?? 'bg-primary'}`} aria-label={`${event.title} ${event.date}`} onClick={() => setSelectedId(event.id)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {visible.filter(event => {
              const monthKey = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
              if (event.kind === 'term' || event.kind === 'semester') return event.date.slice(0, 7) === monthKey;
              return event.date.slice(0, 7) <= monthKey && (event.endDate ?? event.date).slice(0, 7) >= monthKey;
            }).slice(0, 8).map(event => (
              <li key={event.id}>
                <button type="button" className="text-left hover:underline" onClick={() => setSelectedId(event.id)}>
                  <span className="font-medium">{event.title}</span>
                  <span className="text-muted-foreground"> · {event.kind} · {event.date}</span>
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <div className="mt-4 grid sm:grid-cols-2 gap-2 text-sm">
              <label className="block">Title
                <Input value={selected.title} disabled={!canEdit} onChange={event => patchSelected({ title: event.target.value })} />
              </label>
              <label className="block">Date
                <Input type="date" value={selected.date} disabled={!canEdit} onChange={event => move(selected.id, event.target.value)} />
              </label>
              <label className="block">Kind
                <select className="mt-1 w-full h-9 rounded-md border border-border bg-background px-2" value={selected.kind} disabled={!canEdit} onChange={event => patchSelected({ kind: event.target.value as PlannerKind })}>
                  {KINDS.map(kind => <option key={kind} value={kind}>{kind}</option>)}
                </select>
              </label>
              <label className="block">Campus
                <Input value={selected.campusId ?? ''} disabled={!canEdit} onChange={event => patchSelected({ campusId: event.target.value || undefined })} />
              </label>
              <label className="block">Class
                <Input value={selected.classId ?? ''} disabled={!canEdit} onChange={event => patchSelected({ classId: event.target.value || undefined })} />
              </label>
              <label className="block">Level
                <Input value={selected.yearGroup ?? ''} disabled={!canEdit} onChange={event => patchSelected({ yearGroup: event.target.value || undefined })} />
              </label>
            </div>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Who this view is for" />
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs">Campus
                <Input value={plan.campusId} disabled={!canEdit} onChange={event => setPlan(current => ({ ...current, campusId: event.target.value }))} placeholder="All" />
              </label>
              <label className="text-xs">Class
                <Input value={plan.classId} disabled={!canEdit} onChange={event => setPlan(current => ({ ...current, classId: event.target.value }))} placeholder="All" />
              </label>
              <label className="text-xs">Level
                <Input value={plan.yearGroup} disabled={!canEdit} onChange={event => setPlan(current => ({ ...current, yearGroup: event.target.value }))} placeholder="All" />
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-2">A blank field shows every campus, class, or level. Events with a different campus stay hidden.</p>
          </Panel>

          {canEdit && (
            <Panel>
              <PanelHeader title="Start or import" meta={<CalendarRange className="w-4 h-4 text-primary" />} />
              <div className="flex flex-wrap gap-2">
                {YEAR_TEMPLATES.filter(template => ['malaysia-school-2026', 'uk-three-term-2026', 'igcse-2026', 'alevel-2026'].includes(template.id)).map(template => (
                  <Button key={template.id} type="button" variant="outline" size="sm" className="rounded-full" onClick={() => {
                    const events = composeTemplate(template.id, country);
                    const terms = events.filter(event => event.kind === 'term' || event.kind === 'semester');
                    const bounds = (terms.length ? terms : events).flatMap(event => [event.date, event.endDate ?? event.date]).sort();
                    const start = bounds[0] ?? plan.termStart;
                    const end = bounds[bounds.length - 1] ?? plan.termEnd;
                    const [year, month] = start.split('-').map(Number);
                    setCursor({ year: year || cursor.year, month: (month || 1) - 1 });
                    setPlan(current => ({ ...current, events, status: 'draft', termStart: start, termEnd: end }));
                    setNotice(`${template.label}. ${template.note} Public holidays are filled in. This is still a draft.`);
                  }}>
                    {template.label}
                  </Button>
                ))}
              </div>
              <label className="mt-3 block text-sm font-medium">
                ICS, CSV, XLSX, PDF, or a photo
                <input
                  type="file"
                  accept=".ics,.csv,.xlsx,.pdf,.png,.jpg,.jpeg,.webp,text/calendar"
                  className="mt-1 block w-full text-sm"
                  onChange={event => { void onFile(event.target.files?.[0]); }}
                />
              </label>
              <p className="mt-3 text-xs text-muted-foreground">Two-way Google Calendar sync needs the owner&apos;s OAuth client. Until then, paste an ICS link or upload a term file.</p>
              <label className="mt-3 block text-sm font-medium">Google or Outlook link
                <span className="mt-1 flex gap-2">
                  <Input value={link} onChange={event => setLink(event.target.value)} placeholder="https://calendar.google.com/...ics" />
                  <Button type="button" variant="outline" onClick={() => { void onLink(); }} disabled={busy}>Fetch</Button>
                </span>
              </label>
              <label className="mt-3 block text-sm font-medium">Or type dates
                <textarea value={paste} onChange={event => setPaste(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-border bg-background p-2 text-sm" placeholder="National Day 2026-08-31" />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => applyDraft(importPastedDates(paste))}>
                  <Upload className="w-3.5 h-3.5" /> Read typed dates
                </Button>
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={saveDraft}>Save draft</Button>
              </div>
            </Panel>
          )}
        </div>
      </div>

      <Panel>
        <PanelHeader
          title="Teaching weeks"
          action={canEdit ? <Button type="button" size="sm" className="rounded-full" onClick={schedule}>Schedule releases</Button> : undefined}
        />
        <div className="grid sm:grid-cols-2 gap-2 mb-3">
          <label className="text-sm">Term start <Input type="date" value={plan.termStart} disabled={!canEdit} onChange={event => setPlan(current => ({ ...current, termStart: event.target.value, status: 'draft' }))} /></label>
          <label className="text-sm">Term end <Input type="date" value={plan.termEnd} disabled={!canEdit} onChange={event => setPlan(current => ({ ...current, termEnd: event.target.value, status: 'draft' }))} /></label>
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={!canEdit} onClick={() => setPlan(current => ({ ...current, unitsText: `${current.unitsText.trim()}\n${nextTermName(current.unitsText)}: Week 1 | Week 2`.trim(), status: 'draft' }))}>Add term</Button>
          <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={!canEdit} onClick={() => setPlan(current => ({ ...current, unitsText: current.unitsText.trim().split('\n').slice(0, -1).join('\n'), status: 'draft' }))}>Remove last term</Button>
          <label className="inline-flex items-center h-8 px-3 rounded-full border border-border text-xs font-semibold cursor-pointer">
            Upload term dates
            <input type="file" accept=".csv,.txt,text/plain" className="sr-only" disabled={!canEdit} onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const rows = parseTermFile(await file.text());
              if (!rows.length) return;
              const first = rows[0]!;
              setPlan(current => ({ ...current, termStart: first.from, termEnd: rows[rows.length - 1]!.to, unitsText: termsToLines(rows), status: 'draft' }));
            }} />
          </label>
        </div>
        <label className="text-sm block mb-3">Terms, one per line. Lessons after a colon, separated by |
          <textarea value={plan.unitsText} disabled={!canEdit} onChange={event => setPlan(current => ({ ...current, unitsText: event.target.value, status: 'draft' }))} rows={3} className="mt-1 w-full rounded-xl border border-border bg-background p-2 text-sm" />
        </label>
        {pacing.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a term and at least one line. Weekends, holidays, and exam weeks are skipped.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {pacing.map(row => (
              <li key={`${row.unitId}-${row.lesson}`} className="flex justify-between gap-3 border-b border-border py-1">
                <span>{row.unitTitle}: {row.lesson}</span>
                <span className="text-muted-foreground">{row.date}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="rounded-full" onClick={() => download(`${plan.brand.replace(/\s+/g, '-').toLowerCase()}-calendar.ics`, new Blob([toIcs(yearPlan)], { type: 'text/calendar' }))}>
          <Download className="w-4 h-4" /> Download ICS
        </Button>
        <Button type="button" variant="outline" className="rounded-full" onClick={() => {
          const bytes = buildXlsx(['title', 'date', 'type'], visible.map(event => [event.title, event.date, event.kind]), Number(today.slice(0, 4)) || new Date().getFullYear());
          const copy = new ArrayBuffer(bytes.byteLength);
          new Uint8Array(copy).set(bytes);
          download('poket-school-year.xlsx', new Blob([copy], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        }}>
          <Download className="w-4 h-4" /> Download spreadsheet
        </Button>
      </div>
    </DashPage>
  );
}
