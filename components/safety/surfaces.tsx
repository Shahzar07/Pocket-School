import Link from 'next/link';
import { Phone, Shield } from 'lucide-react';
import { SafetyDisclaimerFooter } from '@/components/safety/disclaimer';
import { emergencyNumber } from '@/lib/emergency/policy';
import { DEFAULT_HELPLINES, TRACKER_STAGES, type Helpline, type TrackerStage } from '@/lib/safety/policy';

export const SAFETY_TYPE_OPTIONS = [
  { id: 'bullying', label: 'Bullying' },
  { id: 'cyberbullying', label: 'Cyberbullying' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'abuse', label: 'Abuse' },
  { id: 'self_harm_concern', label: 'Self-harm concern' },
  { id: 'discrimination', label: 'Discrimination' },
  { id: 'unsafe_other', label: 'Something else unsafe' },
] as const;

const STAGE_LABEL: Record<TrackerStage, string> = {
  received: 'Received',
  being_looked_at: 'Being looked at',
  action_taken: 'Action taken',
  closed: 'Closed',
};

const CSS = `
.sf { min-height: 100vh; background: #F3F7F8; color: #17343C; font-family: var(--font-sans), "Plus Jakarta Sans", sans-serif; }
.sf-header { background: var(--ps-hero); color: #fff; padding: 28px 20px 36px; border-radius: 0 0 28px 28px; }
.sf-kicker { margin: 0; letter-spacing: 0.16em; font-size: 12px; font-weight: 700; text-transform: uppercase; }
.sf-title { margin: 8px 0 0; font-size: 34px; line-height: 1.1; font-weight: 800; }
.sf-sub { margin: 8px 0 0; max-width: 560px; font-size: 16px; }
.sf-body { max-width: 880px; margin: -18px auto 32px; padding: 0 16px; display: grid; gap: 12px; }
.sf-card { background: #fff; border: 1px solid #D5E3E7; border-radius: 22px; padding: 16px; box-shadow: 0 10px 28px rgba(30, 106, 131, 0.08); }
.sf-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.sf-shield, .sf-danger, .sf-chip, .sf-btn {
  min-height: 48px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center;
  gap: 8px; padding: 0 16px; font-weight: 700; font-size: 15px; text-decoration: none; border: 0; cursor: pointer;
}
.sf-shield { background: #17343C; color: #fff; }
.sf-danger { background: #D0553F; color: #fff; width: 100%; }
.sf-chip { background: #fff; color: #17343C; border: 1px solid #D5E3E7; }
.sf-btn { background: #3FE0D0; color: #203337; border: 1px solid #1E6A83; }
.sf-btn.ghost { background: #fff; color: #17343C; border: 1px solid #D5E3E7; }
.sf-call { margin: 0; font-size: 40px; font-weight: 800; letter-spacing: -0.03em; }
.sf-note { margin: 6px 0 0; color: #4E6A72; font-size: 14px; }
.sf-stage { min-height: 44px; border-radius: 999px; padding: 0 12px; display: inline-flex; align-items: center; font-size: 13px; font-weight: 700; background: #E7F1F4; color: #1E6A83; }
.sf-stage.on { background: #1F8A70; color: #fff; }
.sf-input, .sf-area { width: 100%; border: 1px solid #D5E3E7; border-radius: 14px; padding: 12px 14px; font: inherit; color: #17343C; background: #fff; }
.sf-area { min-height: 88px; resize: vertical; }
.sf label { display: grid; gap: 6px; font-size: 13px; font-weight: 700; }
.sf-check { display: flex; gap: 8px; align-items: center; min-height: 48px; font-weight: 600; }
`;

export function HelpNearMeLink() {
  return (
    <Link href="/help/near-me" className="sf-btn" style={{ minHeight: 48 }}>
      Get help near me
    </Link>
  );
}

export function SafetyShieldLink({ href = '/dashboard/student/safety' }: { href?: string }) {
  return (
    <Link href={href} className="sf-shield" style={{ minHeight: 48 }}>
      <style>{`.sf-shield{min-height:48px;border-radius:14px;display:inline-flex;align-items:center;gap:8px;padding:0 16px;font-weight:700;font-size:15px;text-decoration:none;background:#17343C;color:#fff}`}</style>
      <Shield size={24} aria-hidden="true" />
      Report a safety concern
    </Link>
  );
}

