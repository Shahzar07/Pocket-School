'use client';

import { useState, type ReactNode } from 'react';
import { Freshness, GlossaryTip, Heatmap } from '@/components/insights/boards';
import { ChartPatternDefs, patternFill } from '@/components/charts/patterns';
import { accentForIndex } from '@/lib/design/chart-colours';
import { moodLabel, quadrantLabel, type BehaviourBoardModel } from '@/lib/insights/behaviour-board';
import { behaviourChecks } from '@/lib/insights/behaviour-seed';
import { MOOD_EMOJI, type Mood } from '@/lib/insights/behaviour';
import { metricById } from '@/lib/insights/metrics';
import type { DrillRecord } from '@/lib/insights/reports';

const MOODS: Mood[] = [1, 2, 3, 4, 5];

function Chart({
  id, title, metricId, caption, children, onOpen,
}: {
  id: string;
  title: string;
  metricId?: string;
  caption: string;
  children: ReactNode;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-2" data-chart={id} style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--ps-emerald) 12%, var(--card)), var(--card) 70%)' }}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title} {metricId && <GlossaryTip id={metricId} />}</h2>
        <button type="button" className="text-xs font-semibold underline" onClick={() => onOpen(id)}>Records</button>
      </div>
      {children}
      <p className="text-xs text-muted-foreground">{caption}</p>
    </section>
  );
}

