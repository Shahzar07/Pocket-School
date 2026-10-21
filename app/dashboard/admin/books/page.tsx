'use client';

import { StudioView } from '@/components/reads/studio-view';

/**
 * AI Book Creator. The dashboard layout already hides the admin menu and
 * draws the ET AI shell around this route. This page only fills that shell.
 */
export default function BookStudioPage() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden" data-book-studio="1">
      <StudioView />
    </div>
  );
}
