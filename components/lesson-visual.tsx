'use client';

import { useRef, useState } from 'react';
import { ImageIcon, Loader2, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { LessonVisual } from '@/lib/db';
import { dataUrlToBlob, uploadLessonImage } from '@/lib/media-upload';
import { fetchWithBackoff } from '@/lib/net-retry';

export function LessonFigure({ visual }: { visual?: LessonVisual | null }) {
  if (!visual?.url) return null;
  return (
    <figure className="my-6 mx-auto max-w-3xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={visual.url}
        alt={visual.alt || visual.caption || ''}
        className="w-full h-auto max-h-[70vh] object-contain rounded-2xl border border-border bg-muted/30"
      />
      {visual.caption && (
        <figcaption className="mt-2 text-sm text-center text-muted-foreground leading-relaxed">
          {visual.caption}
        </figcaption>
      )}
    </figure>
  );
}

const COSTS = { image: 10, illustration: 15 } as const;

export function VisualBlock({
  kind, value, onChange, lessonText, courseId, lessonId,
}: {
  kind: 'image' | 'illustration';
  value?: LessonVisual;
  onChange: (next: LessonVisual) => void;
  lessonText: string;
  courseId: string;
  lessonId: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const cost = COSTS[kind];
  const label = kind === 'illustration' ? 'Illustration' : 'Image';
  const current: LessonVisual = {
    url: value?.url ?? '',
    caption: value?.caption ?? '',
    alt: value?.alt ?? '',
    placement: value?.placement ?? 'after',
    source: value?.source,
  };

  const saveFile = async (file: Blob, source: 'upload' | 'ai', contentType?: string) => {
    setStatus('Saving to storage…');
    const url = await uploadLessonImage(courseId, lessonId, kind, file, contentType);
    onChange({ ...current, url, source });
    setStatus(null);
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file.');
      return;
    }
    setUploading(true);
    try {
      await saveFile(file, 'upload', file.type);
      toast.success(`${label} uploaded.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      setStatus(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const generate = async () => {
    const source = lessonText.trim();
    if (source.length < 40) {
      toast.error('Add lesson text first — the picture is drawn from it.');
      return;
    }
    setConfirming(false);
    setGenerating(true);
    setStatus('Drawing from the lesson text…');
    try {
      const style = kind === 'illustration'
        ? 'Hand-drawn educational illustration, soft colours, no photorealism, no watermarks, no made-up statistics.'
        : 'Clear educational diagram or photograph-style figure, no watermarks, no made-up statistics.';
      const res = await fetchWithBackoff('/api/ai/scene-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: current.caption || label,
          visual: `${style} Depict only what this lesson text describes:\n${source.slice(0, 700)}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.image) {
        throw new Error(data.reason || data.error || 'The image service did not return a picture. Try again.');
      }
      const blob = await dataUrlToBlob(data.image);
      await saveFile(blob, 'ai', 'image/png');
      toast.success(`${label} generated.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Image generation failed.';
      setStatus(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const busy = uploading || generating;

  return (
    <div className="space-y-3">
      {current.url ? (
        <LessonFigure visual={current} />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 aspect-video flex flex-col items-center justify-center gap-2 text-center px-6">
          <ImageIcon className="w-6 h-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No {label.toLowerCase()} yet. Upload one, or generate it from the lesson text.</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-2">
        <Input
          value={current.caption}
          onChange={(e) => onChange({ ...current, caption: e.target.value })}
          placeholder="Caption"
          className="h-9 rounded-xl text-sm"
        />
        <Input
          value={current.alt}
          onChange={(e) => onChange({ ...current, alt: e.target.value })}
          placeholder="Alt text for students using a screen reader"
          className="h-9 rounded-xl text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Placement in the lesson
        <select
          value={current.placement}
          onChange={(e) => onChange({ ...current, placement: e.target.value as 'before' | 'after' })}
          className="h-8 rounded-lg border border-border bg-card px-2 text-xs text-foreground"
        >
          <option value="before">Before the lesson text</option>
          <option value="after">After the lesson text</option>
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onUpload(e.target.files?.[0]); e.target.value = ''; }} />
        <Button type="button" size="sm" variant="outline" className="rounded-xl gap-1.5 h-8 text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload
        </Button>
        {!confirming ? (
          <Button type="button" size="sm" className="rounded-xl gap-1.5 h-8 text-xs bg-gradient-to-r from-violet-600 to-purple-600 text-white" disabled={busy} onClick={() => setConfirming(true)}>
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate with ET
            <span className="text-amber-200 font-bold">{cost} ⚡</span>
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2 py-1.5">
            <p className="text-[11px] text-amber-800">Generate this {label.toLowerCase()} for {cost} Sparks? It is drawn only from the lesson text.</p>
            <Button type="button" size="sm" className="rounded-lg h-7 text-[11px]" disabled={busy} onClick={() => { void generate(); }}>Confirm</Button>
            <Button type="button" size="sm" variant="ghost" className="rounded-lg h-7 text-[11px]" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        )}
      </div>
      {status && <p className="text-[11px] text-amber-700">{status}</p>}
    </div>
  );
}
