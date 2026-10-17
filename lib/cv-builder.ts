/**
 * CV versions choose presentation. Verified facts stay on the record.
 * A wording change applies to a self-reported line only.
 */

import { isSupportedLanguage } from './languages';
import {
  SECTION_IDS,
  sourceLabel,
  type ItemSource,
  type RecordItem,
} from './portfolio';

export const CLASSIC_TEMPLATES = ['classic', 'serif', 'compact'] as const;
export const COLOURFUL_TEMPLATES = ['forest', 'gold', 'coral', 'blue'] as const;
export const CV_DESIGN_TEMPLATES = [...CLASSIC_TEMPLATES, ...COLOURFUL_TEMPLATES] as const;
export type CvDesignTemplate = (typeof CV_DESIGN_TEMPLATES)[number];
export type CvFont = 'sans' | 'serif' | 'mono';
export type CvLayout = 'one' | 'two';
export type CvPageSize = 'A4' | 'Letter';

export const CV_FONTS: readonly CvFont[] = ['sans', 'serif', 'mono'];
export const CV_LAYOUTS: readonly CvLayout[] = ['one', 'two'];
export const CV_PAGE_SIZES: readonly CvPageSize[] = ['A4', 'Letter'];

const TEMPLATE_ACCENT: Record<CvDesignTemplate, string> = {
  classic: '#1A3C34',
  serif: '#1A3C34',
  compact: '#1A3C34',
  forest: '#1A3C34',
  gold: '#C8922A',
  coral: '#E36A4F',
  blue: '#3C8DFF',
};

export const CV_BASE_SECTIONS = ['summary', ...SECTION_IDS] as const;

const DEFAULT_TITLES: Record<string, string> = {
  summary: 'Summary',
  education: 'Education',
  courses: 'Courses',
  scores: 'Scores',
  certificates: 'Certificates',
  badges: 'Badges',
  projects: 'Projects',
  endorsements: 'Endorsements',
  activities: 'Activities',
  awards: 'Awards',
  experience: 'Experience',
  skills: 'Skills',
  links: 'Links',
};

const PDF_FONT: Record<CvFont, string> = {
  sans: 'Helvetica',
  serif: 'Times-Roman',
  mono: 'Courier',
};

const PAGE: Record<CvPageSize, { w: number; h: number }> = {
  A4: { w: 595, h: 842 },
  Letter: { w: 612, h: 792 },
};

export interface CvCustomSection {
  id: string;
  title: string;
  body: string;
}

export interface CvWording {
  title: string;
  detail: string;
}

export interface CvDesign {
  template: CvDesignTemplate;
  accent: string;
  font: CvFont;
  layout: CvLayout;
  photo: boolean;
  photoUrl: string;
  pageSize: CvPageSize;
  language: string;
  sectionOrder: string[];
  sectionTitles: Record<string, string>;
  hiddenSections: string[];
  hiddenItems: string[];
  customSections: CvCustomSection[];
  wording: Record<string, CvWording>;
  summary: string;
  showScores: boolean;
}

export interface PortfolioTheme {
  template: CvDesignTemplate;
  accent: string;
  font: CvFont;
  layout: CvLayout;
  photo: boolean;
  photoUrl: string;
  sectionOrder: string[];
  sectionTitles: Record<string, string>;
  hiddenSections: string[];
  customSections: CvCustomSection[];
  wording: Record<string, CvWording>;
  summary: string;
}

export interface SavedCvVersion {
  id: string;
  name: string;
  shareToken: string;
  design: CvDesign;
  updatedAt: string;
}

export interface ComposedItem {
  id: string;
  title: string;
  detail: string;
  when: string;
  source: ItemSource;
  label: 'Verified by Poket School' | 'Self-reported';
  verifyUrl: string;
}

export interface ComposedSection {
  id: string;
  title: string;
  body: string;
  items: ComposedItem[];
}

export interface ComposedCv {
  name: string;
  initials: string;
  pageSize: CvPageSize;
  language: string;
  theme: {
    template: CvDesignTemplate;
    accent: string;
    font: CvFont;
    layout: CvLayout;
    photo: boolean;
    photoUrl: string;
    colourful: boolean;
    compact: boolean;
  };
  sections: ComposedSection[];
}

