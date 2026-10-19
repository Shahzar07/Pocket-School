'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CataloguePreview,
  FeaturedPreview,
  InstitutionPreview,
  ProgrammePreview,
} from '@/components/courses/placement-previews';
import { useAuthSTORE } from '@/hooks/use-auth';
import { resolveStaffRole } from '@/lib/admin-console';
import { PLACE } from '@/lib/courses/placement-copy';
import {
  canFeature,
  courseLine,
  dedupeById,
  duplicateTitleGroups,
  institutionChoices,
  moneyLabel,
  yearTitleHint,
  type ProgrammePlan,
} from '@/lib/courses/placement';
import {
  listFeaturedStats,
  listShowcaseBooks,
  mergeDuplicateCourse,
  saveBookShowcase,
  type FeaturedStat,
  type ShowcaseBook,
} from '@/lib/courses/featured-store';
import { getAllCourses, getInstitutions, updateCourse, type Course, type Institution } from '@/lib/db';
import { platformPlaces, type Publication } from '@/lib/institution-commerce';
import type { VolumePlanId } from '@/lib/institution-pricing';

const LEVELS: { id: VolumePlanId; label: string }[] = [
  { id: 'primary_secondary', label: 'Primary and Secondary' },
  { id: 'igcse_alevel', label: 'IGCSE and A-Level' },
  { id: 'professional', label: 'Professional' },
];

const KNOWN = new Set<string>(LEVELS.map((row) => row.id));

function createdOn(value: { toDate?: () => Date } | undefined): string {
  try {
    return value?.toDate?.()?.toISOString().slice(0, 10) ?? '';
  } catch {
    return '';
  }
}

function createdMs(value: { toMillis?: () => number } | undefined): number | undefined {
  try {
    return value?.toMillis?.();
  } catch {
    return undefined;
  }
}

function publicationFrom(course: Course): Publication {
  const levels = (course.placement?.levels ?? []).filter((id): id is VolumePlanId => KNOWN.has(id));
  const marketplace = course.placement?.marketplace
    ?? (course.marketplaceApproved ? 'approved' : 'hidden');
  return {
    origin: course.institutionId ? 'institution' : 'platform',
    library: course.libraryApproved ? 'approved' : 'draft',
    marketplace,
    featured: course.placement?.featured ?? course.featured === true,
    core: course.placement?.core ?? course.visibility === 'core',
    levels,
    institutionIds: course.placement?.institutionIds ?? course.allocatedInstitutionIds ?? [],
    priority: course.placement?.priority ?? 0,
    featuredFrom: course.placement?.featuredFrom ?? '',
    featuredUntil: course.placement?.featuredUntil ?? '',
  };
}

