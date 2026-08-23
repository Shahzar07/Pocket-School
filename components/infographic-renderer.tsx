'use client';

import React, { useMemo } from 'react';
import { toast } from 'sonner';
import {
  BarChart3, Check, Copy, FileText, Lightbulb, Printer, Sparkles,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────────────────── */

interface InfographicRendererProps {
  content: string;
  dark?: boolean;
}

interface Stat { value: string; label: string }

type Node =
  | { kind: 'bullets'; items: string[] }
  | { kind: 'para'; text: string }
  | { kind: 'callout'; text: string }
  | { kind: 'divider' };

interface Section { title: string; nodes: Node[] }

interface InfographicDoc {
  title: string;
  stats: Stat[];
  lead: Node[];
  sections: Section[];
  takeaway: string | null;
}

/* ─── Accent palette (works on light + dark surfaces) ──────── */

const ACCENTS = [
  { grad: 'from-blue-500 to-indigo-600', text: 'text-blue-500', soft: 'bg-blue-500/10', border: 'border-blue-500/25' },
  { grad: 'from-emerald-500 to-teal-600', text: 'text-emerald-500', soft: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  { grad: 'from-violet-500 to-purple-600', text: 'text-violet-500', soft: 'bg-violet-500/10', border: 'border-violet-500/25' },
  { grad: 'from-amber-500 to-orange-600', text: 'text-amber-500', soft: 'bg-amber-500/10', border: 'border-amber-500/25' },
  { grad: 'from-rose-500 to-pink-600', text: 'text-rose-500', soft: 'bg-rose-500/10', border: 'border-rose-500/25' },
  { grad: 'from-cyan-500 to-blue-600', text: 'text-cyan-500', soft: 'bg-cyan-500/10', border: 'border-cyan-500/25' },
];

const accent = (i: number) => ACCENTS[((i % ACCENTS.length) + ACCENTS.length) % ACCENTS.length];

/* ─── Parsing ─────────────────────────────────────────────── */

const BULLET_RE = /^\s*(?:[-*•+]|\d+[.)])\s+(.*)$/;
const HR_RE = /^\s*(?:[-*_]\s*){3,}$/;

/** `**42%** — label` / `**3 laws**: label` → a KPI tile. */
function matchStat(line: string): Stat | null {
  const body = line.replace(BULLET_RE, '$1').trim();
  const m = body.match(/^\*\*\s*([^*]{1,30}?)\s*\*\*\s*(.*)$/);
  if (!m) return null;
  const value = m[1].trim();
  const label = m[2].replace(/^[\s—–\-:•|]+/, '').trim();
  const looksNumeric = /\d/.test(value) || /[%$€£¥×+]/.test(value);
  if (!looksNumeric && value.length > 14) return null;
  if (label.length > 110) return null;
  if (!label && !looksNumeric) return null;
  return { value, label };
}

function stripInline(text: string) {
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '').trim();
}

