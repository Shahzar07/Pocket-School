'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { canDownload, type DownloadViewer } from '@/lib/export/allow';
import { formatsFor, type ExportAsset, type ExportFormat } from '@/lib/export/payload';

const LABELS: Record<ExportFormat, string> = {
  pdf: 'PDF',
  docx: 'Word',
  png: 'PNG',
  jpg: 'JPG',
  pptx: 'PowerPoint',
};

export function DownloadMenu({
  asset,
  title,
  content,
  viewer,
  courseId,
  formats,
  answerKeyToggle = false,
}: {
  asset: ExportAsset;
  title: string;
  content: unknown;
  viewer: DownloadViewer;
  courseId: string;
  formats?: ExportFormat[];
  answerKeyToggle?: boolean;
}) {
  const { user } = useAuthSTORE();
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [answerKey, setAnswerKey] = useState(true);
  const decision = canDownload({ ...viewer, courseId });
  if (!decision.allowed) return null;

  const choices = (formats ?? formatsFor(asset)).filter(format => formatsFor(asset).includes(format));

  const save = async (format: ExportFormat) => {
    const token = await user?.getIdToken();
    if (!token) {
      toast.error('Sign in to download this file.');
      return;
    }
    setBusy(format);
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          asset,
          format,
          title,
          content,
          answerKey: answerKeyToggle ? answerKey : true,
          courseId,
          viewer: { ...viewer, courseId },
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : 'Download failed.');
      }
      const blob = await response.blob();
      const header = response.headers.get('Content-Disposition') ?? '';
      const named = header.match(/filename="([^"]+)"/)?.[1] ?? `${title || 'poket-school'}.${format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = named;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
      {choices.map(format => (
        <button
          key={format}
          type="button"
          disabled={busy !== null}
          onClick={() => save(format)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground hover:border-[#2786A4] disabled:opacity-60"
        >
          {busy === format ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {LABELS[format]}
        </button>
      ))}
      {answerKeyToggle && (
        <label className="ml-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <input type="checkbox" checked={answerKey} onChange={event => setAnswerKey(event.target.checked)} />
          Include answer key
        </label>
      )}
    </div>
  );
}
