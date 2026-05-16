'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { BookOpen, Brain, Search, Filter, ArrowRight, Loader2 } from 'lucide-react';
import { getPublicCourses, type Course, type CourseType } from '@/lib/db';

const TYPE_FILTERS: { id: CourseType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'course', label: 'Courses' },
  { id: 'ebook', label: 'eBooks' },
  { id: 'exam', label: 'Exams' },
  { id: 'solutions', label: 'Solutions' },
  { id: 'paper', label: 'Past Papers' },
  { id: 'bundle', label: 'Bundles' },
];

const LEVEL_FILTERS = ['All', 'Primary', 'Secondary', 'GCSE', 'A-Level', 'University'];

function priceLabel(c: Course) {
  if (!c.price || c.price === 0) return 'Free';
  const symbol = c.currency === 'USD' ? '$' : c.currency === 'EUR' ? '€' : '£';
  return `${symbol}${c.price.toFixed(2)}`;
}

export default function MarketplacePage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<CourseType | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getPublicCourses();
        if (!cancelled) setCourses(list);
      } catch {
        if (!cancelled) setCourses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    return courses.filter(c => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      if (levelFilter !== 'All' && c.level !== levelFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${c.title} ${c.description} ${c.subject ?? ''} ${(c.tags ?? []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [courses, typeFilter, levelFilter, search]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-foreground">Pocket School</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">Sign In</Link>
            <Button onClick={() => router.push('/signup')} className="rounded-full h-9 px-5 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-16 sm:py-20 bg-gradient-to-b from-amber-50 via-background to-background overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <Badge className="mb-4 rounded-full bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
            Marketplace
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground mb-4">
            Courses, eBooks &<br className="hidden sm:block" /> past papers, made by teachers.
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Browse and buy without an account. AI-enhanced study materials from real educators.
          </p>
          <div className="bg-white rounded-full p-1 pl-4 flex items-center shadow-lg max-w-xl mx-auto">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search by subject, topic or product…"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm py-2"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="border-y border-border bg-muted/30 py-4 sticky top-16 z-30 backdrop-blur-xl bg-white/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex gap-1.5 flex-wrap">
            {TYPE_FILTERS.map(t => (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  typeFilter === t.id ? 'bg-google-blue text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-border mx-1 hidden sm:block" />
          <div className="flex gap-1.5 flex-wrap">
            {LEVEL_FILTERS.map(l => (
              <button
                key={l}
                onClick={() => setLevelFilter(l)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                  levelFilter === l ? 'bg-foreground text-background' : 'bg-transparent text-muted-foreground hover:bg-muted'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {loading && (
            <div className="text-center py-20">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-20">
              <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No products match these filters yet.</p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.04 }}
                >
                  <Link href={`/courses/${c.id}`}>
                    <Card className="overflow-hidden border hover:shadow-lg transition-all h-full flex flex-col">
                      <div className="aspect-video bg-gradient-to-br from-blue-100 via-indigo-100 to-violet-100 relative flex items-center justify-center">
                        {c.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.thumbnailUrl} alt={c.title} className="w-full h-full object-cover" />
                        ) : (
                          <BookOpen className="w-12 h-12 text-blue-400/60" />
                        )}
                        <span className="absolute top-3 left-3 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-white/95 text-foreground shadow-sm">
                          {c.type ?? 'course'}
                        </span>
                        {c.level && (
                          <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-1 rounded bg-black/70 text-white">
                            {c.level}
                          </span>
                        )}
                      </div>
                      <div className="p-5 flex flex-col flex-1">
                        <h3 className="font-bold text-base text-foreground mb-1 line-clamp-2">{c.title}</h3>
                        <p className="text-xs text-muted-foreground mb-3">{c.ownerName ?? 'Pocket School'}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">{c.description}</p>
                        <div className="flex items-center justify-between">
                          <span className={`text-base font-extrabold ${c.price ? 'text-foreground' : 'text-emerald-600'}`}>
                            {priceLabel(c)}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            View <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
