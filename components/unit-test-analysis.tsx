'use client';

import { itemAnalysis } from '@/lib/unit-test';
import type { UnitQuizAttempt } from '@/lib/db';

export function UnitTestAnalysis({ attempts }: { attempts: UnitQuizAttempt[] }) {
  const rows = itemAnalysis(attempts.filter((attempt) => attempt.kind === 'unit_test' || attempt.version));
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">No unit test responses yet. Item analysis appears after the first attempt.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="py-2 pr-3">Version</th>
            <th className="py-2 pr-3">Question</th>
            <th className="py-2 pr-3">Bloom</th>
            <th className="py-2 pr-3">Correct</th>
            <th className="py-2 pr-3">Marks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border/70">
              <td className="py-2 pr-3 font-semibold">{row.version}</td>
              <td className="py-2 pr-3">{row.prompt}</td>
              <td className="py-2 pr-3">{row.bloom ?? '—'}</td>
              <td className="py-2 pr-3">{row.correct}/{row.attempts}</td>
              <td className="py-2 pr-3">{row.marksAwarded}/{row.marksMax}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
