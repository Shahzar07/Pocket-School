import { BRAND } from '@/lib/brand';
import { AMBER_JOIN_CTA, type AmberPage } from '@/lib/amber/public';

/** Share and Open Graph card. Blue gradient, cyan accent, free join line. */
export function AmberShareCard({ view }: { view: AmberPage | null }) {
  const resolved = view?.resolved === true;
  const title = resolved ? 'resolved' : 'Missing child';
  const place = !resolved && view ? [view.city, view.country].filter(Boolean).join(', ') : '';
  const detail = !resolved && view?.description ? view.description.slice(0, 140) : '';
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
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 32, color: BRAND.cyan }}>{AMBER_JOIN_CTA}</div>
        {code ? <div style={{ fontSize: 24, marginTop: 10 }}>{code}</div> : null}
      </div>
    </div>
  );
}