function Gauge({ value }: { value: number | null }) {
  const pct = value ?? 0;
  return (
    <div className="flex items-center gap-4">
      <div
        className="h-20 w-20 rounded-full"
        style={{ background: `conic-gradient(var(--ps-emerald) ${pct * 3.6}deg, var(--muted) 0)` }}
        role="img"
        aria-label={`Consistency ${value ?? 0} percent`}
      />
      <p className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--ps-emerald)' }}>{value ?? '—'}<span className="text-base text-muted-foreground">%</span></p>
    </div>
  );
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map(row => row.value));
  return (
    <div className="space-y-1">
      {rows.map((row, index) => (
        <div key={row.label} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-2 text-xs">
          <span>{row.label}</span>
          <span className="h-2.5 rounded-full bg-muted overflow-hidden">
            <span className="block h-full" style={{ width: `${(row.value / max) * 100}%`, background: patternFill(accentForIndex(index)) }} />
          </span>
          <span className="tabular-nums text-right">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function BehaviourDashboard({
  board,
  onMood,
  showChecks,
}: {
  board: BehaviourBoardModel;
  onMood?: (mood: Mood, effort: number) => void;
  showChecks?: boolean;
}) {
  const [open, setOpen] = useState<string | null>('heatmap');
  const [effort, setEffort] = useState(3);
  const metrics = board.snapshot.metrics;
  const checks = showChecks ? behaviourChecks(board) : [];
  const drill = recordsFor(board, open);
  const staff = board.role === 'teacher' || board.role === 'institution_admin';

  return (
    <div className="relative space-y-4" data-behaviour-dashboard={board.role}>
      <ChartPatternDefs />
      <p className="text-sm">Behaviour for {board.scopeLabel}. The numbers use the same definitions as Reports.</p>
      <Freshness at={board.computedAt} live={!board.precomputed} />
      <div className="grid lg:grid-cols-2 gap-4">
        <Chart id="heatmap" title="Study by day and hour" metricId="study_time" caption={board.captions.heatmap} onOpen={setOpen}>
          <Heatmap grid={board.heatmap} />
          <p className="text-sm">{metrics.study_time ?? '—'} minutes in this range.</p>
        </Chart>
        <Chart id="consistency" title="Consistency" metricId="consistency" caption={board.captions.consistency} onOpen={setOpen}>
          <Gauge value={metrics.consistency} />
        </Chart>
        <Chart id="streak" title="Streak calendar" metricId="streak" caption={board.captions.streak} onOpen={setOpen}>
          <p className="text-sm font-semibold">{metrics.streak ?? 0} day streak</p>
          <div className="flex flex-wrap gap-1">
            {board.calendar.map(day => (
              <span
                key={day.dateKey}
                title={day.dateKey}
                className={`h-7 min-w-7 px-1 rounded text-[10px] inline-flex items-center justify-center font-semibold ${day.completed || day.studied ? '' : 'bg-muted text-muted-foreground'}`}
                style={day.completed
                  ? { background: 'var(--ps-emerald)', color: 'var(--ps-on-emerald)' }
                  : day.studied
                    ? { background: 'color-mix(in srgb, var(--ps-sky) 28%, var(--card))', color: 'var(--ps-sky)' }
                    : undefined}
              >
                {day.dateKey.slice(8)}
              </span>
            ))}
          </div>
        </Chart>
        <Chart id="sessions" title="Session length" metricId="study_time" caption={board.captions.sessions} onOpen={setOpen}>
          <Bars rows={board.sessions.map(bucket => ({ label: bucket.label, value: bucket.count }))} />
        </Chart>
        <Chart id="focus" title="Focus timer" metricId="focus_adherence" caption={board.captions.focus} onOpen={setOpen}>
          <p className="text-3xl font-semibold tabular-nums">{metrics.focus_adherence ?? '—'}%</p>
          <p className="text-xs text-muted-foreground">{metricById('focus_adherence')?.formula}</p>
        </Chart>
        <Chart id="timeline" title="Learning pattern" metricId="cramming" caption={board.captions.timeline} onOpen={setOpen}>
          <p className="text-sm">Cramming {metrics.cramming ?? '—'}% · Procrastination {metrics.procrastination ?? '—'}%</p>
          {board.timeline.slice(0, 4).map(item => (
            <p key={item.id} className="text-sm">{item.at.slice(0, 16).replace('T', ' ')} · {item.label}. {item.detail}</p>
          ))}
        </Chart>
        <Chart id="help" title="AI help and question pace" metricId="hint_rate" caption={board.captions.help} onOpen={setOpen}>
          <p className="text-sm">Hints {metrics.hint_rate ?? '—'}% · AI turns per hour {metrics.ai_usage ?? '—'} · Attempts {metrics.attempts_per_question ?? '—'} · Seconds {metrics.seconds_per_question ?? '—'}</p>
        </Chart>
        <Chart id="funnel" title="Engagement funnel" metricId="goal_completion" caption={board.captions.funnel} onOpen={setOpen}>
          <Bars rows={[
            { label: 'Start', value: board.funnel.start },
            { label: 'Progress', value: board.funnel.progress },
            { label: 'Complete', value: board.funnel.complete },
          ]} />
        </Chart>
        <Chart id="mood" title="Mood and effort" caption={board.captions.mood} onOpen={setOpen}>
          <div className="flex flex-wrap gap-2 text-sm">
            {board.moods.map(mood => (
              <span key={mood.dateKey}>{mood.dateKey.slice(5)} {MOOD_EMOJI[mood.mood]} {moodLabel(mood.mood)}{mood.effort ? ` · effort ${mood.effort}` : ''}</span>
            ))}
            {board.moods.length === 0 && <span className="text-muted-foreground">No check-in in this range.</span>}
          </div>
          {onMood && (
            <div className="space-y-2">
              <p className="text-xs">Optional check-in after this session.</p>
              <div className="flex gap-2">
                {MOODS.map(mood => (
                  <button key={mood} type="button" className="h-9 px-2 rounded-full border border-border text-sm" onClick={() => onMood(mood, effort)}>
                    {MOOD_EMOJI[mood]} {moodLabel(mood)}
                  </button>
                ))}
              </div>
              <label className="text-xs">Effort
                <input className="ml-2 w-16" type="number" min={1} max={5} value={effort} onChange={event => setEffort(Number(event.target.value))} />
              </label>
            </div>
          )}
        </Chart>
        <Chart id="badges" title="Positive behaviour" caption={board.captions.badges} onOpen={setOpen}>
          <div className="flex flex-wrap gap-2">
            {board.badges.map(badge => (
              <span key={badge.id} className="rounded-full border border-border px-3 py-1 text-xs">{badge.title}</span>
            ))}
            {board.badges.length === 0 && <span className="text-sm text-muted-foreground">No badge in this range yet.</span>}
          </div>
        </Chart>
        <Chart id="notes" title="Teacher notes" caption={board.captions.notes} onOpen={setOpen}>
          {board.notes.map(note => (
            <p key={note.id} className="text-sm">{note.at.slice(0, 10)} · {note.type} · {note.studentLabel} · {note.description}</p>
          ))}
          {board.notes.length === 0 && <p className="text-sm text-muted-foreground">No merit or concern in this range.</p>}
        </Chart>
        {staff && (
          <Chart id="quadrant" title="Class quadrant" caption={board.captions.quadrant} onOpen={setOpen}>
            {board.classPoints.map(point => (
              <p key={point.studentId} className="text-sm" data-quadrant={point.quadrant ?? 'unknown'}>
                {point.label}: {point.studyMinutes} min, quiz {point.performance ?? '—'}%. {quadrantLabel(point.quadrant)}
              </p>
            ))}
          </Chart>
        )}
        <Chart id="alerts" title="Anomaly alerts" caption={board.captions.alerts} onOpen={setOpen}>
          {board.snapshot.behaviour.anomalies.length === 0 && <p className="text-sm text-muted-foreground">No unusual pattern in this range.</p>}
          {board.snapshot.behaviour.anomalies.map(item => (
            <p key={item.id} className="text-sm"><span className="font-semibold">{item.title}. </span>{item.detail}</p>
          ))}
        </Chart>
      </div>
      <div className="rounded-2xl border border-border p-4" data-drill={open ?? ''}>
        <p className="font-semibold">Records</p>
        {drill.map(row => <p key={row.id} className="text-sm">{row.when} · {row.label} · {row.value}</p>)}
        {drill.length === 0 && <p className="text-sm text-muted-foreground">No row-level records for this chart.</p>}
      </div>
      {showChecks && (
        <ul data-checks>
          {checks.map(check => (
            <li key={check.label} data-check={String(check.actual) === String(check.expected) ? 'pass' : 'fail'}>
              {check.label}: {String(check.actual ?? '—')} expected {check.expected}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function recordsFor(board: BehaviourBoardModel, id: string | null): DrillRecord[] {
  if (id === 'sessions') return board.sessions.flatMap(bucket => bucket.records);
  if (id === 'focus') return board.focusRecords;
  if (id === 'timeline') return board.timeline.map(item => ({ id: item.id, when: item.at, label: item.label, value: item.detail }));
  if (id === 'help') return board.helpRecords;
  if (id === 'funnel' || id === 'streak') return board.funnel.records;
  if (id === 'mood') return board.moods.map(mood => ({ id: mood.dateKey, when: mood.at, label: moodLabel(mood.mood), value: mood.effort ? `effort ${mood.effort}` : 'check-in' }));
  if (id === 'notes') return board.notes.map(note => ({ id: note.id, when: note.at, label: `${note.type} · ${note.studentLabel}`, value: note.description }));
  if (id === 'heatmap' || id === 'consistency') {
    return board.sessions.flatMap(bucket => bucket.records);
  }
  if (id === 'quadrant') {
    return board.classPoints.map(point => ({ id: point.studentId, when: board.computedAt, label: point.label, value: quadrantLabel(point.quadrant) }));
  }
  if (id === 'alerts') {
    return board.snapshot.behaviour.anomalies.map(item => ({ id: item.id, when: board.computedAt, label: item.title, value: item.detail }));
  }
  if (id === 'badges') {
    return board.badges.map(badge => ({ id: badge.id, when: board.computedAt, label: badge.title, value: badge.detail }));
  }
  return [];
}
