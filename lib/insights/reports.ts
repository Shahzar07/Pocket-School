import { copyrightLine } from './copyright';
import { metricById } from './metrics';

export interface DrillRecord {
  id: string;
  when: string;
  label: string;
  value: string;
  href?: string;
}

export interface Kpi {
  metricId: string;
  value: number | null;
  records: DrillRecord[];
}

export function delta(current: number | null, previous: number | null): {
  diff: number | null;
  direction: 'up' | 'down' | 'flat' | 'na';
} {
  if (current == null || previous == null) return { diff: null, direction: 'na' };
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return { diff, direction: 'flat' };
  return { diff, direction: diff > 0 ? 'up' : 'down' };
}

function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: (string | number)[][], year: number): string {
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map(row => row.map(csvCell).join(',')),
    csvCell(copyrightLine(year)),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function kpiTable(kpis: Kpi[], year: number): { headers: string[]; rows: (string | number)[][] } {
  const headers = ['Metric', 'Value', 'How it is counted', 'Record', 'When', 'Detail'];
  const rows: (string | number)[][] = [];
  for (const kpi of kpis) {
    const def = metricById(kpi.metricId);
    if (!kpi.records.length) {
      rows.push([def?.label ?? kpi.metricId, kpi.value ?? '', def?.formula ?? '', '', '', '']);
      continue;
    }
    kpi.records.forEach((record, index) => {
      rows.push([
        index === 0 ? (def?.label ?? kpi.metricId) : '',
        index === 0 ? (kpi.value ?? '') : '',
        index === 0 ? (def?.formula ?? '') : '',
        record.label,
        record.when,
        record.value,
      ]);
    });
  }
  rows.push([copyrightLine(year), '', '', '', '', '']);
  return { headers, rows };
}

export interface ReportSchedule {
  id?: string;
  ownerId: string;
  role: 'teacher' | 'parent' | 'admin' | 'institution_admin';
  cadence: 'daily' | 'weekly' | 'term';
  metricIds: string[];
  scopeId: string;
  scopeLabel: string;
  nextRun: string;
}

export function nextScheduleDate(cadence: 'daily' | 'weekly' | 'term', from: string): string {
  const [y, m, d] = from.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  if (cadence === 'daily') date.setDate(date.getDate() + 1);
  else if (cadence === 'weekly') date.setDate(date.getDate() + 7);
  else date.setMonth(date.getMonth() + 3);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
