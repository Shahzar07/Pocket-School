import Link from 'next/link';
import { Award } from 'lucide-react';
import { certificateDateLabel } from '@/lib/certificates/template';
import { certificateStatus, certificateVerifyPath, type CertificateFace } from '@/lib/certificates';

export function CourseCertificateCard({
  certificate,
}: {
  certificate: CertificateFace & { level?: string | null; score?: number | null };
}) {
  const issued = typeof certificate.issuedAt === 'string' || typeof certificate.issuedAt === 'number'
    ? certificateDateLabel(new Date(certificate.issuedAt).toISOString())
    : certificate.issuedAt instanceof Date
      ? certificateDateLabel(certificate.issuedAt.toISOString())
      : '';
  const revoked = certificateStatus(certificate.status) === 'revoked';
  return (
    <article className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Poket School</p>
      <div className="mt-3 flex items-start gap-3">
        <Award className="w-6 h-6 text-primary shrink-0 mt-1" />
        <div className="min-w-0">
          <h2 className="font-heading text-2xl text-foreground">{certificate.studentName}</h2>
          <p className="text-sm text-muted-foreground mt-1">{certificate.courseTitle}</p>
        </div>
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2 text-sm">
        {certificate.level ? (
          <div>
            <dt className="text-muted-foreground">Level</dt>
            <dd className="font-semibold text-foreground">{certificate.level}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted-foreground">Date</dt>
          <dd className="font-semibold text-foreground">{issued || 'Date unavailable'}</dd>
        </div>
        {typeof certificate.score === 'number' ? (
          <div>
            <dt className="text-muted-foreground">Score</dt>
            <dd className="font-semibold text-foreground">{Math.round(certificate.score)}%</dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Certificate ID</dt>
          <dd className="font-mono text-xs text-foreground break-all">{certificate.id}</dd>
        </div>
      </dl>
      <p className={`mt-4 text-[11px] font-bold uppercase tracking-wider ${revoked ? 'text-[#9B1C1C]' : 'text-[#0F6E56]'}`}>
        {revoked ? 'Revoked' : 'Valid'}
      </p>
      <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold">
        <a className="text-primary" href={`/api/certificates/${encodeURIComponent(certificate.id)}/pdf`}>PDF</a>
        <Link className="text-primary" href={certificateVerifyPath(certificate.id)}>Verify</Link>
      </div>
    </article>
  );
}
