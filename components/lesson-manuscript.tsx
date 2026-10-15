'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ImportPanel,
  VersionHistory,
  pushRevision,
  readAutosave,
  useAutosave,
} from '@/components/editor';

import type { ContentRevision, ImportResult } from '@/components/editor';
import { manuscriptToMarkdown } from '@/lib/lesson-body';

const ContentEditor = dynamic(
  () => import('@/components/editor/content-editor').then(mod => mod.ContentEditor),
  { ssr: false, loading: () => <div className="ps-skeleton h-40 rounded-2xl" aria-hidden="true" /> },
);

/**
 * The course authoring surface over the shared editor.
 * Autosave and version history stay on this device. Import and a multi-heading
 * paste are handed to the host, which decides whether they stay one lesson.
 */
export function LessonManuscript({
  value,
  onChange,
  storageKey,
  placeholder,
  onImport,
  onPasteImages,
}: {
  value: string;
  onChange: (markdown: string) => void;
  storageKey: string;
  placeholder?: string;
  onImport?: (result: ImportResult) => void;
  onPasteImages?: (files: File[]) => void;
}) {
  const savedAt = useAutosave(storageKey, value);
  const [revisions, setRevisions] = useState<ContentRevision<string>[]>([]);
  const [deviceDraft, setDeviceDraft] = useState<string | null>(null);

  useEffect(() => {
    const saved = readAutosave<string>(storageKey);
    setDeviceDraft(saved && saved !== value ? saved : null);
    setRevisions([]);
    // Offer a device draft only when this lesson is opened, not on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!savedAt) return;
    setRevisions(list => pushRevision(list, value, 'Autosave'));
  }, [savedAt, value]);

  const apply = (result: ImportResult) => {
    if (onImport) onImport(result);
    else onChange(manuscriptToMarkdown(result.blocks));
  };

  return (
    <div className="space-y-3">
      {deviceDraft !== null && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <p>An unsaved copy of this lesson is on this device.</p>
          <span className="flex gap-2">
            <button type="button" className="h-8 rounded-full bg-[#203337] px-3 font-bold text-white" onClick={() => { onChange(deviceDraft); setDeviceDraft(null); }}>Restore it</button>
            <button type="button" className="h-8 rounded-full border border-amber-300 px-3 font-semibold" onClick={() => setDeviceDraft(null)}>Keep the saved lesson</button>
          </span>
        </div>
      )}
      <ContentEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onManuscript={apply}
        onPasteImages={onPasteImages}
      />
      {savedAt && (
        <p className="text-[11px] text-muted-foreground">Draft kept on this device · {new Date(savedAt).toLocaleTimeString()}</p>
      )}
      <details className="rounded-xl border border-border px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Import a document</summary>
        <div className="pt-3">
          <ImportPanel onApply={apply} />
        </div>
      </details>
      <details className="rounded-xl border border-border px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Version history</summary>
        <div className="pt-3">
          <VersionHistory revisions={revisions} onRestore={revision => onChange(revision.value)} />
        </div>
      </details>
    </div>
  );
}