export function parseInfographic(md: string): InfographicDoc {
  const lines = (md ?? '').replace(/\r\n/g, '\n').split('\n');
  const doc: InfographicDoc = { title: '', stats: [], lead: [], sections: [], takeaway: null };

  let section: Section | null = null;
  const push = (n: Node) => (section ? section.nodes.push(n) : doc.lead.push(n));

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    if (HR_RE.test(trimmed)) { push({ kind: 'divider' }); i++; continue; }

    const heading = trimmed.match(/^(#{1,6})\s*(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const text = stripInline(heading[2]);
      if (level === 1 && !doc.title) { doc.title = text; i++; continue; }
      section = { title: text, nodes: [] };
      doc.sections.push(section);
      i++;
      continue;
    }

    if (trimmed.startsWith('>')) {
      let quote = '';
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote += lines[i].trim().replace(/^>\s?/, '') + ' ';
        i++;
      }
      const text = stripInline(quote);
      if (text) push({ kind: 'callout', text });
      continue;
    }

    if (BULLET_RE.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && BULLET_RE.test(lines[i].trim())) {
        const raw = lines[i].trim().replace(BULLET_RE, '$1').trim();
        const stat = matchStat(raw);
        if (stat) doc.stats.push({ value: stat.value, label: stripInline(stat.label) });
        else if (raw) items.push(raw);
        i++;
      }
      if (items.length) push({ kind: 'bullets', items });
      continue;
    }

    // Standalone stat line (not in a list).
    const stat = matchStat(trimmed);
    if (stat) {
      doc.stats.push({ value: stat.value, label: stripInline(stat.label) });
      i++;
      continue;
    }

    // Paragraph — merge consecutive plain lines.
    let para = '';
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('>') &&
      !/^#{1,6}\s/.test(lines[i].trim()) &&
      !BULLET_RE.test(lines[i].trim()) &&
      !HR_RE.test(lines[i].trim()) &&
      !matchStat(lines[i].trim())
    ) {
      para += lines[i].trim() + ' ';
      i++;
    }
    if (para.trim()) push({ kind: 'para', text: para.trim() });
    else i++;
  }

  // The final callout becomes the key takeaway card at the bottom.
  const bucket = doc.sections.length ? doc.sections[doc.sections.length - 1].nodes : doc.lead;
  for (let k = bucket.length - 1; k >= 0; k--) {
    const n = bucket[k];
    if (n.kind === 'divider') continue;
    if (n.kind === 'callout') { doc.takeaway = n.text; bucket.splice(k, 1); }
    break;
  }

  if (!doc.title) {
    const firstPara = doc.lead.find((n) => n.kind === 'para') as { text: string } | undefined;
    doc.title = firstPara ? firstPara.text.split(/[.!?]/)[0].slice(0, 80) : 'Infographic';
  }

  return doc;
}

/* ─── Inline markdown → React ─────────────────────────────── */

