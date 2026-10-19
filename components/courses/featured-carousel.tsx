'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PLACE } from '@/lib/courses/placement-copy';
import { orderFeatured, type FeaturedSlide } from '@/lib/courses/placement';

export type CarouselVariant = 'hero' | 'row' | 'preview';

function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function sessionKey(): string {
  const key = 'poket-featured-session';
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const next = Math.random().toString(36).slice(2);
    sessionStorage.setItem(key, next);
    return next;
  } catch {
    return 'session';
  }
}

function kindLabel(kind: FeaturedSlide['kind']): string {
  if (kind === 'bundle') return PLACE.kindBundle;
  if (kind === 'book') return PLACE.kindBook;
  return PLACE.kindCourse;
}

export function FeaturedCarousel({
  slides,
  variant,
  onTrack,
}: {
  slides: readonly FeaturedSlide[];
  variant: CarouselVariant;
  onTrack?: (slide: FeaturedSlide, field: 'impressions' | 'clicks') => void;
}) {
  const labelId = useId();
  const [today] = useState(todayKey);
  const [session] = useState(sessionKey);
  const ordered = useMemo(
    () => (variant === 'preview' ? slides.filter((slide) => slide.eligible) : orderFeatured(slides, today, session)),
    [slides, today, session, variant],
  );
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const seen = useRef(new Set<string>());
  const touchX = useRef<number | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [ordered.map((slide) => slide.id).join('|')]);

  useEffect(() => {
    if (variant === 'preview' || paused || reduced || ordered.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % ordered.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [ordered.length, paused, reduced, variant]);

  const slide = ordered[index] ?? ordered[0];

  useEffect(() => {
    if (!slide || variant === 'preview' || !onTrack) return;
    if (seen.current.has(slide.id)) return;
    seen.current.add(slide.id);
    onTrack(slide, 'impressions');
  }, [onTrack, slide, variant]);

  if (!slide) return null;

  const go = (next: number) => {
    const count = ordered.length;
    if (count === 0) return;
    setIndex((next + count) % count);
  };

  const trackClick = () => {
    if (variant !== 'preview') onTrack?.(slide, 'clicks');
  };

  const hero = variant === 'hero';
  const position = `${index + 1} / ${ordered.length}`;

  return (
    <section
      ref={rootRef}
      data-featured-carousel={variant}
      data-motion={reduced ? 'reduce' : 'auto'}
      data-slide={slide.sourceId}
      aria-roledescription="carousel"
      aria-labelledby={labelId}
      tabIndex={0}
      className={`relative overflow-hidden rounded-3xl border border-[#1E6A83]/15 bg-[#0B1417] text-white outline-none focus-visible:ring-2 focus-visible:ring-[#3FE0D0] ${hero ? 'min-h-[280px]' : 'min-h-[220px]'}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          go(index + 1);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          go(index - 1);
        }
      }}
      onTouchStart={(event) => {
        touchX.current = event.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchX.current;
        const end = event.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start == null || end == null) return;
        if (end - start > 40) go(index - 1);
        if (start - end > 40) go(index + 1);
      }}
    >
      <h2 id={labelId} className={hero ? 'sr-only' : 'px-5 pt-4 text-xs font-bold uppercase tracking-[0.16em] text-[#3FE0D0]'}>
        {PLACE.featuredCourses}
      </h2>
      <p className="sr-only" aria-live="polite">{`${slide.title}. ${position}`}</p>
      <div className={`grid gap-4 ${hero ? 'md:grid-cols-[1.3fr_1fr]' : 'sm:grid-cols-[180px_1fr]'} `}>
        <div className={`relative ${hero ? 'min-h-[220px] md:min-h-[320px]' : 'min-h-[160px]'}`}>
          {slide.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(160deg,#1E6A83,#0B1417)]" />
          )}
          <span className="absolute left-4 top-4 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#203337]">
            {kindLabel(slide.kind)}
          </span>
        </div>
        <div className="flex flex-col justify-center px-5 py-5 md:pr-16">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slide.teacherSrc} alt={slide.teacherName} className="h-12 w-12 rounded-full object-cover" />
            <div>
              <p className="text-sm font-semibold text-[#3FE0D0]">{slide.teacherName}</p>
              {slide.level ? <p className="text-xs text-white/75">{slide.level}</p> : null}
            </div>
          </div>
          <Link href={slide.href} onClick={trackClick} className="mt-3 text-2xl font-semibold leading-tight text-white hover:text-[#3FE0D0]">
            {slide.title}
          </Link>
          {slide.rating != null && slide.ratingCount > 0 ? (
            <p className="mt-2 text-sm text-white/85">{`${slide.rating} · ${slide.ratingCount}`}</p>
          ) : null}
          <p className="mt-2 text-lg font-semibold text-white">{slide.priceLabel || PLACE.included}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={slide.buyHref} onClick={trackClick} className="inline-flex min-h-11 items-center rounded-xl bg-[#3FE0D0] px-4 text-sm font-bold text-[#203337]">
              {PLACE.buy}
            </Link>
            <Link href={slide.enrolHref} onClick={trackClick} className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-4 text-sm font-semibold">
              {slide.kind === 'book' ? PLACE.read : PLACE.enrol}
            </Link>
          </div>
        </div>
      </div>
      {ordered.length > 1 ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <button type="button" className="min-h-11 rounded-full border border-white/30 px-3 text-sm" onClick={() => go(index - 1)} aria-label={PLACE.previous}>
            ‹
          </button>
          <div className="flex flex-wrap justify-center gap-2">
            {ordered.map((item, dot) => (
              <button
                key={item.id}
                type="button"
                aria-label={`${PLACE.slide} ${dot + 1}`}
                aria-current={dot === index}
                className={`h-2.5 w-2.5 rounded-full ${dot === index ? 'bg-[#3FE0D0]' : 'bg-white/40'}`}
                onClick={() => go(dot)}
              />
            ))}
          </div>
          <button type="button" className="min-h-11 rounded-full border border-white/30 px-3 text-sm" onClick={() => go(index + 1)} aria-label={PLACE.next}>
            ›
          </button>
        </div>
      ) : null}
    </section>
  );
}
