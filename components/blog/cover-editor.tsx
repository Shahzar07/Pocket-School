'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { BLOG_DESK } from '@/lib/blog/desk-copy';
import { blogImageError, inlineImageMarkdown } from '@/lib/blog/images';
import { prepareBlogImages } from '@/lib/blog/prepare-cover';
import { uploadPreparedMedia } from '@/lib/media/upload';

export function CoverEditor({
  postId,
  coverImage,
  thumbnail,
  coverAlt,
  onCover,
  onInsert,
}: {
  postId: string;
  coverImage: string;
  thumbnail: string;
  coverAlt: string;
  onCover: (next: { coverImage: string; thumbnail: string; coverAlt: string }) => void;
  onInsert: (markdown: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [inlineAlt, setInlineAlt] = useState('');
  const [localPreview, setLocalPreview] = useState('');

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const id = postId.trim();
    if (!id) {
      toast.error(BLOG_DESK.needSlug);
      return;
    }
    setBusy(true);
    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);
    try {
      const made = await prepareBlogImages(file);
      const stamp = Date.now();
      const banner = await uploadPreparedMedia(`blog/${id}/cover-${stamp}.webp`, made.cover, 'image/webp');
      const thumb = await uploadPreparedMedia(`blog/${id}/thumb-${stamp}.webp`, made.thumb, 'image/webp');
      onCover({ coverImage: banner, thumbnail: thumb, coverAlt });
      toast.success(BLOG_DESK.uploaded);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : BLOG_DESK.failed);
    } finally {
      setBusy(false);
    }
  };

  const insert = async (file: File | undefined) => {
    if (!file) return;
    const id = postId.trim();
    if (!id) {
      toast.error(BLOG_DESK.needSlug);
      return;
    }
    const problem = blogImageError({ type: file.type, size: file.size }, inlineAlt);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      const made = await prepareBlogImages(file);
      const url = await uploadPreparedMedia(`blog/${id}/inline-${Date.now()}.webp`, made.cover, 'image/webp');
      onInsert(inlineImageMarkdown({ url, alt: inlineAlt.trim() }));
      setInlineAlt('');
      toast.success(BLOG_DESK.uploaded);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : BLOG_DESK.failed);
    } finally {
      setBusy(false);
    }
  };

  const shown = localPreview || coverImage;

  return (
    <fieldset className="space-y-3 rounded-2xl border border-border p-3" data-blog-cover="1">
      <legend className="px-1 text-sm font-semibold">{BLOG_DESK.banner}</legend>
      <p className="text-xs text-muted-foreground">{BLOG_DESK.bannerHelp}</p>
      <label
        className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-3 py-4 text-center text-sm ${over ? 'border-[#3FE0D0] bg-[#3FE0D0]/10' : 'border-border'}`}
        onDragOver={(event) => { event.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void upload(event.dataTransfer.files[0]);
        }}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={coverAlt || BLOG_DESK.preview} className="mb-3 h-28 w-full rounded-xl object-cover" />
        ) : null}
        <span>{busy ? BLOG_DESK.working : BLOG_DESK.drop}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          data-blog-file="cover"
          disabled={busy}
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-11 rounded-full border px-4 text-sm font-semibold" disabled={busy} onClick={() => onCover({ coverImage: '', thumbnail: '', coverAlt })}>
          {BLOG_DESK.remove}
        </button>
      </div>
      {thumbnail && thumbnail !== coverImage ? (
        <p className="text-xs text-muted-foreground">{BLOG_DESK.thumb}</p>
      ) : null}
      <label className="block text-sm font-semibold">{BLOG_DESK.alt}
        <input
          value={coverAlt}
          data-blog-alt="cover"
          onChange={(event) => onCover({ coverImage, thumbnail, coverAlt: event.target.value })}
          className="mt-1 w-full min-h-11 rounded-xl border border-border px-3"
        />
      </label>
      <label className="block text-sm font-semibold">{BLOG_DESK.inlineAlt}
        <input value={inlineAlt} data-blog-alt="inline" onChange={(event) => setInlineAlt(event.target.value)} className="mt-1 w-full min-h-11 rounded-xl border border-border px-3" />
      </label>
      <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold">
        {BLOG_DESK.inline}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          data-blog-file="inline"
          disabled={busy}
          onChange={(event) => {
            void insert(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
    </fieldset>
  );
}
