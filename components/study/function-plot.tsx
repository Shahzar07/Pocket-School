'use client';

/**
 * Interactive function graph: drag to pan, scroll or pinch-buttons to zoom,
 * hover for exact values. Breaks the curve at asymptotes instead of drawing
 * a vertical line through them, and picks a sensible y-range automatically.
 */

import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { compileFn, exprToTex, type CompiledFn } from '@/lib/study/math-expr';
import { MathMarkdown } from '@/components/math-markdown';

export const SERIES_COLORS = ['#2786A4', '#E8A33D', '#8B5CF6', '#E5484D', '#30A46C'];

export interface PlotPoint { x: number; y: number; label?: string }

interface Props {
  functions: string[];
  points?: PlotPoint[];
  xMin?: number;
  xMax?: number;
  height?: number;
  /** Show the legend with each expression. */
  legend?: boolean;
  className?: string;
}

const W = 640;

function niceStep(range: number, target = 8) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

function fmt(v: number) {
  if (Math.abs(v) < 1e-10) return '0';
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return v.toExponential(1);
  return String(Math.round(v * 1000) / 1000);
}

export function FunctionPlot({ functions, points = [], xMin = -10, xMax = 10, height = 360, legend = true, className = '' }: Props) {
  const H = height;
  // Callers often pass a fresh array each render. Key on the content, or the
  // view resets every render and the reset re-renders the caller — a loop.
  const fnKey = functions.join('\u0001');
  const ptKey = JSON.stringify(points);
  const stableFns = useMemo(() => fnKey.split('\u0001'), [fnKey]);
  const stablePts = useMemo(() => JSON.parse(ptKey) as PlotPoint[], [ptKey]);
  const compiled = useMemo(() => {
    const out: { c: CompiledFn | null; error?: string; color: string; src: string }[] = [];
    stableFns.forEach((f, i) => {
      if (!f.trim()) return;
      try { out.push({ c: compileFn(f), color: SERIES_COLORS[i % SERIES_COLORS.length], src: f }); }
      catch (e) { out.push({ c: null, error: e instanceof Error ? e.message : 'Invalid', color: SERIES_COLORS[i % SERIES_COLORS.length], src: f }); }
    });
    return out;
  }, [stableFns]);

  const autoY = useCallback((x0: number, x1: number) => {
    const ys: number[] = [];
    for (const { c } of compiled) {
      if (!c) continue;
      for (let i = 0; i <= 200; i++) {
        const y = c.fn(x0 + ((x1 - x0) * i) / 200);
        if (Number.isFinite(y)) ys.push(y);
      }
    }
    for (const p of stablePts) ys.push(p.y);
    if (!ys.length) return [-10, 10] as const;
    ys.sort((a, b) => a - b);
    // Trim the extremes so an asymptote doesn't flatten the whole graph.
    let lo = ys[Math.floor(ys.length * 0.04)], hi = ys[Math.ceil(ys.length * 0.96) - 1];
    if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.15;
    lo -= pad; hi += pad;
    // Keep the x-axis in view when it is close.
    if (lo > 0 && lo < (hi - lo) * 0.6) lo = -(hi - lo) * 0.05;
    if (hi < 0 && -hi < (hi - lo) * 0.6) hi = (hi - lo) * 0.05;
    return [lo, hi] as const;
  }, [compiled, stablePts]);

  const initial = useMemo(() => {
    const [y0, y1] = autoY(xMin, xMax);
    return { x0: xMin, x1: xMax, y0, y1 };
  }, [autoY, xMin, xMax]);

  const [view, setView] = useState(initial);
  useEffect(() => setView(initial), [initial]);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ px: number; py: number; v: typeof view } | null>(null);

  const sx = (x: number) => ((x - view.x0) / (view.x1 - view.x0)) * W;
  const sy = (y: number) => H - ((y - view.y0) / (view.y1 - view.y0)) * H;
  const toData = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: view.x0 + ((clientX - r.left) / r.width) * (view.x1 - view.x0),
      y: view.y1 - ((clientY - r.top) / r.height) * (view.y1 - view.y0),
    };
  };

  const paths = useMemo(() => compiled.map(({ c }) => {
    if (!c) return '';
    const n = 600;
    let d = '';
    let pen = false;
    let prevY = NaN;
    const yr = view.y1 - view.y0;
    for (let i = 0; i <= n; i++) {
      const x = view.x0 + ((view.x1 - view.x0) * i) / n;
      const y = c.fn(x);
      // Lift the pen on undefined values and on asymptote-sized jumps.
      if (!Number.isFinite(y) || (Number.isFinite(prevY) && Math.abs(y - prevY) > yr * 3)) { pen = false; prevY = y; continue; }
      const X = ((x - view.x0) / (view.x1 - view.x0)) * W;
      const Y = Math.max(-H * 4, Math.min(H * 5, H - ((y - view.y0) / yr) * H));
      d += `${pen ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)}`;
      pen = true;
      prevY = y;
    }
    return d;
  }), [compiled, view, H]);

  const xStep = niceStep(view.x1 - view.x0);
  const yStep = niceStep(view.y1 - view.y0, 6);
  const xTicks: number[] = [];
  for (let v = Math.ceil(view.x0 / xStep) * xStep; v <= view.x1; v += xStep) xTicks.push(v);
  const yTicks: number[] = [];
  for (let v = Math.ceil(view.y0 / yStep) * yStep; v <= view.y1; v += yStep) yTicks.push(v);

  const zoom = (f: number, cx?: number, cy?: number) => setView(v => {
    const mx = cx ?? (v.x0 + v.x1) / 2, my = cy ?? (v.y0 + v.y1) / 2;
    return { x0: mx + (v.x0 - mx) * f, x1: mx + (v.x1 - mx) * f, y0: my + (v.y0 - my) * f, y1: my + (v.y1 - my) * f };
  });

  const onWheel = (e: React.WheelEvent) => {
    const p = toData(e.clientX, e.clientY);
    zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y);
  };

  // Wheel zoom must not scroll the page underneath.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', stop, { passive: false });
    return () => el.removeEventListener('wheel', stop);
  }, []);

  const axisX = view.y0 <= 0 && view.y1 >= 0 ? sy(0) : null;
  const axisY = view.x0 <= 0 && view.x1 >= 0 ? sx(0) : null;

  return (
    <div className={`rounded-2xl border border-border bg-card overflow-hidden ${className}`}>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full block touch-none select-none cursor-crosshair"
          style={{ aspectRatio: `${W} / ${H}` }}
          onWheel={onWheel}
          onPointerDown={e => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { px: e.clientX, py: e.clientY, v: view }; }}
          onPointerUp={() => { drag.current = null; }}
          onPointerLeave={() => { drag.current = null; setHover(null); }}
          onPointerMove={e => {
            const r = svgRef.current!.getBoundingClientRect();
            if (drag.current) {
              const { px, py, v } = drag.current;
              const dx = ((e.clientX - px) / r.width) * (v.x1 - v.x0);
              const dy = ((e.clientY - py) / r.height) * (v.y1 - v.y0);
              setView({ x0: v.x0 - dx, x1: v.x1 - dx, y0: v.y0 + dy, y1: v.y1 + dy });
            } else setHover(toData(e.clientX, e.clientY).x);
          }}
          role="img"
          aria-label={`Graph of ${functions.join(', ')}`}
        >
          <rect width={W} height={H} fill="var(--card)" />
          {xTicks.map(v => <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={0} y2={H} stroke="var(--border)" strokeWidth={1} />)}
          {yTicks.map(v => <line key={`gy${v}`} y1={sy(v)} y2={sy(v)} x1={0} x2={W} stroke="var(--border)" strokeWidth={1} />)}
          {axisX !== null && <line x1={0} x2={W} y1={axisX} y2={axisX} stroke="var(--muted-foreground)" strokeWidth={1.4} />}
          {axisY !== null && <line y1={0} y2={H} x1={axisY} x2={axisY} stroke="var(--muted-foreground)" strokeWidth={1.4} />}
          {xTicks.map(v => Math.abs(v) > 1e-9 && (
            <text key={`tx${v}`} x={sx(v)} y={Math.min(H - 4, Math.max(12, (axisX ?? H - 6) + 14))} fontSize={11} textAnchor="middle" fill="var(--muted-foreground)">{fmt(v)}</text>
          ))}
          {yTicks.map(v => Math.abs(v) > 1e-9 && (
            <text key={`ty${v}`} x={Math.min(W - 4, Math.max(4, (axisY ?? 4) + 5))} y={sy(v) - 4} fontSize={11} fill="var(--muted-foreground)">{fmt(v)}</text>
          ))}
          {paths.map((d, i) => d && <path key={i} d={d} fill="none" stroke={compiled[i].color} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />)}
          {points.map((p, i) => (
            <g key={`p${i}`}>
              <circle cx={sx(p.x)} cy={sy(p.y)} r={5} fill="var(--card)" stroke="var(--foreground)" strokeWidth={2} />
              {p.label && <text x={sx(p.x) + 8} y={sy(p.y) - 8} fontSize={12} fontWeight={600} fill="var(--foreground)">{p.label}</text>}
            </g>
          ))}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={sx(hover)} x2={sx(hover)} y1={0} y2={H} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
              {compiled.map(({ c, color }, i) => {
                const y = c?.fn(hover);
                if (!c || y === undefined || !Number.isFinite(y)) return null;
                return (
                  <g key={i}>
                    <circle cx={sx(hover)} cy={sy(y)} r={4.5} fill={color} />
                    <text x={sx(hover) + 8} y={sy(y) - 8 + i * 14} fontSize={12} fontWeight={600} fill={color}>({fmt(hover)}, {fmt(y)})</text>
                  </g>
                );
              })}
            </g>
          )}
        </svg>
        <div className="absolute top-2 right-2 flex gap-1">
          {[
            { icon: ZoomIn, on: () => zoom(1 / 1.4), label: 'Zoom in' },
            { icon: ZoomOut, on: () => zoom(1.4), label: 'Zoom out' },
            { icon: Maximize2, on: () => setView(initial), label: 'Reset view' },
          ].map(({ icon: I, on, label }) => (
            <button key={label} onClick={on} title={label} aria-label={label}
              className="w-8 h-8 grid place-items-center rounded-lg bg-card/90 border border-border text-muted-foreground hover:text-foreground shadow-sm">
              <I className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>
      {legend && compiled.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 border-t border-border text-xs">
          {compiled.map(({ src, color, error }, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 font-mono">
              <span className="w-3 h-0.5 rounded" style={{ background: color }} />
              <span className={`[&_p]:my-0 font-sans ${error ? 'text-destructive' : 'text-foreground'}`}>
                {error ? `y = ${src}` : <MathMarkdown>{`$y = ${exprToTex(src)}$`}</MathMarkdown>}
              </span>
              {error && <span className="text-destructive font-sans">— can&apos;t plot</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
