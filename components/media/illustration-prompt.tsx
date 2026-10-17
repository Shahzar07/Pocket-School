'use client';

import { useEffect, useRef, useState } from 'react';
import { generateIllustration } from './generate';
import { COVER_STYLES } from './types';
import type { MediaAsset, SparksConfirm } from './types';

/**
 * AI illustration. The model is asked not to draw words.
 * Sparks are confirmed before the request. A host with a real balance can
 * replace the dialog via `confirmSparks`.
 * `defaultPrompt` fills an empty box (the course CMS passes the lesson text)
 * and does not replace a prompt the author has already typed.
 */
export function IllustrationPrompt({
  sparksCost = 5,
  confirmSparks,
  onCreated,
  defaultPrompt = '',
  defaultStyle = COVER_STYLES[4].id,
}: {
  sparksCost?: number;
  confirmSparks?: SparksConfirm;
  onCreated: (asset: MediaAsset, note: string) => void;
  defaultPrompt?: string;
  defaultStyle?: string;
}) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [style, setStyle] = useState(defaultStyle);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const edited = useRef(false);

  useEffect(() => {
    if (!edited.current && defaultPrompt) setPrompt(defaultPrompt);
  }, [defaultPrompt]);

  const confirmThenRun = async () => {
    if (!confirmSparks) return;
    const ok = await confirmSparks({ cost: sparksCost, reason: prompt });
    if (ok) await run();
  };

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const picture = await generateIllustration(prompt, style);
      onCreated({
        id: `ai-${Date.now()}`,
        src: picture.src,
        alt: '',
        width: 800,
        height: 1200,
        caption: '',
      }, picture.fallback ? 'Drawn stand-in. The image model did not return a picture. Add alt text before placing it.' : 'Illustration ready. Add alt text before placing it.');
      setOpen(false);
      setPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Illustration failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border p-3">
      <p className="text-sm font-semibold">AI illustration</p>
      <textarea value={prompt} onChange={event => { edited.current = true; setPrompt(event.target.value); }} rows={3} placeholder="Describe the scene. Do not ask for words in the picture." className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-sm" />
      <label className="mt-2 block text-xs font-semibold">Style
        <select value={style} onChange={event => setStyle(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border px-2 font-normal">
          {COVER_STYLES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <button type="button" disabled={!prompt.trim() || busy} onClick={() => { if (confirmSparks) void confirmThenRun(); else setOpen(true); }} className="mt-3 h-9 rounded-full bg-secondary px-3 text-sm font-bold disabled:opacity-40">
        Generate · {sparksCost} Sparks
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {open && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p>This spends {sparksCost} Sparks to illustrate “{prompt.trim().slice(0, 140)}”.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="h-9 rounded-full border border-amber-300 px-3 font-semibold" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" disabled={busy} className="h-9 rounded-full bg-[#203337] px-3 font-bold text-white" onClick={() => void run()}>{busy ? 'Working…' : 'Confirm spend'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
