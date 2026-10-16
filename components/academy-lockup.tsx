import { Brain } from 'lucide-react';
import { displayLogoUrl } from '@/lib/certificates';

/** Academy name and logo. Without a logo, the Poket School mark stays. */
export function AcademyLockup({
  name,
  logoUrl,
  accent,
  powered = false,
  tone = 'dark',
}: {
  name: string;
  logoUrl?: string | null;
  accent?: string;
  powered?: boolean;
  tone?: 'dark' | 'light';
}) {
  const logo = displayLogoUrl(logoUrl);
  const light = tone === 'light';
  return (
    <span className={`inline-flex min-h-11 items-center gap-2 ${light ? 'text-foreground' : 'text-white'}`}>
      {logo ? (
        <img src={logo} alt="" className="h-10 w-10 rounded-xl bg-white object-contain p-1" />
      ) : (
        <span className="rounded-xl border p-2" style={{ borderColor: accent || (light ? 'var(--border)' : 'rgba(255,255,255,0.2)') }}>
          <Brain className="h-5 w-5" style={{ color: accent || (light ? 'var(--primary)' : '#ffffff') }} />
        </span>
      )}
      <span className="font-bold text-xl">{name}</span>
      {powered ? <span className={`text-xs ${light ? 'text-muted-foreground' : 'text-white/70'}`}>Powered by Poket School</span> : null}
    </span>
  );
}
