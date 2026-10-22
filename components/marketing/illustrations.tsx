import type { ReactNode } from 'react';
import { ART, MARKET_ART, PATHWAY_STAGE_LABELS } from '@/lib/marketing/art-copy';

const SANS = 'inherit';
const INK = '#203337';
const BLUE = '#1E6A83';
const CYAN = '#3FE0D0';
const NAVY = '#0B1417';
const MINT = '#F4FBFA';
const WHITE = '#FFFFFF';
const MIST = '#E7F4F2';

export function hasMarketArt(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(MARKET_ART, slug);
}

export function MarketingHero({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <div data-market-hero="1" className="mx-auto grid w-full min-w-0 max-w-5xl items-center gap-8 lg:grid-cols-2">
      <div className="min-w-0 lg:order-2">
        <MarketingArt slug={slug} />
      </div>
      <div className="min-w-0 lg:order-1">{children}</div>
    </div>
  );
}

export function MarketingArt({ slug }: { slug: string }) {
  const label = MARKET_ART[slug];
  if (!label) return null;
  const titleId = `market-art-${slug}`;
  return (
    <figure data-market-art={slug} className="mx-auto w-full min-w-0 max-w-[420px]">
      <svg viewBox="0 0 420 280" className="block h-auto w-full" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{label}</title>
        <rect x="1" y="1" width="418" height="278" rx="27" fill={MINT} stroke={BLUE} strokeWidth="2" />
        <Scene slug={slug} />
      </svg>
    </figure>
  );
}

function Scene({ slug }: { slug: string }) {
  if (slug === 'id') return <IdCard />;
  if (slug === 'safeline') return <ReportFlow report={ART.concern} mid={ART.private} end={ART.desk} desk={ART.schoolDesk} staff={ART.namedStaff} />;
  if (slug === 'stand-up') return <ReportFlow report={ART.safetyReport} mid={ART.private} end={ART.desk} desk={ART.safetyDesk} staff={ART.namedStaff} />;
  if (slug === 'demo') return <Classroom />;
  if (slug === 'studio') return <Studio />;
  if (slug === 'ai-teachers') return <Teachers />;
  if (slug === 'about') return <AboutMark />;
  if (slug === 'institutions') return <Academy />;
  if (slug === 'rochfords') return <Places />;
  if (slug === 'offer') return <OfferTiles />;
  const stages = PATHWAY_STAGE_LABELS[slug];
  if (stages) return <Stages labels={stages} />;
  return null;
}

function Txt({
  x, y, children, size = 13, fill = INK, weight = 700, anchor = 'start',
}: {
  x: number;
  y: number;
  children: string;
  size?: number;
  fill?: string;
  weight?: number;
  anchor?: 'start' | 'middle' | 'end';
}) {
  return (
    <text x={x} y={y} fill={fill} fontSize={size} fontWeight={weight} fontFamily={SANS} textAnchor={anchor}>
      {children}
    </text>
  );
}

function Silhouette({ cx, cy, r = 22 }: { cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={MIST} />
      <circle cx={cx} cy={cy - r * 0.28} r={r * 0.36} fill={BLUE} />
      <path d={`M ${cx - r * 0.62} ${cy + r * 0.72} q ${r * 0.62} ${-r * 0.7} ${r * 1.24} 0`} fill={BLUE} />
    </g>
  );
}

function Qr({ x, y, cell = 5 }: { x: number; y: number; cell?: number }) {
  const rows = ['1111111', '1000001', '1011101', '1010101', '1011101', '1000001', '1111111'];
  return (
    <g>
      {rows.map((row, r) => row.split('').map((bit, c) => (
        bit === '1' ? <rect key={`${r}-${c}`} x={x + c * cell} y={y + r * cell} width={cell - 1} height={cell - 1} fill={INK} /> : null
      )))}
    </g>
  );
}

function IdCard() {
  return (
    <g>
      <rect x="16" y="22" width="230" height="236" rx="20" fill={WHITE} stroke={BLUE} strokeWidth="2" />
      <circle cx="46" cy="52" r="16" fill={BLUE} />
      <Txt x={46} y={56} size={11} fill={WHITE} anchor="middle">{ART.mark}</Txt>
      <Txt x={70} y={56} size={13} fill={BLUE}>{ART.brand}</Txt>
      <Silhouette cx={58} cy={128} r={28} />
      <Txt x={98} y={112} size={16}>{ART.sampleStudent}</Txt>
      <Txt x={98} y={134} size={13} fill={BLUE} weight={600}>{ART.level}</Txt>
      <Txt x={98} y={156} size={13} weight={600}>{ART.studentCode}</Txt>
      <Qr x={36} y={196} />
      <rect x="258" y="36" width="146" height="208" rx="24" fill={NAVY} />
      <rect x="268" y="52" width="126" height="176" rx="12" fill={WHITE} />
      <rect x="278" y="68" width="106" height="132" rx="12" fill={MINT} stroke={BLUE} />
      <circle cx="304" cy="96" r="12" fill={BLUE} />
      <Txt x={304} y={100} size={9} fill={WHITE} anchor="middle">{ART.mark}</Txt>
      <Txt x={292} y={128} size={11}>{ART.sampleStudent}</Txt>
      <Txt x={292} y={148} size={11} fill={BLUE} weight={600}>{ART.studentCode}</Txt>
      <Qr x={292} y={160} cell={4} />
    </g>
  );
}

