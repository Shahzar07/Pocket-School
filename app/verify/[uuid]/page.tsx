'use client';

import { useState, use } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, Search, Award } from 'lucide-react';

export default function VerifyCertificate({ params }: { params: Promise<{ uuid: string }> }) {
  const resolvedParams = use(params);
  const [uuid, setUuid] = useState(resolvedParams.uuid || '');
  const [verified, setVerified] = useState<boolean | null>(null);
  const [certData, setCertData] = useState<any>(null);

  const handleVerify = () => {
    // Simulated verification logic
    if (uuid === '1234-5678' || uuid === resolvedParams.uuid) {
      setVerified(true);
      setCertData({
        holder: 'John Doe',
        course: 'Biology 101',
        date: 'Oct 25, 2023',
        institution: 'Lincoln High School'
      });
    } else {
      setVerified(false);
      setCertData(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 rounded-[24px] shadow-sm border border-[#DADCE0] bg-white">
        <div className="text-center mb-8">
          <div className="bg-google-blue/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Award className="w-8 h-8 text-google-blue" />
          </div>
          <h1 className="text-2xl font-bold text-[#202124]">Verify Certificate</h1>
          <p className="text-[#5F6368] mt-2">Enter the certificate UUID to verify its authenticity and details.</p>
        </div>

        <div className="flex gap-2 mb-8">
          <Input 
            value={uuid}
            onChange={(e) => setUuid(e.target.value)}
            placeholder="e.g. 1234-5678"
            className="flex-1 h-12 rounded-xl"
          />
          <Button onClick={handleVerify} className="h-12 rounded-xl bg-google-blue hover:bg-[#1967D2] px-6">
            <Search className="w-5 h-5" />
          </Button>
        </div>

        {verified === true && certData && (
          <div className="text-center p-6 bg-[#E0F2F1] border border-[#00897B] rounded-2xl">
            <CheckCircle2 className="w-12 h-12 text-[#00897B] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#00897B] mb-4">Certificate is Valid</h2>
            <div className="space-y-2 text-left bg-white p-4 rounded-xl border border-[#DADCE0]">
              <div className="flex justify-between items-center text-sm border-b border-[#DADCE0] pb-2">
                <span className="text-[#5F6368] font-medium">Holder Name</span>
                <span className="font-bold text-[#202124]">{certData.holder}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-[#DADCE0] py-2">
                <span className="text-[#5F6368] font-medium">Course</span>
                <span className="font-bold text-[#202124]">{certData.course}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-[#DADCE0] py-2">
                <span className="text-[#5F6368] font-medium">Date Issued</span>
                <span className="font-bold text-[#202124]">{certData.date}</span>
              </div>
              <div className="flex justify-between items-center text-sm pt-2">
                <span className="text-[#5F6368] font-medium">Institution</span>
                <span className="font-bold text-[#202124]">{certData.institution}</span>
              </div>
            </div>
          </div>
        )}

        {verified === false && (
          <div className="text-center p-6 bg-[#FCE8E6] border border-[#E53935] rounded-2xl">
            <XCircle className="w-12 h-12 text-[#E53935] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#E53935] mb-2">Invalid Certificate</h2>
            <p className="text-[#5F6368] text-sm">We could not find a record for this certificate UUID. Please check and try again.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
