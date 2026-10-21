'use client';

import { use } from 'react';
import { EditorDesk } from '@/components/blog/editor-desk';

export default function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <EditorDesk slug={decodeURIComponent(id)} />;
}
