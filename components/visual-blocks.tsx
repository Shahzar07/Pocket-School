'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { uploadLessonImage } from '@/lib/media-upload';
import { toast } from 'sonner';
import {
  INTELLIGENCES, VISUAL_LABELS, emptyVisualBlock, isIntelligence, isVisualBlockId,
  type Intelligence, type VisualBlock, type VisualBlockId, type VisualMedia,
} from '@/lib/visual-blocks';

function IntelligenceField({
  value, onChange,
}: {
  value?: Intelligence;
  onChange: (value: Intelligence | undefined) => void;
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      Multiple intelligence (optional)
      <select
        value={value ?? ''}
        onChange={(event) => onChange(isIntelligence(event.target.value) ? event.target.value : undefined)}
        className="mt-1 w-full h-9 rounded-xl border border-border bg-card px-2 text-sm text-foreground"
      >
        <option value="">No tag</option>
        {INTELLIGENCES.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

function AltField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const missing = !value.trim();
  return (
    <label className="block text-xs text-muted-foreground">
      {label} <span className="text-red-600">Required</span>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Describe the image or sound for someone who cannot see or hear it."
        className={`mt-1 min-h-16 rounded-xl text-sm ${missing ? 'border-red-400' : ''}`}
      />
    </label>
  );
}

async function storeFile(courseId: string, lessonId: string, kind: string, file: File): Promise<string> {
  const extension = file.type.includes('audio') || file.name.endsWith('.mp3') ? 'mp3'
    : file.type.includes('webm') ? 'webm' : 'png';
  return uploadLessonImage(courseId, lessonId, kind, file, file.type || 'application/octet-stream', extension);
}

export function VisualBlockEditor({
  kind, block, courseId, lessonId, onChange,
}: {
  kind: VisualBlockId;
  block: VisualBlock | undefined;
  courseId: string;
  lessonId: string;
  onChange: (block: VisualBlock) => void;
}) {
  const value = block && block.kind === kind ? block : emptyVisualBlock(kind);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File, slot: string) => {
    setBusy(true);
    try {
      return await storeFile(courseId, lessonId, `${kind}-${slot}`, file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed.');
      return '';
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {VISUAL_LABELS[kind]}. Alt text is required. Media loads only when a learner reaches it.
      </p>
      {'src' in value && (
        <div className="flex flex-wrap gap-2">
          <Input
            value={value.src}
            onChange={(event) => onChange({ ...value, src: event.target.value })}
            placeholder={kind === 'audioChant' ? 'Audio URL' : 'Image URL'}
            className="h-9 rounded-xl text-sm flex-1 min-w-48"
          />
          <label className="text-xs font-semibold px-3 py-2 rounded-xl border border-border cursor-pointer">
            {busy ? 'Uploading…' : 'Upload'}
            <input
              type="file"
              accept={kind === 'audioChant' ? 'audio/*' : 'image/*'}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void upload(file, 'main').then((src) => { if (src) onChange({ ...value, src }); });
              }}
            />
          </label>
        </div>
      )}
      <AltField label="Alt text" value={value.alt} onChange={(alt) => onChange({ ...value, alt })} />
      {'caption' in value && (
        <Input
          value={value.caption ?? ''}
          onChange={(event) => onChange({ ...value, caption: event.target.value })}
          placeholder="Caption (optional)"
          className="h-9 rounded-xl text-sm"
        />
      )}
      {'transcript' in value && (
        <Textarea
          value={value.transcript}
          onChange={(event) => onChange({ ...value, transcript: event.target.value })}
          placeholder="Transcript of the chant or rhyme"
          className="min-h-20 rounded-xl text-sm"
        />
      )}
      {'title' in value && (
        <Input
          value={value.title ?? ''}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
          placeholder="Title (optional)"
          className="h-9 rounded-xl text-sm"
        />
      )}
      {'panels' in value && (
        <MediaList
          items={value.panels}
          courseId={courseId}
          lessonId={lessonId}
          kind={kind}
          label="Panel"
          onChange={(panels) => onChange({ ...value, panels })}
        />
      )}
      {'items' in value && (
        <MediaList
          items={value.items}
          courseId={courseId}
          lessonId={lessonId}
          kind={kind}
          label="Image"
          onChange={(items) => onChange({ ...value, items })}
        />
      )}
      <IntelligenceField
        value={value.intelligence}
        onChange={(intelligence) => onChange({ ...value, ...(intelligence ? { intelligence } : { intelligence: undefined }) })}
      />
    </div>
  );
}

function MediaList({
  items, onChange, courseId, lessonId, kind, label,
}: {
  items: VisualMedia[];
  onChange: (items: VisualMedia[]) => void;
  courseId: string;
  lessonId: string;
  kind: string;
  label: string;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const patch = (index: number, next: Partial<VisualMedia>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...next } : item)));
  };
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${label}-${index}`} className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label} {index + 1}</p>
          <Input value={item.src} onChange={(event) => patch(index, { src: event.target.value })} placeholder="Image URL" className="h-9 rounded-xl text-sm" />
          <label className="text-xs font-semibold px-3 py-2 rounded-xl border border-border cursor-pointer inline-block">
            {busy === index ? 'Uploading…' : 'Upload'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setBusy(index);
                void storeFile(courseId, lessonId, `${kind}-${index}`, file)
                  .then((src) => { if (src) patch(index, { src }); })
                  .catch(() => toast.error('Upload failed.'))
                  .finally(() => setBusy(null));
              }}
            />
          </label>
          <AltField label="Alt text" value={item.alt} onChange={(alt) => patch(index, { alt })} />
          <Input value={item.caption ?? ''} onChange={(event) => patch(index, { caption: event.target.value })} placeholder="Caption" className="h-9 rounded-xl text-sm" />
          {items.length > 1 && (
            <Button type="button" variant="outline" className="h-8 rounded-xl text-xs" onClick={() => onChange(items.filter((_, i) => i !== index))}>
              Remove {label.toLowerCase()}
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" className="h-8 rounded-xl text-xs" onClick={() => onChange([...items, { src: '', alt: '', caption: '' }])}>
        Add {label.toLowerCase()}
      </Button>
    </div>
  );
}

function IntelligenceBadge({ value }: { value?: Intelligence }) {
  if (!value) return null;
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{value}</p>;
}

export function VisualBlockView({ blocks }: { blocks: VisualBlock[] | undefined }) {
  const visible = (blocks ?? []).filter((block) => isVisualBlockId(block.kind));
  if (!visible.length) return null;
  return (
    <div className="space-y-4 mb-6">
      {visible.map((block) => <VisualFigure key={block.kind} block={block} />)}
    </div>
  );
}

function VisualFigure({ block }: { block: VisualBlock }) {
  if (block.kind === 'comic') {
    return (
      <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
        <IntelligenceBadge value={block.intelligence} />
        <h2 className="font-heading text-lg text-foreground mb-3">{block.title || 'Comic strip'}</h2>
        <p className="sr-only">{block.alt}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {block.panels.filter((panel) => panel.src).map((panel, index) => (
            <figure key={`${panel.src}-${index}`} className="rounded-2xl overflow-hidden border border-border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={panel.src} alt={panel.alt} loading="lazy" decoding="async" className="w-full h-auto" />
              {panel.caption && <figcaption className="px-3 py-2 text-xs text-muted-foreground">{panel.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </section>
    );
  }
  if (block.kind === 'gallery') return <GalleryView block={block} />;
  if (block.kind === 'audioChant') {
    return (
      <section className="rounded-3xl border border-border bg-card p-4 sm:p-5 space-y-3">
        <IntelligenceBadge value={block.intelligence} />
        <h2 className="font-heading text-lg text-foreground">{block.title || 'Chant'}</h2>
        <p className="text-sm text-muted-foreground">{block.alt}</p>
        {block.src && <audio controls preload="none" src={block.src} className="w-full" aria-label={block.alt} />}
        {block.transcript && (
          <details className="rounded-2xl bg-muted/40 px-3 py-2">
            <summary className="text-sm font-semibold cursor-pointer">Transcript</summary>
            <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">{block.transcript}</p>
          </details>
        )}
      </section>
    );
  }
  const poster = block.kind === 'revisionPoster';
  return (
    <figure className={`rounded-3xl border border-border bg-card overflow-hidden ${poster ? 'ring-1 ring-primary/20' : ''}`}>
      <div className="px-4 pt-4">
        <IntelligenceBadge value={block.intelligence} />
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          {poster ? 'Unit revision poster' : VISUAL_LABELS[block.kind]}
        </p>
      </div>
      {block.src && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={block.src} alt={block.alt} loading="lazy" decoding="async" className="w-full h-auto" />
      )}
      {block.caption && <figcaption className="px-4 py-3 text-sm text-muted-foreground">{block.caption}</figcaption>}
    </figure>
  );
}

function GalleryView({ block }: { block: Extract<VisualBlock, { kind: 'gallery' }> }) {
  const items = block.items.filter((item) => item.src);
  const [index, setIndex] = useState(0);
  const current = items[index];
  if (!current) return null;
  return (
    <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
      <IntelligenceBadge value={block.intelligence} />
      <p className="sr-only">{block.alt}</p>
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.src} alt={current.alt} loading="lazy" decoding="async" className="w-full h-auto rounded-2xl" />
        {current.caption && <figcaption className="mt-2 text-sm text-muted-foreground">{current.caption}</figcaption>}
      </figure>
      {items.length > 1 && (
        <div className="flex items-center justify-between mt-3">
          <Button type="button" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}>Previous</Button>
          <span className="text-xs text-muted-foreground">{index + 1} / {items.length}</span>
          <Button type="button" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setIndex((i) => (i + 1) % items.length)}>Next</Button>
        </div>
      )}
    </section>
  );
}
