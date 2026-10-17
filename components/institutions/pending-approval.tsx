import Link from 'next/link';
import { InstitutionJourneyFrame } from '@/components/institutions/journey-frame';

export type ApprovalStatus = 'pending' | 'suspended' | 'active' | 'unknown';

const COPY: Record<ApprovalStatus, { title: string; body: string }> = {
  pending: {
    title: 'Pending approval',
    body: 'Poket School reviews each school and organisation before the academy opens. You can sign in any time to see this status. An email arrives when the academy is approved, and the next page is the setup checklist.',
  },
  suspended: {
    title: 'This academy is paused',
    body: 'Sign-in to the academy dashboard waits until Poket School restores the academy. Your registration details are unchanged.',
  },
  active: {
    title: 'Approved',
    body: 'This academy is open. Continue to the setup checklist, then the academy dashboard.',
  },
  unknown: {
    title: 'Academy status',
    body: 'Sign in with the institution admin account to see whether the academy is waiting for approval.',
  },
};

export function PendingApproval({
  status,
  organisation,
  email,
  continueHref,
  reasons = [],
}: {
  status: ApprovalStatus;
  organisation: string;
  email?: string;
  continueHref?: string;
  reasons?: string[];
}) {
  const copy = COPY[status];
  const name = organisation.trim() || 'Your organisation';
  return (
    <InstitutionJourneyFrame eyebrow="For Schools & Organisations" title={copy.title} lede={copy.body}>
      <dl className="space-y-3 rounded-2xl bg-[#F6F1E7] px-4 py-4 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt className="text-[#1A3C34]/60">Organisation</dt>
          <dd className="text-right font-semibold">{name}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-[#1A3C34]/60">Status</dt>
          <dd className="rounded-full bg-[#F8E7C4] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#1A3C34]">
            {status === 'unknown' ? 'Sign in required' : status}
          </dd>
        </div>
        {email && (
          <div className="flex items-start justify-between gap-4">
            <dt className="text-[#1A3C34]/60">Approval email</dt>
            <dd className="text-right font-semibold">{email}</dd>
          </div>
        )}
        {reasons.length > 0 && (
          <div>
            <dt className="text-[#1A3C34]/60">Waiting on</dt>
            <dd className="mt-1 font-semibold">{reasons.join(' ')}</dd>
          </div>
        )}
      </dl>
      <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
        {status === 'active' && continueHref && (
          <Link href={continueHref} className="inline-flex h-11 items-center rounded-full bg-[#1A3C34] px-5 text-white">
            Continue
          </Link>
        )}
        {status !== 'active' && (
          <Link href="/institutions/login" className="inline-flex h-11 items-center rounded-full bg-[#1A3C34] px-5 text-white">
            Institution admin sign-in
          </Link>
        )}
        <Link href="/login" className="inline-flex h-11 items-center rounded-full border border-[#1A3C34]/15 px-5">
          Main Poket School login
        </Link>
      </div>
    </InstitutionJourneyFrame>
  );
}
