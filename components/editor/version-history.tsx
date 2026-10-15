'use client';

import type { ContentRevision } from './types';

export function VersionHistory<T>({
  revisions,
  onRestore,
}: {
  revisions: ContentRevision<T>[];
  onRestore: (revision: ContentRevision<T>) => void;
}) {
  if (revisions.length === 0) {
    return <p className="text-sm text-muted-foreground">Edits are kept on this device as you go. Nothing is listed until the first autosave.</p>;
  }
  return (
    <ol className="space-y-2">
      {revisions.map(revision => (
        <li key={revision.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm">
          <span>
            <span className="font-semibold">{revision.label}</span>
            <span className="ml-2 text-muted-foreground">{new Date(revision.at).toLocaleString()}</span>
          </span>
          <button type="button" className="h-8 rounded-full border border-border px-3 text-xs font-semibold" onClick={() => onRestore(revision)}>Restore</button>
        </li>
      ))}
    </ol>
  );
}
