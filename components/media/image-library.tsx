'use client';

import { useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { cropImage, optimiseImage } from './optimise';
import { storeMedia } from './store';
import type { MediaAsset } from './types';

/**
 * Per-document picture library.
 * Drag, drop, or paste a file. Alt text is required before the picture can be placed.
 * Crop is a zoom and a nudge, then a square export.
 */
export function ImageLibrary({
  scopeId,
  images,
  onChange,
  onInsert,
}: {
  scopeId: string;
  images: MediaAsset[];
  onChange: (images: MediaAsset[]) => void;
  onInsert?: (image: MediaAsset) => void;
}) {
  const [error, setError] = useState('');
  const [cropId, setCropId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(0);
  const cropping = images.find(image => image.id === cropId);

  const addFiles = async (files: File[]) => {
    setError('');
    const next = [...images];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const fitted = await optimiseImage(file, 1600);
        const stored = await storeMedia(scopeId, fitted.blob, `${Date.now()}-${file.name || 'image'}.jpg`);
        next.push({
          id: `img-${Date.now()}-${next.length}`,
          src: stored.src,
          alt: '',
          width: fitted.width,
          height: fitted.height,
          storagePath: stored.storagePath,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'That image could not be added.');
      }
    }
    onChange(next);
  };

  return (
    <div
      className="space-y-3"
      onDragOver={event => event.preventDefault()}
      onDrop={event => {
        event.preventDefault();
        void addFiles([...event.dataTransfer.files]);
      }}
      onPaste={event => {
        const files = [...event.clipboardData.files].filter(file => file.type.startsWith('image/'));
        if (files.length) {
          event.preventDefault();
          void addFiles(files);
        }
      }}
    >
      <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-sm font-semibold">
        <ImagePlus className="h-4 w-4" /> Drop, paste, or choose images
        <input type="file" accept="image/*" multiple className="sr-only" onChange={event => { void addFiles([...(event.target.files ?? [])]); event.target.value = ''; }} />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {images.map(image => (
          <li key={image.id} className="rounded-2xl border border-border p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} alt={image.alt || ''} className="aspect-[4/3] w-full rounded-lg object-cover" />
            <label className="mt-2 block text-xs font-semibold">
              Alt text (required)
              <input
                value={image.alt}
                onChange={event => onChange(images.map(item => item.id === image.id ? { ...item, alt: event.target.value } : item))}
                className="mt-1 h-9 w-full rounded-lg border border-border px-2 font-normal"
              />
            </label>
            <label className="mt-2 block text-xs font-semibold">
              Caption
              <input
                value={image.caption ?? ''}
                onChange={event => onChange(images.map(item => item.id === image.id ? { ...item, caption: event.target.value } : item))}
                className="mt-1 h-9 w-full rounded-lg border border-border px-2 font-normal"
              />
            </label>
            <label className="mt-2 flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={Boolean(image.fullBleed)} onChange={event => onChange(images.map(item => item.id === image.id ? { ...item, fullBleed: event.target.checked } : item))} />
              Full-page illustration
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="h-8 rounded-full border border-border px-3 text-xs font-semibold" onClick={() => { setCropId(image.id); setZoom(1); setOffset(0); }}>Crop</button>
              <button
                type="button"
                disabled={!image.alt.trim()}
                className="h-8 rounded-full bg-[#203337] px-3 text-xs font-bold text-white disabled:opacity-40"
                onClick={() => onInsert?.(image)}
              >
                Place in text
              </button>
            </div>
          </li>
        ))}
      </ul>
      {cropping && (
        <div className="rounded-2xl border border-border p-3">
          <p className="text-sm font-semibold">Crop</p>
          <div className="mt-2 h-48 overflow-hidden rounded-xl bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cropping.src} alt="" className="h-full w-full object-cover" style={{ transform: `scale(${zoom}) translateX(${offset}px)` }} />
          </div>
          <label className="mt-2 block text-xs font-semibold">Zoom
            <input type="range" min={1} max={2.4} step={0.05} value={zoom} onChange={event => setZoom(Number(event.target.value))} className="mt-1 w-full" />
          </label>
          <label className="mt-2 block text-xs font-semibold">Nudge
            <input type="range" min={-80} max={80} value={offset} onChange={event => setOffset(Number(event.target.value))} className="mt-1 w-full" />
          </label>
          <div className="mt-2 flex gap-2">
            <button type="button" className="h-9 rounded-full border border-border px-3 text-sm" onClick={() => setCropId(null)}>Cancel</button>
            <button
              type="button"
              className="h-9 rounded-full bg-[#203337] px-3 text-sm font-bold text-white"
              onClick={() => {
                void cropImage(cropping.src, zoom, offset, 0).then(async result => {
                  const stored = await storeMedia(scopeId, result.blob, `${cropping.id}-crop.jpg`);
                  onChange(images.map(item => item.id === cropping.id ? { ...item, src: stored.src, width: result.width, height: result.height, storagePath: stored.storagePath } : item));
                  setCropId(null);
                }).catch(err => setError(err instanceof Error ? err.message : 'Crop failed.'));
              }}
            >
              Apply crop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
