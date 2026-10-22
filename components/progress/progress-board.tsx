'use client';

import { FormEvent, useState } from 'react';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { PARENT_CHECKLIST, STAFF_CHECKLIST, parentActionLabel, staffActionLabel, type AccountabilityStats, type LevelAccountability } from '@/lib/alerts/accountability';
import type { AlertSeverity } from '@/lib/alerts/model';
import type { LevelCount, ProgressAlertView, ProgressSettings } from '@/lib/alerts/progress';
import { DEFAULT_THRESHOLDS } from '@/lib/alerts/progress';

const LIGHT: Record<AlertSeverity, string> = {
  low: 'bg-[var(--ps-cyan)]',
  medium: 'bg-[var(--ps-tile-ink)]',
  high: 'bg-[var(--ps-tile-ink)]',
  critical: 'bg-[#1E6A83]',
};

const WORD: Record<AlertSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export interface ProgressTrend {
  day: string;
  low: number;
  medium: number;
  high: number;
  critical: number;
  total: number;
}

export function ProgressBoard({
  mode,
  eyebrow,
  title,
  description,
  alerts,
  levels = [],
  trend = null,
  previous = null,
  loading = false,
  error = null,
  interactive = false,
  onWorkflow,
  settings = null,
  onSaveSettings,
  stats = null,
  levelStats = [],
}: {
  mode: 'student' | 'parent' | 'teacher' | 'institution' | 'admin';
  eyebrow: string;
  title: string;
  description: string;
  alerts: ProgressAlertView[];
  levels?: LevelCount[];
  trend?: ProgressTrend | null;
  previous?: ProgressTrend | null;
  loading?: boolean;
  error?: string | null;
  interactive?: boolean;
  onWorkflow?: (id: string, action: 'acknowledge' | 'assign' | 'note' | 'resolve' | 'act' | 'seen' | 'parent_act' | 'delegate' | 'check_in' | 'meeting', extra?: { note?: string; assigneeId?: string; checklist?: string; meetingUrl?: string }) => Promise<void>;
  settings?: ProgressSettings | null;
  onSaveSettings?: (settings: ProgressSettings) => Promise<void>;
  stats?: AccountabilityStats | null;
  levelStats?: LevelAccountability[];
}) {
  const [course, setCourse] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const courses = [...new Set(alerts.map((alert) => alert.courseTitle).filter(Boolean))];
  const levelNames = [...new Set(alerts.map((alert) => alert.level).filter(Boolean))];
  const filtering = mode === 'institution' || mode === 'admin';
  const shown = alerts.filter((alert) => (course === 'all' || alert.courseTitle === course) && (levelFilter === 'all' || alert.level === levelFilter));
  return (
    <DashPage>
      <div data-progress-view={mode}>
        <DashHeader eyebrow={eyebrow} title={title} description={description} />
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-[var(--ps-tile-ink)]">{error}</p>}
        {!loading && alerts.length === 0 && !error && (
          <Panel>
            <p className="text-sm text-muted-foreground">
              {mode === 'student' ? 'Nothing needs a plan right now. The next lesson can stay small.' : 'No progress alerts are open.'}
            </p>
          </Panel>
        )}
        {stats && mode !== 'student' && <StatsStrip mode={mode} stats={stats} levelStats={levelStats} />}
        {(mode === 'institution' || mode === 'admin') && <TrendPanel trend={trend} previous={previous} levels={levels} />}
        {filtering && (
          <div className="flex flex-wrap gap-2">
            <select className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm" value={course} onChange={(event) => setCourse(event.target.value)} aria-label="Class">
              <option value="all">All classes</option>
              {courses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} aria-label="Level">
              <option value="all">All levels</option>
              {levelNames.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        )}
        <div className="space-y-4">
          {shown.map((alert) => (
            <AlertCard key={alert.id} alert={alert} mode={mode} interactive={interactive} onWorkflow={onWorkflow} />
          ))}
        </div>
        {settings && onSaveSettings && <SettingsForm initial={settings} onSave={onSaveSettings} />}
      </div>
    </DashPage>
  );
}

function StatsStrip({ mode, stats, levelStats }: { mode: string; stats: AccountabilityStats; levelStats: LevelAccountability[] }) {
  const hours = stats.averageResponseMs == null ? '—' : `${Math.round(stats.averageResponseMs / 3600000)}h`;
  const engagement = stats.parentEngagement == null ? 'Hidden under five' : `${Math.round(stats.parentEngagement * 100)}%`;
  const success = stats.interventionSuccess == null ? 'Hidden under five' : `${Math.round(stats.interventionSuccess * 100)}%`;
  const cards = mode === 'parent'
    ? [
      ['Actions taken', String(stats.parentActions)],
      ['Open plans', String(stats.open)],
    ]
    : [
      ['Open', String(stats.open)],
      ['Waiting', String(stats.overdue)],
      ['Average reply', hours],
      ['Back on track', String(stats.recovered)],
      ...(mode === 'institution' || mode === 'admin' ? [['Family engagement', engagement], ['Plans that helped', success]] as const : []),
    ];
  return (
    <Panel>
      <h2 className="text-[15px] font-semibold mb-3">{mode === 'parent' ? 'Your part in the plan' : 'Response'}</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border p-3">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-heading">{value}</p>
          </div>
        ))}
      </div>
      {levelStats.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {levelStats.map((level) => `${level.level}: ${level.open} open`).join(' · ')}
        </p>
      )}
    </Panel>
  );
}

