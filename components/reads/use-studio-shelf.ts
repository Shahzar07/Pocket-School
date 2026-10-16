'use client';

import { useEffect, useState } from 'react';
import { readAutosave } from '@/components/editor/use-autosave';
import type { Book } from '@/lib/reads/types';

/** The key Book Studio already uses for its on-device copy. */
export const STUDIO_AUTOSAVE_KEY = 'poket-studio-books';

/** Published titles from the existing Book Studio draft, joined onto the shelf. */
export function usePublishedStudioBooks(): Book[] {
  const [books, setBooks] = useState<Book[]>([]);
  useEffect(() => {
    const load = () => {
      const saved = readAutosave<Book[]>(STUDIO_AUTOSAVE_KEY) ?? [];
      setBooks(saved.filter(book => book?.status === 'published'));
    };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);
  return books;
}
