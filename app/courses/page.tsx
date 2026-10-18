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
import { filterCatalog, recommend } from '@/lib/learning';
import { productAccess, previewViewer } from '@/lib/allocation';
import { coursePriceType, freePreviewCount, courseMinTier, tierDefinition } from '@/lib/entitlements';
import { useTranslation } from 'react-i18next';
import { usePricing } from '@/hooks/use-pricing';
import { useWhiteLabel } from '@/components/white-label-provider';
import { filterTenantCatalogue } from '@/lib/tenant-host';
import { listCatalogue } from '@/lib/institution-store';
import { useAuthSTORE } from '@/hooks/use-auth';
import { PublicFlow } from '@/components/school-desk/route-desk';

const TYPE_FILTERS: { id: CourseType | 'all'; labelKey: string }[] = [
  { id: 'all', labelKey: 'market.all' },
  { id: 'course', labelKey: 'market.courses' },
  { id: 'ebook', labelKey: 'market.ebooks' },
  { id: 'exam', labelKey: 'market.exams' },
  { id: 'solutions', labelKey: 'market.solutions' },
  { id: 'paper', labelKey: 'market.papers' },
  { id: 'bundle', labelKey: 'market.bundles' },
];

const LEVEL_FILTERS: { id: string; labelKey: string }[] = [
  { id: 'All', labelKey: 'market.levelAll' },
  { id: 'Primary', labelKey: 'market.levelPrimary' },
  { id: 'Secondary', labelKey: 'market.levelSecondary' },
  { id: 'GCSE', labelKey: 'market.levelGcse' },
  { id: 'A-Level', labelKey: 'market.levelALevel' },
  { id: 'University', labelKey: 'market.levelUniversity' },
];

const TYPE_LABEL_KEYS: Record<string, string> = {
  course: 'market.courses',
  ebook: 'market.ebooks',
  exam: 'market.exams',
  solutions: 'market.solutions',
  paper: 'market.papers',
  bundle: 'market.bundles',
};

/** Badge for the free lessons at the start of a paid course. */
function freePreviewLabel(c: Course, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (coursePriceType(c) === 'FREE') return t('market.freeCourse');
  const n = freePreviewCount(c);
  if (n === Number.MAX_SAFE_INTEGER || n <= 0) return '';
  return t(n === 1 ? 'market.freeLesson' : 'market.freeLessons', { count: n });
}

/** Which subscription includes this course, when it isn't a one-off purchase. */
function tierBadge(c: Course): string {
  if (coursePriceType(c) !== 'SUBSCRIPTION_INCLUDED') return '';
  const t = courseMinTier(c);
  return t > 0 ? tierDefinition(t).name : '';
}


