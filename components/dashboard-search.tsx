'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, BookOpen, Megaphone, FolderOpen, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { Course, Announcement, Resource } from '@/lib/db';

interface SearchResults {
  courses: Course[];
  announcements: Announcement[];
  resources: Resource[];
}

export function DashboardSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const total = results ? results.courses.length + results.announcements.length + results.resources.length : 0;

  return (
    <div className="relative hidden md:block w-96" ref={wrapperRef}>
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      {loading && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
      <Input
        placeholder="Search courses, lessons, resources..."
        className="pl-9 h-10 bg-[#F1F3F4] border-transparent focus:bg-white rounded-full text-sm"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results && setOpen(true)}
      />
      {open && results && (
        <div className="absolute top-12 left-0 w-full bg-white border border-[#DADCE0] rounded-xl shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
          {total === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No results for &ldquo;{query}&rdquo;</p>
          ) : (
            <>
              {results.courses.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">Courses</p>
                  {results.courses.slice(0, 3).map(c => (
                    <button key={c.id} onClick={() => { router.push(`/dashboard/student/courses/${c.id}`); setOpen(false); setQuery(''); }}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#F8F9FA] text-left">
                      <BookOpen className="w-4 h-4 text-blue-500 shrink-0" />
                      <div><p className="text-sm font-medium text-[#202124] truncate">{c.title}</p>
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
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#F8F9FA] text-left">
                      <Megaphone className="w-4 h-4 text-purple-500 shrink-0" />
                      <p className="text-sm text-[#202124] truncate">{a.title}</p>
                    </button>
                  ))}
                </div>
              )}
              {results.resources.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">Resources</p>
                  {results.resources.slice(0, 2).map(r => (
                    <button key={r.id} onClick={() => { router.push('/dashboard/resources'); setOpen(false); setQuery(''); }}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#F8F9FA] text-left">
                      <FolderOpen className="w-4 h-4 text-teal-500 shrink-0" />
                      <p className="text-sm text-[#202124] truncate">{r.title}</p>
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
