import {
  AlertTriangle,
  Check,
  Clock,
  MessageCircle,
  Phone,
  Share2,
  ShieldAlert,
} from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { disclaimerFor, type PublicEmergency, typeLabel } from '@/lib/emergency/policy';

const CSS = `
.hk {
  min-height: 100vh;
  background: #F3F7F8;
  color: #17343C;
  font-family: var(--font-sans), "Plus Jakarta Sans", sans-serif;
}
.hk-header {
  background: linear-gradient(135deg, #1E6A83 0%, #2786A4 50%, #6FBBCE 100%);
  color: #fff;
  padding: 28px 20px 36px;
  border-radius: 0 0 28px 28px;
}
.hk-kicker { margin: 0; letter-spacing: 0.16em; font-size: 12px; font-weight: 700; text-transform: uppercase; }
.hk-title { margin: 8px 0 0; font-size: 34px; line-height: 1.1; font-weight: 800; }
.hk-sub { margin: 8px 0 0; max-width: 560px; font-size: 16px; }
.hk-body { max-width: 880px; margin: -18px auto 32px; padding: 0 16px; display: grid; gap: 12px; }
.hk-card {
  background: #fff;
  border: 1px solid #D5E3E7;
  border-radius: 22px;
  padding: 16px;
  box-shadow: 0 10px 28px rgba(30, 106, 131, 0.08);
}
.hk-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.hk-pill {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 0 12px;
  background: #E5F6EF;
  color: #1E6A83;
  font-size: 13px;
  font-weight: 700;
}
.hk-btn {
  min-height: 48px;
  border-radius: 16px;
  border: 0;
  padding: 0 16px;
  font: inherit;
  font-weight: 700;
  background: #2786A4;
  color: #fff;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}
.hk-btn.ghost { background: #fff; color: #17343C; border: 1px solid #D5E3E7; }
.hk-chip { min-height: 48px; }
.hk-note { background: #E5F6EF; border-radius: 16px; padding: 12px; color: #1E6A83; }
.hk-warn { background: #FDECEA; border-radius: 16px; padding: 12px; color: #17343C; }
`;

export function ParentHotline() {
  return (
    <main className="hk">
      <style>{CSS}</style>
      <header className="hk-header">
        <p className="hk-kicker">Poket School</p>
        <h1 className="hk-title">School hotline</h1>
        <p className="hk-sub">Write to your child’s school. Safeguarding notes go only to the principal or the safeguarding lead.</p>
      </header>
      <div className="hk-body">
        <section className="hk-card">
          <div className="hk-row">
            <Phone size={24} strokeWidth={2} color={BRAND.primary} aria-hidden />
            <strong>New ticket</strong>
          </div>
          <p>Attendance · Medium · To the class teacher</p>
          <p>Attach a photo, a medical certificate, or a PDF. Location data is removed before it is stored.</p>
          <p>Authorities: to be informed. A ticket cannot close until that is recorded.</p>
          <button type="button" className="hk-btn">Send to the school</button>
        </section>
        <article className="hk-card">
          <div className="hk-row">
            <span className="hk-pill"><Clock size={24} strokeWidth={2} aria-hidden /> In progress</span>
            <span className="hk-pill">Attendance</span>
          </div>
          <h2>Late pickup on Thursday</h2>
          <p>Due within one working day. The class teacher has the ticket.</p>
          <button type="button" className="hk-btn ghost"><MessageCircle size={24} strokeWidth={2} aria-hidden /> Reply</button>
        </article>
        <article className="hk-card">
          <div className="hk-row">
            <span className="hk-pill"><ShieldAlert size={24} strokeWidth={2} aria-hidden /> Pending</span>
            <span className="hk-pill">Wellbeing</span>
          </div>
          <h2>A worry about the week</h2>
          <p>High priority. Four working hours. Only the safeguarding lead can see this.</p>
        </article>
      </div>
    </main>
  );
}

