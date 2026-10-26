/** Public links shared by the header and the footer. Labels stay out of JSX literals. */

export interface MarketLink {
  href: string;
  label: string;
}

export const MARKET_MENU = 'Programmes and products';
export const MARKET_BRAND = 'Poket School';

export const MARKET_LINKS: MarketLink[] = [
  { href: '/ai-teachers', label: 'ET AI Teachers' },
  { href: '/studio', label: 'ET AI Studio' },
  { href: '/reads', label: 'PoketReads' },
  { href: '/reads/offer', label: 'Poket Reads' },
  { href: '/safeline', label: 'Poket SafeLine' },
  { href: '/id', label: 'Student ID card' },
  { href: '/primary', label: 'Primary' },
  { href: '/igcse', label: 'IGCSE' },
  { href: '/alevel', label: 'A-Level' },
  { href: '/llb', label: 'Law (LLB)' },
  { href: '/mbbs', label: 'Medicine (MBBS)' },
  { href: '/independent', label: 'Independent learning' },
  { href: '/institutions', label: 'For schools and universities' },
  { href: '/institutions/register', label: 'For schools and organisations' },
  { href: '/demo', label: 'Book a demo' },
  { href: '/about', label: 'About' },
  { href: '/rochfords', label: "Rochford's International School" },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];
