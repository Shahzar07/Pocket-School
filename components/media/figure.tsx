'use client';

import type { ReactNode } from 'react';

/**
 * One picture frame for a lesson or a book page.
 * The course CMS, the student lesson, and the shared editor all use this
 * so a placed image is full width, responsive, and captioned the same way.
 */
export function MediaFigure({
  src,
  alt,
  caption,
  full = false,
  className = '',
  children,
}: {
  src?: string;
  alt?: string;
  caption?: string;
  full?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  if (!src) return null;
  const frame = full ? 'mx-[-1rem] sm:mx-[-2rem]' : 'mx-auto max-w-3xl';
  return (
    <figure className={`${frame} ${className}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || caption || ''}
        className="h-auto w-full max-h-[70vh] rounded-2xl border border-border bg-muted/30 object-contain"
      />
      {caption && (
        <figcaption className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
          {caption}
        </figcaption>
      )}
      {children}
    </figure>
  );
}
