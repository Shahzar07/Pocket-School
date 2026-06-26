'use client';

import React, { useMemo } from 'react';

/* ─── Types ───────────────────────────────────────────────── */

interface InfographicRendererProps {
  content: string;
  dark?: boolean;
}

type BlockType = 'heading' | 'blockquote' | 'stat' | 'list' | 'hr' | 'paragraph';

interface Block {
  type: BlockType;
  text: string;
  items?: string[];
  level?: number; // heading level
}

/* ─── Section gradients ────────────────────────────────────── */

const SECTION_COLORS = [
  { gradient: 'from-blue-500 to-indigo-600', accent: 'border-blue-500', bg: 'bg-blue-500/10', pill: 'from-blue-500 to-indigo-600', lightBg: 'bg-blue-50', lightAccent: 'border-blue-400', lightPill: 'from-blue-500 to-indigo-600' },
  { gradient: 'from-emerald-500 to-teal-600', accent: 'border-emerald-500', bg: 'bg-emerald-500/10', pill: 'from-emerald-500 to-teal-600', lightBg: 'bg-emerald-50', lightAccent: 'border-emerald-400', lightPill: 'from-emerald-500 to-teal-600' },
  { gradient: 'from-violet-500 to-purple-600', accent: 'border-violet-500', bg: 'bg-violet-500/10', pill: 'from-violet-500 to-purple-600', lightBg: 'bg-violet-50', lightAccent: 'border-violet-400', lightPill: 'from-violet-500 to-purple-600' },
  { gradient: 'from-amber-500 to-orange-600', accent: 'border-amber-500', bg: 'bg-amber-500/10', pill: 'from-amber-500 to-orange-600', lightBg: 'bg-amber-50', lightAccent: 'border-amber-400', lightPill: 'from-amber-500 to-orange-600' },
  { gradient: 'from-rose-500 to-pink-600', accent: 'border-rose-500', bg: 'bg-rose-500/10', pill: 'from-rose-500 to-pink-600', lightBg: 'bg-rose-50', lightAccent: 'border-rose-400', lightPill: 'from-rose-500 to-pink-600' },
  { gradient: 'from-cyan-500 to-blue-600', accent: 'border-cyan-500', bg: 'bg-cyan-500/10', pill: 'from-cyan-500 to-blue-600', lightBg: 'bg-cyan-50', lightAccent: 'border-cyan-400', lightPill: 'from-cyan-500 to-blue-600' },
  { gradient: 'from-fuchsia-500 to-pink-600', accent: 'border-fuchsia-500', bg: 'bg-fuchsia-500/10', pill: 'from-fuchsia-500 to-pink-600', lightBg: 'bg-fuchsia-50', lightAccent: 'border-fuchsia-400', lightPill: 'from-fuchsia-500 to-pink-600' },
  { gradient: 'from-teal-500 to-cyan-600', accent: 'border-teal-500', bg: 'bg-teal-500/10', pill: 'from-teal-500 to-cyan-600', lightBg: 'bg-teal-50', lightAccent: 'border-teal-400', lightPill: 'from-teal-500 to-cyan-600' },
];

/* ─── Icon SVGs ────────────────────────────────────────────── */

const BULLET_ICONS = [
  // Checkmark
  <svg key="check" xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>,
  // Star
  <svg key="star" xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
  // Arrow right
  <svg key="arrow" xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>,
  // Lightning
  <svg key="bolt" xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" /></svg>,
  // Diamond
  <svg key="diamond" xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l10 10-10 10L2 12 12 2z" /></svg>,
];

/* ─── Markdown parser ──────────────────────────────────────── */

