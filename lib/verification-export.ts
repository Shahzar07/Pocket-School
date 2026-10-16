export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface VerificationRow {
  id?: string;
  parentId: string;
  parentName: string;
  parentEmail: string;
  studentEmail: string;
  studentId: string;
  status: VerificationStatus;
  createdAt?: { toDate?: () => Date } | Date | string | number | null;
}

export function verificationWhen(row: VerificationRow): string {
  const value = row.createdAt;
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return '';
}

export function filterVerifications<T extends VerificationRow>(
  rows: T[],
  query: string,
  status: VerificationStatus | 'all',
): T[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (status !== 'all' && row.status !== status) return false;
    if (!needle) return true;
    const haystack = [row.parentName, row.parentEmail, row.studentEmail, row.studentId, row.parentId, row.id]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

function cell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function verificationsToCsv(rows: VerificationRow[]): string {
  const header = ['id', 'status', 'parentName', 'parentEmail', 'parentId', 'studentEmail', 'studentId', 'submittedAt'];
  const lines = rows.map((row) => [
    row.id ?? '',
    row.status,
    row.parentName,
    row.parentEmail,
    row.parentId,
    row.studentEmail,
    row.studentId,
    verificationWhen(row),
  ].map(cell).join(','));
  return [header.join(','), ...lines].join('\n');
}
