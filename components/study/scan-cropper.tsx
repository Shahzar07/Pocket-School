'use client';

/**
 * Frame the problem before it's read: a draggable crop box over the photo.
 * Cropping to one question gives the vision model far less to misread.
 */

import { useRef, useState } from 'react';
import { RotateCcw, Check, X } from 'lucide-react';
import { cropImage } from '@/lib/study/files';

type Rect = { x: number; y: number; w: number; h: number };
type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

const MIN = 0.06;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function ScanCropper({ image, onDone, onCancel, busy }: {
  image: string;
  onDone: (cropped: string) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [rect, setRect] = useState<Rect>({ x: 0.06, y: 0.18, w: 0.88, h: 0.5 });
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ h: Handle; sx: number; sy: number; r: Rect } | null>(null);

  const start = (h: Handle) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { h, sx: e.clientX, sy: e.clientY, r: rect };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !box.current) return;
    const b = box.current.getBoundingClientRect();
    const dx = (e.clientX - d.sx) / b.width, dy = (e.clientY - d.sy) / b.height;
    const r = { ...d.r };
    if (d.h === 'move') {
      r.x = clamp(d.r.x + dx, 0, 1 - d.r.w);
      r.y = clamp(d.r.y + dy, 0, 1 - d.r.h);
    } else {
      if (d.h.includes('w')) { const nx = clamp(d.r.x + dx, 0, d.r.x + d.r.w - MIN); r.w = d.r.w + (d.r.x - nx); r.x = nx; }
      if (d.h.includes('e')) r.w = clamp(d.r.w + dx, MIN, 1 - d.r.x);
      if (d.h.includes('n')) { const ny = clamp(d.r.y + dy, 0, d.r.y + d.r.h - MIN); r.h = d.r.h + (d.r.y - ny); r.y = ny; }
      if (d.h.includes('s')) r.h = clamp(d.r.h + dy, MIN, 1 - d.r.y);
    }
    setRect(r);
  };

  const pct = (v: number) => `${v * 100}%`;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Drag the box around the one problem you want help with.</p>
      <div
        ref={box}
        className="relative mx-auto w-fit max-w-full rounded-2xl overflow-hidden bg-black select-none touch-none"
        onPointerMove={move}
        onPointerUp={() => { drag.current = null; }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="Your photo" className="block max-h-[60vh] max-w-full object-contain" draggable={false} />
        {/* Dim everything outside the box */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'rgba(0,0,0,0.55)',
          clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${pct(rect.x)} ${pct(rect.y)},${pct(rect.x)} ${pct(rect.y + rect.h)},${pct(rect.x + rect.w)} ${pct(rect.y + rect.h)},${pct(rect.x + rect.w)} ${pct(rect.y)},${pct(rect.x)} ${pct(rect.y)})`,
        }} />
        <div
          className="absolute border-2 border-white rounded-lg cursor-move shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
          style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
          onPointerDown={start('move')}
        >
          {(['nw', 'ne', 'sw', 'se'] as const).map(h => (
            <span
              key={h}
              onPointerDown={start(h)}
              className="absolute w-5 h-5 rounded-full bg-white border-2 border-primary shadow"
              style={{
                left: h.includes('w') ? -10 : undefined, right: h.includes('e') ? -10 : undefined,
                top: h.includes('n') ? -10 : undefined, bottom: h.includes('s') ? -10 : undefined,
                cursor: `${h}-resize`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button onClick={onCancel} disabled={busy}
          className="h-10 px-4 rounded-full border border-border text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-muted disabled:opacity-50">
          <X className="w-4 h-4" /> Cancel
        </button>
        <button onClick={() => setRect({ x: 0, y: 0, w: 1, h: 1 })} disabled={busy}
          className="h-10 px-4 rounded-full border border-border text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-muted disabled:opacity-50">
          <RotateCcw className="w-4 h-4" /> Whole photo
        </button>
        <button
          disabled={busy}
          onClick={async () => onDone(await cropImage(image, rect))}
          className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-60"
        >
          <Check className="w-4 h-4" /> {busy ? 'Reading…' : 'Read this problem'}
        </button>
      </div>
    </div>
  );
}
