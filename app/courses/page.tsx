'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { BookOpen, Search, Filter, ArrowRight, Loader2, Sparkles, Mail, ShieldCheck, Star } from 'lucide-react';
import { getPublicCourses, type Course, type CourseType } from '@/lib/db';
import { courseCover } from '@/lib/course-cover';
import { coursePriceType, freePreviewCount, courseMinTier, tierDefinition } from '@/lib/entitlements';

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

/** Badge for the free lessons at the start of a paid course. */
function freePreviewLabel(c: Course): string {
  if (coursePriceType(c) === 'FREE') return 'Free course';
  const n = freePreviewCount(c);
  if (n === Number.MAX_SAFE_INTEGER || n <= 0) return '';
  return `${n} free lesson${n === 1 ? '' : 's'}`;
}

/** Which subscription includes this course, when it isn't a one-off purchase. */
function tierBadge(c: Course): string {
  if (coursePriceType(c) !== 'SUBSCRIPTION_INCLUDED') return '';
  const t = courseMinTier(c);
  return t > 0 ? tierDefinition(t).name : '';
}

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
      {/* Hero */}
      <section className="relative py-16 sm:py-20 bg-gradient-to-b from-amber-50 via-background to-background overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <Badge className="mb-4 rounded-full bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
            Marketplace
          </Badge>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl tracking-tight text-foreground mb-4">
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

          {!loading && filtered.length === 0 && courses.length > 0 && (
            <div className="text-center py-20">
              <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No products match these filters yet.</p>
            </div>
          )}

          {!loading && courses.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative max-w-3xl mx-auto rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_30px_70px_-40px_rgba(15,23,42,0.35)]"
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#1A73E8] via-[#7C3AED] to-[#F5B400]" />
              <div className="p-8 sm:p-12 text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EEF3FF] border border-[#1A73E8]/20 text-[10px] font-bold tracking-[0.15em] text-[#1E3A8A]">
                  <ShieldCheck className="w-3 h-3" />
                  MARKETPLACE OPENING SOON
                </span>

                <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#0B1B3F] leading-[1.05] mt-6 mb-4">
                  The shelves are being stocked.
                </h2>
                <p className="text-base text-slate-600 leading-relaxed max-w-xl mx-auto">
                  We are onboarding verified educators right now — every course, eBook and past paper is
                  reviewed before it goes live, so the marketplace opens with material worth paying for
                  rather than whatever got uploaded first.
                </p>

                <div className="mt-8 grid sm:grid-cols-2 gap-3 text-left">
                  <Link
                    href="/ai-studio"
                    className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-[#F8FAFF] p-5 hover:border-[#1A73E8]/40 hover:shadow-[0_20px_50px_-20px_rgba(26,115,232,0.25)] transition-all"
                  >
                    <span className="w-10 h-10 shrink-0 rounded-xl bg-white border border-slate-200 text-[#1A73E8] flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-extrabold text-[#0B1B3F] mb-0.5">
                        Meanwhile, create your own
                      </span>
                      <span className="block text-xs text-slate-600 leading-relaxed">
                        Build study materials with Quill in the AI Studio.
                      </span>
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#1A73E8]">
                        Open AI Studio
                        <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </Link>

                  <a
                    href="mailto:educators@poketschool.ai?subject=Teach%20with%20Poket%20School"
                    className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-[#F8FAFF] p-5 hover:border-[#1A73E8]/40 hover:shadow-[0_20px_50px_-20px_rgba(26,115,232,0.25)] transition-all"
                  >
                    <span className="w-10 h-10 shrink-0 rounded-xl bg-white border border-slate-200 text-[#1A73E8] flex items-center justify-center">
                      <Mail className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-extrabold text-[#0B1B3F] mb-0.5">
                        Teach with us
                      </span>
                      <span className="block text-xs text-slate-600 leading-relaxed">
                        Educators: list your material and earn from every sale.
                      </span>
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#1A73E8]">
                        educators@poketschool.ai
                        <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </a>
                </div>
              </div>
            </motion.div>
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
                  <Link href={`/courses/${c.id}`} className="group block h-full">
                    <Card className="overflow-hidden border hover:border-foreground/25 hover:shadow-xl transition-all h-full flex flex-col rounded-xl">
                      <div className="aspect-video bg-muted relative overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.thumbnailUrl || courseCover(c.title, c.subject ?? '')}
                          alt={c.title}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        />
                        <span className="absolute top-2.5 left-2.5 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-white/95 text-foreground shadow-sm">
                          {c.type ?? 'course'}
                        </span>
                        {freePreviewLabel(c) && (
                          <span className="absolute bottom-2.5 left-2.5 text-[10px] font-bold px-2 py-1 rounded bg-emerald-600 text-white shadow-sm">
                            {freePreviewLabel(c)}
                          </span>
                        )}
                      </div>

                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="font-bold text-[15px] leading-snug text-foreground mb-1 line-clamp-2 group-hover:text-blue-700 transition-colors">
                          {c.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mb-2">{c.ownerName ?? 'Poket School'}</p>

                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-[13px] font-bold text-amber-700 tabular-nums">New</span>
                          <span className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(n => (
                              <Star key={n} className="w-3 h-3 fill-amber-400 text-amber-400" />
                            ))}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            ({(c.enrollmentCount ?? 0).toLocaleString()})
                          </span>
                        </div>

                        <p className="text-[11px] text-muted-foreground mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                          {c.durationHours ? <span>{c.durationHours} total hours</span> : null}
                          {c.level && <><span aria-hidden>·</span><span>{c.level}</span></>}
                          {c.subject && <><span aria-hidden>·</span><span className="truncate">{c.subject}</span></>}
                        </p>

                        <div className="mt-auto flex items-baseline gap-2">
                          <span className={`text-lg font-extrabold ${c.price ? 'text-foreground' : 'text-emerald-600'}`}>
                            {priceLabel(c)}
                          </span>
                          {tierBadge(c) && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {tierBadge(c)}
                            </span>
                          )}
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
