'use client';

import { metricById, METRICS } from '@/lib/insights/metrics';
import { BLOOM_LABELS, type BloomLevel } from '@/lib/insights/analytics';
import { QUADRANT_LABELS, MOOD_LABELS, type Mood, type Quadrant } from '@/lib/insights/behaviour';
import { copyrightLine } from '@/lib/insights/copyright';
import { toCsv } from '@/lib/insights/reports';
import { buildPdf } from '@/lib/insights/pdf';
import { buildXlsx } from '@/lib/insights/xlsx';
import type { AnalyticsSnapshot } from '@/lib/insights/aggregate';
import type { DrillRecord, Kpi } from '@/lib/insights/reports';
import { Info, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { accentForIndex, type AccentId, type TrendDirection } from '@/lib/design/chart-colours';

const METRIC_TONE: Record<string, AccentId> = {
  study_time: 'teal',
  quiz_average: 'amber',
  mastery: 'violet',
  exam_readiness: 'sky',
  understanding: 'violet',
  retention_forecast: 'sky',
  goal_completion: 'emerald',
  sparks_earned: 'coral',
  consistency: 'emerald',
  focus_adherence: 'teal',
  cramming: 'coral',
  procrastination: 'amber',
};

function toneForMetric(id: string, index: number): AccentId {
  return METRIC_TONE[id] ?? accentForIndex(index);
}

function MetricTile({ id, index, value, trend }: { id: string; index: number; value: number | null; trend?: { direction: TrendDirection; label: string } }) {
  const tone = toneForMetric(id, index);
  const TrendIcon = trend?.direction === 'up' ? ArrowUpRight : trend?.direction === 'down' ? ArrowDownRight : Minus;
  const trendColour = trend?.direction === 'up' ? 'var(--ps-emerald)' : trend?.direction === 'down' ? 'var(--ps-coral)' : 'var(--muted-foreground)';
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border p-4"
      style={{ background: `linear-gradient(160deg, color-mix(in srgb, var(--ps-${tone}) 16%, var(--card)), var(--card) 70%)` }}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: `var(--ps-${tone})` }} />
      <p className="text-[12px] text-muted-foreground flex items-center gap-1">
        <span className="h-2 w-2 rounded-sm" style={{ background: `var(--ps-${tone})` }} aria-hidden />
        {metricById(id)?.label} <GlossaryTip id={id} />
      </p>
      <p className="text-2xl font-semibold tabular-nums mt-1" style={{ color: `var(--ps-${tone})` }}>{value ?? '—'}</p>
      <p className="text-[10px] text-muted-foreground">{metricById(id)?.unit}</p>
      {trend && (
        <p className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: trendColour }}>
          <TrendIcon className="h-3.5 w-3.5" aria-hidden />
          {trend.label}
        </p>
      )}
    </div>
  );
}

export function GlossaryTip({ id }: { id: string }) {
  const metric = metricById(id);
  if (!metric) return null;
  return (
    <span title={`${metric.summary} ${metric.formula}`} className="inline-flex align-middle text-muted-foreground cursor-help">
      <Info className="w-3.5 h-3.5" aria-label={metric.summary} />
    </span>
  );
}

export function Freshness({ at, live }: { at?: string | null; live?: boolean }) {
  const label = at ? new Date(at).toLocaleString() : 'just now';
  return (
    <p className="text-[11px] text-muted-foreground">
      Data as of {label}. {live ? 'Counted on this screen from the records below.' : 'Precomputed by the scheduled job.'}
    </p>
  );
}

