'use client';

import { useState, use, useEffect } from 'react';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';
import { CheckCircle2, XCircle, Search, Award, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getCertificateByUUID, type Certificate } from '@/lib/db';
import { authedFetch } from '@/lib/api-client';
import { useAuthSTORE } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CertificateDocument } from '@/components/certificate-document';
import { CERTIFICATE_DISCLAIMER, certificateStatus, formatCertificateDate, type CertificateFace } from '@/lib/certificates';
import { CredentialPanel } from '@/components/credentials/credential-panel';
import { copyrightLine } from '@/lib/insights/copyright';

function toFace(cert: Certificate): CertificateFace {
  const issued = cert.issuedAt instanceof Timestamp ? cert.issuedAt.toDate() : cert.issuedAt;
  return {
    id: cert.id ?? '',
    studentName: cert.studentName,
    courseTitle: cert.courseTitle,
    moduleTitle: cert.moduleTitle,
    courseId: cert.courseId,
    moduleId: cert.moduleId,
    issuedAt: issued,
    issuedByName: cert.issuedByName,
    status: cert.status,
    accent: cert.accent,
    showPoweredBy: cert.showPoweredBy,
    logoUrl: cert.logoUrl,
    certificateFooter: cert.certificateFooter,
  };
}

export default function VerifyCertificate({ params }: { params: Promise<{ uuid: string }> }) {
  const resolvedParams = use(params);
  const { user, profile } = useAuthSTORE();
  const [uuid, setUuid] = useState(resolvedParams.uuid !== 'new' ? resolvedParams.uuid : '');
  const [verified, setVerified] = useState<boolean | null>(null);
  const [certData, setCertData] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    if (resolvedParams.uuid && resolvedParams.uuid !== 'new') {
      void handleVerify(resolvedParams.uuid);
    }
    // The id in the address is the record to check on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.uuid]);

  const handleVerify = async (id?: string) => {
    const target = (id ?? uuid).trim();
    if (!target) return;
    setLoading(true);
    try {
      const cert = await getCertificateByUUID(target);
      setVerified(!!cert);
      setCertData(cert);
    } catch {
      setVerified(false);
      setCertData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7F8] px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-[#1E6A83] font-bold tracking-[0.22em] text-[11px]">
            <Award className="w-4 h-4" /> POKET SCHOOL
          </Link>
          <h1 className="font-heading text-4xl text-[#1c2b30] mt-3">Verify a certificate</h1>
          <p className="text-sm text-[#526066] mt-2">Anyone can check a certificate ID. The record is issued by Poket School.</p>
        </div>

        <div className="flex gap-2 mb-8 max-w-xl mx-auto">
          <Input
            value={uuid}
            onChange={(e) => setUuid(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            placeholder="Certificate ID"
            className="flex-1 h-12 rounded-xl bg-white font-mono text-sm"
          />
          <Button onClick={() => handleVerify()} disabled={loading || !uuid.trim()} className="h-12 rounded-xl bg-[#1E6A83] hover:bg-[#2786A4] px-5">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          </Button>
        </div>

        {verified === true && certData && (
          <VerificationRecord
            certificate={certData}
            canRevoke={profile?.role === 'admin' && !!user}
            revoking={revoking}
            onRevoke={async () => {
              if (!certData.id) return;
              setRevoking(true);
              try {
                await authedFetch('/api/platform/revoke-certificate', {
                  method: 'POST',
                  body: JSON.stringify({ certificateId: certData.id }),
                });
                setCertData({ ...certData, status: 'revoked' });
                toast.success('Certificate revoked.');
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Could not revoke this certificate.');
              } finally {
                setRevoking(false);
              }
            }}
          />
        )}

        {verified === false && (
          <div className="text-center p-8 bg-white border border-[#E7B3AE] rounded-3xl max-w-xl mx-auto">
            <XCircle className="w-12 h-12 text-[#E53935] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#E53935] mb-2">No matching certificate</h2>
            <p className="text-[#526066] text-sm">Poket School has no certificate with this ID. Check the full ID and try again.</p>
          </div>
        )}

        <p className="text-center text-xs text-[#6b7c82] mt-8 max-w-lg mx-auto">{CERTIFICATE_DISCLAIMER}</p>
        <p className="text-center text-xs text-[#6b7c82] mt-3">{copyrightLine(new Date().getFullYear())}</p>
      </div>
    </div>
  );
}

function VerificationRecord({
  certificate,
  canRevoke,
  revoking,
  onRevoke,
}: {
  certificate: Certificate;
  canRevoke: boolean;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const face = toFace(certificate);
  const status = certificateStatus(face.status);
  const revoked = status === 'revoked';
  const moduleTitle = face.moduleTitle?.trim();
  const rows = [
    { label: 'Student name', value: face.studentName },
    { label: 'Module', value: moduleTitle || face.courseTitle },
    { label: 'Course', value: face.courseTitle },
    { label: 'Issue date', value: formatCertificateDate(face.issuedAt) },
    { label: 'Certificate ID', value: face.id },
    { label: 'Status', value: revoked ? 'Revoked' : 'Valid' },
  ];
  return (
    <div className="space-y-4">
      <div className={`rounded-3xl border p-6 ${revoked ? 'bg-[#FDE8E8] border-[#E7B3AE]' : 'bg-[#E7F6F1] border-[#B7E4D4]'}`}>
        <div className={`flex items-center justify-center gap-2 font-semibold ${revoked ? 'text-[#9B1C1C]' : 'text-[#0F6E56]'}`}>
          {revoked ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          {revoked ? 'Revoked' : 'Valid'}
        </div>
        <dl className="mt-4 bg-white rounded-2xl border border-[#DADCE0] divide-y divide-[#DADCE0]">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-4 px-4 py-3 text-sm">
              <dt className="text-[#526066] shrink-0">{row.label}</dt>
              <dd className={`font-semibold text-right break-all ${row.label === 'Certificate ID' ? 'font-mono text-xs sm:text-sm' : ''} ${row.label === 'Status' ? (revoked ? 'text-[#9B1C1C]' : 'text-[#0F6E56]') : 'text-[#1c2b30]'}`}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        {canRevoke && !revoked ? (
          <div className="mt-4 text-center">
            <Button type="button" variant="outline" disabled={revoking} onClick={onRevoke} className="rounded-full">
              {revoking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Revoke this certificate'}
            </Button>
          </div>
        ) : null}
      </div>
      <CertificateDocument certificate={face} />
      {face.id ? <CredentialPanel id={face.id} /> : null}
    </div>
  );
}
