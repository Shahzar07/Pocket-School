'use client';

import { useState } from 'react';
import { BlogLivePreview } from '@/components/blog/live-preview';
import { SAMPLE_POSTS, type BlogPost } from '@/lib/blog/posts';

export default function BlogPreviewPage() {
  const [draft, setDraft] = useState<BlogPost>(SAMPLE_POSTS[0]!);
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Rochford demo · Blog editor</p>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <label className="block text-sm font-semibold">Body
          <textarea className="mt-1 h-80 w-full rounded-2xl border px-3 py-2" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
        </label>
        <BlogLivePreview post={draft} />
      </div>
    </main>
  );
}