function parseInfographicMarkdown(md: string): Block[] {
  const lines = md.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Horizontal rule
    if (/^(\s*[-*_]\s*){3,}$/.test(line.trim()) || /^---+$/.test(line.trim())) {
      blocks.push({ type: 'hr', text: '' });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        text: headingMatch[2].replace(/\*\*/g, '').trim(),
        level: headingMatch[1].length,
      });
      i++;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith('>')) {
      let quoteText = '';
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteText += lines[i].replace(/^>\s*/, '').trim() + ' ';
        i++;
      }
      blocks.push({ type: 'blockquote', text: quoteText.trim() });
      continue;
    }

    // List
    const bulletMatch = line.match(/^\s*([-*•]|\d+[.)]\s)\s*(.*)/);
    if (bulletMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const bm = lines[i].match(/^\s*([-*•]|\d+[.)]\s)\s*(.*)/);
        if (!bm) break;
        const itemText = bm[2].trim();
        if (itemText) items.push(itemText);
        i++;
      }
      if (items.length > 0) {
        blocks.push({ type: 'list', text: '', items });
      }
      continue;
    }

    // Check if the line is a stat (contains bold numbers/percentages)
    const statMatch = line.match(/\*\*([^*]*\d+[^*]*)\*\*/);
    if (statMatch && line.trim()) {
      blocks.push({ type: 'stat', text: line.replace(/\*\*/g, '').trim() });
      i++;
      continue;
    }

    // Regular paragraph
    if (line.trim()) {
      let paraText = '';
      while (i < lines.length && lines[i].trim() && !lines[i].match(/^#{1,6}\s/) && !lines[i].trim().startsWith('>') && !lines[i].match(/^\s*([-*•]|\d+[.)]\s)/) && !/^(\s*[-*_]\s*){3,}$/.test(lines[i].trim())) {
        paraText += lines[i].trim() + ' ';
        i++;
      }
      blocks.push({ type: 'paragraph', text: paraText.replace(/\*\*/g, '').replace(/\*/g, '').trim() });
      continue;
    }

    i++;
  }

  return blocks;
}

/* ─── Extract stat numbers for highlighting ────────────────── */

