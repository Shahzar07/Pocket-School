'use client';

import { useState, use, useEffect } from 'react';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';
import { CheckCircle2, XCircle, Search, Award, Loader2 } from 'lucide-react';
import { getCertificateByUUID, type Certificate } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CertificateDocument } from '@/components/certificate-document';
import { CERTIFICATE_DISCLAIMER, type CertificateFace } from '@/lib/certificates';

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
  };
}

export default function VerifyCertificate({ params }: { params: Promise<{ uuid: string }> }) {
  const resolvedParams = use(params);
  const [uuid, setUuid] = useState(resolvedParams.uuid !== 'new' ? resolvedParams.uuid : '');
  const [verified, setVerified] = useState<boolean | null>(null);
  const [certData, setCertData] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(false);

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
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-[#0F6E56] font-semibold">
              <CheckCircle2 className="w-5 h-5" /> This certificate is on record
            </div>
            <CertificateDocument certificate={toFace(certData)} />
          </div>
        )}

        {verified === false && (
          <div className="text-center p-8 bg-white border border-[#E7B3AE] rounded-3xl max-w-xl mx-auto">
            <XCircle className="w-12 h-12 text-[#E53935] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#E53935] mb-2">No matching certificate</h2>
            <p className="text-[#526066] text-sm">Poket School has no certificate with this ID. Check the full ID and try again.</p>
          </div>
        )}

        <p className="text-center text-xs text-[#6b7c82] mt-8 max-w-lg mx-auto">{CERTIFICATE_DISCLAIMER}</p>
      </div>
    </div>
  );
}
