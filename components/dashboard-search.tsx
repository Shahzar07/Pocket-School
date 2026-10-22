'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, BookOpen, BookMarked, Megaphone, FolderOpen, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { Course, Announcement, Resource } from '@/lib/db';

interface BookHit {
  id: string;
  title: string;
  href: string;
  subject: string;
}

interface SearchResults {
  courses: Course[];
  announcements: Announcement[];
  resources: Resource[];
  books?: BookHit[];
}

export function DashboardSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The "/" hint in the field has to actually do something.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement
        || el instanceof HTMLTextAreaElement
        || (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults(null); setOpen(false); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data: SearchResults = await res.json();
        setResults(data);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const books = results?.books ?? [];
  const total = results ? results.courses.length + results.announcements.length + results.resources.length + books.length : 0;

  return (
    <div className="relative w-full min-w-0 max-w-[420px] max-md:fixed max-md:inset-x-4 max-md:top-20 max-md:z-50 max-md:w-auto max-md:opacity-0 max-md:pointer-events-none focus-within:opacity-100 focus-within:pointer-events-auto md:static md:opacity-100 md:pointer-events-auto" ref={wrapperRef}>
      <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
      {loading
        ? <Loader2 className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
        : (
          /* Keyboard hint, as in the reference topbar. */
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden h-6 items-center rounded-md border border-border bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground pointer-events-none sm:flex">
            ⌘K
          </kbd>
        )}
      <Input
        ref={inputRef}
        id="dashboard-search"
        aria-label="Search courses, books, and school updates"
        placeholder="Search courses, books, announcements"
        className="pl-11 pr-11 h-11 bg-card border-border rounded-2xl text-[13.5px] shadow-[var(--shadow-card)] focus-visible:ring-primary/30"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results && setOpen(true)}
      />
      {open && results && (
        <div className="absolute top-12 left-0 w-full bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
          {total === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No results for &ldquo;{query}&rdquo;</p>
          ) : (
            <>
              {books.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">Books</p>
                  {books.slice(0, 3).map(b => (
                    <button key={b.id} onClick={() => { router.push(b.href); setOpen(false); setQuery(''); }}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted text-left">
                      <BookMarked className="w-4 h-4 text-primary shrink-0" />
                      <div><p className="text-sm font-medium text-foreground truncate">{b.title}</p>
                      <p className="text-xs text-gray-400 truncate">{b.subject}</p></div>
                    </button>
                  ))}
                </div>
              )}
              {results.courses.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">Courses</p>
                  {results.courses.slice(0, 3).map(c => (
                    <button key={c.id} onClick={() => { router.push(`/dashboard/student/courses/${c.id}`); setOpen(false); setQuery(''); }}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted text-left">
                      <BookOpen className="w-4 h-4 text-blue-500 shrink-0" />
                      <div><p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                      <p className="text-xs text-gray-400 truncate">{c.subject}</p></div>
                    </button>
                  ))}
                </div>
              )}
              {results.announcements.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">Announcements</p>
                  {results.announcements.slice(0, 2).map(a => (
                    <button key={a.id} onClick={() => { router.push('/dashboard/announcements'); setOpen(false); setQuery(''); }}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted text-left">
                      <Megaphone className="w-4 h-4 text-purple-500 shrink-0" />
                      <p className="text-sm text-foreground truncate">{a.title}</p>
                    </button>
                  ))}
                </div>
              )}
              {results.resources.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">Resources</p>
                  {results.resources.slice(0, 2).map(r => (
                    <button key={r.id} onClick={() => { router.push('/dashboard/resources'); setOpen(false); setQuery(''); }}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted text-left">
                      <FolderOpen className="w-4 h-4 text-teal-500 shrink-0" />
                      <p className="text-sm text-foreground truncate">{r.title}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
