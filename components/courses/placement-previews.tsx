'use client';

import Link from 'next/link';
import { FeaturedCarousel } from '@/components/courses/featured-carousel';
import { PLACE } from '@/lib/courses/placement-copy';
import { previewSlide, type FeaturedKind, type ProgrammePlan } from '@/lib/courses/placement';

const LEVEL_LABEL: Record<ProgrammePlan, string> = {
  primary_secondary: 'Primary and Secondary',
  igcse_alevel: 'IGCSE and A-Level',
  professional: 'Professional',
};

export function CataloguePreview({
  title,
  priceLabel,
  listed,
}: {
  title: string;
  priceLabel: string;
  listed: boolean;
}) {
  if (!listed) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">{PLACE.hiddenNote}</p>
        <Link href="/courses" className="mt-2 inline-flex text-sm font-semibold text-[#1E6A83]">{PLACE.openLive}</Link>
      </div>
    );
  }
  return (
    <div className="max-w-xs rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 h-24 rounded-xl bg-[linear-gradient(160deg,#1E6A83,#0B1417)]" />
      <p className="font-semibold text-[#203337]">{title}</p>
      <p className="mt-1 text-sm font-semibold text-[#1E6A83]">{priceLabel || PLACE.included}</p>
      <span className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-[#1E6A83] px-3 text-xs font-bold text-white">{PLACE.buy}</span>
      <Link href="/courses" className="mt-3 block text-sm font-semibold text-[#1E6A83]">{PLACE.openLive}</Link>
    </div>
  );
}

export function FeaturedPreview({
  shown,
  id,
  title,
  level,
  subject,
  price,
  currency,
  cover,
  kind,
  priority,
  from,
  until,
}: {
  shown: boolean;
  id: string;
  title: string;
  level: string;
  subject: string;
  price?: number;
  currency?: string;
  cover: string;
  kind: FeaturedKind;
  priority: number;
  from: string;
  until: string;
}) {
  if (!shown) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">{PLACE.notFeatured}</p>
        <Link href="/courses#E9F7FAtured" className="mt-2 inline-flex text-sm font-semibold text-[#1E6A83]">{PLACE.openLive}</Link>
      </div>
    );
  }
  const slide = previewSlide({ id, title, level, subject, price, currency, cover, kind, priority, from, until });
  return (
    <div className="space-y-2">
      <FeaturedCarousel slides={[slide]} variant="preview" />
      <Link href="/courses#E9F7FAtured" className="inline-flex text-sm font-semibold text-[#1E6A83]">{PLACE.openLive}</Link>
    </div>
  );
}

export function ProgrammePreview({ title, levels }: { title: string; levels: ProgrammePlan[] }) {
  if (levels.length === 0) {
    return <p className="text-sm text-muted-foreground">{PLACE.programmeOff}</p>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {levels.map((level) => (
        <div key={level} className="rounded-2xl border border-[#1E6A83]/15 bg-[#F4FBFA] p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#1E6A83]">{PLACE.yourProgramme}</p>
          <p className="text-xs text-[#1E6A83]">{LEVEL_LABEL[level]}</p>
          <p className="mt-1 text-sm font-semibold text-[#203337]">{title}</p>
          <Link href="/dashboard/student#programme" className="mt-2 inline-flex text-sm font-semibold text-[#1E6A83]">{PLACE.openLive}</Link>
        </div>
      ))}
    </div>
  );
}

export function InstitutionPreview({ title, schools }: { title: string; schools: { id: string; name: string }[] }) {
  if (schools.length === 0) return null;
  return (
    <div className="grid gap-2">
      {schools.map((school) => (
        <div key={school.id} className="rounded-2xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">{school.name}</p>
          <p className="font-semibold text-[#203337]">{title}</p>
          <Link href="/dashboard/institution/publishing" className="mt-2 inline-flex text-sm font-semibold text-[#1E6A83]">{PLACE.openLive}</Link>
        </div>
      ))}
    </div>
  );
}
