'use client';

import { ACCENT_IDS, ACCENT_PATTERN, accentFillVar, patternId, type AccentId } from '@/lib/design/chart-colours';

/** Hidden pattern tiles. Chart fills reference these ids so each hue also has a texture. */
export function ChartPatternDefs() {
  return (
    <svg aria-hidden className="pointer-events-none absolute h-0 w-0" focusable="false">
      <defs>
        {ACCENT_IDS.map(id => (
          <pattern key={id} id={patternId(id)} width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill={`var(${accentFillVar(id)})`} />
            <PatternMark id={id} />
          </pattern>
        ))}
        <linearGradient id="ps-area-teal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ps-teal)" stopOpacity={0.55} />
          <stop offset="100%" stopColor="var(--ps-teal)" stopOpacity={0.05} />
        </linearGradient>
      </defs>
    </svg>
  );
}

function PatternMark({ id }: { id: AccentId }) {
  const stroke = 'var(--ps-pattern-ink)';
  const kind = ACCENT_PATTERN[id];
  if (kind === 'stripe') {
    return <path d="M-2 2 l4 -4 M0 8 l8 -8 M6 10 l4 -4" stroke={stroke} strokeWidth="1.6" />;
  }
  if (kind === 'dots') {
    return <circle cx="2" cy="2" r="1.3" fill={stroke} />;
  }
  if (kind === 'cross') {
    return <path d="M1 1 l6 6 M7 1 l-6 6" stroke={stroke} strokeWidth="1.2" />;
  }
  if (kind === 'dash') {
    return <path d="M0 4 h8" stroke={stroke} strokeWidth="1.6" />;
  }
  if (kind === 'bars') {
    return <path d="M3 0 v8" stroke={stroke} strokeWidth="1.6" />;
  }
  return null;
}

export function patternFill(id: AccentId): string {
  return `url(#${patternId(id)})`;
}

export function SeriesLegend({ items }: { items: { id: AccentId; label: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
      {items.map(item => (
        <li key={`${item.id}-${item.label}`} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
          <svg width="14" height="14" aria-hidden className="shrink-0">
            <rect width="14" height="14" rx="3" fill={patternFill(item.id)} />
          </svg>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