export default function MarketplacePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { institution } = useWhiteLabel();
  const account = useAuthSTORE((state) => state.profile);
  const [memberCourseIds, setMemberCourseIds] = useState<string[]>([]);
  const { courseLabel, courseConversion } = usePricing();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<CourseType | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState('All');
  const [subjectFilter, setSubjectFilter] = useState('All');
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

  useEffect(() => {
    if (!institution || account?.institutionId !== institution.id) {
      setMemberCourseIds([]);
      return;
    }
    let cancelled = false;
    listCatalogue(institution.id)
      .then((items) => {
        if (!cancelled) setMemberCourseIds(items.filter((item) => item.kind === 'course').map((item) => item.refId));
      })
      .catch(() => { if (!cancelled) setMemberCourseIds([]); });
    return () => { cancelled = true; };
  }, [account?.institutionId, institution]);

  const visible = useMemo(
    () => filterTenantCatalogue(
      courses.filter(course => productAccess(course, previewViewer('guest')).listed),
      institution,
      memberCourseIds,
    ),
    [courses, institution, memberCourseIds],
  );
  const subjects = useMemo(() => {
    const names = visible.map(course => course.subject).filter((name): name is string => !!name);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [visible]);
  const filtered = useMemo(() => {
    const matched = filterCatalog(visible, {
      q: search,
      level: levelFilter === 'All' ? '' : levelFilter,
      subject: subjectFilter === 'All' ? '' : subjectFilter,
    });
    return matched.filter(course => typeFilter === 'all' || course.type === typeFilter);
  }, [visible, typeFilter, levelFilter, subjectFilter, search]);
  const narrowed = search.trim() !== '' || typeFilter !== 'all' || levelFilter !== 'All' || subjectFilter !== 'All';
  const suggested = useMemo(
    () => (narrowed && filtered[0] ? recommend(visible, filtered[0]) : []),
    [visible, filtered, narrowed],
  );

  return (
    <div className="min-h-screen bg-background">
      <PublicFlow flow="marketplace" />
      {/* Hero */}
      <section className="relative py-16 sm:py-20 bg-gradient-to-b from-secondary via-background to-background overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <Badge className="mb-4 rounded-full bg-secondary text-secondary-foreground border-primary/20 text-xs font-semibold">
            {t('market.badge')}
          </Badge>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl tracking-tight text-foreground mb-4">
            {t('market.titleStart')}<br className="hidden sm:block" /> {t('market.titleEnd')}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            {t('market.subtitle')}
          </p>
          <div className="bg-card border border-border rounded-full p-1 pl-4 flex items-center shadow-[var(--shadow-card)] max-w-xl mx-auto">
            <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
            <input
              type="text"
              placeholder={t('market.search')}
              className="flex-1 min-w-0 bg-transparent outline-none text-sm py-2"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="border-y border-border bg-muted/30 py-4 sticky top-16 z-30 backdrop-blur-xl bg-background/85">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex gap-1.5 flex-wrap">
            {TYPE_FILTERS.map(filter => (
              <button
                key={filter.id}
                onClick={() => setTypeFilter(filter.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  typeFilter === filter.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {t(filter.labelKey)}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-border mx-1 hidden sm:block" />
          <div className="flex gap-1.5 flex-wrap">
            {LEVEL_FILTERS.map(level => (
              <button
                key={level.id}
                onClick={() => setLevelFilter(level.id)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                  levelFilter === level.id ? 'bg-foreground text-background' : 'bg-transparent text-muted-foreground hover:bg-muted'
                }`}
              >
                {t(level.labelKey)}
              </button>
            ))}
          </div>
          {subjects.length > 0 && (
            <div className="flex gap-1.5 flex-wrap basis-full">
              {['All', ...subjects].map(subject => (
                <button
                  key={subject}
                  onClick={() => setSubjectFilter(subject)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                    subjectFilter === subject ? 'bg-foreground text-background' : 'bg-transparent text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {subject === 'All' ? t('market.allSubjects') : subject}
                </button>
              ))}
            </div>
          )}
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
              <p className="text-sm text-muted-foreground">{t('market.noMatch')}</p>
            </div>
          )}

          {!loading && courses.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative max-w-3xl mx-auto rounded-2xl border border-border bg-card overflow-hidden shadow-[var(--shadow-card-hover)]"
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-[#6FBBCE] to-[#3FE0D0]" />
              <div className="p-8 sm:p-12 text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-primary/20 text-[10px] font-bold tracking-[0.15em] text-secondary-foreground">
                  <ShieldCheck className="w-3 h-3" />
                  {t('market.opening')}
                </span>

                <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl tracking-tight text-foreground leading-[1.05] mt-6 mb-4">
                  {t('market.shelves')}
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
                  {t('market.shelvesBody')}
                </p>

                <div className="mt-8 grid sm:grid-cols-2 gap-3 text-left">
                  <Link
                    href="/ai-studio"
                    className="group flex items-start gap-4 rounded-xl border border-border bg-muted/40 p-5 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] transition-all"
                  >
                    <span className="w-10 h-10 shrink-0 rounded-xl bg-card border border-border text-primary flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-extrabold text-foreground mb-0.5">
                        {t('market.meanwhile')}
                      </span>
                      <span className="block text-xs text-muted-foreground leading-relaxed">
                        {t('market.meanwhileBody')}
                      </span>
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
                        {t('market.openStudio')}
                        <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </Link>

                  <a
                    href="mailto:educators@poketschool.ai?subject=Teach%20with%20Poket%20School"
                    className="group flex items-start gap-4 rounded-xl border border-border bg-muted/40 p-5 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] transition-all"
                  >
                    <span className="w-10 h-10 shrink-0 rounded-xl bg-card border border-border text-primary flex items-center justify-center">
                      <Mail className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-extrabold text-foreground mb-0.5">
                        {t('market.teach')}
                      </span>
                      <span className="block text-xs text-muted-foreground leading-relaxed">
                        {t('market.teachBody')}
                      </span>
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
                        educators@poketschool.ai
                        <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </a>
                </div>
              </div>
            </motion.div>
          )}

          {!loading && suggested.length > 0 && filtered[0] && (
            <div className="mb-8">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
                {t('market.related', { title: filtered[0].title })}
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {suggested.map(course => (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className="min-w-[220px] max-w-[260px] shrink-0 rounded-xl border border-border bg-card p-4 hover:border-foreground/25"
                  >
                    <p className="text-sm font-bold line-clamp-2">{course.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{course.subject || course.level || t('market.course')}</p>
                  </Link>
                ))}
              </div>
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
                          {t(TYPE_LABEL_KEYS[c.type ?? 'course'] ?? 'market.courses')}
                        </span>
                        {freePreviewLabel(c, t) && (
                          <span className="absolute bottom-2.5 left-2.5 text-[10px] font-bold px-2 py-1 rounded bg-success text-white shadow-sm">
                            {freePreviewLabel(c, t)}
                          </span>
                        )}
                      </div>

                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="font-bold text-[15px] leading-snug text-foreground mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                          {c.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mb-2">{c.ownerName ?? 'Poket School'}</p>

                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-[13px] font-bold text-[var(--ps-cyan-text)] tabular-nums">{t('market.new')}</span>
                          <span className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(n => (
                              <Star key={n} className="w-3 h-3 fill-[var(--ps-cyan-text)] text-[var(--ps-cyan-text)]" />
                            ))}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            ({(c.enrollmentCount ?? 0).toLocaleString()})
                          </span>
                        </div>

                        <p className="text-[11px] text-muted-foreground mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                          {c.durationHours ? <span>{t('market.hours', { count: c.durationHours })}</span> : null}
                          {c.level && <><span aria-hidden>·</span><span>{c.level}</span></>}
                          {c.subject && <><span aria-hidden>·</span><span className="truncate">{c.subject}</span></>}
                        </p>

                        <div className="mt-auto flex items-baseline gap-2">
                          <span className={`text-lg font-extrabold ${c.price ? 'text-foreground' : 'text-success'}`}>
                            {!c.price || c.price <= 0 ? t('market.free') : courseLabel(c.price, c.currency)}
                          </span>
                          {courseConversion(c.price, c.currency) && (
                            <span className="text-xs font-medium text-muted-foreground">
                              {t('market.approx', { amount: courseConversion(c.price, c.currency) })}
                            </span>
                          )}
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
