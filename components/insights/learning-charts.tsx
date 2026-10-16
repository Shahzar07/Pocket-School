'use client';

import { useState, type ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { BLOOM_LABELS, weeklyStudySeries, type BloomLevel } from '@/lib/insights/analytics';
import type { AnalyticsSnapshot } from '@/lib/insights/aggregate';
import { Heatmap } from '@/components/insights/boards';
import { ChartPatternDefs, SeriesLegend, patternFill } from '@/components/charts/patterns';
import { Button } from '@/components/ui/button';
import { ACCENT_IDS, accentForIndex, type AccentId } from '@/lib/design/chart-colours';

const tick = { fontSize: 10, fill: 'var(--muted-foreground)' };
const gridStroke = 'var(--border)';

function Table({ caption, headers, rows }: { caption: string; headers: string[]; rows: string[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}
      </tbody>
    </table>
  );
}

function Frame({ title, summary, children, table, legend }: {
  title: string;
  summary: string;
  children: ReactNode;
  table: { headers: string[]; rows: string[][] };
  legend?: { id: AccentId; label: string }[];
}) {
  return (
    <figure className="rounded-2xl border border-border bg-card p-4" aria-label={title} style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--ps-teal) 7%, var(--card)), var(--card) 42%)' }}>
      <figcaption className="text-sm font-semibold mb-1">{title}</figcaption>
      <p className="text-xs text-muted-foreground mb-3">{summary}</p>
      <div className="h-52">{children}</div>
      {legend && legend.length > 0 && <SeriesLegend items={legend} />}
      <Table caption={title} headers={table.headers} rows={table.rows} />
    </figure>
  );
}

