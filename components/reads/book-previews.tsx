'use client';

import { useMemo, useState } from 'react';
import { ChapterProse } from '@/components/reads/prose';
import { BRAND_COVER } from '@/lib/reads/cover';
import { PREVIEW } from '@/lib/reads/preview-copy';
import {
  pageLabel, previewPublishIssues, readerPages, readingLevelLabel, readingMinutes, readsOfferLabel,
} from '@/lib/reads/preview';
import type { Book } from '@/lib/reads/types';

type Device = 'phone' | 'tablet' | 'desktop';

const FRAME: Record<Device, string> = {
  phone: 'max-w-[390px]',
  tablet: 'max-w-[768px]',
  desktop: 'max-w-none',
};

export function BookStatusBadge({ status }: { status: Book['status'] }) {
  const label = status === 'published' ? PREVIEW.published : status === 'review' ? PREVIEW.review : PREVIEW.draft;
  const tone = status === 'published'
    ? 'bg-[#1E6A83] text-white'
    : 'bg-[#E9F7FA] text-[#1E6A83]';
  return (
    <span data-book-status={status} className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${tone}`}>
      {label}
    </span>
  );
}

export function CoverLibraryCard({ book }: { book: Book }) {
  const image = book.cover.image?.trim();
  const alt = book.coverBrief?.alt?.trim() || book.title;
  const level = readingLevelLabel(book.readingLevel);
  return (
    <div data-cover-preview="1" className="w-[186px]">
      {image ? (
        <div className="overflow-hidden rounded-xl shadow-[var(--shadow-card)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={alt} className="aspect-[2/3] w-full object-cover" />
        </div>
      ) : (
        <div
          data-cover-fallback="1"
          className="relative flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-xl p-3.5 text-left"
          style={{ background: `linear-gradient(165deg, ${BRAND_COVER.from}, ${BRAND_COVER.to})` }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: BRAND_COVER.accent }}>{PREVIEW.fallbackMark}</p>
          <p className="font-heading text-[17px] leading-tight text-white">{book.title}</p>
        </div>
      )}
      <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug">{book.title}</p>
      <p className="text-[12px] text-muted-foreground">{book.author}</p>
      <p className="text-[12px] text-[#1E6A83]">{level}</p>
    </div>
  );
}

export function LibraryDetailPreview({ book }: { book: Book }) {
  const minutes = readingMinutes(book.chapters);
  const price = readsOfferLabel(book);
  const level = readingLevelLabel(book.readingLevel);
  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      <div data-library-preview="1">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]">{PREVIEW.library}</p>
        <CoverLibraryCard book={book} />
      </div>
      <article data-detail-preview="1" className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]">{PREVIEW.detail}</p>
        <h3 className="font-heading text-[28px] tracking-[-0.03em]">{book.title}</h3>
        <p className="text-sm text-muted-foreground">{book.author}</p>
        <p className="max-w-xl text-sm leading-relaxed">{book.blurb.trim() || PREVIEW.emptyBlurb}</p>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          <div><span className="font-semibold text-foreground">{PREVIEW.level}</span> {level}</div>
          <div data-reading-time="1"><span className="font-semibold text-foreground">{PREVIEW.reading}</span> {minutes} {PREVIEW.minutes}</div>
          <div data-price="1"><span className="font-semibold text-foreground">{PREVIEW.price}</span> {price}</div>
        </dl>
      </article>
    </div>
  );
}

export function BookReaderPreview({ book }: { book: Book }) {
  const pages = useMemo(() => readerPages(book.chapters), [book.chapters]);
  const [index, setIndex] = useState(0);
  const [device, setDevice] = useState<Device>('phone');
  const page = pages[Math.min(index, Math.max(0, pages.length - 1))];
  const at = pages.length ? Math.min(index, pages.length - 1) : 0;
  return (
    <div data-reader-preview="1" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{PREVIEW.reader}</p>
        <div className="flex gap-1">
          {(['phone', 'tablet', 'desktop'] as const).map(item => (
            <button
              key={item}
              type="button"
              data-device={item}
              aria-pressed={device === item}
              onClick={() => setDevice(item)}
              className={`h-8 rounded-full px-3 text-[12px] font-semibold ${device === item ? 'bg-[#1E6A83] text-white' : 'border border-border'}`}
            >
              {PREVIEW[item]}
            </button>
          ))}
        </div>
      </div>
      <div className={`mx-auto overflow-hidden rounded-[28px] border border-border bg-[#E9F7FA] ${FRAME[device]}`}>
        <div className="flex items-center justify-between border-b border-border px-4 py-2 text-[12px] text-muted-foreground">
          <span>{page?.chapterTitle}</span>
          <span data-page-counter="1">{pageLabel(at, pages.length || 1)}</span>
        </div>
        <div data-reader-page="1" className="min-h-64 px-5 py-4 text-[15px] leading-relaxed text-[#203337]">
          {page?.markdown?.trim() ? <ChapterProse markdown={page.markdown} quotes={[]} /> : <p>{PREVIEW.emptyPage}</p>}
        </div>
        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <button type="button" className="h-9 rounded-full border border-border px-3 text-sm font-semibold" onClick={() => setIndex(value => Math.max(0, Math.min(value, pages.length - 1) - 1))}>{PREVIEW.previous}</button>
          <button type="button" className="h-9 rounded-full border border-border px-3 text-sm font-semibold" onClick={() => setIndex(value => Math.min(pages.length - 1, Math.min(value, pages.length - 1) + 1))}>{PREVIEW.next}</button>
        </div>
      </div>
    </div>
  );
}

export function PublishGate({ book, onPublish }: { book: Book; onPublish: () => void }) {
  const issues = previewPublishIssues(book);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <BookStatusBadge status={book.status} />
        {book.status !== 'published' && (
          <button type="button" data-publish-book="1" onClick={onPublish} className="h-10 rounded-full bg-foreground px-4 text-sm font-bold text-background">{PREVIEW.publish}</button>
        )}
      </div>
      {issues.length > 0 && book.status !== 'published' && (
        <ul data-publish-block="1" className="space-y-1 text-sm text-[#1E6A83]">
          {issues.map(issue => <li key={issue}>{issue}</li>)}
        </ul>
      )}
    </div>
  );
}