function renderStatText(text: string, dark: boolean, colorIdx: number) {
  const color = SECTION_COLORS[colorIdx % SECTION_COLORS.length];
  // Find numbers (with %, $, etc.) in the text and highlight them
  const parts = text.split(/(\d[\d,]*\.?\d*\s*[%$£€]?|[%$£€]\s*\d[\d,]*\.?\d*)/g);

  return parts.map((part, i) => {
    if (/\d/.test(part)) {
      return (
        <span
          key={i}
          className={`inline-block px-3 py-0.5 rounded-full font-bold text-white bg-gradient-to-r ${
            dark ? color.pill : color.lightPill
          } text-lg mx-1`}
        >
          {part.trim()}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* ─── Inline bold rendering ────────────────────────────────── */

function renderInlineMarkdown(text: string) {
  // Handle **bold** markers
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-bold">{part}</strong> : <span key={i}>{part}</span>
  );
}

/* ─── Block renderers ──────────────────────────────────────── */

function HeadingBlock({ block, sectionNum, dark, colorIdx }: { block: Block; sectionNum: number; dark: boolean; colorIdx: number }) {
  const color = SECTION_COLORS[colorIdx % SECTION_COLORS.length];
  const isTitle = block.level === 1;

  if (isTitle) {
    return (
      <div className="text-center mb-6">
        <h2 className={`text-2xl sm:text-3xl font-bold ${dark ? 'text-white' : 'text-foreground'}`}>
          {block.text}
        </h2>
        <div className={`mt-3 mx-auto w-24 h-1 rounded-full bg-gradient-to-r ${color.gradient}`} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 mb-4 mt-8">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
        <span className="text-white font-bold text-sm">{sectionNum > 0 ? sectionNum : '#'}</span>
      </div>
      <div className="flex-1">
        <h3 className={`text-lg sm:text-xl font-bold ${dark ? 'text-white' : 'text-foreground'}`}>
          {block.text}
        </h3>
        <div className={`mt-1.5 w-12 h-0.5 rounded-full bg-gradient-to-r ${color.gradient}`} />
      </div>
    </div>
  );
}

function BlockquoteBlock({ block, dark, colorIdx }: { block: Block; dark: boolean; colorIdx: number }) {
  const color = SECTION_COLORS[colorIdx % SECTION_COLORS.length];
  return (
    <div className={`relative rounded-xl p-4 my-3 border-l-4 ${
      dark
        ? `${color.accent} bg-white/[0.03]`
        : `${color.lightAccent} ${color.lightBg}`
    }`}>
      <div className={`absolute top-3 right-3 text-3xl opacity-10 ${dark ? 'text-white' : 'text-slate-900'}`}>
        &ldquo;
      </div>
      <p className={`text-sm leading-relaxed italic ${dark ? 'text-slate-300' : 'text-foreground/80'}`}>
        {renderInlineMarkdown(block.text)}
      </p>
    </div>
  );
}

function StatBlock({ block, dark, colorIdx }: { block: Block; dark: boolean; colorIdx: number }) {
  return (
    <div className={`rounded-xl p-4 my-3 text-center ${
      dark ? 'bg-white/[0.04] border border-white/10' : 'bg-slate-50 border border-border'
    }`}>
      <p className={`text-sm leading-relaxed font-medium ${dark ? 'text-slate-200' : 'text-foreground'}`}>
        {renderStatText(block.text, dark, colorIdx)}
      </p>
    </div>
  );
}

function ListBlock({ block, dark, colorIdx }: { block: Block; dark: boolean; colorIdx: number }) {
  const color = SECTION_COLORS[colorIdx % SECTION_COLORS.length];
  const icon = BULLET_ICONS[colorIdx % BULLET_ICONS.length];

  return (
    <div className="space-y-2 my-3">
      {block.items?.map((item, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-xl px-4 py-2.5 transition-colors ${
            dark
              ? 'bg-white/[0.03] hover:bg-white/[0.06]'
              : 'bg-slate-50/80 hover:bg-slate-100'
          }`}
        >
          <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${color.gradient} flex items-center justify-center shrink-0 mt-0.5`}>
            <span className="text-white">{icon}</span>
          </div>
          <p className={`text-sm leading-relaxed ${dark ? 'text-slate-300' : 'text-foreground/80'}`}>
            {renderInlineMarkdown(item)}
          </p>
        </div>
      ))}
    </div>
  );
}

function HrBlock({ dark, colorIdx }: { dark: boolean; colorIdx: number }) {
  const color = SECTION_COLORS[colorIdx % SECTION_COLORS.length];
  return (
    <div className="flex items-center gap-3 my-6">
      <div className={`flex-1 h-px ${dark ? 'bg-white/10' : 'bg-border'}`} />
      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${color.gradient}`} />
      <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${color.gradient} opacity-60`} />
      <div className={`w-1 h-1 rounded-full bg-gradient-to-r ${color.gradient} opacity-30`} />
      <div className={`flex-1 h-px ${dark ? 'bg-white/10' : 'bg-border'}`} />
    </div>
  );
}

function ParagraphBlock({ block, dark }: { block: Block; dark: boolean }) {
  return (
    <p className={`text-sm leading-relaxed my-2 ${dark ? 'text-slate-300' : 'text-foreground/80'}`}>
      {renderInlineMarkdown(block.text)}
    </p>
  );
}

/* ─── Main renderer ────────────────────────────────────────── */

export function InfographicRenderer({ content, dark = false }: InfographicRendererProps) {
  const blocks = useMemo(() => parseInfographicMarkdown(content), [content]);

  if (!content.trim()) {
    return (
      <p className={`text-sm italic ${dark ? 'text-slate-500' : 'text-muted-foreground'}`}>
        No infographic content available.
      </p>
    );
  }

  // Track section numbers for headings
  let sectionCount = 0;
  let currentColorIdx = 0;

  return (
    <div
      className={`w-full rounded-2xl p-6 sm:p-8 ${
        dark
          ? 'bg-gradient-to-br from-[#0B0F1A] to-[#070A14] border border-white/10'
          : 'bg-gradient-to-br from-white to-slate-50 border border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 0 0 1.5-1.5V5.25a1.5 1.5 0 0 0-1.5-1.5H3.75a1.5 1.5 0 0 0-1.5 1.5v14.25a1.5 1.5 0 0 0 1.5 1.5Z" />
          </svg>
        </div>
        <h3 className={`font-bold text-lg ${dark ? 'text-white' : 'text-foreground'}`}>
          Infographic
        </h3>
      </div>

      {/* Blocks */}
      <div className="space-y-1">
        {blocks.map((block, i) => {
          if (block.type === 'heading') {
            if (block.level && block.level > 1) {
              sectionCount++;
              currentColorIdx = (sectionCount - 1) % SECTION_COLORS.length;
            }
            return (
              <HeadingBlock
                key={i}
                block={block}
                sectionNum={sectionCount}
                dark={dark}
                colorIdx={currentColorIdx}
              />
            );
          }
          if (block.type === 'blockquote') {
            return <BlockquoteBlock key={i} block={block} dark={dark} colorIdx={currentColorIdx} />;
          }
          if (block.type === 'stat') {
            return <StatBlock key={i} block={block} dark={dark} colorIdx={currentColorIdx} />;
          }
          if (block.type === 'list') {
            return <ListBlock key={i} block={block} dark={dark} colorIdx={currentColorIdx} />;
          }
          if (block.type === 'hr') {
            return <HrBlock key={i} dark={dark} colorIdx={currentColorIdx} />;
          }
          return <ParagraphBlock key={i} block={block} dark={dark} />;
        })}
      </div>
    </div>
  );
}
