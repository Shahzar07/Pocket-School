'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FeaturedCarousel, type CarouselVariant } from '@/components/courses/featured-carousel';
import { bumpFeaturedStat, listShowcaseBooks } from '@/lib/courses/featured-store';
import { getPublicCourses, type Course } from '@/lib/db';
import { PLACE } from '@/lib/courses/placement-copy';
import {
  bookSlide,
  courseSlide,
  programmePlan,
  type FeaturedSlide,
  type ProgrammePlan,
} from '@/lib/courses/placement';

const LEVEL_LABEL: Record<ProgrammePlan, string> = {
  primary_secondary: 'Primary and Secondary',
  igcse_alevel: 'IGCSE and A-Level',
  professional: 'Professional',
};

export function FeaturedShowcase({ variant }: { variant: Exclude<CarouselVariant, 'preview'> }) {
  const [slides, setSlides] = useState<FeaturedSlide[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPublicCourses(), listShowcaseBooks()])
      .then(([courses, books]) => {
        if (cancelled) return;
        setSlides([
          ...courses.map(courseSlide),
          ...books.map(bookSlide),
        ]);
      })
      .catch(() => {
        if (!cancelled) setSlides([]);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <FeaturedCarousel
      slides={slides}
      variant={variant}
      onTrack={(slide, field) => {
        void bumpFeaturedStat(slide.id, field, { kind: slide.kind, title: slide.title });
      }}
    />
  );
}

export function ProgrammeTiles({ level }: { level: string }) {
  const plan = programmePlan(level);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    if (!plan) return;
    let cancelled = false;
    getPublicCourses()
      .then((rows) => { if (!cancelled) setCourses(rows); })
      .catch(() => { if (!cancelled) setCourses([]); });
    return () => { cancelled = true; };
  }, [plan]);

  if (!plan) return null;
  const mine = courses.filter((course) => course.placement?.core && (course.placement.levels ?? []).includes(plan) && course.status === 'published');
  if (mine.length === 0) return null;

  return (
    <section id="programme" className="space-y-3">
      <h2 className="text-sm font-semibold text-[#1E6A83]">{PLACE.yourProgramme}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {mine.map((course) => (
          <Link key={course.id} href={`/courses/${course.id}`} className="rounded-2xl border border-[#1E6A83]/15 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#1E6A83]">{LEVEL_LABEL[plan]}</p>
            <p className="mt-1 font-semibold text-[#203337]">{course.title}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function AllocatedLibrary({ institutionId }: { institutionId: string }) {
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    if (!institutionId) return;
    let cancelled = false;
    getPublicCourses()
      .then((rows) => { if (!cancelled) setCourses(rows); })
      .catch(() => { if (!cancelled) setCourses([]); });
    return () => { cancelled = true; };
  }, [institutionId]);

  const mine = courses.filter((course) => {
    const ids = course.placement?.institutionIds ?? course.allocatedInstitutionIds ?? [];
    return ids.includes(institutionId);
  });

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">{PLACE.allocated}</h2>
      {mine.length === 0 ? <p className="text-sm text-muted-foreground">{PLACE.allocatedEmpty}</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {mine.map((course) => (
          <li key={course.id} className="rounded-2xl border border-border bg-card p-4">
            <p className="font-semibold">{course.title}</p>
            <p className="text-sm text-[#1E6A83]">{course.price && course.price > 0 ? `$${course.price}` : PLACE.included}</p>
            <Link href={`/courses/${course.id}`} className="mt-2 inline-flex text-sm font-semibold text-[#1E6A83]">{PLACE.openLive}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
