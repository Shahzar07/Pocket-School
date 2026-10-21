'use client';

import { useEffect, useState } from 'react';
import { IssuanceDesk } from '@/components/credentials/issuance-desk';
import { CertificateDesigner } from '@/components/certificates/designer';
import { authedFetch } from '@/lib/api-client';
import { useAuthSTORE } from '@/hooks/use-auth';
import { resolveStaffRole } from '@/lib/admin-console';
import { builtinDesigns, type CertificateDesign } from '@/lib/certificates/design';

export default function AdminCertificatesPage() {
  const { profile } = useAuthSTORE();
  const staff = resolveStaffRole(profile);
  const platform = staff === 'super_admin';
  const [designs, setDesigns] = useState<CertificateDesign[]>(builtinDesigns());
  const [comingSoon, setComingSoon] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    authedFetch('/api/admin/certificates')
      .then((data) => {
        if (Array.isArray(data.designs) && data.designs.length) setDesigns(data.designs as CertificateDesign[]);
        setComingSoon(data.comingSoon === true);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '';
        if (message.toLowerCase().includes('hidden') || message.toLowerCase().includes('forbidden')) setHidden(true);
      })
      .finally(() => setReady(true));
  }, []);

  if (hidden || (profile && String(profile.role) === 'partner_merchant')) {
    return <p className="text-sm text-[#203337]">Partners do not design certificates.</p>;
  }
  if (profile?.role === 'teacher') {
    return <p className="text-sm text-[#203337]">Teachers issue class work from their classroom. Certificate templates stay with the institution admin.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1E6A83] dark:text-[#3FE0D0]">Admin</p>
        <h1 className="mt-2 font-heading text-4xl text-[#203337] dark:text-[#E8F4F6]">Certificates</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#1E6A83] dark:text-[#3FE0D0]">
          Design the certificate, keep more than one template, and set a default. An institution admin saves an override for their school only.
        </p>
      </header>
      {ready ? (
        <CertificateDesigner
          initial={designs}
          canEditDefault={platform}
          institutionId={profile?.institutionId ?? ''}
          comingSoon={comingSoon}
        />
      ) : <p className="text-sm text-[#1E6A83]">Loading templates.</p>}
      {platform ? <IssuanceDesk mode="admin" /> : null}
    </div>
  );
}