function isTemplate(value: string): value is CvDesignTemplate {
  return (CV_DESIGN_TEMPLATES as readonly string[]).includes(value);
}

export function templateFamily(template: CvDesignTemplate): 'classic' | 'colourful' {
  return (CLASSIC_TEMPLATES as readonly string[]).includes(template) ? 'classic' : 'colourful';
}

export function defaultCvDesign(): CvDesign {
  return {
    template: 'classic',
    accent: TEMPLATE_ACCENT.classic,
    font: 'sans',
    layout: 'one',
    photo: false,
    photoUrl: '',
    pageSize: 'A4',
    language: 'en',
    sectionOrder: [...CV_BASE_SECTIONS],
    sectionTitles: { ...DEFAULT_TITLES },
    hiddenSections: [],
    hiddenItems: [],
    customSections: [],
    wording: {},
    summary: '',
    showScores: false,
  };
}

function clip(value: unknown, max: number): string {
  return (typeof value === 'string' ? value : '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function hexAccent(value: unknown, template: CvDesignTemplate): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  return /^#[0-9A-Fa-f]{6}$/.test(raw) ? raw.toUpperCase() : TEMPLATE_ACCENT[template];
}

function httpsUrl(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw.startsWith('https://') ? raw.slice(0, 300) : '';
}

function customId(value: string, index: number): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
  return (slug ? `custom-${slug}` : `custom-${index + 1}`).slice(0, 40);
}

export function readCvDesign(value: unknown): CvDesign {
  const base = defaultCvDesign();
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const template = typeof raw.template === 'string' && isTemplate(raw.template) ? raw.template : base.template;
  const customSections: CvCustomSection[] = [];
  const seen = new Set<string>();
  const incoming = Array.isArray(raw.customSections) ? raw.customSections : [];
  for (const entry of incoming.slice(0, 8)) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const title = clip(row.title, 60) || 'Custom section';
    let id = customId(typeof row.id === 'string' && row.id.startsWith('custom-') ? row.id.slice(7) : title, customSections.length);
    while (seen.has(id)) id = `${id.slice(0, 36)}-${customSections.length + 1}`;
    seen.add(id);
    customSections.push({ id, title, body: clip(row.body, 800) });
  }
  const allowed = new Set<string>([...CV_BASE_SECTIONS, ...customSections.map((section) => section.id)]);
  const sectionOrder: string[] = [];
  const requested = Array.isArray(raw.sectionOrder) ? raw.sectionOrder : base.sectionOrder;
  for (const id of requested) {
    if (typeof id !== 'string' || !allowed.has(id) || sectionOrder.includes(id)) continue;
    sectionOrder.push(id);
  }
  for (const id of allowed) {
    if (!sectionOrder.includes(id)) sectionOrder.push(id);
  }
  const titles: Record<string, string> = { ...DEFAULT_TITLES };
  const titleRaw = raw.sectionTitles && typeof raw.sectionTitles === 'object' ? raw.sectionTitles as Record<string, unknown> : {};
  for (const id of sectionOrder) {
    const next = clip(titleRaw[id], 60);
    if (next) titles[id] = next;
    const custom = customSections.find((section) => section.id === id);
    if (custom && !next) titles[id] = custom.title;
  }
  const wording: Record<string, CvWording> = {};
  const wordingRaw = raw.wording && typeof raw.wording === 'object' ? raw.wording as Record<string, unknown> : {};
  for (const [id, entry] of Object.entries(wordingRaw).slice(0, 80)) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const key = id.trim().slice(0, 120);
    if (!key) continue;
    wording[key] = { title: clip(row.title, 120), detail: clip(row.detail, 280) };
  }
  const language = typeof raw.language === 'string' && isSupportedLanguage(raw.language) ? raw.language : 'en';
  return {
    template,
    accent: hexAccent(raw.accent, template),
    font: raw.font === 'serif' || raw.font === 'mono' || raw.font === 'sans' ? raw.font : 'sans',
    layout: raw.layout === 'two' ? 'two' : 'one',
    photo: raw.photo === true,
    photoUrl: raw.photo === true ? httpsUrl(raw.photoUrl) : '',
    pageSize: raw.pageSize === 'Letter' ? 'Letter' : 'A4',
    language,
    sectionOrder,
    sectionTitles: titles,
    hiddenSections: (Array.isArray(raw.hiddenSections) ? raw.hiddenSections : [])
      .filter((id): id is string => typeof id === 'string' && allowed.has(id))
      .slice(0, 40),
    hiddenItems: (Array.isArray(raw.hiddenItems) ? raw.hiddenItems : [])
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      .map((id) => id.trim().slice(0, 120))
      .slice(0, 80),
    customSections,
    wording,
    summary: clip(raw.summary, 600),
    showScores: raw.showScores === true,
  };
}

