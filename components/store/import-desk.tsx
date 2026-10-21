'use client';

import { useMemo, useState } from 'react';
import JSZip from 'jszip';
import { ApiError, authedFetch, bearerHeaders } from '@/lib/api-client';
import { can, resolveStaffRole } from '@/lib/admin-console';
import { useAuthSTORE } from '@/hooks/use-auth';
import { STORE_COPY } from '@/lib/store/copy';
import { errorsToCsv, parseManifest, pendingSkus, type ManifestRow, type RowReport } from '@/lib/store/manifest';

const JOB_KEY = 'poket-store-import';

interface SavedJob {
  jobId: string;
  fileName: string;
}

interface ShownRow extends RowReport {
  productId: string;
  saved: '' | 'draft' | 'resumed';
}

async function readZip(file: File): Promise<{ csv: string; files: Map<string, Uint8Array> }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const csv = await zip.file('manifest.csv')?.async('string');
  if (!csv) throw new Error('manifest.csv is missing from the ZIP.');
  const files = new Map<string, Uint8Array>();
  const names = Object.keys(zip.files);
  for (const name of names) {
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;
    files.set(name, await entry.async('uint8array'));
  }
  return { csv, files };
}

function fileBlob(bytes: Uint8Array, type: string, name: string): File {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy], name, { type });
}

function rememberJob(job: SavedJob) {
  sessionStorage.setItem(JOB_KEY, JSON.stringify(job));
}

