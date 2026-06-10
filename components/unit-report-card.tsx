'use client';

import { UnitQuizAttempt } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, AlertTriangle, Clock, RotateCcw, Target, ArrowRight, BookOpen } from 'lucide-react';

export interface UnitReportData {
  courseId: string;
  courseTitle: string;
  unitId: string;
  unitTitle: string;
  masteryThreshold: number;
  /** All attempts for this unit, newest first. */
  attempts: UnitQuizAttempt[];
  /** Lessons recommended for review by the latest attempt. */
  reviewLessons: { id: string; title: string; lessonNumber?: number }[];
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

/**
 * Per-unit mastery report for the parent dashboard: best score vs threshold,
 * time taken, attempt count, weakest objective and recommended next steps.
 */
export function UnitReportCard({ report }: { report: UnitReportData }) {
  const { attempts } = report;
  const latest = attempts[0];
  const best = attempts.reduce((a, b) => (b.percentage > a.percentage ? b : a), attempts[0]);
  const passed = attempts.some(a => a.passed);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className={`px-5 py-3.5 flex items-center justify-between gap-3 border-b ${
        passed ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'
      }`}>
        <div className="min-w-0">
          <p className="font-bold text-foreground text-sm truncate">{report.unitTitle}</p>
          <p className="text-xs text-muted-foreground truncate">{report.courseTitle}</p>
        </div>
        <Badge className={`rounded-full gap-1 shrink-0 ${
          passed
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : 'bg-amber-100 text-amber-700 border-amber-200'
        }`}>
          {passed ? <Trophy className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          {passed ? 'Mastered' : 'In progress'}
        </Badge>
      </div>

      <div className="p-5 space-y-4">
        {/* Best score vs threshold */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Best quiz score</span>
            <span className={`text-2xl font-extrabold ${passed ? 'text-emerald-600' : 'text-amber-600'}`}>
              {best.percentage}%
            </span>
          </div>
          <div className="relative">
            <Progress value={best.percentage} className="h-2" />
            <div
              className="absolute top-[-3px] h-3.5 w-0.5 bg-foreground/50 rounded"
              style={{ left: `${report.masteryThreshold}%` }}
              title={`Pass mark: ${report.masteryThreshold}%`}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Pass mark: {report.masteryThreshold}%</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/40 rounded-xl p-2.5">
            <Clock className="w-3.5 h-3.5 mx-auto mb-1 text-blue-500" />
            <p className="text-sm font-bold text-foreground">{formatTime(latest.timeTakenSeconds)}</p>
            <p className="text-[10px] text-muted-foreground">Last attempt</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-2.5">
            <RotateCcw className="w-3.5 h-3.5 mx-auto mb-1 text-violet-500" />
            <p className="text-sm font-bold text-foreground">{attempts.length}</p>
            <p className="text-[10px] text-muted-foreground">Attempt{attempts.length === 1 ? '' : 's'}</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-2.5">
            <Target className="w-3.5 h-3.5 mx-auto mb-1 text-red-500" />
            <p className="text-sm font-bold text-foreground font-mono">{latest.weakestObjective ?? '—'}</p>
            <p className="text-[10px] text-muted-foreground">Weakest objective</p>
          </div>
        </div>

        {/* Recommended next steps */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5">
          <p className="text-xs font-bold text-blue-900 mb-1.5">Recommended next steps</p>
          {passed ? (
            <p className="text-xs text-blue-800 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              Unit mastered — ready to start the next unit.
            </p>
          ) : report.reviewLessons.length > 0 ? (
            <ul className="space-y-1">
              {report.reviewLessons.map(l => (
                <li key={l.id} className="text-xs text-blue-800 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  Revisit {l.lessonNumber ? `L${l.lessonNumber}: ` : ''}{l.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-blue-800">Retake the mastery quiz to reach {report.masteryThreshold}%.</p>
          )}
        </div>
      </div>
    </div>
  );
}
