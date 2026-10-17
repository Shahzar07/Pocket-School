import { BRAND } from '@/lib/brand';
import { AMBER_JOIN_CTA, type AmberPage } from '@/lib/amber/public';

export interface ShareCardLines {
  title: string;
  place: string;
  detail: string;
}

/** Share and Open Graph card. Blue gradient, cyan fills and accents, no gold. */
export function AmberShareCard({ view, lines }: { view: AmberPage | null; lines?: ShareCardLines | null }) {
  const resolved = view?.resolved === true;
  const title = lines?.title || (resolved ? 'resolved' : view ? 'Missing child' : 'Amber alert');
  const place = lines?.place ?? (!resolved && view ? [view.city, view.country].filter(Boolean).join(', ') : '');
  const detail = lines?.detail ?? (!resolved && view?.description ? view.description.slice(0, 140) : '');
  const code = view?.referralCode ? `referrals/${view.referralCode}` : '';
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: BRAND.hero, color: '#ffffff', padding: '64px' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: BRAND.cyan, marginRight: 16 }} />
          <div style={{ fontSize: 28, letterSpacing: 4, color: BRAND.cyan }}>POKET SCHOOL</div>
        </div>
        <div style={{ fontSize: 76, marginTop: 28 }}>{title}</div>
        {place ? <div style={{ fontSize: 32, marginTop: 12 }}>{place}</div> : null}
        {detail ? <div style={{ fontSize: 28, marginTop: 16 }}>{detail}</div> : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 32, color: BRAND.ink, background: BRAND.cyan, border: `1px solid ${BRAND.blueDeep}`, borderRadius: 16, padding: '12px 20px' }}>{AMBER_JOIN_CTA}</div>
        {code ? <div style={{ fontSize: 24, marginTop: 16 }}>{code}</div> : null}
      </div>
    </div>
  );
}