export function StaffQueue() {
  return (
    <main className="hk">
      <style>{CSS}</style>
      <header className="hk-header">
        <p className="hk-kicker">Poket School</p>
        <h1 className="hk-title">Hotline queue</h1>
        <p className="hk-sub">Filter the desk. Bullying and safeguarding tickets stay with the principal and the safeguarding lead.</p>
      </header>
      <div className="hk-body">
        <div className="hk-row">
          <button type="button" className="hk-btn hk-chip">All</button>
          <button type="button" className="hk-btn ghost hk-chip">Pending</button>
          <button type="button" className="hk-btn ghost hk-chip">Overdue</button>
          <button type="button" className="hk-btn ghost hk-chip">Keep in view</button>
        </div>
        <article className="hk-card">
          <div className="hk-row">
            <span className="hk-pill">Academic</span>
            <span className="hk-pill">Pending · low</span>
          </div>
          <h2>Homework load this week</h2>
          <p>Three working days. Assigned to the class teacher. Authorities reminder after four hours.</p>
          <div className="hk-row">
            <button type="button" className="hk-btn">Open</button>
            <button type="button" className="hk-btn ghost">Verify integrity</button>
          </div>
        </article>
        <article className="hk-card">
          <div className="hk-row">
            <span className="hk-pill"><AlertTriangle size={24} strokeWidth={2} aria-hidden /> Transport</span>
            <span className="hk-pill">Overdue</span>
          </div>
          <h2>Bus was late twice</h2>
          <p>Escalates to the academic lead, then the principal.</p>
        </article>
        <p className="hk-note">Safeguarding tickets are hidden from this desk.</p>
      </div>
    </main>
  );
}

export function PublicAlert({ view }: { view: PublicEmergency | null }) {
  if (!view) {
    return (
      <main className="hk">
        <style>{CSS}</style>
        <header className="hk-header">
          <p className="hk-kicker">Poket School</p>
          <h1 className="hk-title">Alert</h1>
        </header>
      </main>
    );
  }
  const when = view.publishedAt ? new Date(view.publishedAt).toUTCString() : '';
  return (
    <main className="hk">
      <style>{CSS}</style>
      <header className="hk-header">
        <p className="hk-kicker">Poket School</p>
        <h1 className="hk-title">{typeLabel(view.type)}</h1>
        <p className="hk-sub">{view.region.city}, {view.region.state}, {view.region.country}</p>
      </header>
      <div className="hk-body">
        <article className="hk-card">
          <h2>{view.title}</h2>
          <p>{view.description}</p>
          <p>{when}</p>
          {view.subjectName ? <p>{view.subjectName}</p> : null}
        </article>
        <section className="hk-note">
          <strong>If you have information, contact {view.agency} {view.referenceNumber}</strong>
          <p>Call {view.emergencyNumber}. This page does not show school staff numbers.</p>
        </section>
        {view.status === 'retracted' ? <p className="hk-warn">Retracted. This page is no longer shared.</p> : null}
        {view.photoUrl.startsWith('attachment:') ? (
          <img src={`/api/emergency/public-file?id=${view.id}&attachmentId=${view.photoUrl.slice('attachment:'.length)}`} alt="Photo shared with consent" />
        ) : null}
        {view.shareEnabled ? (
          <div className="hk-row">
            <a className="hk-btn" href={`/api/emergency/share?id=${view.id}&channel=whatsapp`}><Share2 size={24} strokeWidth={2} aria-hidden /> WhatsApp</a>
            <a className="hk-btn ghost" href={`/api/emergency/share?id=${view.id}&channel=facebook`}>Facebook</a>
            <a className="hk-btn ghost" href={`/api/emergency/share?id=${view.id}&channel=x`}>X</a>
            <a className="hk-btn ghost" href={`/api/emergency/share?id=${view.id}&channel=copy`}>Copy link</a>
          </div>
        ) : null}
        <button type="button" className="hk-btn ghost">Report this alert</button>
        <p className="hk-warn">{view.disclaimer || disclaimerFor(view.region.country)}</p>
      </div>
    </main>
  );
}

export function EmergencyDesk() {
  return (
    <main className="hk">
      <style>{CSS}</style>
      <header className="hk-header">
        <p className="hk-kicker">Poket School</p>
        <h1 className="hk-title">Emergency desk</h1>
        <p className="hk-sub">A principal drafts the alert. A second verified staff member confirms it before anyone else sees it.</p>
      </header>
      <div className="hk-body">
        <article className="hk-card">
          <h2>Missing child · draft</h2>
          <p>Region comes from the school, not a home address. Police reference PDRM-2026-1044 is on the draft.</p>
          <p>Re-confirm every 24 hours or public sharing pauses. Retract needs a reason. Guardian consent is recorded before a missing child alert is published.</p>
          <div className="hk-row">
            <button type="button" className="hk-btn"><Check size={24} strokeWidth={2} aria-hidden /> Confirm and publish</button>
            <button type="button" className="hk-btn ghost">Resolve</button>
            <button type="button" className="hk-btn ghost">Retract</button>
            <button type="button" className="hk-btn ghost">Verify integrity</button>
          </div>
          <p>Views 0 · Shares 0</p>
        </article>
      </div>
    </main>
  );
}