function ReportFlow({
  report, mid, end, desk, staff,
}: {
  report: string;
  mid: string;
  end: string;
  desk: string;
  staff: string;
}) {
  return (
    <g>
      <rect x="22" y="28" width="168" height="224" rx="26" fill={NAVY} />
      <rect x="34" y="46" width="144" height="188" rx="14" fill={WHITE} />
      <Row y={64} label={report} fill={MIST} ink={INK} />
      <Row y={118} label={mid} fill={CYAN} ink={INK} />
      <Row y={172} label={end} fill={BLUE} ink={WHITE} />
      <path d="M198 140 H228" stroke={BLUE} strokeWidth="3" />
      <path d="M220 132 L232 140 L220 148" fill={BLUE} />
      <rect x="236" y="78" width="164" height="124" rx="18" fill={WHITE} stroke={BLUE} strokeWidth="2" />
      <rect x="252" y="96" width="36" height="36" rx="10" fill={CYAN} />
      <Txt x={270} y={118} size={12} anchor="middle">{ART.mark}</Txt>
      <Txt x={252} y={154} size={14}>{desk}</Txt>
      <Txt x={252} y={176} size={12} fill={BLUE} weight={600}>{staff}</Txt>
    </g>
  );
}

function Row({ y, label, fill, ink }: { y: number; label: string; fill: string; ink: string }) {
  return (
    <g>
      <rect x="46" y={y} width="120" height="40" rx="12" fill={fill} />
      <Txt x={106} y={y + 25} size={13} fill={ink} anchor="middle">{label}</Txt>
    </g>
  );
}

function Classroom() {
  return (
    <g>
      <rect x="16" y="32" width="184" height="216" rx="18" fill={WHITE} stroke={BLUE} strokeWidth="2" />
      <Txt x={32} y={64} size={12} fill={BLUE}>{ART.classCode}</Txt>
      <rect x="32" y="78" width="120" height="40" rx="12" fill={CYAN} />
      <Txt x={92} y={104} size={18} anchor="middle">{ART.sampleCode}</Txt>
      <Txt x={32} y={150} size={12} fill={BLUE}>{ART.sampleLink}</Txt>
      <rect x="32" y="164" width="140" height="8" rx="4" fill={MIST} />
      <rect x="32" y="182" width="100" height="8" rx="4" fill={MIST} />
      <rect x="214" y="32" width="190" height="216" rx="18" fill={WHITE} stroke={BLUE} strokeWidth="2" />
      <rect x="214" y="32" width="190" height="40" rx="18" fill={BLUE} />
      <rect x="214" y="56" width="190" height="16" fill={BLUE} />
      <Txt x={228} y={58} size={12} fill={WHITE}>{ART.gradebook}</Txt>
      <Txt x={228} y={100} size={14}>{ART.sampleStudent}</Txt>
      <Txt x={228} y={136} size={12} fill={BLUE}>{`${ART.colSubject} / ${ART.colNote}`}</Txt>
      <Txt x={228} y={160} size={14} weight={600}>{ART.maths}</Txt>
      <Txt x={310} y={160} size={14} fill={BLUE} weight={600}>{ART.draft}</Txt>
    </g>
  );
}

function Studio() {
  return (
    <g>
      <rect x="20" y="28" width="380" height="224" rx="18" fill={WHITE} stroke={BLUE} strokeWidth="2" />
      <rect x="20" y="28" width="380" height="44" rx="18" fill={BLUE} />
      <rect x="20" y="52" width="380" height="20" fill={BLUE} />
      <Txt x={40} y={56} size={16} fill={WHITE}>{ART.studio}</Txt>
      <Column x={40} title={ART.lesson} />
      <Column x={164} title={ART.quiz} />
      <Column x={288} title={ART.book} />
    </g>
  );
}

function Column({ x, title }: { x: number; title: string }) {
  return (
    <g>
      <Txt x={x} y={104} size={14} fill={BLUE}>{title}</Txt>
      <rect x={x} y={116} width="96" height="10" rx="5" fill={MIST} />
      <rect x={x} y={136} width="80" height="10" rx="5" fill={CYAN} />
      <rect x={x} y={156} width="96" height="10" rx="5" fill={MIST} />
      <rect x={x} y={176} width="64" height="10" rx="5" fill={MIST} />
    </g>
  );
}

function Teachers() {
  return (
    <g>
      <TeacherCard x={16} name={ART.etMaths} />
      <TeacherCard x={148} name={ART.etEnglish} />
      <TeacherCard x={280} name={ART.etScience} />
    </g>
  );
}

