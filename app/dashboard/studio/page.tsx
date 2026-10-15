'use client';

import Studio from '@/app/ai-studio/page';

export default function StudioInDashboard() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-border">
      <Studio />
    </div>
  );
}
