'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ReportsHub } from '@/components/insights/reports-hub';
import { seedHub } from '@/lib/insights/hub-seed';
import type { HubFilters, ReportRole } from '@/lib/insights/hub';

function roleFrom(side: string | null): ReportRole {
  if (side === 'parent') return 'parent';
  if (side === 'teacher') return 'teacher';
  if (side === 'institution') return 'institution_admin';
  if (side === 'admin') return 'admin';
  return 'student';
}

function ReportsPreviewBody() {
  const params = useSearchParams();
  const role = roleFrom(params.get('side'));
  const [filters, setFilters] = useState<Partial<HubFilters>>({});
  const [scheduled, setScheduled] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const hub = useMemo(() => seedHub(role, filters), [role, filters]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-4">
      <p className="text-sm rounded-2xl border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan-soft)] px-4 py-3 text-[var(--ps-cyan-text)]">
        Sample data for review. These figures are the seeded report, not a live account. {role}.
      </p>
      <h1 className="font-heading text-3xl">Reports</h1>
      {scheduled && <p data-scheduled>Scheduled {scheduled}</p>}
      {exported && <p data-exported>Exported {exported}</p>}
      {note && <p data-absence-note>Absence note: {note}</p>}
      <ReportsHub
        hub={hub}
        showChecks
        onFilters={setFilters}
        onSchedule={cadence => setScheduled(cadence)}
        onExport={format => setExported(format)}
        onAbsence={(reason, dateKey) => setNote(`${dateKey} ${reason}`)}
      />
    </main>
  );
}

export default function ReportsPreviewPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading reports</main>}>
      <ReportsPreviewBody />
    </Suspense>
  );
}
