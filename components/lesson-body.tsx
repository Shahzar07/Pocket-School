'use client';

import type { ReactNode } from 'react';
import { MathMarkdown } from '@/components/math-markdown';

const IMAGE = /^(!full|!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/;

/**
 * Student view of a lesson body. Prose and maths stay on MathMarkdown.
 * Pictures placed by the shared editor (`![alt](src)` and `!full[alt](src)`)
 * render as figures, with the full-page flag spanning the column.
 */
export function LessonBody({
  markdown,
  imageDownload,
}: {
  markdown: string;
  imageDownload?: (image: { src: string; alt: string }) => ReactNode;
}) {
  const blocks = (markdown ?? '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const image = IMAGE.exec(block.trim());
        if (!image) {
          return <MathMarkdown key={index}>{block}</MathMarkdown>;
        }
        const full = image[1] === '!full';
        const alt = image[2] || '';
        const src = image[3] || '';
        const caption = image[4] || '';
        return (
          <figure key={index} className={full ? 'mx-[-1rem] sm:mx-[-2rem]' : 'mx-auto max-w-3xl'}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="h-auto w-full max-h-[70vh] rounded-2xl border border-border bg-muted/30 object-contain"
            />
            {caption && (
              <figcaption className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
                {caption}
              </figcaption>
            )}
            {imageDownload && (
              <div className="mt-2 flex justify-center">{imageDownload({ src, alt: alt || caption || 'Illustration' })}</div>
            )}
          </figure>
        );
      })}
    </div>
  );
}
