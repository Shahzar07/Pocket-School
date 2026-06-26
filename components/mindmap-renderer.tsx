'use client';

import React, { useMemo, useState } from 'react';

/* ─── Types ───────────────────────────────────────────────── */

interface MindmapNode {
  label: string;
  children: MindmapNode[];
}

interface MindmapRendererProps {
  content: string;
  dark?: boolean;
}

/* ─── Branch colors ────────────────────────────────────────── */

const BRANCH_COLORS = [
  { bg: 'from-blue-500 to-indigo-600', border: 'border-blue-400', text: 'text-blue-50', line: 'bg-blue-400', lightBg: 'from-blue-50 to-indigo-50', lightBorder: 'border-blue-300', lightText: 'text-blue-900', lightLine: 'bg-blue-300' },
  { bg: 'from-emerald-500 to-teal-600', border: 'border-emerald-400', text: 'text-emerald-50', line: 'bg-emerald-400', lightBg: 'from-emerald-50 to-teal-50', lightBorder: 'border-emerald-300', lightText: 'text-emerald-900', lightLine: 'bg-emerald-300' },
  { bg: 'from-violet-500 to-purple-600', border: 'border-violet-400', text: 'text-violet-50', line: 'bg-violet-400', lightBg: 'from-violet-50 to-purple-50', lightBorder: 'border-violet-300', lightText: 'text-violet-900', lightLine: 'bg-violet-300' },
  { bg: 'from-amber-500 to-orange-600', border: 'border-amber-400', text: 'text-amber-50', line: 'bg-amber-400', lightBg: 'from-amber-50 to-orange-50', lightBorder: 'border-amber-300', lightText: 'text-amber-900', lightLine: 'bg-amber-300' },
  { bg: 'from-rose-500 to-pink-600', border: 'border-rose-400', text: 'text-rose-50', line: 'bg-rose-400', lightBg: 'from-rose-50 to-pink-50', lightBorder: 'border-rose-300', lightText: 'text-rose-900', lightLine: 'bg-rose-300' },
  { bg: 'from-cyan-500 to-blue-600', border: 'border-cyan-400', text: 'text-cyan-50', line: 'bg-cyan-400', lightBg: 'from-cyan-50 to-blue-50', lightBorder: 'border-cyan-300', lightText: 'text-cyan-900', lightLine: 'bg-cyan-300' },
  { bg: 'from-fuchsia-500 to-pink-600', border: 'border-fuchsia-400', text: 'text-fuchsia-50', line: 'bg-fuchsia-400', lightBg: 'from-fuchsia-50 to-pink-50', lightBorder: 'border-fuchsia-300', lightText: 'text-fuchsia-900', lightLine: 'bg-fuchsia-300' },
  { bg: 'from-lime-500 to-green-600', border: 'border-lime-400', text: 'text-lime-50', line: 'bg-lime-400', lightBg: 'from-lime-50 to-green-50', lightBorder: 'border-lime-300', lightText: 'text-lime-900', lightLine: 'bg-lime-300' },
];

/* ─── Markdown parser ──────────────────────────────────────── */

function parseMindmapMarkdown(md: string): MindmapNode {
  const lines = md.split('\n').filter((l) => l.trim());

  // Find the root: first heading or first non-empty line
  let rootLabel = 'Mind Map';
  let startIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^#{1,6}\s+(.+)/);
    if (headingMatch) {
      rootLabel = headingMatch[1].replace(/\*\*/g, '').trim();
      startIdx = i + 1;
      break;
    }
  }

  const root: MindmapNode = { label: rootLabel, children: [] };

  // Parse remaining lines into tree structure
  // Headings (##, ###, etc.) become branch nodes
  // Bullets (-, *, •) become leaf nodes under the last heading
  // Nested bullets become children of the parent bullet

  interface StackItem {
    node: MindmapNode;
    level: number;
  }

  const stack: StackItem[] = [{ node: root, level: 0 }];

  function getParentAtLevel(level: number): MindmapNode {
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    return stack[stack.length - 1].node;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];

    // Check for heading
    const headingMatch = line.match(/^(#{2,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length; // 2-6
      const label = headingMatch[2].replace(/\*\*/g, '').trim();
      const parent = getParentAtLevel(level);
      const node: MindmapNode = { label, children: [] };
      parent.children.push(node);
      stack.push({ node, level });
      continue;
    }

    // Check for bullet items (-, *, •, numbered)
    const bulletMatch = line.match(/^(\s*)([-*•]|\d+[.)]\s)\s*(.*)/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const label = bulletMatch[3].replace(/\*\*/g, '').replace(/\*/g, '').trim();
      if (!label) continue;

      // Determine nesting level based on indent (each 2 spaces = 1 level deeper)
      const bulletLevel = 100 + Math.floor(indent / 2); // offset to avoid collision with heading levels

      const parent = getParentAtLevel(bulletLevel);
      const node: MindmapNode = { label, children: [] };
      parent.children.push(node);
      stack.push({ node, level: bulletLevel });
      continue;
    }

    // Plain text line — treat as a leaf under current parent
    const trimmed = line.replace(/\*\*/g, '').replace(/\*/g, '').trim();
    if (trimmed && !trimmed.match(/^---+$/) && !trimmed.match(/^===+$/)) {
      const parent = stack[stack.length - 1].node;
      parent.children.push({ label: trimmed, children: [] });
    }
  }

  return root;
}

/* ─── Leaf node component ──────────────────────────────────── */