export function Heatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat());
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `16px repeat(24, minmax(8px, 1fr))` }}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-[8px] text-muted-foreground text-center">{h % 6 === 0 ? h : ''}</span>
        ))}
        {grid.map((row, day) => (
          <div key={day} className="contents">
            <span className="text-[9px] text-muted-foreground">{days[day]}</span>
            {row.map((value, hour) => (
              <span
                key={`${day}-${hour}`}
                title={`${days[day]} ${hour}:00 · ${value} min`}
                className="h-3 rounded-sm"
                style={{ background: `color-mix(in srgb, var(--primary) ${value ? Math.round((0.15 + 0.85 * (value / max)) * 100) : 6}%, transparent)` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function downloadText(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBytes(filename: string, bytes: Uint8Array, type: string) {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy.buffer], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportBar({ kpis, onExport }: { kpis: Kpi[]; onExport?: (format: 'csv' | 'xlsx' | 'pdf') => void }) {
  const year = new Date().getFullYear();
  const headers = ['Metric', 'Value', 'Record', 'When', 'Detail'];
  const rows = kpis.flatMap(kpi => {
    const label = metricById(kpi.metricId)?.label ?? kpi.metricId;
    if (!kpi.records.length) return [[label, kpi.value ?? '', '', '', '']];
    return kpi.records.map((record, index) => [
      index === 0 ? label : '',
      index === 0 ? (kpi.value ?? '') : '',
      record.label,
      record.when,
      record.value,
    ]);
  });
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="h-8 px-3 rounded-lg border border-border text-xs font-semibold" onClick={() => { downloadText('poket-report.csv', toCsv(headers, rows, year), 'text/csv'); onExport?.('csv'); }}>CSV</button>
      <button type="button" className="h-8 px-3 rounded-lg border border-border text-xs font-semibold" onClick={() => { downloadBytes('poket-report.xlsx', buildXlsx(headers, rows, year), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); onExport?.('xlsx'); }}>XLSX</button>
      <button type="button" className="h-8 px-3 rounded-lg border border-border text-xs font-semibold" onClick={() => { downloadBytes('poket-report.pdf', buildPdf('Poket School report', rows.map(row => row.filter(Boolean).join(' · ')), year), 'application/pdf'); onExport?.('pdf'); }}>PDF</button>
      <span className="text-[11px] text-muted-foreground self-center">{copyrightLine(year)}</span>
    </div>
  );
}

export function snapshotKpis(snapshot: AnalyticsSnapshot, records: Record<string, DrillRecord[]> = {}): Kpi[] {
  return Object.entries(snapshot.metrics).map(([metricId, value]) => ({
    metricId,
    value,
    records: records[metricId] ?? [],
  }));
}

export function AnalyticsBoard({ snapshot, live }: { snapshot: AnalyticsSnapshot; live?: boolean }) {
  return (
    <div className="space-y-4">
      <Freshness at={snapshot.computedAt} live={live} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {['study_time', 'quiz_average', 'mastery', 'exam_readiness', 'understanding', 'retention_forecast', 'goal_completion', 'sparks_earned'].map((id, index) => (
          <MetricTile
            key={id}
            id={id}
            index={index}
            value={snapshot.metrics[id] ?? null}
            trend={id === 'goal_completion' && snapshot.metrics.streak != null
              ? { direction: (snapshot.metrics.streak ?? 0) > 0 ? 'up' : 'flat', label: `${snapshot.metrics.streak ?? 0} day streak` }
              : id === 'sparks_earned'
                ? { direction: (snapshot.metrics.sparks_earned ?? 0) >= (snapshot.sparksSpent ?? 0) ? 'up' : 'down', label: `${snapshot.sparksSpent} spent` }
                : undefined}
          />
        ))}
      </div>
      <div className="rounded-2xl border border-border p-4">
        <p className="text-sm font-semibold mb-2 flex items-center gap-1">Exam readiness <GlossaryTip id="exam_readiness" /></p>
        <p className="text-3xl font-semibold">{snapshot.examReadiness.score ?? '—'} <span className="text-base text-muted-foreground">{snapshot.examReadiness.band}</span></p>
        {snapshot.cohort && (
          <p className="text-xs text-muted-foreground mt-2">Anonymous cohort: around the {snapshot.cohort.percentile}th percentile of {snapshot.cohort.size} scores. Names are not shown.</p>
        )}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-sm font-semibold mb-3">Study heatmap</p>
          <Heatmap grid={snapshot.heatmap} />
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-sm font-semibold mb-3">Mastery by Bloom level</p>
          {snapshot.radar.map((row, index) => (
            <div key={row.level} className="flex items-center gap-2 mb-2">
              <span className="w-24 text-xs">{BLOOM_LABELS[row.level as BloomLevel]}</span>
              <span className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <span className="block h-full" style={{ width: `${row.score ?? 0}%`, background: `var(--ps-${accentForIndex(index)})` }} />
              </span>
              <span className="text-xs tabular-nums w-8">{row.score ?? '—'}</span>
            </div>
          ))}
        </div>
      </div>
      {snapshot.misconceptions.length > 0 && (
        <div className="rounded-2xl border border-border p-4">
          <p className="text-sm font-semibold mb-2">Misconceptions</p>
          {snapshot.misconceptions.map(item => <p key={item.topic} className="text-sm text-muted-foreground">{item.note}</p>)}
        </div>
      )}
      {snapshot.insights.length > 0 && (
        <div className="rounded-2xl border border-border p-4 space-y-2">
          <p className="text-sm font-semibold">This week</p>
          {snapshot.insights.map(card => (
            <p key={card.id} className="text-sm"><span className="font-semibold">{card.title}. </span>{card.body}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export function BehaviourBoard({
  snapshot, mood, onMood,
}: {
  snapshot: AnalyticsSnapshot;
  mood?: Mood | null;
  onMood?: (mood: Mood) => void;
}) {
  const quadrant = snapshot.behaviour.quadrant;
  return (
    <div className="space-y-4">
      <Freshness at={snapshot.computedAt} live />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(['consistency', 'focus_adherence', 'cramming', 'procrastination'] as const).map((id, index) => (
          <MetricTile
            key={id}
            id={id}
            index={index}
            value={snapshot.metrics[id] ?? null}
            trend={id === 'cramming' || id === 'procrastination'
              ? { direction: (snapshot.metrics[id] ?? 0) > 25 ? 'down' : 'up', label: (snapshot.metrics[id] ?? 0) > 25 ? 'Worth a look' : 'In a good range' }
              : { direction: (snapshot.metrics[id] ?? 0) >= 70 ? 'up' : 'flat', label: (snapshot.metrics[id] ?? 0) >= 70 ? 'Strong' : 'Building' }}
          />
        ))}
      </div>
      <div className="rounded-2xl border border-border p-4">
        <p className="text-sm font-semibold mb-2">Day by hour</p>
        <Heatmap grid={snapshot.heatmap} />
      </div>
      <div className="rounded-2xl border border-border p-4">
        <p className="text-sm font-semibold">Engagement and performance</p>
        <p className="text-sm text-muted-foreground mt-1">{quadrant ? QUADRANT_LABELS[quadrant as Quadrant] : 'Needs study time and a quiz score.'}</p>
      </div>
      {onMood && (
        <div className="rounded-2xl border border-border p-4">
          <p className="text-sm font-semibold mb-2">Mood check-in</p>
          <div className="flex gap-2">
            {([1, 2, 3, 4, 5] as Mood[]).map(value => (
              <button key={value} type="button" onClick={() => onMood(value)}
                className={`h-9 px-3 rounded-full text-xs font-semibold border ${mood === value ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>
                {MOOD_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-border p-4 space-y-2">
        <p className="text-sm font-semibold">Alerts</p>
        {snapshot.behaviour.anomalies.length === 0 && <p className="text-sm text-muted-foreground">No unusual pattern in this range.</p>}
        {snapshot.behaviour.anomalies.map(item => (
          <p key={item.id} className="text-sm"><span className="font-semibold">{item.title}. </span>{item.detail}</p>
        ))}
      </div>
    </div>
  );
}

export function GlossaryList() {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {METRICS.map(metric => (
        <div key={metric.id} className="rounded-xl border border-border p-3">
          <p className="text-sm font-semibold">{metric.label}</p>
          <p className="text-xs text-muted-foreground mt-1">{metric.summary}</p>
          <p className="text-[11px] mt-1">{metric.formula}</p>
        </div>
      ))}
    </div>
  );
}