/** Drops wording for verified lines so a saved version cannot rewrite those facts. */
export function sanitizeDesignForItems(
  design: CvDesign,
  items: readonly Pick<RecordItem, 'id' | 'source'>[],
): CvDesign {
  const verified = new Set(items.filter((item) => item.source === 'verified').map((item) => item.id));
  const known = new Set(items.map((item) => item.id));
  const wording: Record<string, CvWording> = {};
  for (const [id, entry] of Object.entries(design.wording)) {
    if (!known.has(id) || verified.has(id)) continue;
    wording[id] = entry;
  }
  return { ...design, wording };
}

export function themeFromDesign(design: CvDesign): PortfolioTheme {
  return {
    template: design.template,
    accent: design.accent,
    font: design.font,
    layout: design.layout,
    photo: design.photo,
    photoUrl: design.photo ? design.photoUrl : '',
    sectionOrder: design.sectionOrder,
    sectionTitles: design.sectionTitles,
    hiddenSections: design.hiddenSections,
    customSections: design.customSections,
    wording: design.wording,
    summary: design.summary,
  };
}

export function readPortfolioTheme(value: unknown): PortfolioTheme {
  return themeFromDesign(readCvDesign(value));
}

export function designFromTheme(theme: PortfolioTheme, fallbackSummary = ''): CvDesign {
  const design = readCvDesign({ ...theme, summary: theme.summary.trim() || fallbackSummary, showScores: true, pageSize: 'A4', language: 'en' });
  return { ...design, showScores: true, summary: theme.summary.trim() || clip(fallbackSummary, 600) };
}

export function moveSection(order: readonly string[], id: string, toIndex: number): string[] {
  const next = [...order];
  const from = next.indexOf(id);
  if (from < 0) return next;
  const bounded = Math.max(0, Math.min(next.length - 1, toIndex));
  const [item] = next.splice(from, 1);
  if (!item) return order.slice();
  next.splice(bounded, 0, item);
  return next;
}

export function cvInitials(name: string): string {
  const parts = name.replace(/[^A-Za-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0] ?? '').join('');
  return (letters || 'PS').toUpperCase();
}

export function cvNeedsTranslation(language: string): boolean {
  return isSupportedLanguage(language) && language !== 'en';
}

function verifyLink(value: string): string {
  return value.startsWith('https://poketschool.ai/verify/') ? value : '';
}

