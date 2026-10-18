'use client';

import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { authedFetch } from '@/lib/api-client';
import {
  CERTIFICATE_SAMPLE,
  builtinDesigns,
  normaliseDesign,
  paletteColours,
  type CertificateBorder,
  type CertificateDesign,
  type CertificatePalette,
  type CertificateSignatory,
} from '@/lib/certificates/design';
import { certificatePdf } from '@/lib/certificates/pdf';

const fieldClass = 'mt-1 min-h-11 w-full rounded-xl border border-[#D5E6EA] bg-white px-3 text-sm text-[#203337]';

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
  const starting = initial?.length ? initial : builtinDesigns();
  const [designs, setDesigns] = useState<CertificateDesign[]>(starting);
  const [currentId, setCurrentId] = useState(starting.find((item) => item.isDefault)?.id ?? starting[0]?.id ?? 'poket-cyan');
  const [note, setNote] = useState(comingSoon ? 'Saving certificate templates needs the Firebase Admin key. This admin tool is coming soon.' : '');
  const [busy, setBusy] = useState(false);
  const current = designs.find((item) => item.id === currentId) ?? designs[0];
  const colours = paletteColours(current?.palette ?? 'cyan');
  const sample = CERTIFICATE_SAMPLE;

  const borderClass = useMemo(() => {
    if (!current || current.border === 'none') return 'border-0';
    if (current.border === 'double') return 'border-[6px] border-double';
    if (current.border === 'corner') return 'border-2';
    return 'border-2';
  }, [current]);

  if (!current) return null;

  const patch = (next: Partial<CertificateDesign>) => {
    setDesigns((rows) => rows.map((row) => (row.id === current.id ? { ...row, ...next } : row)));
  };

  const updateSignatory = (index: number, next: Partial<CertificateSignatory>) => {
    const signatories = current.signatories.map((person, item) => (item === index ? { ...person, ...next } : person));
    patch({ signatories });
  };

  const save = async () => {
    if (preview) {
      setNote('This preview does not write a template.');
      return;
    }
    setBusy(true);
    try {
      const data = await authedFetch('/api/admin/certificates', { method: 'POST', body: JSON.stringify(current) });
      if (data.comingSoon) {
        setNote(typeof data.error === 'string' ? data.error : 'Saving certificate templates needs the Firebase Admin key. This admin tool is coming soon.');
        return;
      }
      const saved = normaliseDesign(data.design as Partial<CertificateDesign>);
      setDesigns((rows) => {
        const rest = rows.filter((row) => row.id !== saved.id).map((row) => (saved.isDefault ? { ...row, isDefault: false } : row));
        return [...rest, saved];
      });
      setCurrentId(saved.id);
      setNote(saved.isDefault ? 'Saved as the default template.' : 'Template saved.');
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not save that template.');
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const bytes = certificatePdf(current, sample);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${current.id}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const addTemplate = () => {
    const id = `template-${designs.length + 1}`;
    const next = normaliseDesign({ ...current, id, name: 'New template', isDefault: false, institutionId: canEditDefault ? '' : institutionId });
    setDesigns((rows) => [...rows, next]);
    setCurrentId(id);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
      <form className="space-y-4 rounded-[24px] border border-[#D5E6EA] bg-white p-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="flex flex-wrap gap-2">
          {designs.map((item) => (
            <button key={item.id} type="button" onClick={() => setCurrentId(item.id)} className={`rounded-full px-3 py-2 text-xs font-semibold ${item.id === current.id ? 'border border-[#1E6A83] bg-[#3FE0D0] text-[#203337]' : 'border border-[#D5E6EA] text-[#1E6A83]'}`}>
              {item.name}{item.isDefault ? ' · default' : ''}{item.institutionId ? ' · school' : ''}
            </button>
          ))}
          <button type="button" onClick={addTemplate} className="rounded-full border border-[#1E6A83] px-3 py-2 text-xs font-semibold text-[#1E6A83]">New template</button>
        </div>
        <label className="block text-sm text-[#203337]">Template name
          <input className={fieldClass} aria-label="Template name" value={current.name} onChange={(event) => patch({ name: event.target.value })} />
        </label>
        <label className="block text-sm text-[#203337]">Title
          <input className={fieldClass} aria-label="Certificate title" value={current.title} onChange={(event) => patch({ title: event.target.value })} />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-[#203337]">Brand palette</legend>
          <div className="flex gap-2">
            {(['blue', 'cyan'] as CertificatePalette[]).map((palette) => (
              <button key={palette} type="button" onClick={() => patch({ palette })} className={`rounded-full px-3 py-2 text-xs font-semibold capitalize ${current.palette === palette ? 'border border-[#1E6A83] bg-[#3FE0D0] text-[#203337]' : 'border border-[#D5E6EA] text-[#1E6A83]'}`}>{palette}</button>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm text-[#203337]">Border
          <select aria-label="Border style" className={fieldClass} value={current.border} onChange={(event) => patch({ border: event.target.value as CertificateBorder })}>
            <option value="none">None</option>
            <option value="line">Line</option>
            <option value="double">Double</option>
            <option value="corner">Corner</option>
          </select>
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ['showRecipient', 'Recipient name'],
            ['showCourse', 'Course or level'],
            ['showDate', 'Date'],
            ['showCertificateId', 'Certificate ID'],
            ['showQr', 'QR verify link'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-[#203337]">
              <input type="checkbox" checked={current[key]} onChange={(event) => patch({ [key]: event.target.checked })} />
              {label}
            </label>
          ))}
        </div>
        <label className="block text-sm text-[#203337]">Institution logo URL
          <input className={fieldClass} aria-label="Institution logo" placeholder="https://" value={current.logoUrl} onChange={(event) => patch({ logoUrl: event.target.value })} />
        </label>
        <label className="block text-sm text-[#203337]">Co-brand name
          <input className={fieldClass} aria-label="Co-brand name" value={current.coBrandName} onChange={(event) => patch({ coBrandName: event.target.value })} />
        </label>
        <label className="block text-sm text-[#203337]">Co-brand logo URL
          <input className={fieldClass} aria-label="Co-brand logo" placeholder="https://" value={current.coBrandLogoUrl} onChange={(event) => patch({ coBrandLogoUrl: event.target.value })} />
        </label>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-[#203337]">Signatories</legend>
          {current.signatories.map((person, index) => (
            <div key={`${person.name}-${index}`} className="grid gap-2 sm:grid-cols-3">
              <input className={fieldClass} aria-label={`Signatory ${index + 1} name`} value={person.name} onChange={(event) => updateSignatory(index, { name: event.target.value })} />
              <input className={fieldClass} aria-label={`Signatory ${index + 1} title`} value={person.title} onChange={(event) => updateSignatory(index, { title: event.target.value })} />
              <input className={fieldClass} aria-label={`Signatory ${index + 1} signature`} placeholder="https://" value={person.imageUrl} onChange={(event) => updateSignatory(index, { imageUrl: event.target.value })} />
            </div>
          ))}
          {current.signatories.length < 3 ? (
            <button type="button" className="text-sm font-semibold text-[#1E6A83]" onClick={() => patch({ signatories: [...current.signatories, { name: '', title: '', imageUrl: '' }] })}>Add signatory</button>
          ) : null}
        </fieldset>
        {canEditDefault ? (
          <label className="flex items-center gap-2 text-sm text-[#203337]">
            <input type="checkbox" checked={current.isDefault} onChange={(event) => patch({ isDefault: event.target.checked, institutionId: '' })} />
            Default template
          </label>
        ) : (
          <p className="text-sm text-[#1E6A83]">This override belongs to your institution. The platform default stays with a super admin.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 py-2 text-sm font-semibold text-[#203337]">{busy ? 'Saving…' : 'Save template'}</button>
          <button type="button" onClick={download} className="rounded-full border border-[#1E6A83] px-4 py-2 text-sm font-semibold text-[#1E6A83]">Download PDF</button>
        </div>
        {note ? <p className="text-sm text-[#203337]">{note}</p> : null}
        <p className="text-xs text-[#1E6A83]">The PDF carries the wording, signatory names, and the verify link. Logos and signature images stay on this preview.</p>
      </form>
      <article aria-label="Certificate preview" className={`rounded-[24px] bg-white p-6 ${borderClass}`} style={{ borderColor: colours.line, background: colours.wash, color: colours.ink }}>
        <div className="flex items-center justify-between gap-3">
          {current.logoUrl ? <img src={current.logoUrl} alt="Institution logo" className="h-12 w-auto" /> : <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: colours.accent }}>Poket School</p>}
          {current.coBrandLogoUrl ? <img src={current.coBrandLogoUrl} alt={current.coBrandName || 'Co-brand'} className="h-12 w-auto" /> : null}
        </div>
        <h2 className="mt-8 text-center font-heading text-3xl">{current.title}</h2>
        {current.showRecipient ? <p className="mt-6 text-center text-2xl">{sample.recipient}</p> : null}
        {current.showCourse ? <p className="mt-2 text-center text-sm">{sample.course}</p> : null}
        {current.showDate ? <p className="mt-2 text-center text-sm">{sample.date}</p> : null}
        {current.showCertificateId ? <p className="mt-2 text-center text-xs">{sample.certificateId}</p> : null}
        {current.coBrandName ? <p className="mt-4 text-center text-sm">With {current.coBrandName}</p> : null}
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          {current.signatories.map((person) => (
            <div key={person.name} className="text-center text-xs">
              {person.imageUrl ? <img src={person.imageUrl} alt={`${person.name} signature`} className="mx-auto h-10" /> : <div className="mx-auto h-10 w-24 border-b" style={{ borderColor: colours.accent }} />}
              <p className="mt-1 font-semibold">{person.name}</p>
              <p>{person.title}</p>
            </div>
          ))}
          {current.showQr ? (
            <div className="text-center">
              <QRCodeSVG value={sample.verifyUrl} size={72} bgColor="#ffffff" fgColor={colours.ink} />
              <p className="mt-1 max-w-[8rem] text-[10px]">{sample.verifyUrl}</p>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}
