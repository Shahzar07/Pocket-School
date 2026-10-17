'use client';

import { useId } from 'react';

const INK = '#1A3C34';
const GOLD = '#C8922A';

const ACCENTS: Record<string, string> = {
  door: '#F26B4A',
  lesson: '#3DB7E4',
  pass: '#3DDC97',
  perfect: '#FFD166',
  comeback: '#E85D75',
  flame: '#FF7A45',
  sunrise: '#FFB703',
  moon: '#8E7CFF',
  chat: '#3DB7E4',
  search: '#F26B4A',
  book: '#E85D75',
  plan: '#3DDC97',
  hands: '#FFB703',
  stairs: '#8E7CFF',
  certificate: '#FFD166',
  link: '#E85D75',
  board: '#3DB7E4',
  class: '#3DDC97',
  school: '#F26B4A',
  star: '#FFD166',
  crown: '#FFD166',
};

function scene(art: string, accent: string) {
  switch (art) {
    case 'door':
      return <><rect x="30" y="24" width="20" height="28" rx="3" fill={accent} /><circle cx="46" cy="38" r="1.6" fill={GOLD} /></>;
    case 'lesson':
      return <><rect x="26" y="28" width="28" height="20" rx="2" fill={accent} /><path d="M30 34h20M30 39h14" stroke={INK} strokeWidth="1.6" /></>;
    case 'pass':
      return <path d="M28 40l8 8 16-18" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />;
    case 'perfect':
      return <path d="M40 22l4 10h11l-9 7 3 11-9-6-9 6 3-11-9-7h11z" fill={accent} />;
    case 'comeback':
      return <><path d="M48 28a12 12 0 11-8 20" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" /><path d="M40 24v8h8" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" /></>;
    case 'flame':
      return <path d="M40 22c2 8-8 10-6 18 8 2 16-4 14-14-6 4-8 2-8-4z" fill={accent} />;
    case 'sunrise':
      return <><circle cx="40" cy="40" r="8" fill={accent} /><path d="M24 46h32" stroke={GOLD} strokeWidth="2" strokeLinecap="round" /></>;
    case 'moon':
      return <path d="M44 26a12 12 0 100 24 10 10 0 110-24z" fill={accent} />;
    case 'chat':
      return <path d="M24 30h28a4 4 0 014 4v12a4 4 0 01-4 4H36l-8 6v-6h-4a4 4 0 01-4-4V34a4 4 0 014-4z" fill={accent} />;
    case 'search':
      return <><circle cx="36" cy="36" r="8" fill="none" stroke={accent} strokeWidth="3" /><path d="M42 42l8 8" stroke={accent} strokeWidth="3" strokeLinecap="round" /></>;
    case 'book':
      return <path d="M24 28h14c2 0 4 4 4 10s-2 10-4 10H24V28zm32 0H42c-2 0-4 4-4 10s2 10 4 10h14V28z" fill={accent} />;
    case 'plan':
      return <><rect x="26" y="26" width="28" height="28" rx="3" fill={accent} /><path d="M32 36h16M32 42h10" stroke={INK} strokeWidth="2" strokeLinecap="round" /></>;
    case 'hands':
      return <path d="M26 42c4-8 8-8 10 0 2-10 8-10 12 0 2 6 6 6 8-2" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />;
    case 'stairs':
      return <path d="M26 50h10V40h10V30h10" fill="none" stroke={accent} strokeWidth="4" strokeLinejoin="round" />;
    case 'certificate':
      return <><rect x="24" y="26" width="32" height="22" rx="2" fill={accent} /><circle cx="40" cy="52" r="5" fill={GOLD} /></>;
    case 'link':
      return <path d="M32 40h16M30 34a6 6 0 000 12M50 34a6 6 0 010 12" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />;
    case 'board':
      return <><rect x="24" y="26" width="32" height="22" rx="2" fill={accent} /><path d="M32 48v6M48 48v6M28 54h24" stroke={GOLD} strokeWidth="2" strokeLinecap="round" /></>;
    case 'class':
      return <><circle cx="32" cy="34" r="5" fill={accent} /><circle cx="48" cy="34" r="5" fill={GOLD} /><path d="M24 50c2-6 6-8 8-8s6 2 8 8M40 50c2-6 6-8 8-8s6 2 8 8" stroke={accent} strokeWidth="2" fill="none" /></>;
    case 'school':
      return <path d="M40 24l18 8v16H22V32z" fill={accent} />;
    case 'crown':
      return <path d="M24 46l4-14 8 8 4-12 4 12 8-8 4 14z" fill={accent} />;
    default:
      return <path d="M40 24l3.5 9h9l-7 5.5 2.5 9L40 38l-8 9.5 2.5-9-7-5.5h9z" fill={accent} />;
  }
}

export function BadgeArt({ art, size = 72, title }: { art: string; size?: number; title?: string }) {
  const raw = useId().replace(/:/g, '');
  const accent = ACCENTS[art] ?? '#3DB7E4';
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" role={title ? 'img' : 'presentation'} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id={`${raw}-face`} cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#2F6A58" />
          <stop offset="100%" stopColor={INK} />
        </radialGradient>
      </defs>
      <circle cx="40" cy="40" r="36" fill={`url(#${raw}-face)`} />
      <circle cx="40" cy="40" r="31" fill="none" stroke={GOLD} strokeWidth="3" />
      <circle cx="40" cy="40" r="27" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.9" />
      {scene(art, accent)}
    </svg>
  );
}
