'use client';

import { useMemo, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { loadCertificateAssets, loadCertificateFonts } from '@/lib/certificates/assets';
import {
  CERTIFICATE_PAGE_LABELS,
  CERTIFICATE_PAGE_POINTS,
  CERTIFICATE_PAGE_SIZES,
  CERTIFICATE_SAMPLE,
  builtinDesigns,
  designFieldErrors,
  imageFieldError,
  isBuiltinTemplate,
  normaliseDesign,
  paletteColours,
  uniqueDesigns,
  type CertificateBorder,
  type CertificateDesign,
  type CertificatePageSize,
  type CertificatePalette,
  type CertificateSignatory,
} from '@/lib/certificates/design';
import { certificatePdf } from '@/lib/certificates/pdf';
import { decorateSample } from '@/lib/certificates/sample-placeholders';
import { CertificateSheet } from '@/components/certificates/sheet';

const fieldClass = 'mt-1 min-h-11 w-full rounded-xl border border-[#D5E6EA] bg-white px-3 text-sm text-[#203337] dark:border-white/20 dark:bg-[#0B1417] dark:text-[#E8F4F6]';
const cardClass = 'space-y-4 rounded-[24px] border border-[#D5E6EA] bg-white p-4 text-[#203337] dark:border-white/15 dark:bg-[#1A1918] dark:text-[#E8F4F6]';

const IMAGE_LIMIT = 80_000;

function nextTemplateId(rows: { id: string }[]): string {
  const taken = new Set(rows.map((row) => row.id));
  let n = rows.length + 1;
  let id = `template-${n}`;
  while (taken.has(id)) {
    n += 1;
    id = `template-${n}`;
  }
  return id;
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      reject(new Error('Upload a PNG or JPG.'));
      return;
    }
    if (file.size > IMAGE_LIMIT) {
      reject(new Error('Use an image under 80 KB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}

function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const uploaded = value.startsWith('data:image/');
  const error = imageFieldError(value);
  const [fileError, setFileError] = useState('');
  return (
    <div className="block text-sm">
      <label className="block">
        {label}
        <input
          className={fieldClass}
          aria-label={label}
          placeholder={uploaded ? 'Image uploaded' : 'https://'}
          value={uploaded ? '' : value}
          onChange={(event) => {
            setFileError('');
            onChange(event.target.value);
          }}
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-[#1E6A83] px-3 text-xs font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">
          Upload image
          <input
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg"
            aria-label={`${label} file`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              readImageFile(file).then((url) => {
                setFileError('');
                onChange(url);
              }).catch((reason: unknown) => {
                setFileError(reason instanceof Error ? reason.message : 'Could not read that image.');
              });
            }}
          />
        </label>
        {uploaded ? (
          <button type="button" className="min-h-11 text-xs font-semibold text-[#1E6A83] dark:text-[#3FE0D0]" onClick={() => onChange('')}>
            Remove upload
          </button>
        ) : null}
      </div>
      {uploaded ? <img src={value} alt="" className="mt-2 h-12 w-auto max-w-full object-contain" /> : null}
      {error || fileError ? <p role="alert" className="mt-1 text-xs text-[#9B1C1C]">{error || fileError}</p> : null}
    </div>
  );
}

export function CertificateDesigner({
  initial,
  canEditDefault = true,
  institutionId = '',
  comingSoon = false,
  preview = false,
}: {
  initial?: CertificateDesign[];
  canEditDefault?: boolean;
  institutionId?: string;
  comingSoon?: boolean;
  preview?: boolean;
}) {
  const starting = useMemo(
    () => uniqueDesigns((initial?.length ? initial : builtinDesigns()).map((item) => normaliseDesign(item))),
    [initial],
  );
  const [designs, setDesigns] = useState<CertificateDesign[]>(starting);
  const [currentId, setCurrentId] = useState(starting.find((item) => item.isDefault)?.id ?? starting[0]?.id ?? 'poket-cyan');
  const [note, setNote] = useState(comingSoon ? 'Saving certificate templates needs the Firebase Admin key. This admin tool is coming soon.' : '');
  const [phase, setPhase] = useState<'idle' | 'unsaved' | 'saved' | 'error'>(comingSoon ? 'error' : 'idle');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const current = designs.find((item) => item.id === currentId) ?? designs[0];
  const previewDesign = current ? decorateSample(current) : null;
  const colours = paletteColours(current?.palette ?? 'cyan');
  const sample = CERTIFICATE_SAMPLE;
  const errors = current ? designFieldErrors(current) : [];

  if (!current) return null;

  const markDirty = () => {
    setPhase('unsaved');
    setNote('Unsaved changes.');
  };

  const patch = (next: Partial<CertificateDesign>) => {
    setDesigns((rows) => rows.map((row) => (row.id === current.id ? { ...row, ...next } : row)));
    markDirty();
  };

  const updateSignatory = (index: number, next: Partial<CertificateSignatory>) => {
    const signatories = current.signatories.map((person, item) => (item === index ? { ...person, ...next } : person));
    patch({ signatories });
  };

  const save = async () => {
    if (errors.length) {
      setPhase('error');
      setNote(errors[0] ?? 'Check the template fields.');
      return;
    }
    if (preview) {
      setPhase('idle');
      setNote('This preview does not write a template.');
      return;
    }
    setBusy(true);
    try {
      const data = await authedFetch('/api/admin/certificates', { method: 'POST', body: JSON.stringify(current) });
      if (data.comingSoon) {
        setPhase('error');
        setNote(typeof data.error === 'string' ? data.error : 'Saving certificate templates needs the Firebase Admin key. This admin tool is coming soon.');
        return;
      }
      const saved = normaliseDesign(data.design as Partial<CertificateDesign>);
      setDesigns((rows) => {
        const rest = rows.filter((row) => row.id !== saved.id).map((row) => (saved.isDefault ? { ...row, isDefault: false } : row));
        return uniqueDesigns([...rest, saved]);
      });
      setCurrentId(saved.id);
      setPhase('saved');
      setNote(saved.isDefault ? `Saved. ${saved.name} is the default template.` : `Saved. ${saved.name} is stored.`);
    } catch (error) {
      setPhase('error');
      setNote(error instanceof Error ? error.message : 'Could not save that template.');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (errors.length) {
      setPhase('error');
      setNote(errors[0] ?? 'Check the template fields.');
      return;
    }
    setBusy(true);
    try {
      const [fonts, assets] = await Promise.all([
        loadCertificateFonts(),
        loadCertificateAssets(previewDesign ?? current),
      ]);
      const bytes = await certificatePdf(current, sample, { ...fonts, assets, labelledSample: true });
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const blob = new Blob([copy], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${current.id}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setPhase('error');
      setNote(error instanceof Error ? error.message : 'Could not build that PDF.');
    } finally {
      setBusy(false);
    }
  };

  const addTemplate = () => {
    const id = nextTemplateId(designs);
    const next = normaliseDesign({
      ...current,
      id,
      name: `Template ${designs.length + 1}`,
      isDefault: false,
      institutionId: canEditDefault ? '' : institutionId,
      signatories: current.signatories.map((person) => ({ ...person })),
    });
    setDesigns((rows) => uniqueDesigns([...rows, next]));
    setCurrentId(id);
    setConfirmDelete(false);
    markDirty();
  };

  const duplicate = () => {
    const id = nextTemplateId(designs);
    const next = normaliseDesign({
      ...current,
      id,
      name: `Copy of ${current.name}`.slice(0, 80),
      isDefault: false,
      institutionId: canEditDefault ? '' : institutionId,
      signatories: current.signatories.map((person) => ({ ...person })),
    });
    setDesigns((rows) => uniqueDesigns([...rows, next]));
    setCurrentId(id);
    setConfirmDelete(false);
    markDirty();
  };

  const remove = async () => {
    if (designs.length < 2 || isBuiltinTemplate(current.id)) return;
    if (!preview) {
      setBusy(true);
      try {
        const data = await authedFetch(`/api/admin/certificates?id=${encodeURIComponent(current.id)}`, { method: 'DELETE' });
        if (data.comingSoon) {
          setPhase('error');
          setNote(typeof data.error === 'string' ? data.error : 'Deleting a template needs the Firebase Admin key.');
          return;
        }
      } catch (error) {
        setPhase('error');
        setNote(error instanceof Error ? error.message : 'Could not delete that template.');
        return;
      } finally {
        setBusy(false);
      }
    }
    const rest = designs.filter((row) => row.id !== current.id);
    setDesigns(rest);
    setCurrentId(rest[0]?.id ?? '');
    setConfirmDelete(false);
    setPhase('saved');
    setNote(`Deleted ${current.name}.`);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,440px)]" data-certificate-designer="1">
      <form
        data-certificate-form="1"
        className={cardClass}
        onSubmit={(event) => { event.preventDefault(); void save(); }}
      >
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Certificate templates">
          {designs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === current.id}
              onClick={() => { setCurrentId(item.id); setConfirmDelete(false); }}
              className={`min-h-11 rounded-full px-3 py-2 text-xs font-semibold ${item.id === current.id ? 'border border-[#1E6A83] bg-[#3FE0D0] text-[#203337]' : 'border border-[#D5E6EA] text-[#1E6A83] dark:border-white/20 dark:text-[#3FE0D0]'}`}
            >
              {item.name}{item.isDefault ? ' · default' : ''}{item.institutionId ? ' · school' : ''}
            </button>
          ))}
          <button type="button" onClick={addTemplate} className="min-h-11 rounded-full border border-[#1E6A83] px-3 py-2 text-xs font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">Add template</button>
        </div>
        <label className="block text-sm">Template name
          <input className={fieldClass} aria-label="Template name" value={current.name} onChange={(event) => patch({ name: event.target.value })} />
        </label>
        <p className="text-xs text-[#1E6A83] dark:text-[#3FE0D0]">Renaming updates the tab. Duplicate keeps the original.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={duplicate} className="min-h-11 rounded-full border border-[#1E6A83] px-3 text-xs font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">Duplicate</button>
          {isBuiltinTemplate(current.id) ? (
            <p className="self-center text-xs text-[#1E6A83] dark:text-[#3FE0D0]">Poket cyan and Poket blue stay on the page. Duplicate one to make your own.</p>
          ) : confirmDelete ? (
            <div role="alertdialog" aria-label="Delete template" className="flex flex-wrap items-center gap-2">
              <p className="text-sm">Delete {current.name}?</p>
              <button type="button" onClick={() => void remove()} className="min-h-11 rounded-full border border-[#9B1C1C] px-3 text-xs font-semibold text-[#9B1C1C]">Delete</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-11 rounded-full border border-[#1E6A83] px-3 text-xs font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={designs.length < 2} className="min-h-11 rounded-full border border-[#9B1C1C] px-3 text-xs font-semibold text-[#9B1C1C] disabled:opacity-40">Delete</button>
          )}
        </div>
        <label className="block text-sm">Title
          <input className={fieldClass} aria-label="Certificate title" value={current.title} onChange={(event) => patch({ title: event.target.value })} />
        </label>
        <label className="block text-sm">Page
          <select aria-label="Page size" className={fieldClass} value={current.pageSize} onChange={(event) => patch({ pageSize: event.target.value as CertificatePageSize })}>
            {CERTIFICATE_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{CERTIFICATE_PAGE_LABELS[size]}</option>
            ))}
          </select>
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Brand palette</legend>
          <div className="flex gap-2">
            {(['blue', 'cyan'] as CertificatePalette[]).map((palette) => (
              <button key={palette} type="button" onClick={() => patch({ palette })} className={`min-h-11 rounded-full px-3 py-2 text-xs font-semibold capitalize ${current.palette === palette ? 'border border-[#1E6A83] bg-[#3FE0D0] text-[#203337]' : 'border border-[#D5E6EA] text-[#1E6A83] dark:border-white/20 dark:text-[#3FE0D0]'}`}>{palette}</button>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">Border
          <select aria-label="Border style" className={fieldClass} value={current.border} onChange={(event) => patch({ border: event.target.value as CertificateBorder })}>
            <option value="none">None</option>
            <option value="line">Line</option>
            <option value="double">Double</option>
            <option value="corner">Corner</option>
          </select>
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([
            ['showRecipient', 'Recipient name'],
            ['showCourse', 'Course or level'],
            ['showDate', 'Date'],
            ['showCertificateId', 'Certificate ID'],
            ['showQr', 'QR verify link'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm leading-5">
              <input type="checkbox" checked={current[key]} onChange={(event) => patch({ [key]: event.target.checked })} />
              {label}
            </label>
          ))}
        </div>
        <ImageField label="Institution logo URL" value={current.logoUrl} onChange={(logoUrl) => patch({ logoUrl })} />
        <label className="block text-sm">Co-brand name
          <input className={fieldClass} aria-label="Co-brand name" value={current.coBrandName} onChange={(event) => patch({ coBrandName: event.target.value })} />
        </label>
        <ImageField label="Co-brand logo URL" value={current.coBrandLogoUrl} onChange={(coBrandLogoUrl) => patch({ coBrandLogoUrl })} />
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Signatories</legend>
          {current.signatories.map((person, index) => (
            <div key={`signatory-${index}`} className="grid gap-2 sm:grid-cols-2">
              <input className={fieldClass} aria-label={`Signatory ${index + 1} name`} placeholder="Name" value={person.name} onChange={(event) => updateSignatory(index, { name: event.target.value })} />
              <input className={fieldClass} aria-label={`Signatory ${index + 1} title`} placeholder="Title" value={person.title} onChange={(event) => updateSignatory(index, { title: event.target.value })} />
              <div className="sm:col-span-2">
                <ImageField label={`Signatory ${index + 1} signature`} value={person.imageUrl} onChange={(imageUrl) => updateSignatory(index, { imageUrl })} />
              </div>
            </div>
          ))}
          {current.signatories.length < 3 ? (
            <button type="button" className="min-h-11 text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]" onClick={() => patch({ signatories: [...current.signatories, { name: '', title: '', imageUrl: '' }] })}>Add signatory</button>
          ) : null}
        </fieldset>
        {canEditDefault ? (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={current.isDefault}
              onChange={(event) => {
                const isDefault = event.target.checked;
                setDesigns((rows) => rows.map((row) => {
                  if (row.id === current.id) return { ...row, isDefault, institutionId: isDefault ? '' : row.institutionId };
                  return isDefault ? { ...row, isDefault: false } : row;
                }));
                markDirty();
              }}
            />
            Default template
          </label>
        ) : (
          <p className="text-sm text-[#1E6A83] dark:text-[#3FE0D0]">This override belongs to your institution. The platform default stays with a super admin.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="min-h-11 rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 py-2 text-sm font-semibold text-[#203337]">{busy ? 'Saving…' : 'Save template'}</button>
          <button type="button" onClick={() => void download()} disabled={busy} className="min-h-11 rounded-full border border-[#1E6A83] px-4 py-2 text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">Download PDF</button>
        </div>
        <p role="status" aria-live="polite" data-certificate-status={phase} className="text-sm">{note}</p>
        <p className="text-xs text-[#1E6A83] dark:text-[#3FE0D0]">The PDF is this sheet: border, palette, logos, signatures, QR, and the copyright line.</p>
      </form>
      <div className="w-full self-start lg:sticky lg:top-4" data-certificate-preview="1" style={{ color: colours.ink }}>
        <p className="mb-2 text-center text-xs text-[#1E6A83] dark:text-[#3FE0D0]" data-certificate-sample="1">Template sample. North Academy, Harbour and the drawn signature stay on this preview. A student certificate leaves them off.</p>
        <div className="mx-auto w-full" style={{ width: `min(100%, calc(70vh * ${CERTIFICATE_PAGE_POINTS[current.pageSize].width} / ${CERTIFICATE_PAGE_POINTS[current.pageSize].height}))` }}>
          <CertificateSheet design={previewDesign ?? current} sample={sample} />
        </div>
      </div>
    </div>
  );
}
