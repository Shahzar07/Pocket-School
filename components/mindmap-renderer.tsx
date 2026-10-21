'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { layoutBuzan, parseBuzan } from '@/lib/mindmap';

interface MindmapRendererProps {
  content: string;
  dark?: boolean;
}

function clampScale(value: number): number {
  return Math.min(2.5, Math.max(0.6, value));
}

/**
 * Radial Buzan map. Pinch, wheel, and drag move around the picture.
 * A prose study note is not drawn.
 */
export function MindmapRenderer({ content, dark = false, compact = false }: MindmapRendererProps & { compact?: boolean }) {
  const map = useMemo(() => parseBuzan(content), [content]);
  const layout = useMemo(() => (map ? layoutBuzan(map) : null), [map]);
  const [scale, setScale] = useState(1);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const frame = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 1.08 : 0.92;
      setScale(current => clampScale(current * delta));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [layout]);

  if (!map || !layout) {
    return (
      <p className={`text-sm ${dark ? 'text-slate-300' : 'text-muted-foreground'}`}>
        This mind map needs regenerating.
      </p>
    );
  }

  const movePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const active = [...pointers.current.values()];
    if (active.length >= 2) {
      const [a, b] = active;
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      if (!pinch.current) pinch.current = { distance, scale };
      else setScale(clampScale(pinch.current.scale * (distance / pinch.current.distance)));
      return;
    }
    if (previous && active.length === 1) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      setOrigin(current => ({ x: current.x + dx, y: current.y + dy }));
    }
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const panel = dark ? 'border-white/10 bg-[#1c1915]' : 'border-border bg-[#f7f4ee]';
  const button = dark
    ? 'border-white/15 text-slate-200 hover:bg-white/10'
    : 'border-border bg-white/80 text-foreground hover:bg-white';

  return (
    <div className={`rounded-3xl border ${panel} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <p className={`text-[11px] font-semibold uppercase tracking-widest ${dark ? 'text-slate-400' : 'text-muted-foreground'}`}>
          Mind map
        </p>
        <div className="flex items-center gap-1">
          <button type="button" className={`h-8 w-8 rounded-lg border text-sm ${button}`} onClick={() => setScale(current => clampScale(current * 1.12))} aria-label="Zoom in">+</button>
          <button type="button" className={`h-8 w-8 rounded-lg border text-sm ${button}`} onClick={() => setScale(current => clampScale(current / 1.12))} aria-label="Zoom out">−</button>
          <button type="button" className={`h-8 rounded-lg border px-2 text-[11px] font-medium ${button}`} onClick={() => { setScale(1); setOrigin({ x: 0, y: 0 }); }}>Reset</button>
        </div>
      </div>
      <div
        ref={frame}
        className={`${compact ? 'h-80 max-h-80 min-h-0' : 'h-[70vh] max-h-[820px] min-h-[320px]'} cursor-grab overflow-hidden touch-none`}
        onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        }}
        onPointerMove={movePointer}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={`Mind map of ${layout.center}`}
          className="h-full w-full"
          style={{ transform: `translate(${origin.x}px, ${origin.y}px) scale(${scale})`, transformOrigin: 'center' }}
        >
          <rect width={layout.width} height={layout.height} fill="#f7f4ee" />
          {layout.ribbons.map((ribbon, index) => (
            <g key={`${index}-${ribbon.keyword}`}>
              <path d={ribbon.path} fill={ribbon.color} />
              <text x={ribbon.iconX} y={ribbon.iconY} fontSize="16" textAnchor="middle">{ribbon.icon}</text>
              <text x={ribbon.labelX} y={ribbon.labelY} fontSize={ribbon.depth === 0 ? 16 : 13} fontFamily="sans-serif" fontWeight="700" textAnchor="middle" fill="#1f2933">{ribbon.keyword}</text>
            </g>
          ))}
          <circle cx={layout.centerX} cy={layout.centerY} r="62" fill="#243037" />
          <text x={layout.centerX} y={layout.centerY - 6} fontSize="20" textAnchor="middle">{layout.centerIcon}</text>
          <text x={layout.centerX} y={layout.centerY + 18} fontSize="14" fontFamily="sans-serif" fontWeight="700" textAnchor="middle" fill="#ffffff">{layout.center}</text>
        </svg>
      </div>
      <ul className="sr-only">
        {map.branches.map(branch => (
          <li key={branch.keyword}>
            {branch.keyword}
            {branch.children.length > 0 && (
              <ul>
                {branch.children.map(child => <li key={child.keyword}>{child.keyword}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
