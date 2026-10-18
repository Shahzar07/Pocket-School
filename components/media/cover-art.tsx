'use client';

import { useState } from 'react';
import { generateCoverArt } from './generate';
import { COVER_STYLES } from './types';
import type { CoverArtOption, CoverStyleOption } from './types';

/**
 * Several cover or thumbnail pictures from a brief.
 * The pictures do not contain title text. The host draws crisp lettering afterwards
 * if the product needs it (Book Studio does; a course thumbnail may not).
 */
export function CoverArtPicker({
  brief,
  styles = COVER_STYLES,
  lockedStyleId,
  onSelect,
}: {
  brief: string;
  styles?: CoverStyleOption[];
  lockedStyleId?: string;
  onSelect: (option: CoverArtOption) => void;
}) {
  const [styleId, setStyleId] = useState(lockedStyleId || styles[0]?.id || 'novel');
  const [refine, setRefine] = useState('');
  const [options, setOptions] = useState<CoverArtOption[]>([]);
  const [busy, setBusy] = useState(false);
  const activeStyle = lockedStyleId || styleId;

  const run = async () => {
    setBusy(true);
    try {
      setOptions(await generateCoverArt(brief, activeStyle, refine));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {styles.map(style => (
          <button
            key={style.id}
            type="button"
            disabled={Boolean(lockedStyleId) && lockedStyleId !== style.id}
            aria-pressed={activeStyle === style.id}
            onClick={() => setStyleId(style.id)}
            className={`h-9 rounded-full px-3 text-xs font-semibold ${activeStyle === style.id ? 'border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan)] text-[var(--ps-cyan-ink)]' : 'border border-border'} disabled:opacity-40`}
          >
            {style.label}
          </button>
        ))}
      </div>
      <label className="block text-sm font-semibold">
        Refine the picture
        <input value={refine} onChange={event => setRefine(event.target.value)} placeholder="Warmer light, no people, a harbour at dusk" className="mt-1 h-10 w-full rounded-xl border border-border px-3 font-normal" />
      </label>
      <button type="button" onClick={() => void run()} disabled={busy || !brief.trim()} className="h-10 rounded-full border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan)] px-4 text-sm font-bold text-[var(--ps-cyan-ink)] disabled:opacity-40">
        {busy ? 'Generating…' : options.length ? 'Regenerate options' : 'Generate options'}
      </button>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {options.map(option => (
          <li key={option.id}>
            <button type="button" onClick={() => onSelect(option)} className="block w-full overflow-hidden rounded-xl border border-border text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={option.artSrc} alt="" className="aspect-[2/3] w-full object-cover" />
              <span className="block px-2 py-1 text-[11px] font-semibold">{option.fallback ? 'Stand-in' : 'Model'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