export function composeCv(input: {
  name: string;
  items: readonly RecordItem[];
  design: CvDesign;
}): ComposedCv {
  const design = input.design;
  const hiddenSections = new Set(design.hiddenSections);
  const hiddenItems = new Set(design.hiddenItems);
  const grouped = new Map<string, ComposedItem[]>();
  for (const item of input.items) {
    if (item.kind === 'score' && !design.showScores) continue;
    if (hiddenItems.has(item.id)) continue;
    const override = item.source === 'self_reported' ? design.wording[item.id] : undefined;
    const title = (item.source === 'self_reported' && override?.title.trim() ? override.title : item.title).trim().slice(0, 120);
    if (!title) continue;
    const detail = (item.source === 'self_reported' && override ? override.detail : item.detail).trim().slice(0, 280);
    const composed: ComposedItem = {
      id: item.id,
      title,
      detail,
      when: item.when.trim().slice(0, 40),
      source: item.source,
      label: sourceLabel(item.source),
      verifyUrl: verifyLink(item.verifyUrl),
    };
    const section = item.section || 'links';
    const list = grouped.get(section) ?? [];
    list.push(composed);
    grouped.set(section, list);
  }
  const order = [...design.sectionOrder];
  for (const custom of design.customSections) {
    if (!order.includes(custom.id)) order.push(custom.id);
  }
  const sections: ComposedSection[] = [];
  for (const id of order) {
    if (hiddenSections.has(id)) continue;
    const title = (design.sectionTitles[id] || DEFAULT_TITLES[id] || 'Section').slice(0, 60);
    if (id === 'summary') {
      const body = design.summary.trim();
      if (body) sections.push({ id, title, body, items: [] });
      continue;
    }
    const custom = design.customSections.find((section) => section.id === id);
    if (custom) {
      if (custom.body.trim()) sections.push({ id, title: custom.title || title, body: custom.body.trim(), items: [] });
      continue;
    }
    const items = grouped.get(id) ?? [];
    if (items.length) sections.push({ id, title, body: '', items });
  }
  const name = input.name.replace(/\s+/g, ' ').trim().slice(0, 80) || 'Learner';
  return {
    name,
    initials: cvInitials(name),
    pageSize: design.pageSize,
    language: design.language,
    theme: {
      template: design.template,
      accent: design.accent,
      font: design.font,
      layout: design.layout,
      photo: design.photo,
      photoUrl: design.photoUrl,
      colourful: templateFamily(design.template) === 'colourful',
      compact: design.template === 'compact',
    },
    sections,
  };
}

/** Display strings a translation may replace. Verified facts are not included. */
export function cvTranslatableFields(doc: ComposedCv): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const section of doc.sections) {
    fields[`h:${section.id}`] = section.title;
    if (section.body) fields[`b:${section.id}`] = section.body;
    for (const item of section.items) {
      if (item.source !== 'self_reported') continue;
      fields[`t:${item.id}`] = item.title;
      if (item.detail) fields[`d:${item.id}`] = item.detail;
    }
  }
  return fields;
}

export function applyCvFields(doc: ComposedCv, fields: Record<string, string>): ComposedCv {
  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      title: fields[`h:${section.id}`]?.trim() || section.title,
      body: section.body ? (fields[`b:${section.id}`]?.trim() || section.body) : '',
      items: section.items.map((item) => {
        if (item.source === 'verified') return item;
        return {
          ...item,
          title: fields[`t:${item.id}`]?.trim() || item.title,
          detail: item.detail ? (fields[`d:${item.id}`]?.trim() || item.detail) : '',
        };
      }),
    })),
  };
}

function pdfEscape(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, ' ').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function rgb(hex: string): [number, number, number] {
  const raw = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#1A3C34';
  return [
    parseInt(raw.slice(1, 3), 16) / 255,
    parseInt(raw.slice(3, 5), 16) / 255,
    parseInt(raw.slice(5, 7), 16) / 255,
  ];
}

function wrap(value: string, width: number): string[] {
  const clean = value.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const out: string[] = [];
  let rest = clean;
  const size = Math.max(18, width);
  while (rest.length > size && out.length < 8) {
    let cut = rest.lastIndexOf(' ', size);
    if (cut < 10) cut = size;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest.slice(0, size));
  return out;
}