export function LearningCharts({
  snapshot,
  compact,
  onMakeGoal,
}: {
  snapshot: AnalyticsSnapshot;
  compact?: boolean;
  onMakeGoal?: (title: string, minutes: number) => void;
}) {
  const [week, setWeek] = useState(false);
  const study = week ? weeklyStudySeries(snapshot.studySeries) : snapshot.studySeries.filter((_, index, rows) => !compact || index >= rows.length - 14);
  const studySummary = study.slice(-7).map(row => `${row.label.slice(5)} ${row.minutes} min`).join(', ') || 'No study time in this range.';
  const bloom = snapshot.radar.map(row => ({
    level: BLOOM_LABELS[row.level as BloomLevel] ?? row.level,
    score: row.score ?? 0,
  }));
  const topics = snapshot.topics.slice(0, 6).map(row => ({
    topic: row.topic,
    score: row.score,
    confidence: row.confidence,
  }));

  const attendanceRate = snapshot.metrics.attendance_rate;
  const attendanceSlices = attendanceRate == null
    ? []
    : [
      { name: 'Present', value: attendanceRate, tone: 'sky' as AccentId },
      { name: 'Away', value: Math.max(0, 100 - attendanceRate), tone: 'coral' as AccentId },
    ];
  const bloomTones = ACCENT_IDS;

  return (
    <div className="relative space-y-4" data-learning-charts>
      <ChartPatternDefs />
      <p className="text-sm">{snapshot.summary}</p>
      {snapshot.dropOffs.length > 0 && (
        <p className="text-xs text-muted-foreground">Drop-off: {snapshot.dropOffs.join('; ')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {snapshot.insights.slice(0, 3).map(card => (
          <div key={card.id} className="rounded-xl border border-border p-3 max-w-sm">
            <p className="text-sm font-semibold">{card.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.body}</p>
            {onMakeGoal && (
              <Button type="button" variant="outline" className="mt-2 h-8" onClick={() => onMakeGoal(card.suggestedGoal.title, card.suggestedGoal.estimateMinutes)}>
                Make this a goal
              </Button>
            )}
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Frame
          title="Study time"
          summary={studySummary}
          legend={[{ id: 'teal', label: 'Study time' }]}
          table={{ headers: ['When', 'Minutes'], rows: study.map(row => [row.label, String(row.minutes)]) }}
        >
          <div className="flex justify-end mb-1">
            <button type="button" className="text-[11px] font-semibold text-primary" onClick={() => setWeek(value => !value)}>
              {week ? 'Show days' : 'Show weeks'}
            </button>
          </div>
          <ResponsiveContainer width="100%" height="90%">
            <AreaChart data={study}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="label" tick={tick} tickFormatter={value => String(value).slice(5)} />
              <YAxis tick={tick} />
              <Tooltip />
              <Area type="monotone" dataKey="minutes" name="Minutes" stroke="var(--ps-teal)" strokeWidth={2} fill="url(#ps-area-teal)" />
            </AreaChart>
          </ResponsiveContainer>
        </Frame>
        <figure className="rounded-2xl border border-border p-4" aria-label="Study activity heatmap">
          <figcaption className="text-sm font-semibold mb-1">Activity heatmap</figcaption>
          <p className="text-xs text-muted-foreground mb-3">
            {snapshot.behaviour.bestDay ? `Busiest slot: ${snapshot.behaviour.bestDay} at ${snapshot.behaviour.bestHour}:00.` : 'No hourly study recorded yet.'}
          </p>
          <Heatmap grid={snapshot.heatmap} />
          <Table
            caption="Study activity by weekday and hour"
            headers={['Day', 'Hour', 'Minutes']}
            rows={snapshot.heatmap.flatMap((row, day) => row.flatMap((minutes, hour) => (
              minutes > 0 ? [[ ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] ?? 'Day', String(hour), String(minutes) ]] : []
            )))}
          />
        </figure>
        {!compact && (
          <Frame
            title="Course progress"
            summary={snapshot.courseProgress.length
              ? snapshot.courseProgress.map(row => `${row.label} ${row.progress}%`).join(', ')
              : `${snapshot.lessonsCompleted} lessons completed in goals.`}
            legend={(snapshot.courseProgress.length ? snapshot.courseProgress : [{ label: 'Lessons' }]).map((row, index) => ({ id: accentForIndex(index), label: row.label }))}
            table={{
              headers: ['Course', 'Progress'],
              rows: (snapshot.courseProgress.length ? snapshot.courseProgress : [{ label: 'Lessons in goals', progress: snapshot.lessonsCompleted }])
                .map(row => [row.label, String(row.progress)]),
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snapshot.courseProgress.length ? snapshot.courseProgress : [{ label: 'Lessons', progress: snapshot.lessonsCompleted }]}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="label" tick={tick} />
                <YAxis tick={tick} />
                <Tooltip />
                <Bar dataKey="progress" name="Progress">
                  {(snapshot.courseProgress.length ? snapshot.courseProgress : [{ label: 'Lessons' }]).map((row, index) => (
                    <Cell key={row.label} fill={patternFill(accentForIndex(index))} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Frame>
        )}
        <Frame
          title="Quiz scores"
          summary={snapshot.quizTrend.map(row => `${row.label.slice(5)} ${row.average}%`).join(', ') || 'No quizzes in this range.'}
          legend={[{ id: 'amber', label: 'Grades' }]}
          table={{ headers: ['Day', 'Average'], rows: snapshot.quizTrend.map(row => [row.label, String(row.average)]) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={snapshot.quizTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="label" tick={tick} tickFormatter={value => String(value).slice(5)} />
              <YAxis domain={[0, 100]} tick={tick} />
              <Tooltip />
              <Line type="monotone" dataKey="average" name="Score %" stroke="var(--ps-amber)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Frame>
        <Frame
          title="Topic mastery"
          summary={topics.map(row => `${row.topic} ${row.score}% (confidence ${row.confidence}%)`).join(', ') || 'No topic scores yet.'}
          legend={[{ id: 'violet', label: 'Topic score' }]}
          table={{ headers: ['Topic', 'Score', 'Confidence'], rows: topics.map(row => [row.topic, String(row.score), String(row.confidence)]) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={topics.length ? topics : [{ topic: '—', score: 0, confidence: 0 }]}>
              <PolarGrid />
              <PolarAngleAxis dataKey="topic" tick={{ fontSize: 10 }} />
              <Radar dataKey="score" name="Score" stroke="var(--ps-violet)" fill="var(--ps-violet)" fillOpacity={0.35} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </Frame>
        <Frame
          title="Goals met and missed"
          summary={`${snapshot.goalsMet} met, ${snapshot.goalsMissed} missed. Streak ${snapshot.metrics.streak ?? 0} days.`}
          legend={[{ id: 'emerald', label: 'Goals met' }, { id: 'coral', label: 'Goals missed' }]}
          table={{ headers: ['Result', 'Count'], rows: [['Met', String(snapshot.goalsMet)], ['Missed', String(snapshot.goalsMissed)]] }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: 'Met', value: snapshot.goalsMet },
                  { name: 'Missed', value: snapshot.goalsMissed },
                ]}
                dataKey="value"
                nameKey="name"
                innerRadius={46}
                outerRadius={72}
                label={({ name, value }) => `${name} ${value}`}
              >
                <Cell fill={patternFill('emerald')} />
                <Cell fill={patternFill('coral')} />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Frame>
        {!compact && (
          <Frame
            title="Sparks earned and spent"
            summary={`${snapshot.metrics.sparks_earned ?? 0} earned, ${snapshot.sparksSpent} spent.`}
            legend={[{ id: 'coral', label: 'Sparks earned' }, { id: 'amber', label: 'Sparks spent' }]}
            table={{ headers: ['Kind', 'Sparks'], rows: [['Earned', String(snapshot.metrics.sparks_earned ?? 0)], ['Spent', String(snapshot.sparksSpent)]] }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Earned', value: snapshot.metrics.sparks_earned ?? 0 },
                    { name: 'Spent', value: snapshot.sparksSpent },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={46}
                  outerRadius={72}
                  label={({ name, value }) => `${name} ${value}`}
                >
                  <Cell fill={patternFill('coral')} />
                  <Cell fill={patternFill('amber')} />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Frame>
        )}
        <Frame
          title="Bloom’s taxonomy"
          summary={bloom.map(row => `${row.level} ${row.score}`).join(', ')}
          legend={bloom.map((row, index) => ({ id: accentForIndex(index), label: row.level }))}
          table={{ headers: ['Level', 'Score'], rows: bloom.map(row => [row.level, String(row.score)]) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bloom} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis type="number" domain={[0, 100]} tick={tick} />
              <YAxis type="category" dataKey="level" tick={tick} width={80} />
              <Tooltip />
              <Bar dataKey="score" name="Mastery">
                {bloom.map((row, index) => (
                  <Cell key={row.level} fill={patternFill(accentForIndex(index))} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Frame>
      </div>
      {!compact && snapshot.bloomTopics.length > 0 && (
        <Frame
          title="Bloom by topic"
          summary={snapshot.bloomTopics.map(row => row.topic).join(', ')}
          legend={[
            { id: 'teal', label: 'Remember' },
            { id: 'amber', label: 'Understand' },
            { id: 'coral', label: 'Apply' },
            { id: 'violet', label: 'Analyse' },
            { id: 'emerald', label: 'Evaluate' },
            { id: 'sky', label: 'Create' },
          ]}
          table={{
            headers: ['Topic', 'Remember', 'Understand', 'Apply', 'Analyse', 'Evaluate', 'Create'],
            rows: snapshot.bloomTopics.map(row => [row.topic, String(row.remember), String(row.understand), String(row.apply), String(row.analyse), String(row.evaluate), String(row.create)]),
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={snapshot.bloomTopics}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="topic" tick={tick} />
              <YAxis tick={tick} />
              <Tooltip />
              <Bar dataKey="remember" name="Remember" stackId="bloom" fill={patternFill(bloomTones[0])} />
              <Bar dataKey="understand" name="Understand" stackId="bloom" fill={patternFill(bloomTones[1])} />
              <Bar dataKey="apply" name="Apply" stackId="bloom" fill={patternFill(bloomTones[2])} />
              <Bar dataKey="analyse" name="Analyse" stackId="bloom" fill={patternFill(bloomTones[3])} />
              <Bar dataKey="evaluate" name="Evaluate" stackId="bloom" fill={patternFill(bloomTones[4])} />
              <Bar dataKey="create" name="Create" stackId="bloom" fill={patternFill(bloomTones[5])} />
            </BarChart>
          </ResponsiveContainer>
        </Frame>
      )}
      {!compact && attendanceSlices.length > 0 && (
        <Frame
          title="Attendance"
          summary={attendanceSlices.map(row => `${row.name} ${row.value}%`).join(', ')}
          legend={attendanceSlices.map(row => ({ id: row.tone, label: row.name }))}
          table={{ headers: ['Mark', 'Share'], rows: attendanceSlices.map(row => [row.name, `${row.value}%`]) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={attendanceSlices} dataKey="value" nameKey="name" innerRadius={46} outerRadius={72} label={({ name, value }) => `${name} ${value}%`}>
                {attendanceSlices.map(row => <Cell key={row.name} fill={patternFill(row.tone)} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Frame>
      )}
      {!compact && (
        <div className="grid lg:grid-cols-2 gap-4 text-sm">
          <div className="rounded-2xl border border-border p-4">
            <p className="font-semibold">Strengths and weaknesses</p>
            <p className="mt-2">Strengths: {snapshot.strengths.join(', ') || 'Not enough scores yet.'}</p>
            <p className="mt-1 text-muted-foreground">Needs work: {snapshot.weaknesses.join(', ') || 'None standing out.'}</p>
            <p className="mt-2 text-xs text-muted-foreground">Confidence-weighted mastery {snapshot.metrics.confidence_mastery ?? '—'}%. Retention forecast {snapshot.metrics.retention_forecast ?? '—'}%.</p>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className="font-semibold">How the studying looks</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>Average session {snapshot.behaviour.averageSession ?? '—'} min. Consistency {snapshot.metrics.consistency ?? '—'}%.</li>
              <li>Focus timer adherence {snapshot.metrics.focus_adherence ?? '—'}%. Pace versus plan {snapshot.metrics.pace ?? '—'}%.</li>
              <li>Hints {snapshot.metrics.hint_rate ?? '—'}% of questions. AI turns per hour {snapshot.metrics.ai_usage ?? '—'}.</li>
              <li>Attempts per question {snapshot.behaviour.attemptsPerQuestion ?? '—'}. Seconds per question {snapshot.behaviour.secondsPerQuestion ?? '—'}.</li>
              <li>Cramming {snapshot.metrics.cramming ?? '—'}%. Late starts {snapshot.metrics.procrastination ?? '—'}%.</li>
              <li>Drop-off: {snapshot.dropOffs.length ? snapshot.dropOffs.join('; ') : 'No stall in the saved courses.'}</li>
            </ul>
          </div>
          {snapshot.misconceptions.length > 0 && (
            <div className="rounded-2xl border border-border p-4">
              <p className="font-semibold">Misconceptions</p>
              {snapshot.misconceptions.map(item => <p key={item.topic} className="text-muted-foreground mt-1">{item.note}</p>)}
            </div>
          )}
          <div className="rounded-2xl border border-border p-4">
            <p className="font-semibold">Exam readiness</p>
            <p className="text-2xl mt-1">{snapshot.examReadiness.score ?? '—'} <span className="text-base text-muted-foreground">{snapshot.examReadiness.band}</span></p>
            {snapshot.cohort && (
              <p className="text-xs text-muted-foreground mt-2">Around the {snapshot.cohort.percentile}th percentile of {snapshot.cohort.size} anonymised scores. Names are not shown.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ClassCharts({
  rows,
}: {
  rows: { title: string; progress: number; quiz: number | null; students: number }[];
}) {
  const summary = rows.map(row => `${row.title}: ${row.progress}% progress${row.quiz != null ? `, quiz ${row.quiz}%` : ''}, ${row.students} students`).join('. ');
  return (
    <div className="relative space-y-4" data-class-charts>
      <ChartPatternDefs />
      <p className="text-sm">Class averages. Student names are not on these charts.</p>
      <p className="text-xs text-muted-foreground">{summary || 'No class totals yet.'}</p>
      <div className="grid lg:grid-cols-2 gap-4">
        <Frame
          title="Course progress"
          summary={summary || 'No courses.'}
          legend={rows.map((row, index) => ({ id: accentForIndex(index), label: `${row.title} progress` }))}
          table={{ headers: ['Course', 'Progress', 'Students'], rows: rows.map(row => [row.title, String(row.progress), String(row.students)]) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="title" tick={tick} />
              <YAxis tick={tick} />
              <Tooltip />
              <Bar dataKey="progress" name="Progress %">
                {rows.map((row, index) => <Cell key={row.title} fill={patternFill(accentForIndex(index))} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Frame>
        <Frame
          title="Quiz score by course"
          summary={rows.filter(row => row.quiz != null).map(row => `${row.title} ${row.quiz}%`).join(', ') || 'No quiz average yet.'}
          legend={rows.map((row, index) => ({ id: accentForIndex(index + 1), label: `${row.title} quiz` }))}
          table={{ headers: ['Course', 'Quiz'], rows: rows.map(row => [row.title, row.quiz == null ? '—' : String(row.quiz)]) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows.map(row => ({ ...row, quiz: row.quiz ?? 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="title" tick={tick} />
              <YAxis domain={[0, 100]} tick={tick} />
              <Tooltip />
              <Bar dataKey="quiz" name="Quiz %">
                {rows.map((row, index) => <Cell key={row.title} fill={patternFill(accentForIndex(index + 1))} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Frame>
      </div>
    </div>
  );
}