function TrendPanel({ trend, previous, levels }: { trend: ProgressTrend | null; previous: ProgressTrend | null; levels: LevelCount[] }) {
  return (
    <Panel>
      <h2 className="text-[15px] font-semibold mb-3">At-risk overview</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        {(['low', 'medium', 'high', 'critical'] as const).map((severity) => (
          <div key={severity} className="rounded-xl border border-border p-3">
            <p className="flex items-center gap-2 text-sm font-medium"><Dot severity={severity} />{WORD[severity]}</p>
            <p className="mt-1 text-2xl font-heading">{trend ? trend[severity] : '—'}</p>
            {previous && <p className="text-xs text-muted-foreground">Seven days ago: {previous[severity]}</p>}
          </div>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2 font-medium">Level</th>
              <th className="py-2 font-medium">Low</th>
              <th className="py-2 font-medium">Medium</th>
              <th className="py-2 font-medium">High</th>
              <th className="py-2 font-medium">Critical</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((level) => (
              <tr key={level.level} className="border-t border-border">
                <td className="py-2">{level.level}</td>
                <td>{level.low}</td>
                <td>{level.medium}</td>
                <td>{level.high}</td>
                <td>{level.critical}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {levels.length === 0 && <p className="text-sm text-muted-foreground mt-2">Groups smaller than five stay off this overview.</p>}
      </div>
    </Panel>
  );
}

function AlertCard({
  alert,
  mode,
  interactive,
  onWorkflow,
}: {
  alert: ProgressAlertView;
  mode: 'student' | 'parent' | 'teacher' | 'institution' | 'admin';
  interactive: boolean;
  onWorkflow?: (id: string, action: 'acknowledge' | 'assign' | 'note' | 'resolve' | 'act' | 'seen' | 'parent_act' | 'delegate' | 'check_in' | 'meeting', extra?: { note?: string; assigneeId?: string; checklist?: string; meetingUrl?: string }) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [assignee, setAssignee] = useState('');
  const [checklist, setChecklist] = useState('');
  const [meetingUrl, setMeetingUrl] = useState(alert.accountability?.meeting?.url ?? '');
  const [busy, setBusy] = useState(false);
  const positive = alert.polarity === 'positive';
  const run = async (action: 'acknowledge' | 'assign' | 'note' | 'resolve' | 'act' | 'seen' | 'parent_act' | 'delegate' | 'check_in' | 'meeting', extra?: { note?: string; assigneeId?: string; checklist?: string; meetingUrl?: string }) => {
    if (!onWorkflow) return;
    setBusy(true);
    try {
      await onWorkflow(alert.id, action, extra);
      if (action === 'note') setNote('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            {positive ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--ps-good)]" /> : <Dot severity={alert.severity} />}
            {mode === 'student' ? 'A note from ET AI' : positive ? alert.title : WORD[alert.severity]}
            {alert.badge === 'comeback' && <span className="rounded-full bg-[var(--ps-mint)] px-2 py-0.5 text-xs text-[var(--ps-mint-ink)]">Comeback</span>}
          </p>
          <h2 className="mt-1 font-heading text-xl tracking-[-0.03em]">{mode === 'student' ? alert.plan.studentIntro : alert.title}</h2>
          {mode !== 'student' && <p className="mt-1 text-sm text-muted-foreground">{alert.studentName} · {alert.level || 'Level'} · {alert.courseTitle}</p>}
        </div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{alert.status}</p>
      </div>
      {mode === 'parent' && alert.plan.parentGuide && <p className="mt-3 text-sm leading-relaxed">{alert.plan.parentGuide}</p>}
      {alert.accountability && (
        <div className="mt-3 space-y-2 text-sm">
          {mode !== 'student' && alert.accountability.ownerName && <p>Owner: {alert.accountability.ownerName}{alert.accountability.coOwnerName ? ` · Family: ${alert.accountability.coOwnerName}` : ''}</p>}
          {mode !== 'student' && alert.accountability.dueAt && <p>Due {new Date(alert.accountability.dueAt).toLocaleString()}{alert.accountability.overdue ? ' · still open' : ''}</p>}
          {alert.accountability.recognition.map((badge) => (
            <p key={badge} className="text-[var(--ps-mint-ink)]">{badge === 'rapid_responder' ? 'Rapid Responder' : 'Engaged Parent'}</p>
          ))}
          {alert.accountability.tasks.map((task) => <p key={task.id}>{task.who === 'student' ? 'Student' : task.who === 'parent' ? 'Family' : 'Teacher'}: {task.text}</p>)}
          {mode !== 'student' && alert.accountability.agenda && <p>{alert.accountability.agenda}</p>}
          {alert.accountability.meeting && <p>Meeting: {alert.accountability.meeting.provider} · {alert.accountability.meeting.url}</p>}
          {mode !== 'student' && alert.accountability.staffAction && <p>Logged: {alert.accountability.staffAction}</p>}
          {alert.accountability.parentAction && <p>Family: {alert.accountability.parentAction}</p>}
        </div>
      )}
      {mode === 'student' && (
        <div className="mt-3 space-y-2 text-sm">
          {alert.plan.review.length > 0 && (
            <ul className="list-disc pl-5">
              {alert.plan.review.map((lesson) => <li key={lesson.lessonId}>{lesson.title}</li>)}
            </ul>
          )}
          {alert.plan.visuals.map((visual) => (
            <p key={`${visual.lessonId}-${visual.kind}`}>{visual.kind === 'mindmapImage' ? 'Mind map' : 'Revision poster'}: {visual.title}</p>
          ))}
          <p>{alert.plan.retake}</p>
        </div>
      )}
      {mode !== 'student' && mode !== 'parent' && (
        <div className="mt-3 space-y-2 text-sm">
          <p>{alert.summary}</p>
          {alert.plan.teacherActions.map((action) => <p key={action}>{action}</p>)}
          {alert.safeguardingCaseId && <p>Linked safeguarding case {alert.safeguardingCaseId}.</p>}
          {alert.notes.map((item) => (
            <p key={`${item.at}-${item.text}`} className="text-muted-foreground">{item.authorName}: {item.text}</p>
          ))}
          {alert.audit.slice(-3).map((item) => (
            <p key={`${item.at}-${item.action}`} className="text-xs text-muted-foreground">{item.action}: {item.detail}</p>
          ))}
        </div>
      )}
      {interactive && onWorkflow && mode !== 'student' && alert.polarity === 'concern' && alert.status !== 'resolved' && (
        <form className="mt-4 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void run('note', { note }); }}>
          <button type="button" className="rounded-full border border-border px-3 py-1.5 text-sm" disabled={busy} onClick={() => void run('acknowledge')}>Acknowledge</button>
          <button type="button" className="rounded-full border border-border px-3 py-1.5 text-sm" disabled={busy} onClick={() => void run('resolve')}>Mark resolved</button>
          <select className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm" value={checklist} onChange={(event) => setChecklist(event.target.value)}>
            <option value="">Log an action</option>
            {STAFF_CHECKLIST.map((item) => <option key={item} value={item}>{staffActionLabel(item)}</option>)}
          </select>
          <button type="button" className="rounded-full border border-border px-3 py-1.5 text-sm" disabled={busy} onClick={() => void run('act', { checklist, note })}>Save action</button>
          <input value={meetingUrl} onChange={(event) => setMeetingUrl(event.target.value)} placeholder="Zoom, Meet, or Teams link" className="min-w-48 rounded-xl border border-border bg-card px-3 py-1.5 text-sm" />
          <button type="button" className="rounded-full border border-border px-3 py-1.5 text-sm" disabled={busy} onClick={() => void run('meeting', { meetingUrl })}>Save meeting</button>
          <input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="Assign to" className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm" />
          <button type="button" className="rounded-full border border-border px-3 py-1.5 text-sm" disabled={busy} onClick={() => void run('assign', { assigneeId: assignee })}>Assign</button>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note" className="min-w-48 flex-1 rounded-xl border border-border bg-card px-3 py-1.5 text-sm" />
          <button type="submit" className="rounded-full bg-primary px-3 py-1.5 text-sm text-primary-foreground" disabled={busy}>Save note</button>
        </form>
      )}
      {interactive && onWorkflow && mode === 'student' && alert.polarity === 'concern' && alert.status === 'open' && (
        <button type="button" className="mt-4 rounded-full border border-border px-3 py-1.5 text-sm" disabled={busy} onClick={() => void run('acknowledge')}>I have seen this</button>
      )}
      {interactive && onWorkflow && mode === 'parent' && alert.polarity === 'concern' && (
        <form className="mt-4 flex gap-2" onSubmit={(event: FormEvent) => { event.preventDefault(); void run('note', { note }); }}>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note for the teacher" className="min-w-48 flex-1 rounded-xl border border-border bg-card px-3 py-1.5 text-sm" />
          <button type="submit" className="rounded-full bg-primary px-3 py-1.5 text-sm text-primary-foreground" disabled={busy}>Send note</button>
          <button type="button" className="rounded-full border border-border px-3 py-1.5 text-sm" disabled={busy} onClick={() => void run('seen')}>I&apos;ve seen this</button>
          <select className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm" value={checklist} onChange={(event) => setChecklist(event.target.value)}>
            <option value="">Family action</option>
            {PARENT_CHECKLIST.map((item) => <option key={item} value={item}>{parentActionLabel(item)}</option>)}
          </select>
          <button type="button" className="rounded-full border border-border px-3 py-1.5 text-sm" disabled={busy} onClick={() => void run('parent_act', { checklist, note })}>Save family action</button>
        </form>
      )}
    </Panel>
  );
}

function Dot({ severity }: { severity: AlertSeverity }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${LIGHT[severity]}`} aria-hidden="true" />;
}

function SettingsForm({ initial, onSave }: { initial: ProgressSettings; onSave: (settings: ProgressSettings) => Promise<void> }) {
  const [settings, setSettings] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setThreshold = (key: keyof typeof DEFAULT_THRESHOLDS, value: string) => {
    const parsed = Number(value);
    setSettings((current) => ({
      ...current,
      thresholds: { ...current.thresholds, [key]: Number.isFinite(parsed) ? parsed : current.thresholds[key] },
    }));
  };
  return (
    <Panel>
      <h2 className="text-[15px] font-semibold mb-1">Alert settings</h2>
      <p className="text-sm text-muted-foreground mb-4">Critical alerts are still sent during quiet hours. Adult learners are never sent to parents.</p>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        setError(null);
        void onSave(settings).then(() => setSaved(true)).catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Settings were not saved.');
        });
      }}>
        <label className="text-sm">Inactive, low (days)
          <input className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-1.5" type="number" min={0} value={settings.thresholds.inactiveLowDays} onChange={(event) => setThreshold('inactiveLowDays', event.target.value)} />
        </label>
        <label className="text-sm">Inactive, medium (days)
          <input className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-1.5" type="number" min={0} value={settings.thresholds.inactiveMediumDays} onChange={(event) => setThreshold('inactiveMediumDays', event.target.value)} />
        </label>
        <label className="text-sm">Inactive, high (days)
          <input className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-1.5" type="number" min={0} value={settings.thresholds.inactiveHighDays} onChange={(event) => setThreshold('inactiveHighDays', event.target.value)} />
        </label>
        <label className="text-sm">Inactive, critical (days)
          <input className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-1.5" type="number" min={0} value={settings.thresholds.inactiveCriticalDays} onChange={(event) => setThreshold('inactiveCriticalDays', event.target.value)} />
        </label>
        <label className="text-sm">Score drop (%)
          <input className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-1.5" type="number" min={0} value={settings.thresholds.scoreDropPercent} onChange={(event) => setThreshold('scoreDropPercent', event.target.value)} />
        </label>
        <label className="text-sm">Medium due (hours)
          <input className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-1.5" type="number" min={1} value={settings.sla.mediumHours} onChange={(event) => setSettings((current) => ({ ...current, sla: { ...current.sla, mediumHours: Number(event.target.value) || current.sla.mediumHours } }))} />
        </label>
        <label className="text-sm">High due (hours)
          <input className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-1.5" type="number" min={1} value={settings.sla.highHours} onChange={(event) => setSettings((current) => ({ ...current, sla: { ...current.sla, highHours: Number(event.target.value) || current.sla.highHours } }))} />
        </label>
        <label className="text-sm">Critical acknowledgement (hours)
          <input className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-1.5" type="number" min={1} value={settings.sla.criticalHours} onChange={(event) => setSettings((current) => ({ ...current, sla: { ...current.sla, criticalHours: Number(event.target.value) || current.sla.criticalHours } }))} />
        </label>
        <label className="text-sm">Critical escalation (minutes)
          <input className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-1.5" type="number" min={1} value={settings.sla.criticalEscalationMinutes} onChange={(event) => setSettings((current) => ({ ...current, sla: { ...current.sla, criticalEscalationMinutes: Number(event.target.value) || current.sla.criticalEscalationMinutes } }))} />
        </label>
        <label className="text-sm">Course final at risk below (%)
          <input className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-1.5" type="number" min={0} value={settings.thresholds.finalAtRiskPercent} onChange={(event) => setThreshold('finalAtRiskPercent', event.target.value)} />
        </label>
        <label className="text-sm">Parent alert level
          <select className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-1.5" value={settings.parentAlertLevel} onChange={(event) => setSettings((current) => ({ ...current, parentAlertLevel: event.target.value as AlertSeverity }))}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="text-sm">Quiet hours
          <span className="mt-1 flex gap-2">
            <input className="w-full rounded-xl border border-border bg-card px-3 py-1.5" value={settings.quietStart} onChange={(event) => setSettings((current) => ({ ...current, quietStart: event.target.value }))} />
            <input className="w-full rounded-xl border border-border bg-card px-3 py-1.5" value={settings.quietEnd} onChange={(event) => setSettings((current) => ({ ...current, quietEnd: event.target.value }))} />
          </span>
        </label>
        <label className="text-sm sm:col-span-2">Academic lead ids
          <input className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-1.5" value={settings.academicLeadIds.join(', ')} onChange={(event) => setSettings((current) => ({ ...current, academicLeadIds: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={settings.automationEnabled} onChange={(event) => setSettings((current) => ({ ...current, automationEnabled: event.target.checked }))} />
          Send progress alerts
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">Save settings</button>
          {saved && <span className="ml-3 text-sm text-muted-foreground">Saved.</span>}
          {error && <span className="ml-3 text-sm text-[var(--ps-tile-ink)]">{error}</span>}
        </div>
      </form>
    </Panel>
  );
}
