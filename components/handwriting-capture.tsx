'use client';

import { useRef, useState } from 'react';
import { Camera, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { postJSON } from '@/lib/authed-fetch';
import { compressImage } from '@/lib/study/files';

/**
 * Camera on a small screen, file upload on a wide one.
 * Both send the photo through the same vision route ET Maths uses.
 */
export function HandwritingCapture({
  onText,
  disabled = false,
  tone = 'theme',
}: {
  onText: (text: string) => void | Promise<void>;
  disabled?: boolean;
  tone?: 'theme' | 'onDark';
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);

  async function read(file?: File) {
    if (!file || reading) return;
    setReading(true);
    try {
      const image = await compressImage(file, 1600, 0.82);
      const result = await postJSON<{ text?: string; note?: string | null }>('/api/study/math/read', {
        image,
        purpose: 'writing',
      });
      const text = result.text?.trim() ?? '';
      if (!text) throw new Error('ET AI could not read any writing in that photo.');
      if (result.note) toast.message(result.note);
      await onText(text);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read the photo.');
    } finally {
      setReading(false);
    }
  }

  const busy = disabled || reading;
  const label = reading ? 'Reading handwriting…' : null;
  const look = tone === 'onDark'
    ? 'border-white/30 text-white'
    : 'border-border text-foreground';

  return (
    <>
      <button
        type="button"
        data-testid="handwriting-camera"
        disabled={busy}
        onClick={() => cameraRef.current?.click()}
        className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold disabled:opacity-50 md:hidden ${look}`}
      >
        <Camera className="h-4 w-4" aria-hidden /> {label ?? 'Camera'}
      </button>
      <button
        type="button"
        data-testid="handwriting-upload"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className={`hidden h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold disabled:opacity-50 md:inline-flex ${look}`}
      >
        <ImagePlus className="h-4 w-4" aria-hidden /> {label ?? 'Upload photo'}
      </button>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Photograph handwriting"
        onChange={event => { void read(event.target.files?.[0]); event.target.value = ''; }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Upload a photo of handwriting"
        onChange={event => { void read(event.target.files?.[0]); event.target.value = ''; }}
      />
    </>
  );
}
