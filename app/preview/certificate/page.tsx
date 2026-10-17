import { CertificateDocument } from '@/components/certificate-document';
import { CredentialPanel } from '@/components/credentials/credential-panel';
import type { CertificateFace } from '@/lib/certificates';

const sample: CertificateFace = {
  id: '11111111-2222-4333-8444-555555555555',
  studentName: 'Aisha Rahman',
  courseTitle: 'Biology',
  moduleTitle: 'Cells and organisation',
  moduleId: 'module-cells',
  courseId: 'course-biology',
  issuedAt: '2026-10-15T12:00:00.000Z',
  issuedByName: 'Poket School',
  status: 'valid',
  studentNumber: 'PS-K7NP-4R2C',
};

/** Sample certificate for review. It is not a live record and is not written to Firestore. */
export default function PreviewCertificatePage() {
  return (
    <main className="min-h-screen bg-[#F4F7F8] px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-4">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-[#1E6A83]">Preview</p>
        <h1 className="text-center font-heading text-3xl text-[#1c2b30]">Module certificate</h1>
        <CertificateDocument certificate={sample} />
        <CredentialPanel id={sample.id} />
      </div>
    </main>
  );
}
