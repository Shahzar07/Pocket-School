export function filterTutors<T extends { name: string; bio?: string; subjects: string[] }>(rows: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => [row.name, row.bio, ...row.subjects].filter(Boolean).join(' ').toLowerCase().includes(needle));
}

export function filterResources<T extends { title: string; kind: string; status?: string }>(
  rows: T[],
  query: string,
  kind: string,
): T[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    const kindOk = kind === 'all' || row.kind === kind;
    const textOk = !needle || `${row.title} ${row.kind} ${row.status ?? ''}`.toLowerCase().includes(needle);
    return kindOk && textOk;
  });
}