function pdfStream(doc: ComposedCv): string[] {
  const page = PAGE[doc.pageSize];
  const accent = rgb(doc.theme.accent);
  const ink = doc.theme.colourful ? '1 1 1 rg' : '0 0 0 rg';
  const margin = doc.theme.compact ? 28 : 42;
  const columns = doc.theme.layout === 'two' ? 2 : 1;
  const gutter = 18;
  const colWidth = columns === 2 ? (page.w - margin * 2 - gutter) / 2 : page.w - margin * 2;
  const chars = Math.max(22, Math.floor(colWidth / (doc.theme.compact ? 5.2 : 5.8)));
  const header = (yTop: number): string[] => {
    const commands = [`${accent.map((part) => part.toFixed(3)).join(' ')} rg`];
    if (doc.theme.colourful) commands.push(`0 ${yTop - 56} ${page.w} 56 re f`);
    else commands.push(`${margin} ${yTop - 28} ${page.w - margin * 2} 1.2 re f`);
    commands.push(ink);
    commands.push(`BT /F1 ${doc.theme.compact ? 14 : 16} Tf ${margin} ${yTop - (doc.theme.colourful ? 34 : 18)} Td (${pdfEscape(doc.name)}) Tj ET`);
    if (doc.theme.photo) {
      const box = doc.theme.colourful ? yTop - 48 : yTop - 46;
      commands.push('0.9 0.9 0.9 rg');
      commands.push(`${page.w - margin - 36} ${box} 36 36 re f`);
      commands.push('0 0 0 rg');
      commands.push(`BT /F1 11 Tf ${page.w - margin - 26} ${box + 13} Td (${pdfEscape(doc.initials)}) Tj ET`);
    }
    return commands;
  };
  const blocks: string[][] = [];
  for (const section of doc.sections) {
    const lines = [section.title.toUpperCase()];
    if (section.body) lines.push(...wrap(section.body, chars));
    for (const item of section.items) {
      const when = item.when ? ` · ${item.when}` : '';
      const detail = item.detail ? ` — ${item.detail}` : '';
      lines.push(...wrap(`${item.title}${detail}${when} · ${item.label}`, chars));
    }
    blocks.push(lines);
  }
  const columnsOf: string[][][] = columns === 2
    ? [blocks.filter((_, index) => index % 2 === 0), blocks.filter((_, index) => index % 2 === 1)]
    : [blocks];
  const pages: string[][] = [header(page.h)];
  const cursors = columnsOf.map(() => page.h - (doc.theme.colourful ? 78 : 52));
  const pageIndex = columnsOf.map(() => 0);
  columnsOf.forEach((column, columnIndex) => {
    const x = margin + columnIndex * (colWidth + gutter);
    for (const block of column) {
      block.forEach((line, lineIndex) => {
        if (cursors[columnIndex]! < 40) {
          pageIndex[columnIndex] = (pageIndex[columnIndex] ?? 0) + 1;
          if (!pages[pageIndex[columnIndex]!]) pages[pageIndex[columnIndex]!] = header(page.h);
          cursors[columnIndex] = page.h - (doc.theme.colourful ? 78 : 52);
        }
        const size = lineIndex === 0 ? (doc.theme.compact ? 10 : 11) : (doc.theme.compact ? 8 : 9);
        const y = cursors[columnIndex] ?? 40;
        const target = pages[pageIndex[columnIndex] ?? 0] ?? pages[0]!;
        target.push('0 0 0 rg');
        target.push(`BT /F1 ${size} Tf ${Math.round(x)} ${Math.round(y)} Td (${pdfEscape(line).slice(0, 110)}) Tj ET`);
        cursors[columnIndex] = y - (size + 5);
      });
      cursors[columnIndex] = (cursors[columnIndex] ?? 40) - 8;
    }
  });
  return pages.filter((commands) => commands.length).map((commands) => commands.join('\n'));
}

export function cvDocumentPdf(doc: ComposedCv): Uint8Array {
  const page = PAGE[doc.pageSize];
  const streams = pdfStream(doc).slice(0, 3);
  const objects: string[] = [];
  const pageIds: number[] = [];
  let nextId = 4;
  const fontId = 3;
  const contents: { id: number; body: string }[] = [];
  for (const body of streams) {
    const id = nextId++;
    contents.push({ id, body });
    pageIds.push(nextId++);
  }
  objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
  objects.push(`2 0 obj << /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >> endobj`);
  objects.push(`${fontId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /${PDF_FONT[doc.theme.font]} >> endobj`);
  contents.forEach((item, index) => {
    objects.push(`${item.id} 0 obj << /Length ${item.body.length} >> stream\n${item.body}\nendstream endobj`);
    const pageId = pageIds[index];
    objects.push(`${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.w} ${page.h}] /Contents ${item.id} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >> endobj`);
  });
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += `${object}\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}

export function cvPlainLines(doc: ComposedCv): string[] {
  const lines = [doc.name];
  for (const section of doc.sections) {
    lines.push(section.title);
    if (section.body) lines.push(section.body);
    for (const item of section.items) {
      const when = item.when ? ` · ${item.when}` : '';
      const detail = item.detail ? ` — ${item.detail}` : '';
      lines.push(`${item.title}${detail}${when} · ${item.label}`);
    }
  }
  return lines;
}
