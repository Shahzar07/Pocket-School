'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthSTORE } from '@/hooks/use-auth';
import { resolveStaffRole } from '@/lib/admin-console';
import { getAllCourses, getInstitutions, updateCourse, type Course, type Institution } from '@/lib/db';
import { platformPlaces, type Publication } from '@/lib/institution-commerce';
import type { VolumePlanId } from '@/lib/institution-pricing';

const LEVELS: { id: VolumePlanId; label: string }[] = [
  { id: 'primary_secondary', label: 'Primary and Secondary' },
  { id: 'igcse_alevel', label: 'IGCSE and A-Level' },
  { id: 'professional', label: 'Professional' },
];

const KNOWN = new Set<string>(LEVELS.map((row) => row.id));

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
  };
}

export default function CoursePlacementPage() {
  const { profile } = useAuthSTORE();
  const staff = resolveStaffRole(profile);
  const allowed = staff === 'super_admin' || staff === 'admin';
  const [courses, setCourses] = useState<Course[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [marketplace, setMarketplace] = useState<Publication['marketplace']>('hidden');
  const [featured, setFeatured] = useState(false);
  const [core, setCore] = useState(false);
  const [levels, setLevels] = useState<VolumePlanId[]>([]);
  const [institutionIds, setInstitutionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [nextCourses, nextInstitutions] = await Promise.all([getAllCourses(), getInstitutions()]);
    setCourses(nextCourses);
    setInstitutions(nextInstitutions);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void load().catch(() => toast.error('Could not load courses.'));
  }, [allowed, load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return courses.filter((course) => !needle || course.title.toLowerCase().includes(needle));
  }, [courses, query]);

  const selected = courses.find((course) => course.id === selectedId) ?? null;

  const choose = (course: Course) => {
    const pub = publicationFrom(course);
    setSelectedId(course.id);
    setMarketplace(pub.marketplace);
    setFeatured(pub.featured);
    setCore(pub.core);
    setLevels(pub.levels);
    setInstitutionIds(pub.institutionIds);
  };

  const toggleLevel = (id: VolumePlanId) => {
    setLevels((current) => current.includes(id) ? current.filter((item) => item !== id) : current.concat(id));
  };

  const toggleInstitution = (id: string) => {
    setInstitutionIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.concat(id));
  };

  const save = async () => {
    if (!selected) return;
    const placed = platformPlaces(publicationFrom(selected), {
      marketplace: marketplace === 'pending' ? 'hidden' : marketplace,
      featured,
      core,
      levels,
      institutionIds,
    });
    if ('error' in placed) {
      toast.error(placed.error);
      return;
    }
    setSaving(true);
    try {
      await updateCourse(selected.id, {
        placement: {
          marketplace: placed.marketplace,
          featured: placed.featured,
          core: placed.core,
          levels: placed.levels,
          institutionIds: placed.institutionIds,
        },
        featured: placed.featured,
        marketplaceApproved: placed.marketplace === 'approved',
        visibility: placed.core ? 'core' : placed.marketplace === 'approved' ? 'marketplace' : 'institution',
        allocatedInstitutionIds: placed.institutionIds,
      });
      toast.success('Placement saved.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save placement.');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <DashPage>
        <DashHeader eyebrow="Platform" title="Course placement" description="A super admin decides where each course appears." />
        <Panel><p className="text-sm text-muted-foreground">This screen is for a platform admin.</p></Panel>
      </DashPage>
    );
  }

  return (
    <DashPage>
      <DashHeader
        eyebrow="Platform"
        title="Course placement"
        description="Marketplace listing, featured spots, core programmes, and which institutions and levels receive each course."
      />
      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <Panel>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Find a course" placeholder="Find a course" />
          <ul className="mt-3 max-h-[32rem] overflow-auto space-y-1">
            {visible.map((course) => (
              <li key={course.id}>
                <button
                  type="button"
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm ${course.id === selectedId ? 'bg-secondary' : 'hover:bg-muted'}`}
                  onClick={() => choose(course)}
                >
                  {course.title}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          {!selected && <p className="text-sm text-muted-foreground">Choose a course to place it.</p>}
          {selected && (
            <div className="space-y-4">
              <p className="font-semibold">{selected.title}</p>
              <label className="block text-sm">
                Marketplace
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3"
                  value={marketplace === 'pending' ? 'hidden' : marketplace}
                  onChange={(event) => setMarketplace(event.target.value as 'approved' | 'rejected' | 'hidden')}
                  aria-label="Marketplace listing"
                >
                  <option value="hidden">Hidden</option>
                  <option value="approved">Listed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />
                Featured spot
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={core} onChange={(event) => setCore(event.target.checked)} />
                Core programme
              </label>
              <fieldset>
                <legend className="text-sm font-medium">Levels</legend>
                <div className="mt-2 space-y-1">
                  {LEVELS.map((level) => (
                    <label key={level.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={levels.includes(level.id)} onChange={() => toggleLevel(level.id)} />
                      {level.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-medium">Institutions</legend>
                <div className="mt-2 max-h-48 overflow-auto space-y-1">
                  {institutions.map((institution) => (
                    <label key={institution.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={institutionIds.includes(institution.id)}
                        onChange={() => toggleInstitution(institution.id)}
                      />
                      {institution.name}
                    </label>
                  ))}
                  {institutions.length === 0 && <p className="text-sm text-muted-foreground">No institutions yet.</p>}
                </div>
              </fieldset>
              <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save placement'}</Button>
            </div>
          )}
        </Panel>
      </div>
    </DashPage>
  );
}
