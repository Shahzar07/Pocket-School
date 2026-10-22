'use client';

import { useState } from 'react';
import { cropImage, optimiseImage, removeStoredMedia, storeMedia } from '@/components/media';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export function ProfilePhoto({
  src,
  name,
  scopeId,
  preview,
  onChange,
}: {
  src: string;
  name: string;
  scopeId: string;
  preview?: boolean;
  onChange: (next: { avatarUrl: string; photoStoragePath: string }) => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ src: string; path: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(0);
  const initials = (name || 'U').split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);

  const store = async (blob: Blob, fileName: string) => {
    if (preview) {
      const url = await blobToDataUrl(blob);
      return { src: url, storagePath: '' };
    }
    return storeMedia(scopeId, blob, fileName);
  };

  const choose = async (file: File) => {
    setError('');
    setBusy(true);
    try {
      const fitted = await optimiseImage(file, 1200);
      const stored = await store(fitted.blob, `avatar-${Date.now()}.jpg`);
      setDraft({ src: stored.src, path: stored.storagePath ?? '' });
      setZoom(1);
      setOffset(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That photo could not be added.');
    } finally {
      setBusy(false);
    }
  };

  const applyCrop = async () => {
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      const cropped = await cropImage(draft.src, zoom, offset, 0, 512);
      const stored = await store(cropped.blob, `avatar-crop-${Date.now()}.jpg`);
      if (draft.path && stored.storagePath && draft.path !== stored.storagePath) {
        await removeStoredMedia(draft.path);
      }
      onChange({ avatarUrl: stored.src, photoStoragePath: stored.storagePath ?? '' });
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Crop failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setError('');
    if (!preview && src.startsWith('http')) {
      /* The stored path is cleared by the parent. Bytes are removed when we know the path. */
    }
    onChange({ avatarUrl: '', photoStoragePath: '' });
    setDraft(null);
  };

  return (
    <div className="space-y-3" data-profile-photo>
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border-2 border-border">
          <AvatarImage src={draft?.src || src || undefined} />
          <AvatarFallback className="bg-primary text-lg font-bold text-primary-foreground">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center rounded-full border border-border px-3 text-sm font-semibold">
            {busy ? 'Working…' : 'Upload photo'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Upload profile photo"
              onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void choose(file);
              }}
            />
          </label>
          {(src || draft) && (
            <Button type="button" variant="outline" className="h-9 rounded-full" onClick={() => void remove()}>
              Remove photo
            </Button>
          )}
        </div>
      </div>
      {draft && (
        <div className="rounded-2xl border border-border p-3">
          <p className="text-sm font-semibold">Crop</p>
          <div className="mt-2 h-48 overflow-hidden rounded-xl bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.src} alt="" className="h-full w-full object-cover" style={{ transform: `scale(${zoom}) translateX(${offset}px)` }} />
          </div>
          <label className="mt-2 block text-xs font-semibold">Zoom
            <input type="range" min={1} max={2.4} step={0.05} value={zoom} aria-label="Crop zoom" onChange={event => setZoom(Number(event.target.value))} className="mt-1 w-full" />
          </label>
          <label className="mt-2 block text-xs font-semibold">Nudge
            <input type="range" min={-80} max={80} value={offset} aria-label="Crop nudge" onChange={event => setOffset(Number(event.target.value))} className="mt-1 w-full" />
          </label>
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="outline" className="h-9 rounded-full" onClick={() => setDraft(null)}>Cancel</Button>
            <Button type="button" className="h-9 rounded-full" disabled={busy} onClick={() => void applyCrop()}>Apply crop</Button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-[var(--ps-tile-ink)]">{error}</p>}
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.readAsDataURL(blob);
  });
}
