'use client';

import { useState } from 'react';
import { BookOpen, Bus, GraduationCap, Laptop, Ticket, Utensils, Activity } from 'lucide-react';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { PERK_CATEGORIES } from '@/lib/student-id/model';

const ICONS = {
  utensils: Utensils,
  'book-open': BookOpen,
  bus: Bus,
  laptop: Laptop,
  'graduation-cap': GraduationCap,
  activity: Activity,
  ticket: Ticket,
} as const;

export interface PerkOffer {
  id: string;
  partnerName: string;
  title: string;
  discount: string;
  terms: string;
  category: string;
  codeType: string;
  staticCode?: string;
}

export function PerksBoard({
  offers,
  onRedeem,
}: {
  offers: PerkOffer[];
  onRedeem?: (offer: PerkOffer) => Promise<string>;
}) {
  const [category, setCategory] = useState('all');
  const [note, setNote] = useState('');
  const shown = category === 'all' ? offers : offers.filter((offer) => offer.category === category);

  return (
    <DashPage>
      <DashHeader
        eyebrow="Free with your card"
        title="Perks"
        description="Student discounts from partner businesses. Your card is free. These offers never ask for a paid plan."
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`rounded-full px-3 py-1.5 text-xs font-semibold ${category === 'all' ? 'border border-[#1E6A83] bg-[#3FE0D0] text-[#203337]' : 'border border-[#E7EDED] text-[#1E6A83]'}`} onClick={() => setCategory('all')}>
          All
        </button>
        {PERK_CATEGORIES.map((item) => {
          const Icon = ICONS[item.icon];
          const active = category === item.id;
          return (
            <button key={item.id} type="button" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${active ? 'border border-[#1E6A83] bg-[#3FE0D0] text-[#203337]' : 'border border-[#E7EDED] text-[#1E6A83]'}`} onClick={() => setCategory(item.id)}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {shown.map((offer) => (
          <Panel key={offer.id}>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]">{offer.partnerName}</p>
            <h2 className="mt-2 font-heading text-2xl text-[#203337]">{offer.title}</h2>
            <p className="mt-2 text-sm font-semibold text-[#203337]">{offer.discount}</p>
            <p className="mt-2 text-sm text-[#5F7074]">{offer.terms}</p>
            {offer.staticCode ? <p className="mt-3 font-mono text-sm text-[#203337]">Code {offer.staticCode}</p> : null}
            {onRedeem ? (
              <button
                type="button"
                className="mt-4 rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 py-2 text-sm font-semibold text-[#203337]"
                onClick={() => {
                  void onRedeem(offer).then((code) => setNote(code ? `${offer.title}: ${code}` : 'Perk saved.')).catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : 'Could not use this perk.'));
                }}
              >
                Use perk
              </button>
            ) : null}
          </Panel>
        ))}
      </div>
      {shown.length === 0 ? <p className="text-sm text-[#5F7074]">No perks in this category right now.</p> : null}
      {note ? <p className="text-sm text-[#203337]">{note}</p> : null}
    </DashPage>
  );
}