function renderInline(text: string, key = 0): React.ReactNode {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={`${key}-${i}`} className="font-semibold">{part}</strong>
      : <span key={`${key}-${i}`}>{part.replace(/\*/g, '')}</span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Shared export toolbar — used by the infographic AND mind map
   renderers so the controls stay identical between them.
   ═══════════════════════════════════════════════════════════ */

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineHtml(s: string) {
  return escapeHtml(s)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

/** Minimal markdown → HTML good enough for print / Word export. */
function markdownToHtml(md: string): string {
  const out: string[] = [];
  const lines = (md ?? '').replace(/\r\n/g, '\n').split('\n');
  let listOpen = false;
  const closeList = () => { if (listOpen) { out.push('</ul>'); listOpen = false; } };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    const trimmed = line.trim();
    if (!trimmed) { closeList(); continue; }

    if (HR_RE.test(trimmed)) { closeList(); out.push('<hr />'); continue; }

    const heading = trimmed.match(/^(#{1,6})\s*(.+)$/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 1, 6);
      out.push(`<h${level}>${inlineHtml(heading[2])}</h${level}>`);
      continue;
    }

    if (trimmed.startsWith('>')) {
      closeList();
      out.push(`<blockquote>${inlineHtml(trimmed.replace(/^>\s?/, ''))}</blockquote>`);
      continue;
    }

    const bullet = line.match(/^(\s*)(?:[-*•+]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      if (!listOpen) { out.push('<ul>'); listOpen = true; }
      const indent = Math.min(Math.floor(bullet[1].length / 2), 5) * 18;
      out.push(`<li style="margin-left:${indent}px">${inlineHtml(bullet[2])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${inlineHtml(trimmed)}</p>`);
  }
  closeList();
  return out.join('\n');
}

const DOC_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Helvetica, Arial, sans-serif; color: #16181d; margin: 0; padding: 36px 40px; line-height: 1.6; }
  .ps-head { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 3px solid #4f46e5; padding-bottom: 10px; margin-bottom: 26px; }
  .ps-mark { font-size: 17px; font-weight: 700; letter-spacing: -0.02em; color: #4f46e5; }
  .ps-mark span { color: #16181d; }
  .ps-kind { font-size: 11px; text-transform: uppercase; letter-spacing: .18em; color: #6b7280; }
  h1 { font-size: 26px; margin: 0 0 18px; letter-spacing: -0.02em; }
  h2 { font-size: 19px; margin: 26px 0 8px; color: #1f2937; border-left: 4px solid #4f46e5; padding-left: 10px; }
  h3, h4, h5, h6 { font-size: 15px; margin: 18px 0 6px; color: #374151; }
  p { margin: 0 0 10px; font-size: 13.5px; }
  ul { margin: 0 0 12px; padding-left: 20px; }
  li { font-size: 13.5px; margin-bottom: 5px; }
  blockquote { margin: 14px 0; padding: 12px 16px; background: #f3f4f6; border-left: 4px solid #f59e0b; font-style: italic; font-size: 13.5px; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 22px 0; }
  code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 12.5px; }
  .ps-foot { margin-top: 32px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 10.5px; color: #9ca3af; }
  @page { margin: 18mm; }
`;

function buildDocumentHtml(title: string, kind: string, markdown: string, forWord: boolean) {
  const body = markdownToHtml(markdown);
  const head = `
    <div class="ps-head">
      <div class="ps-mark">Poket <span>School</span></div>
      <div class="ps-kind">${escapeHtml(kind)}</div>
    </div>
    <h1>${escapeHtml(title)}</h1>`;
  const foot = `<div class="ps-foot">Generated with ET on Poket School</div>`;
  const wordNs = forWord
    ? ' xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"'
    : '';
  return `<!DOCTYPE html>
<html${wordNs}>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${DOC_STYLES}</style>
</head>
<body>
${head}
${body}
${foot}
</body>
</html>`;
}

function safeFileName(title: string) {
  const base = (title || 'poket-school').replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return base || 'poket-school';
}

/**
 * Compact Download PDF / Download Word / Copy controls.
 * Shared by the infographic and mind map renderers.
 */
export function ContentExportToolbar({
  title, kind, markdown, dark = false,
}: { title: string; kind: string; markdown: string; dark?: boolean }) {
  const btn = `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors border ${
    dark
      ? 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.09] hover:text-white'
      : 'border-border bg-background/70 text-muted-foreground hover:bg-muted hover:text-foreground'
  }`;

  const handlePdf = () => {
    const html = buildDocumentHtml(title, kind, markdown, false);
    const w = window.open('', '_blank', 'width=920,height=1000');
    if (!w) {
      toast.error('Allow pop-ups for this site to export a PDF.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch { /* user can print manually */ } }, 400);
    toast.success('Print dialog opened — choose "Save as PDF".');
  };

  const handleWord = () => {
    try {
      const html = buildDocumentHtml(title, kind, markdown, true);
      const blob = new Blob(['﻿', html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFileName(title)}.doc`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      toast.success('Word document downloaded.');
    } catch {
      toast.error('Could not create the Word file.');
    }
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(markdown);
      } else {
        const ta = document.createElement('textarea');
        ta.value = markdown;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      toast.success('Copied to clipboard.');
    } catch {
      toast.error('Copy failed — try selecting the text manually.');
    }
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0 print:hidden">
      <button type="button" onClick={handlePdf} className={btn} title="Open a printable version and save it as PDF">
        <Printer className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">PDF</span>
      </button>
      <button type="button" onClick={handleWord} className={btn} title="Download as a Word document">
        <FileText className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Word</span>
      </button>
      <button type="button" onClick={handleCopy} className={btn} title="Copy the raw text">
        <Copy className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Copy</span>
      </button>
    </div>
  );
}

/* ─── Sub-renderers ───────────────────────────────────────── */

function StatTiles({ stats, dark }: { stats: Stat[]; dark: boolean }) {
  const cols = stats.length <= 2 ? 'sm:grid-cols-2' : stats.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';
  return (
    <div className={`grid grid-cols-2 ${cols} gap-3 mb-7`}>
      {stats.map((s, i) => {
        const a = accent(i);
        return (
          <div
            key={i}
            className={`relative overflow-hidden rounded-2xl border p-4 ${a.border} ${
              dark ? 'bg-white/[0.03]' : 'bg-white'
            }`}
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${a.grad}`} />
            <p className={`text-xl sm:text-2xl font-bold leading-none tracking-tight ${a.text}`}>{s.value}</p>
            {s.label && (
              <p className={`mt-2 text-[11px] leading-snug ${dark ? 'text-slate-400' : 'text-muted-foreground'}`}>
                {s.label}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NodeList({ nodes, dark, idx }: { nodes: Node[]; dark: boolean; idx: number }) {
  const a = accent(idx);
  return (
    <>
      {nodes.map((n, i) => {
        if (n.kind === 'divider') {
          return <div key={i} className={`my-4 h-px ${dark ? 'bg-white/10' : 'bg-border'}`} />;
        }
        if (n.kind === 'para') {
          return (
            <p key={i} className={`text-sm leading-relaxed mb-3 ${dark ? 'text-slate-300' : 'text-foreground/80'}`}>
              {renderInline(n.text, i)}
            </p>
          );
        }
        if (n.kind === 'callout') {
          return (
            <div key={i} className={`my-3 rounded-xl border-l-[3px] px-4 py-3 ${a.border} ${a.soft}`}>
              <div className="flex items-start gap-2.5">
                <Sparkles className={`w-4 h-4 shrink-0 mt-0.5 ${a.text}`} />
                <p className={`text-sm leading-relaxed ${dark ? 'text-slate-200' : 'text-foreground/90'}`}>
                  {renderInline(n.text, i)}
                </p>
              </div>
            </div>
          );
        }
        return (
          <ul key={i} className="space-y-2 mb-2">
            {n.items.map((item, j) => (
              <li key={j} className="flex items-start gap-2.5">
                <span className={`mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${a.soft}`}>
                  <Check className={`h-2.5 w-2.5 ${a.text}`} strokeWidth={3} />
                </span>
                <span className={`text-sm leading-relaxed ${dark ? 'text-slate-300' : 'text-foreground/80'}`}>
                  {renderInline(item, j)}
                </span>
              </li>
            ))}
          </ul>
        );
      })}
    </>
  );
}

/* ─── Main renderer ────────────────────────────────────────── */

export function InfographicRenderer({ content, dark = false }: InfographicRendererProps) {
  const doc = useMemo(() => parseInfographic(content), [content]);

  if (!content.trim()) {
    return (
      <p className={`text-sm italic ${dark ? 'text-slate-500' : 'text-muted-foreground'}`}>
        No infographic content available.
      </p>
    );
  }

  return (
    <div
      className={`w-full rounded-2xl p-5 sm:p-8 ${
        dark
          ? 'bg-gradient-to-br from-[#0B0F1A] to-[#070A14] border border-white/10'
          : 'bg-gradient-to-br from-white to-slate-50 border border-border'
      }`}
    >
      {/* Eyebrow + export toolbar */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] truncate ${dark ? 'text-slate-400' : 'text-muted-foreground'}`}>
            Infographic
          </p>
        </div>
        <ContentExportToolbar title={doc.title} kind="Infographic" markdown={content} dark={dark} />
      </div>

      {/* Title */}
      <div className="mb-6">
        <h2 className={`text-2xl sm:text-3xl font-bold leading-tight tracking-tight ${dark ? 'text-white' : 'text-foreground'}`}>
          {doc.title}
        </h2>
        <div className="mt-3 h-1 w-20 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
      </div>

      {/* Lead paragraphs */}
      {doc.lead.length > 0 && (
        <div className="mb-6">
          <NodeList nodes={doc.lead} dark={dark} idx={0} />
        </div>
      )}

      {/* KPI / stat tiles */}
      {doc.stats.length > 0 && <StatTiles stats={doc.stats} dark={dark} />}

      {/* Sections */}
      <div className="grid gap-4 md:grid-cols-2">
        {doc.sections.map((s, i) => {
          const a = accent(i);
          return (
            <section
              key={i}
              className={`rounded-2xl border p-4 sm:p-5 ${
                dark ? 'border-white/10 bg-white/[0.02]' : 'border-border bg-white'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${a.grad} flex items-center justify-center shrink-0 shadow-sm`}>
                  <span className="text-white text-xs font-bold">{i + 1}</span>
                </div>
                <h3 className={`text-base font-semibold leading-tight ${dark ? 'text-white' : 'text-foreground'}`}>
                  {s.title}
                </h3>
              </div>
              <NodeList nodes={s.nodes} dark={dark} idx={i} />
            </section>
          );
        })}
      </div>

      {/* Key takeaway */}
      {doc.takeaway && (
        <div
          className={`mt-6 rounded-2xl border p-4 sm:p-5 ${
            dark ? 'border-amber-500/30 bg-amber-500/[0.07]' : 'border-amber-300 bg-amber-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
              <Lightbulb className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-[0.18em] mb-1 ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
                Key takeaway
              </p>
              <p className={`text-sm leading-relaxed ${dark ? 'text-amber-50' : 'text-amber-900'}`}>
                {renderInline(doc.takeaway)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
