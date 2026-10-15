'use client';

import { useState, type ReactNode } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { BLOOM_LABELS, weeklyStudySeries, type BloomLevel } from '@/lib/insights/analytics';
import type { AnalyticsSnapshot } from '@/lib/insights/aggregate';
import { Heatmap } from '@/components/insights/boards';
import { Button } from '@/components/ui/button';

const TEAL = '#2786A4';
const AMBER = '#d97706';
const INK = '#0f172a';

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

function Frame({ title, summary, children, table }: {
  title: string;
  summary: string;
  children: ReactNode;
  table: { headers: string[]; rows: string[][] };
}) {
  return (
    <figure className="rounded-2xl border border-border p-4" aria-label={title}>
      <figcaption className="text-sm font-semibold mb-1">{title}</figcaption>
      <p className="text-xs text-muted-foreground mb-3">{summary}</p>
      <div className="h-56">{children}</div>
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

  return (
    <div className="space-y-4" data-learning-charts>
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
          table={{ headers: ['When', 'Minutes'], rows: study.map(row => [row.label, String(row.minutes)]) }}
        >
          <div className="flex justify-end mb-1">
            <button type="button" className="text-[11px] font-semibold text-primary" onClick={() => setWeek(value => !value)}>
              {week ? 'Show days' : 'Show weeks'}
            </button>
          </div>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={study}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickFormatter={value => String(value).slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="minutes" name="Minutes" stroke={TEAL} strokeWidth={2} dot={false} />
            </LineChart>
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
            table={{
              headers: ['Course', 'Progress'],
              rows: (snapshot.courseProgress.length ? snapshot.courseProgress : [{ label: 'Lessons in goals', progress: snapshot.lessonsCompleted }])
                .map(row => [row.label, String(row.progress)]),
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snapshot.courseProgress.length ? snapshot.courseProgress : [{ label: 'Lessons', progress: snapshot.lessonsCompleted }]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="progress" name="Progress" fill={TEAL} />
              </BarChart>
            </ResponsiveContainer>
          </Frame>
        )}
        <Frame
          title="Quiz scores"
          summary={snapshot.quizTrend.map(row => `${row.label.slice(5)} ${row.average}%`).join(', ') || 'No quizzes in this range.'}
          table={{ headers: ['Day', 'Average'], rows: snapshot.quizTrend.map(row => [row.label, String(row.average)]) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={snapshot.quizTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickFormatter={value => String(value).slice(5)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="average" name="Score %" stroke={AMBER} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Frame>
        <Frame
          title="Topic mastery"
          summary={topics.map(row => `${row.topic} ${row.score}% (confidence ${row.confidence}%)`).join(', ') || 'No topic scores yet.'}
          table={{ headers: ['Topic', 'Score', 'Confidence'], rows: topics.map(row => [row.topic, String(row.score), String(row.confidence)]) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={topics.length ? topics : [{ topic: '—', score: 0, confidence: 0 }]}>
              <PolarGrid />
              <PolarAngleAxis dataKey="topic" tick={{ fontSize: 10 }} />
              <Radar dataKey="score" name="Score" stroke={TEAL} fill={TEAL} fillOpacity={0.35} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </Frame>
        <Frame
          title="Goals met and missed"
          summary={`${snapshot.goalsMet} met, ${snapshot.goalsMissed} missed. Streak ${snapshot.metrics.streak ?? 0} days.`}
          table={{ headers: ['Result', 'Count'], rows: [['Met', String(snapshot.goalsMet)], ['Missed', String(snapshot.goalsMissed)]] }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[{ name: 'Goals', met: snapshot.goalsMet, missed: snapshot.goalsMissed }]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="met" name="Met" fill={TEAL} />
              <Bar dataKey="missed" name="Missed" fill={AMBER} />
            </BarChart>
          </ResponsiveContainer>
        </Frame>
        {!compact && (
          <Frame
            title="Sparks earned and spent"
            summary={`${snapshot.metrics.sparks_earned ?? 0} earned, ${snapshot.sparksSpent} spent.`}
            table={{ headers: ['Kind', 'Sparks'], rows: [['Earned', String(snapshot.metrics.sparks_earned ?? 0)], ['Spent', String(snapshot.sparksSpent)]] }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ name: 'Sparks', earned: snapshot.metrics.sparks_earned ?? 0, spent: snapshot.sparksSpent }]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="earned" name="Earned" fill={TEAL} />
                <Bar dataKey="spent" name="Spent" fill={INK} />
              </BarChart>
            </ResponsiveContainer>
          </Frame>
        )}
        <Frame
          title="Bloom’s taxonomy"
          summary={bloom.map(row => `${row.level} ${row.score}`).join(', ')}
          table={{ headers: ['Level', 'Score'], rows: bloom.map(row => [row.level, String(row.score)]) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bloom} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="level" tick={{ fontSize: 10 }} width={80} />
              <Tooltip />
              <Bar dataKey="score" name="Mastery" fill={TEAL} />
            </BarChart>
          </ResponsiveContainer>
        </Frame>
      </div>
      {!compact && snapshot.bloomTopics.length > 0 && (
        <Frame
          title="Bloom by topic"
          summary={snapshot.bloomTopics.map(row => row.topic).join(', ')}
          table={{
            headers: ['Topic', 'Remember', 'Understand', 'Apply', 'Analyse', 'Evaluate', 'Create'],
            rows: snapshot.bloomTopics.map(row => [row.topic, String(row.remember), String(row.understand), String(row.apply), String(row.analyse), String(row.evaluate), String(row.create)]),
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={snapshot.bloomTopics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="topic" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="remember" stackId="bloom" fill="#94a3b8" />
              <Bar dataKey="understand" stackId="bloom" fill="#67e8f9" />
              <Bar dataKey="apply" stackId="bloom" fill={TEAL} />
              <Bar dataKey="analyse" stackId="bloom" fill="#6366f1" />
              <Bar dataKey="evaluate" stackId="bloom" fill={AMBER} />
              <Bar dataKey="create" stackId="bloom" fill={INK} />
            </BarChart>
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
    <div className="space-y-4" data-class-charts>
      <p className="text-sm">Class averages. Student names are not on these charts.</p>
      <p className="text-xs text-muted-foreground">{summary || 'No class totals yet.'}</p>
      <div className="grid lg:grid-cols-2 gap-4">
        <Frame
          title="Course progress"
          summary={summary || 'No courses.'}
          table={{ headers: ['Course', 'Progress', 'Students'], rows: rows.map(row => [row.title, String(row.progress), String(row.students)]) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="title" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="progress" name="Progress %" fill={TEAL} />
            </BarChart>
          </ResponsiveContainer>
        </Frame>
        <Frame
          title="Quiz score by course"
          summary={rows.filter(row => row.quiz != null).map(row => `${row.title} ${row.quiz}%`).join(', ') || 'No quiz average yet.'}
          table={{ headers: ['Course', 'Quiz'], rows: rows.map(row => [row.title, row.quiz == null ? '—' : String(row.quiz)]) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows.map(row => ({ ...row, quiz: row.quiz ?? 0 }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="title" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="quiz" name="Quiz %" fill={AMBER} />
            </BarChart>
          </ResponsiveContainer>
        </Frame>
      </div>
    </div>
  );
}