function TeacherCard({ x, name }: { x: number; name: string }) {
  return (
    <g>
      <rect x={x} y={40} width="124" height="200" rx="18" fill={WHITE} stroke={BLUE} strokeWidth="2" />
      <Silhouette cx={x + 62} cy={112} r={32} />
      <Txt x={x + 62} y={176} size={13} anchor="middle">{name}</Txt>
      <rect x={x + 28} y={192} width={68} height={8} rx={4} fill={CYAN} />
    </g>
  );
}

function AboutMark() {
  return (
    <g>
      <circle cx="210" cy="78" r="28" fill={BLUE} />
      <Txt x={210} y={84} size={16} fill={WHITE} anchor="middle">{ART.mark}</Txt>
      <Txt x={210} y={132} size={22} fill={BLUE} anchor="middle">{ART.brand}</Txt>
      <Tile x={28} label={ART.learn} />
      <Tile x={154} label={ART.etAi} />
      <Tile x={280} label={ART.safeLine} />
    </g>
  );
}

function Tile({ x, label }: { x: number; label: string }) {
  return (
    <g>
      <rect x={x} y={160} width="112" height="72" rx="16" fill={WHITE} stroke={BLUE} strokeWidth="2" />
      <Txt x={x + 56} y={202} size={14} fill={BLUE} anchor="middle">{label}</Txt>
    </g>
  );
}

function Academy() {
  return (
    <g>
      <rect x="36" y="64" width="150" height="150" rx="8" fill={BLUE} />
      <rect x="86" y="36" width="50" height="36" fill={BLUE} />
      <rect x="56" y="88" width="28" height="28" rx="4" fill={CYAN} />
      <rect x="98" y="88" width="28" height="28" rx="4" fill={CYAN} />
      <rect x="140" y="88" width="28" height="28" rx="4" fill={CYAN} />
      <rect x="56" y="128" width="28" height="28" rx="4" fill={CYAN} />
      <rect x="140" y="128" width="28" height="28" rx="4" fill={CYAN} />
      <rect x="92" y="164" width="38" height="50" rx="4" fill={NAVY} />
      <rect x="214" y="78" width="176" height="122" rx="18" fill={WHITE} stroke={BLUE} strokeWidth="2" />
      <Txt x={232} y={118} size={16}>{ART.yourAcademy}</Txt>
      <rect x="232" y="138" width="140" height="36" rx="18" fill={CYAN} />
      <Txt x={302} y={161} size={13} anchor="middle">{ART.brandedLogin}</Txt>
    </g>
  );
}

function Places() {
  return (
    <g>
      <rect x="28" y="36" width="200" height="208" rx="24" fill={WHITE} stroke={BLUE} strokeWidth="2" />
      <circle cx="90" cy="100" r="36" fill={MIST} />
      <circle cx="140" cy="150" r="48" fill={MIST} />
      <Pin x={88} y={92} />
      <Pin x={132} y={140} />
      <Pin x={96} y={168} />
      <Txt x={248} y={84} size={16} fill={BLUE}>{ART.brand}</Txt>
      <Place y={118} label={ART.ipoh} />
      <Place y={164} label={ART.cameron} />
      <Place y={210} label={ART.kl} />
    </g>
  );
}

function Pin({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="8" fill={CYAN} stroke={BLUE} strokeWidth="2" />
    </g>
  );
}

function Place({ y, label }: { y: number; label: string }) {
  return (
    <g>
      <circle cx="248" cy={y - 4} r="6" fill={CYAN} />
      <Txt x={262} y={y} size={13}>{label}</Txt>
    </g>
  );
}

function OfferTiles() {
  return (
    <g>
      <TileWide x={24} y={28} label={ART.etAi} />
      <TileWide x={148} y={28} label={ART.studio} />
      <TileWide x={272} y={28} label={ART.reads} />
      <rect x="24" y="168" width="372" height="80" rx="18" fill={WHITE} stroke={BLUE} strokeWidth="2" />
      <Txt x={44} y={204} size={16}>{ART.brand}</Txt>
      <Txt x={44} y={228} size={13} fill={BLUE} weight={600}>{ART.sampleChapter}</Txt>
    </g>
  );
}

function TileWide({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y} width="124" height="120" rx="18" fill={WHITE} stroke={BLUE} strokeWidth="2" />
      <circle cx={x + 62} cy={y + 46} r="18" fill={CYAN} />
      <Txt x={x + 62} y={y + 96} size={12} fill={BLUE} anchor="middle">{label}</Txt>
    </g>
  );
}

function Stages({ labels }: { labels: readonly string[] }) {
  const rowH = labels.length > 4 ? 38 : 56;
  const block = labels.length * rowH;
  const top = Math.max(24, (280 - block) / 2);
  return (
    <g>
      {labels.map((label, index) => {
        const y = top + index * rowH;
        return (
          <g key={label}>
            <rect x={28} y={y} width={364} height={rowH - 8} rx={14} fill={index === 0 ? CYAN : WHITE} stroke={BLUE} strokeWidth={2} />
            <Txt x={210} y={y + (rowH - 8) / 2 + 5} size={label.length > 16 ? 13 : 16} anchor="middle">{label}</Txt>
          </g>
        );
      })}
    </g>
  );
}