export default function CoursePlacementPage() {
  const { profile } = useAuthSTORE();
  const staff = resolveStaffRole(profile);
  const allowed = staff === 'super_admin' || staff === 'admin';
  const [courses, setCourses] = useState<Course[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [books, setBooks] = useState<ShowcaseBook[]>([]);
  const [stats, setStats] = useState<FeaturedStat[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [bookId, setBookId] = useState('');
  const [marketplace, setMarketplace] = useState<Publication['marketplace']>('hidden');
  const [featured, setFeatured] = useState(false);
  const [core, setCore] = useState(false);
  const [levels, setLevels] = useState<VolumePlanId[]>([]);
  const [institutionIds, setInstitutionIds] = useState<string[]>([]);
  const [priority, setPriority] = useState(0);
  const [featuredFrom, setFeaturedFrom] = useState('');
  const [featuredUntil, setFeaturedUntil] = useState('');
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [dragId, setDragId] = useState('');
  const [saving, setSaving] = useState(false);
  const [mergeKeep, setMergeKeep] = useState('');
  const [mergeDrop, setMergeDrop] = useState('');
  const [mergeArmed, setMergeArmed] = useState(false);

  const load = useCallback(async () => {
    const [nextCourses, nextInstitutions, nextBooks, nextStats] = await Promise.all([
      getAllCourses(),
      getInstitutions(),
      listShowcaseBooks(),
      listFeaturedStats(),
    ]);
    const unique = dedupeById(nextCourses);
    setCourses(unique);
    setInstitutions(dedupeById(nextInstitutions));
    setBooks(nextBooks);
    setStats(nextStats);
    const featuredRows = unique
      .filter((course) => course.placement?.featured && course.placement.marketplace === 'approved' && course.status === 'published')
      .sort((a, b) => (b.placement?.priority ?? 0) - (a.placement?.priority ?? 0) || a.title.localeCompare(b.title));
    setOrderIds(featuredRows.map((course) => course.id));
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void load().catch(() => toast.error(PLACE.loadFailed));
  }, [allowed, load]);

  const institutionName = useMemo(() => {
    const map = new Map(institutions.map((row) => [row.id, row.name]));
    return (id?: string) => (id ? map.get(id) ?? '' : '');
  }, [institutions]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return courses.filter((course) => !needle || course.title.toLowerCase().includes(needle) || course.id.toLowerCase().includes(needle));
  }, [courses, query]);

  const schools = useMemo(() => institutionChoices(institutions.map((row) => ({
    id: row.id,
    name: row.name,
    domain: row.domain,
    createdAtMs: createdMs(row.createdAt),
  }))), [institutions]);

  const selected = courses.find((course) => course.id === selectedId) ?? null;
  const selectedBook = books.find((book) => book.id === bookId) ?? null;
  const groups = useMemo(() => duplicateTitleGroups(courses), [courses]);
  const featuredLocked = !canFeature(marketplace === 'pending' ? 'hidden' : marketplace);

  const choose = (course: Course) => {
    const pub = publicationFrom(course);
    setBookId('');
    setSelectedId(course.id);
    setMarketplace(pub.marketplace);
    setFeatured(pub.featured && canFeature(pub.marketplace));
    setCore(pub.core);
    setLevels(pub.levels);
    setInstitutionIds(pub.institutionIds);
    setPriority(pub.priority ?? 0);
    setFeaturedFrom(pub.featuredFrom ?? '');
    setFeaturedUntil(pub.featuredUntil ?? '');
  };

  const chooseBook = (book: ShowcaseBook) => {
    setSelectedId('');
    setBookId(book.id);
    setFeatured(book.featured);
    setPriority(book.priority);
    setFeaturedFrom(book.featuredFrom);
    setFeaturedUntil(book.featuredUntil);
  };

  const toggleLevel = (id: VolumePlanId) => {
    setLevels((current) => current.includes(id) ? current.filter((item) => item !== id) : current.concat(id));
  };

  const toggleInstitution = (id: string) => {
    setInstitutionIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.concat(id));
  };

  const save = async () => {
    if (selectedBook) {
      setSaving(true);
      try {
        await saveBookShowcase(selectedBook.id, {
          featured,
          priority,
          from: featuredFrom,
          until: featuredUntil,
        });
        toast.success(PLACE.saved);
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : PLACE.saveFailed);
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!selected) return;
    const placed = platformPlaces(publicationFrom(selected), {
      marketplace: marketplace === 'pending' ? 'hidden' : marketplace,
      featured: featured && !featuredLocked,
      core,
      levels,
      institutionIds,
      priority,
      featuredFrom,
      featuredUntil,
    });
    if ('error' in placed) {
      toast.error(placed.error);
      return;
    }
    const listed = placed.marketplace === 'approved';
    const shared = placed.core || placed.institutionIds.length > 0;
    setSaving(true);
    try {
      await updateCourse(selected.id, {
        placement: {
          marketplace: placed.marketplace,
          featured: placed.featured,
          core: placed.core,
          levels: placed.levels,
          institutionIds: placed.institutionIds,
          priority: placed.priority ?? 0,
          featuredFrom: placed.featuredFrom ?? '',
          featuredUntil: placed.featuredUntil ?? '',
          ...(selected.placement?.mergedInto ? { mergedInto: selected.placement.mergedInto } : {}),
        },
        featured: placed.featured,
        marketplaceApproved: listed,
        isPublic: listed || shared,
        visibility: placed.core ? 'core' : listed ? 'marketplace' : 'institution',
        allocatedInstitutionIds: placed.institutionIds,
      });
      toast.success(PLACE.saved);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : PLACE.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const move = (id: string, direction: -1 | 1) => {
    setOrderIds((current) => {
      const next = [...current];
      const index = next.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return current;
      const swap = next[target];
      next[target] = id;
      next[index] = swap ?? id;
      return next;
    });
  };

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setOrderIds((current) => {
      const next = current.filter((id) => id !== dragId);
      const index = next.indexOf(targetId);
      next.splice(index < 0 ? next.length : index, 0, dragId);
      return next;
    });
    setDragId('');
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      for (let index = 0; index < orderIds.length; index++) {
        const id = orderIds[index];
        const course = courses.find((row) => row.id === id);
        if (!course) continue;
        const nextPriority = (orderIds.length - index) * 10;
        await updateCourse(course.id, {
          placement: {
            marketplace: course.placement?.marketplace ?? 'approved',
            featured: true,
            core: course.placement?.core ?? false,
            levels: course.placement?.levels ?? [],
            institutionIds: course.placement?.institutionIds ?? [],
            priority: nextPriority,
            featuredFrom: course.placement?.featuredFrom ?? '',
            featuredUntil: course.placement?.featuredUntil ?? '',
            ...(course.placement?.mergedInto ? { mergedInto: course.placement.mergedInto } : {}),
          },
        });
      }
      toast.success(PLACE.orderSaved);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : PLACE.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const rename = async (course: Course, title: string) => {
    try {
      await updateCourse(course.id, { title });
      toast.success(PLACE.renamed);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : PLACE.saveFailed);
    }
  };

  const merge = async () => {
    if (!mergeArmed) {
      setMergeArmed(true);
      return;
    }
    setSaving(true);
    try {
      await mergeDuplicateCourse(mergeKeep, mergeDrop);
      toast.success(PLACE.mergeDone);
      setMergeArmed(false);
      setMergeKeep('');
      setMergeDrop('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : PLACE.mergeFailed);
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <DashPage>
        <DashHeader eyebrow={PLACE.pageEyebrow} title={PLACE.pageTitle} description={PLACE.pageDescription} />
        <Panel><p className="text-sm text-muted-foreground">{PLACE.adminOnly}</p></Panel>
      </DashPage>
    );
  }

  const statFor = (id: string) => stats.find((row) => row.id === id);
  const selectedStat = selected ? statFor(`${selected.type === 'bundle' ? 'bundle' : 'course'}:${selected.id}`) : undefined;
  const hint = selected ? yearTitleHint(selected.title) : null;
  const shownSchools = schools.filter((school) => institutionIds.includes(school.id) || school.duplicateIds.some((id) => institutionIds.includes(id)));

  return (
    <DashPage>
      <DashHeader eyebrow={PLACE.pageEyebrow} title={PLACE.pageTitle} description={PLACE.pageDescription} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={PLACE.find} placeholder={PLACE.find} />
          <ul className="mt-3 max-h-[32rem] space-y-1 overflow-auto">
            {visible.map((course) => {
              const line = courseLine({
                ownerId: course.ownerId,
                ownerName: course.ownerName,
                institutionName: institutionName(course.institutionId),
                createdOn: createdOn(course.createdAt),
                status: course.placement?.mergedInto ? `${course.status} · ${course.placement.mergedInto}` : course.status,
              });
              const year = yearTitleHint(course.title);
              return (
                <li key={course.id}>
                  <button
                    type="button"
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${course.id === selectedId ? 'bg-secondary' : 'hover:bg-muted'}`}
                    onClick={() => choose(course)}
                  >
                    <span className="block font-medium">{course.title}</span>
                    <span className="block text-xs text-muted-foreground">{line}</span>
                    {year ? <span className="block text-xs text-[#1E6A83]">{year}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
        <div className="space-y-4">
          <Panel>
            {!selected && !selectedBook ? <p className="text-sm text-muted-foreground">{PLACE.choose}</p> : null}
            {selected ? (
              <div className="space-y-5">
                <div>
                  <p className="font-semibold">{selected.title}</p>
                  <p className="text-xs text-muted-foreground">{courseLine({
                    ownerId: selected.ownerId,
                    ownerName: selected.ownerName,
                    institutionName: institutionName(selected.institutionId),
                    createdOn: createdOn(selected.createdAt),
                    status: selected.status,
                  })}</p>
                  {hint ? (
                    <div className="mt-2 rounded-xl bg-[#F4FBFA] p-3 text-sm">
                      <p>{PLACE.yearFlag}</p>
                      <p className="text-[#1E6A83]">{`${PLACE.suggested}: ${hint}`}</p>
                      <Button type="button" variant="outline" className="mt-2 h-9" onClick={() => void rename(selected, hint)}>{PLACE.rename}</Button>
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">{`${PLACE.impressions} ${selectedStat?.impressions ?? 0} · ${PLACE.clicks} ${selectedStat?.clicks ?? 0}`}</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block text-sm">
                    {PLACE.marketplace}
                    <select
                      className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3"
                      value={marketplace === 'pending' ? 'hidden' : marketplace}
                      onChange={(event) => {
                        const next = event.target.value as 'approved' | 'rejected' | 'hidden';
                        setMarketplace(next);
                        if (next !== 'approved') setFeatured(false);
                      }}
                      aria-label={PLACE.marketplaceLabel}
                    >
                      <option value="hidden">{PLACE.hidden}</option>
                      <option value="approved">{PLACE.listed}</option>
                      <option value="rejected">{PLACE.rejected}</option>
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">{PLACE.marketplaceHelp}</p>
                  </label>
                  <CataloguePreview
                    title={selected.title}
                    priceLabel={moneyLabel(selected.price, selected.currency)}
                    listed={marketplace === 'approved'}
                  />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <span className="block text-sm" title={featuredLocked ? PLACE.featuredLock : undefined}>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={featured && !featuredLocked}
                          disabled={featuredLocked}
                          onChange={(event) => setFeatured(event.target.checked)}
                        />
                        {PLACE.featured}
                      </label>
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">{PLACE.featuredHelp}</p>
                    {featuredLocked ? <p className="mt-1 text-xs text-[#1E6A83]">{PLACE.featuredLock}</p> : null}
                    <label className="mt-3 block text-sm">
                      {PLACE.priority}
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={priority}
                        onChange={(event) => setPriority(Number(event.target.value))}
                        className="mt-1 h-10 w-28 rounded-xl border border-border bg-card px-3"
                        aria-label={PLACE.priority}
                      />
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">{PLACE.priorityHelp}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="text-sm">
                        {PLACE.from}
                        <input type="date" value={featuredFrom} onChange={(event) => setFeaturedFrom(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3" aria-label={PLACE.from} />
                      </label>
                      <label className="text-sm">
                        {PLACE.until}
                        <input type="date" value={featuredUntil} onChange={(event) => setFeaturedUntil(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3" aria-label={PLACE.until} />
                      </label>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{PLACE.datesHelp}</p>
                  </div>
                  <FeaturedPreview
                    shown={featured && !featuredLocked}
                    id={selected.id}
                    title={selected.title}
                    level={selected.level ?? ''}
                    subject={selected.subject ?? ''}
                    price={selected.price}
                    currency={selected.currency}
                    cover={selected.thumbnailUrl ?? ''}
                    kind={selected.type === 'bundle' ? 'bundle' : 'course'}
                    priority={priority}
                    from={featuredFrom}
                    until={featuredUntil}
                  />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={core} onChange={(event) => setCore(event.target.checked)} />
                      {PLACE.core}
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">{PLACE.coreHelp}</p>
                    <fieldset className="mt-3">
                      <legend className="text-sm font-medium">{PLACE.levels}</legend>
                      <div className="mt-2 space-y-1">
                        {LEVELS.map((level) => (
                          <label key={level.id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={levels.includes(level.id)} onChange={() => toggleLevel(level.id)} />
                            {level.label}
                          </label>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{PLACE.levelsHelp}</p>
                    </fieldset>
                  </div>
                  <ProgrammePreview title={selected.title} levels={core ? levels : []} />
                </div>
                <fieldset>
                  <legend className="text-sm font-medium">{PLACE.institutions}</legend>
                  <div className="mt-2 max-h-48 space-y-2 overflow-auto">
                    {schools.map((school) => (
                      <label key={school.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={institutionIds.includes(school.id) || school.duplicateIds.some((id) => institutionIds.includes(id))}
                          onChange={() => toggleInstitution(school.id)}
                        />
                        <span>
                          {school.name}
                          {school.duplicateIds.length > 0 ? <span className="mt-0.5 block text-xs text-[#1E6A83]">{PLACE.duplicateInstitution}</span> : null}
                        </span>
                      </label>
                    ))}
                    {schools.length === 0 ? <p className="text-sm text-muted-foreground">{PLACE.noInstitutions}</p> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{PLACE.institutionsHelp}</p>
                </fieldset>
                <InstitutionPreview title={selected.title} schools={shownSchools} />
                <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? PLACE.saving : PLACE.save}</Button>
              </div>
            ) : null}
            {selectedBook ? (
              <div className="space-y-4">
                <p className="font-semibold">{selectedBook.title}</p>
                <p className="text-xs text-muted-foreground">{PLACE.readsHelp}</p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />
                  {PLACE.featured}
                </label>
                <label className="block text-sm">
                  {PLACE.priority}
                  <input type="number" min={0} max={999} value={priority} onChange={(event) => setPriority(Number(event.target.value))} className="mt-1 h-10 w-28 rounded-xl border border-border px-3" aria-label={PLACE.priority} />
                </label>
                <FeaturedPreview
                  shown={featured}
                  id={selectedBook.id}
                  title={selectedBook.title}
                  level={selectedBook.readingLevel}
                  subject={selectedBook.readingLevel}
                  price={selectedBook.priceUsd}
                  currency="USD"
                  cover={selectedBook.cover}
                  kind="book"
                  priority={priority}
                  from={featuredFrom}
                  until={featuredUntil}
                />
                <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? PLACE.saving : PLACE.save}</Button>
              </div>
            ) : null}
          </Panel>
          <Panel>
            <h2 className="font-semibold">{PLACE.order}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{PLACE.orderHelp}</p>
            <ul className="mt-3 space-y-2">
              {orderIds.map((id, index) => {
                const course = courses.find((row) => row.id === id);
                if (!course) return null;
                return (
                  <li
                    key={id}
                    draggable
                    onDragStart={() => setDragId(id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => dropOn(id)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <span>{`${index + 1}. ${course.title}`}</span>
                    <span className="flex gap-1">
                      <button type="button" className="min-h-9 rounded-lg border px-2" onClick={() => move(id, -1)} aria-label={PLACE.moveUp}>{PLACE.moveUp}</button>
                      <button type="button" className="min-h-9 rounded-lg border px-2" onClick={() => move(id, 1)} aria-label={PLACE.moveDown}>{PLACE.moveDown}</button>
                    </span>
                  </li>
                );
              })}
            </ul>
            <Button type="button" variant="outline" className="mt-3" disabled={saving || orderIds.length === 0} onClick={() => void saveOrder()}>{PLACE.saveOrder}</Button>
          </Panel>
          <Panel>
            <h2 className="font-semibold">{PLACE.reads}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{PLACE.readsHelp}</p>
            <ul className="mt-3 space-y-1">
              {books.map((book) => (
                <li key={book.id}>
                  <button type="button" className={`w-full rounded-lg px-3 py-2 text-left text-sm ${book.id === bookId ? 'bg-secondary' : 'hover:bg-muted'}`} onClick={() => chooseBook(book)}>
                    {book.title}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          {groups.length > 0 ? (
            <Panel>
              <h2 className="font-semibold">{PLACE.merge}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{PLACE.mergeHelp}</p>
              <div className="mt-3 space-y-4">
                {groups.map((group) => (
                  <fieldset key={group.map((row) => row.id).join('-')} className="space-y-1">
                    <legend className="text-sm font-medium">{group[0]?.title}</legend>
                    {group.map((course) => (
                      <div key={course.id} className="flex flex-wrap items-center gap-3 text-sm">
                        <span>{courseLine({
                          ownerId: course.ownerId,
                          ownerName: course.ownerName,
                          institutionName: institutionName(course.institutionId),
                          createdOn: createdOn(course.createdAt),
                          status: course.status,
                        })}</span>
                        <label className="flex items-center gap-1">
                          <input type="radio" name={`keep-${group[0]?.id}`} checked={mergeKeep === course.id} onChange={() => { setMergeKeep(course.id); setMergeArmed(false); }} />
                          {PLACE.keep}
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="radio" name={`drop-${group[0]?.id}`} checked={mergeDrop === course.id} onChange={() => { setMergeDrop(course.id); setMergeArmed(false); }} />
                          {PLACE.drop}
                        </label>
                      </div>
                    ))}
                  </fieldset>
                ))}
              </div>
              <Button type="button" className="mt-3" disabled={saving || !mergeKeep || !mergeDrop} onClick={() => void merge()}>
                {mergeArmed ? PLACE.confirmMerge : PLACE.merge}
              </Button>
            </Panel>
          ) : null}
        </div>
      </div>
    </DashPage>
  );
}