function LeafNode({ label, dark, colorIdx }: { label: string; dark: boolean; colorIdx: number }) {
  const color = BRANCH_COLORS[colorIdx % BRANCH_COLORS.length];
  return (
    <div
      className={`relative px-3 py-1.5 rounded-lg text-xs font-medium leading-snug max-w-[200px] border ${
        dark
          ? `bg-white/[0.04] ${color.border}/40 ${color.text}/90`
          : `bg-gradient-to-r ${color.lightBg} ${color.lightBorder} ${color.lightText}`
      }`}
    >
      {label}
    </div>
  );
}

/* ─── Branch node component ────────────────────────────────── */

function BranchNode({
  node,
  dark,
  colorIdx,
  depth,
}: {
  node: MindmapNode;
  dark: boolean;
  colorIdx: number;
  depth: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const color = BRANCH_COLORS[colorIdx % BRANCH_COLORS.length];
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex items-start gap-0">
      {/* Horizontal connector line */}
      <div className={`w-6 h-px mt-4 shrink-0 ${dark ? color.line : color.lightLine}`} />

      <div className="flex items-start gap-0">
        {/* The node itself */}
        <button
          onClick={() => hasChildren && setCollapsed(!collapsed)}
          className={`relative shrink-0 px-3 py-1.5 rounded-xl text-sm font-semibold leading-snug border transition-all ${
            hasChildren ? 'cursor-pointer hover:scale-105' : 'cursor-default'
          } ${
            depth === 1
              ? dark
                ? `bg-gradient-to-r ${color.bg} ${color.border} ${color.text} shadow-lg shadow-${color.border}/20`
                : `bg-gradient-to-r ${color.bg} ${color.border} text-white shadow-md`
              : dark
                ? `bg-white/[0.06] ${color.border}/50 ${color.text}/90`
                : `bg-gradient-to-r ${color.lightBg} ${color.lightBorder} ${color.lightText}`
          }`}
          style={{ maxWidth: depth === 1 ? 220 : 200 }}
        >
          {node.label}
          {hasChildren && (
            <span className={`ml-1.5 text-[10px] opacity-60`}>
              {collapsed ? `+${node.children.length}` : ''}
            </span>
          )}
        </button>

        {/* Children with vertical connector */}
        {hasChildren && !collapsed && (
          <div className="flex items-start gap-0">
            {/* Vertical connector */}
            <div className="relative flex flex-col items-start">
              <div
                className={`absolute left-0 w-px ${dark ? color.line : color.lightLine}`}
                style={{
                  top: node.children.length > 1 ? '16px' : '0',
                  height: node.children.length > 1 ? `calc(100% - 32px)` : '0',
                }}
              />
              <div className="flex flex-col gap-1.5">
                {node.children.map((child, i) => (
                  <div key={i}>
                    {child.children.length > 0 ? (
                      <BranchNode
                        node={child}
                        dark={dark}
                        colorIdx={colorIdx}
                        depth={depth + 1}
                      />
                    ) : (
                      <div className="flex items-center gap-0">
                        <div className={`w-6 h-px ${dark ? color.line : color.lightLine}`} />
                        <LeafNode label={child.label} dark={dark} colorIdx={colorIdx} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main renderer ────────────────────────────────────────── */

export function MindmapRenderer({ content, dark = false }: MindmapRendererProps) {
  const tree = useMemo(() => parseMindmapMarkdown(content), [content]);

  if (!content.trim()) {
    return (
      <p className={`text-sm italic ${dark ? 'text-slate-500' : 'text-muted-foreground'}`}>
        No mind map content available.
      </p>
    );
  }

  return (
    <div
      className={`w-full overflow-x-auto rounded-2xl p-6 sm:p-8 ${
        dark
          ? 'bg-gradient-to-br from-[#0B0F1A] to-[#070A14] border border-white/10'
          : 'bg-gradient-to-br from-slate-50 to-white border border-border'
      }`}
    >
      {/* Title */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
          dark ? 'bg-gradient-to-br from-fuchsia-500 to-pink-600' : 'bg-gradient-to-br from-fuchsia-500 to-pink-600'
        }`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        </div>
        <h3 className={`font-bold text-lg ${dark ? 'text-white' : 'text-foreground'}`}>
          Mind Map
        </h3>
      </div>

      {/* Tree diagram */}
      <div className="flex items-start gap-0 min-w-fit">
        {/* Central root node */}
        <div className={`shrink-0 px-5 py-3 rounded-2xl font-bold text-base border-2 shadow-xl ${
          dark
            ? 'bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 border-violet-400/50 text-white shadow-violet-500/20'
            : 'bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 border-violet-300 text-white shadow-violet-200'
        }`} style={{ maxWidth: 260 }}>
          {tree.label}
        </div>

        {/* Branches */}
        {tree.children.length > 0 && (
          <div className="flex items-start gap-0">
            {/* Vertical trunk line */}
            <div className="relative flex flex-col items-start">
              {tree.children.length > 1 && (
                <div
                  className={`absolute left-0 w-px ${dark ? 'bg-violet-400/50' : 'bg-violet-300/70'}`}
                  style={{
                    top: '16px',
                    height: `calc(100% - 32px)`,
                  }}
                />
              )}
              <div className="flex flex-col gap-2">
                {tree.children.map((child, i) => (
                  <BranchNode
                    key={i}
                    node={child}
                    dark={dark}
                    colorIdx={i}
                    depth={1}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend / instructions */}
      <p className={`text-[10px] mt-6 ${dark ? 'text-slate-500' : 'text-muted-foreground'}`}>
        Click any branch node to expand or collapse it.
      </p>
    </div>
  );
}
