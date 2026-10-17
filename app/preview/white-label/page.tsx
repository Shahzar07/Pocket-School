import { AcademyLockup } from '@/components/academy-lockup';
import { CertificateDocument } from '@/components/certificate-document';
import type { CertificateFace } from '@/lib/certificates';
import { accentInk } from '@/lib/white-label';

const ACCENT = '#9A3412';
const LOGO = '/preview-assets/north.svg';

const certificate: CertificateFace = {
  id: '11111111-2222-4333-8444-555555555555',
  studentName: 'Aisha Rahman',
  courseTitle: 'Biology',
  moduleTitle: 'Cells and organisation',
  issuedAt: '2026-10-15T12:00:00.000Z',
  issuedByName: 'North Academy',
  status: 'valid',
  accent: ACCENT,
  showPoweredBy: true,
  logoUrl: LOGO,
  certificateFooter: 'Awarded by North Academy. Poket School remains the platform.',
  studentNumber: 'PS-K7NP-4R2C',
};

/** Static academy brand. The live login and bar use the same lockup when a host resolves. */
export default function WhiteLabelPreview() {
  return (
    <main className="min-h-screen bg-[#F4F7F8]">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <AcademyLockup name="North Academy" logoUrl={LOGO} accent={ACCENT} tone="light" />
          <span className="ms-auto text-xs text-muted-foreground">Powered by Poket School</span>
        </div>
      </div>
      <section className="bg-[#06060F] px-6 py-10 text-white">
        <AcademyLockup name="North Academy" logoUrl={LOGO} accent={ACCENT} powered />
        <h1 className="mt-8 text-3xl font-bold">Welcome back to North Academy</h1>
        <p className="mt-2 text-sm text-white/60">Sign in with your academy account.</p>
        <button
          type="button"
          className="mt-6 h-12 rounded-2xl px-6 font-semibold"
          style={{ background: ACCENT, color: accentInk(ACCENT) }}
        >
          Sign in
        </button>
      </section>
      <section className="mx-auto max-w-3xl px-4 py-8">
        <CertificateDocument certificate={certificate} actions={false} />
      </section>
    </main>
  );
}
