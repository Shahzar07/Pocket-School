'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { publicName } from '@/lib/alumni';
import {
  CLASSIC_TEMPLATES,
  COLOURFUL_TEMPLATES,
  applyCvFields,
  composeCv,
  cvNeedsTranslation,
  defaultCvDesign,
  moveSection,
  readCvDesign,
  type ComposedCv,
  type CvDesign,
  type SavedCvVersion,
} from '@/lib/cv-builder';
import { BRAND } from '@/lib/brand-theme';
import { LANGUAGES } from '@/lib/languages';
import { sourceLabel, type RecordItem } from '@/lib/portfolio';

function download(filename: string, bytes: Uint8Array, type: string) {
  const copy = new Uint8Array(bytes);
  const url = URL.createObjectURL(new Blob([copy], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function bytesFromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function CvDocument({ doc }: { doc: ComposedCv }) {
  const { theme } = doc;
  const fontFamily = theme.font === 'serif'
    ? 'Georgia, "Times New Roman", serif'
    : theme.font === 'mono'
      ? 'ui-monospace, "Courier New", monospace'
      : 'ui-sans-serif, system-ui, sans-serif';
  return (
    <article
      className={`overflow-hidden rounded-[28px] border border-line bg-white text-ink ${theme.compact ? 'text-xs' : 'text-sm'}`}
      style={{ fontFamily }}
    >
      <header
        className="flex items-center justify-between gap-4 px-6 py-5"
        style={theme.colourful
          ? { background: theme.accent, color: theme.template === 'bright' || theme.template === 'mist' ? BRAND.ink : BRAND.card }
          : { background: BRAND.card, color: BRAND.ink, borderBottom: `3px solid ${theme.accent}` }}
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em]">Poket School CV · {doc.pageSize}</p>
          <h3 className="mt-1 font-heading text-3xl tracking-tight">{doc.name}</h3>
        </div>
        {theme.photo ? (
          theme.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.photoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" />
          ) : (
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/90 text-lg font-semibold text-ink">{doc.initials}</span>
          )
        ) : null}
      </header>
      <div className={`grid gap-5 p-6 ${theme.layout === 'two' ? 'md:grid-cols-2' : ''}`}>
        {doc.sections.map((section) => (
          <section key={section.id}>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: theme.accent }}>{section.title}</h4>
            {section.body ? <p className="mt-1 leading-relaxed">{section.body}</p> : null}
            <ul className="mt-2 space-y-2">
              {section.items.map((item) => (
                <li key={item.id}>
                  <p className="font-medium">{item.title}</p>
                  <p>{[item.detail, item.when].filter(Boolean).join(' · ')}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: theme.accent }}>{item.label}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={`h-9 rounded-full px-3 text-sm ${active ? 'bg-blue-deep text-white' : 'bg-wash text-ink'}`}>
      {children}
    </button>
  );
}

export function CvStudio({
  name,
  items,
  summary,
  avatarUrl = '',
  versions,
  links,
  localPreview = false,
  seed,
  onChanged,
}: {
  name: string;
  items: readonly RecordItem[];
  summary: string;
  avatarUrl?: string;
  versions: readonly SavedCvVersion[];
  links: readonly { token: string; label: string }[];
  localPreview?: boolean;
  seed?: { design: CvDesign; name: string; shareToken: string };
  onChanged?: () => void;
}) {
  const starting = seed?.design ?? readCvDesign({ ...defaultCvDesign(), summary });
  const [design, setDesign] = useState<CvDesign>(starting);
  const [versionId, setVersionId] = useState(versions[0]?.id ?? '');
  const [versionName, setVersionName] = useState(seed?.name ?? versions[0]?.name ?? '');
  const [shareToken, setShareToken] = useState(seed?.shareToken ?? versions[0]?.shareToken ?? '');
  const [customTitle, setCustomTitle] = useState('Availability');
  const [customBody, setCustomBody] = useState('');
  const [notice, setNotice] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const displayName = publicName(name);

  const preview = useMemo(() => {
    const composed = composeCv({ name: displayName, items, design: { ...design, photoUrl: design.photo ? avatarUrl || design.photoUrl : '' } });
    return applyCvFields(composed, fields);
  }, [avatarUrl, design, displayName, fields, items]);

  const patch = (next: Partial<CvDesign>) => {
    setFields({});
    setDesign(readCvDesign({ ...design, ...next }));
  };

  const loadVersion = (id: string) => {
    setVersionId(id);
    const version = versions.find((item) => item.id === id);
    if (!version) {
      setVersionName('');
      setShareToken('');
      setDesign(readCvDesign({ ...defaultCvDesign(), summary }));
      return;
    }
    setVersionName(version.name);
    setShareToken(version.shareToken);
    setDesign(readCvDesign({ ...version.design, summary: version.design.summary || summary }));
    setFields({});
  };

  const save = () => {
    if (localPreview) {
      toast.success(`${versionName || 'This CV'} is saved on this preview.`);
      return;
    }
    void authedFetch('/api/portfolio', {
      method: 'POST',
      body: JSON.stringify({ action: 'save-version', id: versionId, name: versionName, shareToken, design }),
    })
      .then((data) => {
        const version = data.version && typeof data.version === 'object' ? data.version as { id?: string } : null;
        if (version?.id) setVersionId(version.id);
        onChanged?.();
        toast.success('CV version saved.');
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not save this CV.'));
  };

  const remove = () => {
    if (localPreview || !versionId) return;
    void authedFetch('/api/portfolio', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete-version', id: versionId }),
    })
      .then(() => {
        setVersionId('');
        onChanged?.();
        toast.success('CV version removed.');
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not remove this CV.'));
  };

  const translate = () => {
    if (!cvNeedsTranslation(design.language)) {
      setFields({});
      setNotice('');
      return;
    }
    if (localPreview) {
      setNotice('Download translates this CV. Verified facts stay in the original wording.');
      return;
    }
    void authedFetch('/api/portfolio', {
      method: 'POST',
      body: JSON.stringify({ action: 'translate-cv', design }),
    })
      .then((data) => {
        const next = data.fields && typeof data.fields === 'object' ? data.fields as Record<string, string> : {};
        setFields(next);
        setNotice(typeof data.notice === 'string' ? data.notice : '');
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not translate this CV.'));
  };

  const exportFile = (format: 'pdf' | 'docx') => {
    if (localPreview) {
      toast.success(`${format === 'pdf' ? 'PDF' : 'DOCX'} uses this preview.`);
      return;
    }
    void authedFetch('/api/portfolio', {
      method: 'POST',
      body: JSON.stringify({ action: 'export-cv', format, design: { ...design, photoUrl: design.photo ? avatarUrl : '' } }),
    })
      .then((data) => {
        if (typeof data.notice === 'string' && data.notice) setNotice(data.notice);
        const filename = typeof data.filename === 'string' ? data.filename : `poket-school-cv.${format}`;
        if (typeof data.pdf === 'string') download(filename, bytesFromBase64(data.pdf), 'application/pdf');
        if (typeof data.docx === 'string') download(filename, bytesFromBase64(data.docx), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not download this CV.'));
  };

  const publishTheme = () => {
    if (localPreview) {
      toast.success('The public portfolio uses this theme.');
      return;
    }
    void authedFetch('/api/portfolio', {
      method: 'POST',
      body: JSON.stringify({ action: 'save-theme', design }),
    })
      .then(() => toast.success('The public portfolio uses this theme.'))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not update the public portfolio.'));
  };

  return (
    <section className="grid gap-4 rounded-[28px] border border-line bg-white p-6 text-ink">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-deep">CV builder</p>
        <h2 className="mt-1 font-heading text-3xl tracking-tight">Live preview</h2>
        <p className="mt-1 text-sm leading-relaxed">Choose a template, accent, font, columns, and photo. Drag sections, hide a line, or rename a heading. Verified facts stay as recorded. Self-reported wording and the summary can change on this version.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm">Saved CV
          <select value={versionId} onChange={(event) => loadVersion(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line bg-wash px-3">
            <option value="">New CV</option>
            {versions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Version name
          <input value={versionName} onChange={(event) => setVersionName(event.target.value)} placeholder="Company X - Analyst" className="mt-1 h-11 w-full rounded-xl border border-line px-3" />
        </label>
        <div className="flex items-end gap-2">
          <button type="button" onClick={save} className="h-11 rounded-full bg-blue-deep px-4 text-sm font-semibold text-white">Save version</button>
          {versionId ? <button type="button" onClick={remove} className="h-11 rounded-full border border-blue-deep px-4 text-sm">Remove</button> : null}
        </div>
      </div>
      <label className="text-sm">Job tracker share link
        <select value={shareToken} onChange={(event) => setShareToken(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3">
          <option value="">No share link</option>
          {links.map((link) => <option key={link.token} value={link.token}>{link.label}</option>)}
        </select>
      </label>

      <div>
        <p className="text-sm font-semibold">Classic</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CLASSIC_TEMPLATES.map((template) => (
            <Chip key={template} active={design.template === template} onClick={() => patch({ template })}>{template}</Chip>
          ))}
        </div>
        <p className="mt-3 text-sm font-semibold">Colourful</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {COLOURFUL_TEMPLATES.map((template) => (
            <Chip key={template} active={design.template === template} onClick={() => patch({ template })}>{template}</Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Accent
          <input type="color" value={design.accent} onChange={(event) => patch({ accent: event.target.value })} className="mt-1 block h-11 w-16 cursor-pointer rounded-xl border border-line bg-white" />
        </label>
        <label className="text-sm">Font
          <select value={design.font} onChange={(event) => patch({ font: event.target.value === 'serif' || event.target.value === 'mono' ? event.target.value : 'sans' })} className="mt-1 h-11 rounded-xl border border-line px-3">
            <option value="sans">Sans</option>
            <option value="serif">Serif</option>
            <option value="mono">Mono</option>
          </select>
        </label>
        <div className="flex gap-2">
          <Chip active={design.layout === 'one'} onClick={() => patch({ layout: 'one' })}>One column</Chip>
          <Chip active={design.layout === 'two'} onClick={() => patch({ layout: 'two' })}>Two columns</Chip>
        </div>
        <div className="flex gap-2">
          <Chip active={design.pageSize === 'A4'} onClick={() => patch({ pageSize: 'A4' })}>A4</Chip>
          <Chip active={design.pageSize === 'Letter'} onClick={() => patch({ pageSize: 'Letter' })}>Letter</Chip>
        </div>
        <Chip active={design.photo} onClick={() => patch({ photo: !design.photo, photoUrl: design.photo ? '' : avatarUrl })}>Photo</Chip>
      </div>

      <label className="text-sm">Language
        <select value={design.language} onChange={(event) => patch({ language: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-line px-3">
          {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
        </select>
      </label>
      <button type="button" onClick={translate} className="h-10 w-fit rounded-full border border-blue-deep px-4 text-sm">Preview this language</button>
      {notice ? <p className="text-sm">{notice}</p> : <p className="text-sm">English stays as written. Another language is a display copy from content translation. Verified facts are not rewritten.</p>}

      <div className="grid gap-2">
        <p className="text-sm font-semibold">Section order</p>
        {design.sectionOrder.map((id, index) => {
          const hidden = design.hiddenSections.includes(id);
          return (
            <div
              key={id}
              draggable
              onDragStart={(event) => event.dataTransfer.setData('text/plain', id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const from = event.dataTransfer.getData('text/plain');
                patch({ sectionOrder: moveSection(design.sectionOrder, from, index) });
              }}
              className="flex flex-wrap items-center gap-2 rounded-2xl bg-wash px-3 py-2"
            >
              <span className="cursor-grab text-xs font-semibold uppercase tracking-wide">Drag</span>
              <input
                value={design.sectionTitles[id] ?? id}
                onChange={(event) => patch({ sectionTitles: { ...design.sectionTitles, [id]: event.target.value } })}
                className="h-9 min-w-40 flex-1 rounded-xl border border-line bg-white px-3 text-sm"
              />
              <button type="button" className="text-xs underline" onClick={() => patch({ sectionOrder: moveSection(design.sectionOrder, id, index - 1) })}>Up</button>
              <button type="button" className="text-xs underline" onClick={() => patch({ sectionOrder: moveSection(design.sectionOrder, id, index + 1) })}>Down</button>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={!hidden}
                  onChange={() => patch({
                    hiddenSections: hidden
                      ? design.hiddenSections.filter((section) => section !== id)
                      : [...design.hiddenSections, id],
                  })}
                />
                Show
              </label>
            </div>
          );
        })}
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
        <input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="Custom section" className="h-11 rounded-xl border border-line px-3 text-sm" />
        <input value={customBody} onChange={(event) => setCustomBody(event.target.value)} placeholder="Wording for this section" className="h-11 rounded-xl border border-line px-3 text-sm" />
        <button
          type="button"
          className="h-11 rounded-full bg-brand-primary px-4 text-sm font-semibold text-white"
          onClick={() => {
            if (!customBody.trim()) return;
            const slug = customTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'section';
            patch({ customSections: [...design.customSections, { id: `custom-${slug}`, title: customTitle || 'Custom section', body: customBody }] });
            setCustomBody('');
          }}
        >
          Add section
        </button>
      </div>

      <label className="text-sm">Summary
        <textarea value={design.summary} onChange={(event) => patch({ summary: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-line px-3 py-2" />
      </label>

      <div className="grid gap-2">
        <p className="text-sm font-semibold">Lines on this CV</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={design.showScores} onChange={(event) => patch({ showScores: event.target.checked })} />
          Show scores
        </label>
        {items.map((item) => {
          const hidden = design.hiddenItems.includes(item.id) || (item.kind === 'score' && !design.showScores);
          const wording = design.wording[item.id];
          return (
            <div key={item.id} className="rounded-2xl border border-line px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!hidden}
                  onChange={() => patch(hidden
                    ? {
                      hiddenItems: design.hiddenItems.filter((id) => id !== item.id),
                      showScores: item.kind === 'score' ? true : design.showScores,
                    }
                    : { hiddenItems: [...design.hiddenItems, item.id] })}
                />
                <span>{item.source === 'verified' ? item.title : (wording?.title || item.title)}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-deep">{sourceLabel(item.source)}</span>
              </label>
              {item.source === 'verified' ? (
                <p className="mt-1 text-xs">{[item.detail, item.when].filter(Boolean).join(' · ')} Verified facts stay as recorded.</p>
              ) : (
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <input
                    value={wording?.title ?? item.title}
                    onChange={(event) => patch({ wording: { ...design.wording, [item.id]: { title: event.target.value, detail: wording?.detail ?? item.detail } } })}
                    className="h-10 rounded-xl border border-line px-3 text-sm"
                  />
                  <input
                    value={wording?.detail ?? item.detail}
                    onChange={(event) => patch({ wording: { ...design.wording, [item.id]: { title: wording?.title ?? item.title, detail: event.target.value } } })}
                    className="h-10 rounded-xl border border-line px-3 text-sm"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => exportFile('pdf')} className="h-11 rounded-full bg-blue-deep px-5 text-sm font-semibold text-white">PDF</button>
        <button type="button" onClick={() => exportFile('docx')} className="h-11 rounded-full bg-blue-deep px-5 text-sm font-semibold text-white">DOCX</button>
        <button type="button" onClick={publishTheme} className="h-11 rounded-full border border-blue-deep px-5 text-sm font-semibold text-ink">Public portfolio theme</button>
      </div>
      <p className="text-sm">The public portfolio uses this template, accent, font, layout, and photo.</p>
      <CvDocument doc={preview} />
    </section>
  );
}
