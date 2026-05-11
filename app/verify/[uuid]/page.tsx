'use client';

import { useState, use, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, Search, Award, Loader2 } from 'lucide-react';
import { getCertificateByUUID, Certificate } from '@/lib/db';
import { Timestamp } from 'firebase/firestore';

export default function VerifyCertificate({ params }: { params: Promise<{ uuid: string }> }) {
  const resolvedParams = use(params);
  const [uuid, setUuid] = useState(resolvedParams.uuid !== 'new' ? resolvedParams.uuid : '');
  const [verified, setVerified] = useState<boolean | null>(null);
  const [certData, setCertData] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (resolvedParams.uuid && resolvedParams.uuid !== 'new') {
      handleVerify(resolvedParams.uuid);
    }
  }, [resolvedParams.uuid]);

  const handleVerify = async (id?: string) => {
    const target = id ?? uuid;
    if (!target.trim()) return;
    setLoading(true);
    try {
      const cert = await getCertificateByUUID(target.trim());
      if (cert) {
        setVerified(true);
        setCertData(cert);
      } else {
        setVerified(false);
        setCertData(null);
      }
    } catch {
      setVerified(false);
      setCertData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return 'Unknown';
    try {
      const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return 'Unknown'; }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 rounded-[24px] shadow-sm border border-[#DADCE0] bg-white">
        <div className="text-center mb-8">
          <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Award className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-[#202124]">Verify Certificate</h1>
          <p className="text-[#5F6368] mt-2 text-sm">Enter the certificate ID to verify its authenticity.</p>
        </div>

        <div className="flex gap-2 mb-8">
          <Input
            value={uuid}
            onChange={(e) => setUuid(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            placeholder="Certificate UUID"
            className="flex-1 h-12 rounded-xl"
          />
          <Button onClick={() => handleVerify()} disabled={loading || !uuid.trim()} className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 px-5">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          </Button>
        </div>

        {verified === true && certData && (
          <div className="text-center p-6 bg-[#E0F2F1] border border-[#00897B] rounded-2xl">
            <CheckCircle2 className="w-12 h-12 text-[#00897B] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#00897B] mb-4">Certificate is Valid</h2>
            <div className="space-y-2 text-left bg-white p-4 rounded-xl border border-[#DADCE0]">
              {[
                { label: 'Holder Name', value: certData.studentName },
                { label: 'Course', value: certData.courseTitle },
                { label: 'Date Issued', value: formatDate(certData.issuedAt) },
                { label: 'Issued By', value: certData.issuedByName },
                { label: 'Certificate ID', value: certData.id?.slice(0, 18) + '…' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center text-sm border-b border-[#DADCE0] py-2 last:border-0">
                  <span className="text-[#5F6368] font-medium">{label}</span>
                  <span className="font-bold text-[#202124] text-right max-w-[55%]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {verified === false && (
          <div className="text-center p-6 bg-[#FCE8E6] border border-[#E53935] rounded-2xl">
            <XCircle className="w-12 h-12 text-[#E53935] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#E53935] mb-2">Invalid Certificate</h2>
            <p className="text-[#5F6368] text-sm">We could not find a record for this certificate ID. Please check and try again.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
