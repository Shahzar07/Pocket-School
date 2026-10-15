'use client';

import { useState } from 'react';
import { ExportBar, Freshness, GlossaryTip } from '@/components/insights/boards';
import { BLOOM_LEVELS, BLOOM_LABELS, type BloomLevel } from '@/lib/insights/analytics';
import type { HubFilters, ReportHub } from '@/lib/insights/hub';
import { seedChecks } from '@/lib/insights/hub-seed';
import { metricById } from '@/lib/insights/metrics';
import type { ReportSchedule } from '@/lib/insights/reports';
import { copyrightLine } from '@/lib/insights/copyright';

export function ReportsHub({
  hub,
  onFilters,
  onSchedule,
  onExport,
  onAbsence,
  showChecks,
}: {
  hub: ReportHub;
  onFilters?: (filters: HubFilters) => void;
  onSchedule?: (cadence: ReportSchedule['cadence']) => void;
  onExport?: (format: 'csv' | 'xlsx' | 'pdf') => void;
  onAbsence?: (reason: string, dateKey: string) => void;
  showChecks?: boolean;
}) {
  const [open, setOpen] = useState<string | null>('attendance_rate');
  const [reason, setReason] = useState('');
  const filters = hub.filters;
  const kpis = hub.sections.flatMap(section => section.kpis);
  const openKpi = kpis.find(kpi => kpi.metricId === open);
  const checks = showChecks ? seedChecks(hub, filters.bloom) : [];
  const set = (patch: Partial<HubFilters>) => onFilters?.({ ...filters, ...patch });

  return (
    <div className="space-y-6" data-reports-hub={hub.role}>
      <p className="text-sm">Reports for {hub.scopeLabel}. Every figure uses the glossary definition and opens the records behind it.</p>
      <Freshness at={hub.computedAt} live={false} />
      <p className="text-xs text-muted-foreground" data-reconciled={hub.reconciliation.match ? 'yes' : 'no'}>
        Attendance stored {hub.reconciliation.stored ?? '—'} and recounted {hub.reconciliation.raw ?? '—'}. {hub.reconciliation.match ? 'The saved total matches the session records.' : 'The saved total does not match the session records.'}
      </p>
      <div className="flex flex-wrap gap-2 text-xs">
        <label>From <input className="ml-1 rounded border border-border px-2 py-1" type="date" value={filters.rangeStart} onChange={event => set({ rangeStart: event.target.value })} /></label>
        <label>To <input className="ml-1 rounded border border-border px-2 py-1" type="date" value={filters.rangeEnd} onChange={event => set({ rangeEnd: event.target.value })} /></label>
        <label>Course <input className="ml-1 rounded border border-border px-2 py-1" value={filters.courseId} placeholder="All courses" onChange={event => set({ courseId: event.target.value })} /></label>
        <label>Class <input className="ml-1 rounded border border-border px-2 py-1" value={filters.classId} onChange={event => set({ classId: event.target.value })} /></label>
        <label>Student <input className="ml-1 rounded border border-border px-2 py-1" value={filters.studentId} placeholder="All students" onChange={event => set({ studentId: event.target.value })} /></label>
        <label>Institution <input className="ml-1 rounded border border-border px-2 py-1" value={filters.institutionId} onChange={event => set({ institutionId: event.target.value })} /></label>
        <label>Bloom
          <select data-bloom-filter className="ml-1 rounded border border-border px-2 py-1" value={filters.bloom} onChange={event => set({ bloom: event.target.value as BloomLevel | '' })}>
            <option value="">All levels</option>
            {BLOOM_LEVELS.map(level => <option key={level} value={level}>{BLOOM_LABELS[level]}</option>)}
          </select>
        </label>
      </div>
      <p className="text-sm">
        Attendance {hub.attendance.rate ?? '—'}%. Streak {hub.attendance.streak} days.
        {hub.attendance.chronic ? ' Chronic absence flag.' : ' No chronic absence flag.'}
        {' '}Class {hub.classRate ?? '—'}%. Institution {hub.institutionRate ?? '—'}%.
        {hub.previous.direction !== 'na' && ` Versus the previous period: ${hub.previous.diff} (${hub.previous.direction}).`}
        {hub.cohort && ` Cohort: ${hub.cohort.percentile}th percentile of ${hub.cohort.size} anonymised scores.`}
      </p>
      {hub.alerts.length > 0 && (
        <p className="text-sm">Parent alerts this period: {hub.alerts.map(mark => `${mark.dateKey} ${mark.status}`).join(', ')}.</p>
      )}
      {hub.notes.length > 0 && (
        <p className="text-sm">Absence notes: {hub.notes.map(note => `${note.dateKey} ${note.reason} (${note.status})`).join('; ')}.</p>
      )}
      <ExportBar kpis={kpis} onExport={onExport} />
      {hub.sections.map(section => (
        <section key={section.id} className="space-y-2">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <div className="flex flex-wrap gap-2">
            {section.kpis.map(kpi => (
              <button key={`${section.id}-${kpi.metricId}`} type="button" className="rounded-2xl border border-border px-3 py-2 text-left" onClick={() => setOpen(kpi.metricId)}>
                <span className="block text-[11px] text-muted-foreground">{metricById(kpi.metricId)?.label ?? kpi.metricId} <GlossaryTip id={kpi.metricId} /></span>
                <span className="text-xl font-semibold tabular-nums">{kpi.value ?? '—'}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      <div className="rounded-2xl border border-border p-4" data-drill={open ?? ''}>
        <p className="font-semibold">{openKpi ? metricById(openKpi.metricId)?.label : 'Records'}</p>
        <p className="text-xs text-muted-foreground mb-2">{openKpi ? metricById(openKpi.metricId)?.formula : ''}</p>
        {(openKpi?.records ?? []).map(row => (
          <p key={row.id} className="text-sm">{row.when} · {row.label} · {row.value}</p>
        ))}
        {(openKpi?.records.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No records for this figure in the filter.</p>}
      </div>
      {hub.reportCard && (
        <article className="rounded-2xl border border-border p-4" data-report-card>
          <h2 className="text-lg font-semibold">{hub.reportCard.heading}</h2>
          <p className="text-sm">{hub.reportCard.studentName} · {hub.reportCard.courseTitle} · {hub.reportCard.termId} {hub.reportCard.year}</p>
          <p className="text-2xl font-semibold mt-2">Grade {hub.reportCard.grade}</p>
          <p className="text-sm mt-2">{hub.reportCard.comment}</p>
          <p className="text-[11px] text-muted-foreground mt-3">{copyrightLine(hub.reportCard.year)}</p>
          <button type="button" className="mt-3 h-8 px-3 rounded-lg border border-border text-xs font-semibold" onClick={() => window.print()}>Print report card</button>
        </article>
      )}
      {hub.role === 'parent' && onAbsence && (
        <form className="rounded-2xl border border-border p-4 space-y-2" onSubmit={event => { event.preventDefault(); onAbsence(reason, filters.rangeEnd); setReason(''); }}>
          <p className="font-semibold">Send an absence note</p>
          <textarea className="w-full rounded-xl border border-border p-2 text-sm" value={reason} onChange={event => setReason(event.target.value)} placeholder="Reason" />
          <button type="submit" className="h-8 px-3 rounded-lg border border-border text-xs font-semibold">Submit note</button>
        </form>
      )}
      {onSchedule && (
        <div className="flex flex-wrap gap-2">
          {(['daily', 'weekly', 'term'] as const).map(cadence => (
            <button key={cadence} type="button" className="h-8 px-3 rounded-lg border border-border text-xs font-semibold" onClick={() => onSchedule(cadence)}>
              Schedule {cadence}
            </button>
          ))}
        </div>
      )}
      {showChecks && (
        <ul data-checks>
          {checks.map(check => (
            <li key={check.label} data-check={String(check.actual) === String(check.expected) ? 'pass' : 'fail'}>
              {check.label}: {check.actual ?? '—'} expected {check.expected}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