function rememberedJob(): SavedJob | null {
  try {
    const raw = sessionStorage.getItem(JOB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedJob;
    if (!parsed.jobId || !parsed.fileName) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function ImportDesk() {
  const { profile } = useAuthSTORE();
  const staff = resolveStaffRole(profile);
  const canPublish = staff === 'admin' || staff === 'super_admin';
  const allowed = can(staff, 'content');
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState('');
  const [files, setFiles] = useState<Map<string, Uint8Array>>(new Map());
  const [rows, setRows] = useState<ManifestRow[]>([]);
  const [reports, setReports] = useState<ShownRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [note, setNote] = useState('');
  const [setupResult, setSetupResult] = useState('');

  const blocked = useMemo(() => reports.some(row => !row.ok), [reports]);
  const savedCount = reports.filter(row => row.saved === 'draft' || row.saved === 'resumed').length;

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setNote('');
    setSetupResult('');
    const packed = await readZip(file);
    const parsed = parseManifest(packed.csv);
    setFileName(file.name);
    setCsv(packed.csv);
    setFiles(packed.files);
    setRows(parsed.rows);
    setReports([]);
    if (parsed.headerError) setNote(parsed.headerError);
  };

  const dryRun = async () => {
    setBusy(true);
    setNote('');
    try {
      const data = await authedFetch('/api/store/import', {
        method: 'POST',
        body: JSON.stringify({
          phase: 'dry-run',
          csv,
          files: [...files.entries()].map(([path, bytes]) => ({ path, bytes: bytes.length })),
        }),
      });
      const incoming = Array.isArray(data.reports) ? data.reports as RowReport[] : [];
      setReports(incoming.map(row => ({ ...row, productId: '', saved: '' })));
    } catch (error) {
      setNote(error instanceof Error ? error.message : STORE_COPY.setupNote);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async (resume: boolean) => {
    if (blocked || rows.length === 0) return;
    setBusy(true);
    setNote('');
    try {
      const remembered = rememberedJob();
      let jobId = resume && remembered?.fileName === fileName ? remembered.jobId : '';
      if (!jobId) {
        const started = await authedFetch('/api/store/import', {
          method: 'POST',
          body: JSON.stringify({ phase: 'start' }),
        });
        jobId = typeof started.jobId === 'string' ? started.jobId : '';
      }
      if (!jobId) throw new Error(STORE_COPY.setupNote);
      rememberJob({ jobId, fileName });
      const job = await authedFetch(`/api/store/import?jobId=${encodeURIComponent(jobId)}`);
      const done = new Set(
        (Array.isArray(job.rows) ? job.rows : [])
          .filter((row): row is { sku: string; status: string; productId?: string } => !!row && typeof row === 'object' && (row as { status?: string }).status === 'done' && typeof (row as { sku?: string }).sku === 'string')
          .map(row => row.sku),
      );
      const doneIds = new Map(
        (Array.isArray(job.rows) ? job.rows : [])
          .filter((row): row is { sku: string; productId: string } => !!row && typeof row === 'object' && typeof (row as { sku?: string }).sku === 'string')
          .map(row => [row.sku, typeof row.productId === 'string' ? row.productId : '']),
      );
      const queue = pendingSkus(reports, done);
      let finished = reports.length - queue.length;
      setProgress(`${finished}/${reports.length}`);
      const next = reports.map(row => (
        done.has(row.sku)
          ? { ...row, saved: 'resumed' as const, productId: doneIds.get(row.sku) ?? row.productId }
          : row
      ));
      for (const sku of queue) {
        const source = rows.find(row => row.sku === sku);
        if (!source) continue;
        const form = new FormData();
        form.set('phase', 'row');
        form.set('jobId', jobId);
        form.set('line', String(source.line));
        form.set('sku', source.sku);
        form.set('title', source.title);
        form.set('subject', source.subject);
        form.set('level', source.level);
        form.set('exam_board', source.examBoard);
        form.set('spec_code', source.specCode);
        form.set('type', source.type);
        form.set('price_usd', source.priceUsd === null ? '' : source.priceUsd.toFixed(2));
        form.set('price_myr', source.priceMyr === null ? '' : source.priceMyr.toFixed(2));
        form.set('access', source.access);
        form.set('description', source.description);
        form.set('tags', source.tags.join('|'));
        form.set('paper_pdf', source.paperPdf);
        form.set('markscheme_pdf', source.markschemePdf);
        form.set('thumbnail', source.thumbnail);
        form.set('preview_images', source.previewImages.join('|'));
        form.set('status', 'draft');
        const paper = files.get(source.paperPdf);
        const scheme = source.markschemePdf ? files.get(source.markschemePdf) : undefined;
        const thumb = files.get(source.thumbnail);
        if (paper) form.set('paper', fileBlob(paper, 'application/pdf', 'paper.pdf'));
        if (scheme) form.set('markscheme', fileBlob(scheme, 'application/pdf', 'markscheme.pdf'));
        if (thumb) form.set('thumbnail', fileBlob(thumb, 'image/png', 'thumb.png'));
        source.previewImages.forEach((path, index) => {
          const preview = files.get(path);
          if (preview) form.append('preview', fileBlob(preview, 'image/png', `preview-${index + 1}.png`));
        });
        const headers = await bearerHeaders();
        const response = await fetch('/api/store/import', { method: 'POST', headers, body: form });
        const body = await response.json() as { ok?: boolean; productId?: string; errors?: string[]; resumed?: boolean; error?: string; code?: string };
        const index = next.findIndex(row => row.sku === sku);
        if (!response.ok || body.ok !== true) {
          const message = body.code === 'SETUP_NEEDED' ? STORE_COPY.setupNote : (body.error || (body.errors ?? []).join(' | ') || STORE_COPY.setupNote);
          if (index >= 0) {
            const current = next[index];
            if (current) next[index] = { ...current, errors: [message], ok: false, saved: '' };
          }
          setReports([...next]);
          setNote(message);
          setProgress(`${finished}/${reports.length}`);
          if (body.code === 'SETUP_NEEDED') setSetupResult(STORE_COPY.setupNote);
          return;
        }
        finished += 1;
        if (index >= 0) {
          const current = next[index];
          if (current) {
            next[index] = {
              ...current,
              saved: body.resumed ? 'resumed' : 'draft',
              productId: typeof body.productId === 'string' ? body.productId : '',
              errors: [],
            };
          }
        }
        setReports([...next]);
        setProgress(`${finished}/${reports.length}`);
      }
      setReports([...next]);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : STORE_COPY.setupNote;
      setNote(message);
      if (error instanceof ApiError && error.code === 'SETUP_NEEDED') setSetupResult(STORE_COPY.setupNote);
    } finally {
      setBusy(false);
    }
  };

  const exportErrors = () => {
    const blob = new Blob([errorsToCsv(reports)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'store-import-errors.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const checkDownload = async (sku: string) => {
    setSetupResult('');
    try {
      const data = await authedFetch('/api/store/download', {
        method: 'POST',
        body: JSON.stringify({ sku, file: 'paper' }),
      });
      const url = typeof data.url === 'string' ? data.url : '';
      if (data.ok === true && url.startsWith('https://')) setSetupResult(url);
      else setSetupResult(STORE_COPY.setupNote);
    } catch (error) {
      setSetupResult(error instanceof Error ? error.message : STORE_COPY.setupNote);
    }
  };

  const publish = async (sku: string) => {
    try {
      await authedFetch('/api/store/products', {
        method: 'POST',
        body: JSON.stringify({ action: 'publish', sku }),
      });
      setReports(current => current.map(row => row.sku === sku ? { ...row, warnings: [STORE_COPY.published] } : row));
    } catch (error) {
      setNote(error instanceof Error ? error.message : STORE_COPY.setupNote);
    }
  };

  if (!allowed) return null;

  const resumeReady = rememberedJob()?.fileName === fileName && fileName !== '';

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4" data-store-import="1">
      <div>
        <h1 className="font-heading text-2xl text-foreground">{STORE_COPY.importTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{STORE_COPY.importBody}</p>
      </div>
      <p className="rounded-xl border border-border bg-card p-3 text-sm text-foreground" data-setup-note="1">{STORE_COPY.setupNote}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".zip,application/zip"
          aria-label={STORE_COPY.chooseZip}
          className="max-w-full text-sm"
          onChange={(event) => { void loadFile(event.target.files?.[0]); }}
        />
        <button type="button" className="h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50" data-dry-run="1" disabled={busy || !csv} onClick={() => { void dryRun(); }}>{STORE_COPY.dryRun}</button>
        <button type="button" className="h-10 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50" data-import-drafts="1" disabled={busy || reports.length === 0 || blocked} onClick={() => { void runImport(false); }}>{STORE_COPY.importRows}</button>
        <button type="button" className="h-10 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50" data-resume="1" disabled={busy || !resumeReady || reports.length === 0 || blocked} onClick={() => { void runImport(true); }}>{STORE_COPY.resume}</button>
        <button type="button" className="h-10 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50" data-export-errors="1" disabled={!reports.some(row => row.errors.length > 0)} onClick={exportErrors}>{STORE_COPY.exportErrors}</button>
      </div>
      {progress && <p className="text-sm font-semibold" data-import-progress="1">{STORE_COPY.progress} {progress}</p>}
      {note && <p className="text-sm text-destructive" data-import-note="1">{note}</p>}
      {setupResult && <p className="text-sm text-foreground" data-setup-needed="1">{setupResult}</p>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2">{STORE_COPY.sku}</th>
              <th className="p-2">{STORE_COPY.status}</th>
              <th className="p-2">{STORE_COPY.description}</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(row => (
              <tr key={`${row.line}-${row.sku}`} data-import-row={row.sku} data-product-id={row.productId} data-row-state={row.saved || (row.ok ? 'ready' : 'error')} data-product-status={row.saved === 'draft' || row.saved === 'resumed' ? 'draft' : ''}>
                <td className="p-2 align-top font-semibold">{row.sku || '—'}</td>
                <td className="p-2 align-top">{row.saved === 'resumed' ? STORE_COPY.resume : row.saved === 'draft' ? STORE_COPY.draftSaved : row.action}</td>
                <td className="p-2 align-top">
                  {row.errors.map(error => <p key={error}>{error}</p>)}
                  {row.warnings.map(warning => <p key={warning}>{warning}</p>)}
                  {row.saved && (
                    <span className="mt-2 flex flex-wrap gap-2">
                      <button type="button" className="underline" data-check-download={row.sku} onClick={() => { void checkDownload(row.sku); }}>{STORE_COPY.checkDownload}</button>
                      {canPublish && row.saved === 'draft' && (
                        <button type="button" className="underline" data-publish-product={row.sku} onClick={() => { void publish(row.sku); }}>{STORE_COPY.publish}</button>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {savedCount > 0 && <p className="text-xs text-muted-foreground" data-draft-count={savedCount}>{savedCount}</p>}
    </div>
  );
}