export function SupportCard({ lines = DEFAULT_HELPLINES, emergencyNumber = '999' }: { lines?: Helpline[]; emergencyNumber?: string }) {
  return (
    <section className="sf-card" aria-label="Support resources">
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Support resources</h2>
      <p className="sf-note">These lines are there if you want to talk to someone outside school. A super admin can change them.</p>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {lines.map(line => (
          <div key={`${line.name}-${line.number}`} className="sf-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{line.name}</strong>
              <div className="sf-note">{line.note}</div>
            </div>
            <a className="sf-btn" href={`tel:${line.number.replace(/\s/g, '')}`}>{line.number}</a>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <SafetyDisclaimerFooter emergencyNumber={emergencyNumber} />
      </div>
    </section>
  );
}

export function TrackerCard({
  stage = 'received',
  schoolInformed = false,
  authorityReferred = false,
}: {
  stage?: TrackerStage;
  schoolInformed?: boolean;
  authorityReferred?: boolean;
}) {
  return (
    <section className="sf-card" aria-label="Report tracker">
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Your report</h2>
      <p className="sf-note">You can see where it stands. Staff notes stay with the safeguarding lead.</p>
      {schoolInformed ? <p className="sf-note" style={{ color: '#1E6A83', fontWeight: 700 }}>Your school has been informed</p> : null}
      {authorityReferred ? <p className="sf-note" style={{ color: '#1E6A83', fontWeight: 700 }}>Referred to authorities</p> : null}
      <div className="sf-row" style={{ marginTop: 12 }}>
        {TRACKER_STAGES.map(item => (
          <span key={item} className={item === stage ? 'sf-stage on' : 'sf-stage'}>{STAGE_LABEL[item]}</span>
        ))}
      </div>
    </section>
  );
}

export function DangerCard({
  country = 'Malaysia',
  sent = false,
}: {
  country?: string;
  sent?: boolean;
}) {
  const number = emergencyNumber(country);
  return (
    <section className="sf-card" aria-label="I'm in danger now">
      <p className="sf-kicker" style={{ color: '#D0553F' }}>Emergency</p>
      <p className="sf-call">Call {number}</p>
      <p className="sf-note">The Safety Desk does not replace emergency services.</p>
      <p className="sf-note">This is the emergency number for your country. Call it now if you can. Poket School is not a replacement for emergency services.</p>
      <HelpNearMeLink />
      <button type="button" className="sf-danger" style={{ marginTop: 12 }}>
        <Phone size={24} aria-hidden="true" />
        I&apos;m in danger now
      </button>
      <p className="sf-note">{sent ? 'Your school has been told. Location is shared only if you chose it, and only once.' : 'Your school is told when you press this. Parents are told unless you say not to, or the concern is abuse.'}</p>
      <SafetyDisclaimerFooter emergencyNumber={number} />
    </section>
  );
}

export function SafetyPreview({ view = 'tracker' }: { view?: string }) {
  const home = view === 'shield' || view === 'home';
  const danger = view === 'danger';
  const notice = view === 'notice';
  return (
    <div className="sf">
      <style>{CSS}</style>
      <header className="sf-header">
        <p className="sf-kicker">{home ? 'Student home' : notice ? 'Safeguarding' : 'Student safety'}</p>
        <div className="sf-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <h1 className="sf-title">{danger ? 'I need help now' : notice ? 'A student needs help' : 'Report a safety concern'}</h1>
          {home ? <span className="sf-row"><SafetyShieldLink /><HelpNearMeLink /></span> : null}
        </div>
        <p className="sf-sub">
          {home
            ? 'The shield is one tap on the student home and in Community.'
            : 'The type is enough. Anything else you add is optional.'}
        </p>
      </header>
      <div className="sf-body">
        {home ? (
          <section className="sf-card">
            <h2 style={{ marginTop: 0 }}>Community</h2>
            <SafetyShieldLink />
            <HelpNearMeLink />
          </section>
        ) : null}
        {danger ? <DangerCard sent /> : null}
        {notice ? (
          <section className="sf-card">
            <h2 style={{ marginTop: 0 }}>Aisha needs help now</h2>
            <p className="sf-note">Sent at 09:41. Location was not shared. Parents were not notified.</p>
            <div className="sf-row" style={{ marginTop: 12 }}>
              <button type="button" className="sf-btn">I have seen this</button>
              <button type="button" className="sf-btn ghost">Family contact decision</button>
            </div>
          </section>
        ) : null}
        {!home && !danger && !notice ? (
          <>
            <section className="sf-card">
              <h2 style={{ marginTop: 0 }}>What is happening?</h2>
              <div className="sf-row">
                {SAFETY_TYPE_OPTIONS.map(option => (
                  <button key={option.id} type="button" className="sf-chip">{option.label}</button>
                ))}
              </div>
              <p className="sf-note">Tap a type to send. A description, who, where, when, and evidence are optional.</p>
            </section>
            <TrackerCard />
            <SupportCard />
            <DangerCard />
          </>
        ) : null}
      </div>
    </div>
  );
}
