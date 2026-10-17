import { FamilyBoard } from '@/components/billing/family-board';

const sample = {
  placeholderDiscount: true as const,
  subscription: {
    status: 'active',
    currentPeriodEnd: Date.UTC(2026, 10, 17),
    source: 'stripe',
    spendingCapUsd: 200,
    beneficiaryUids: ['child_a', 'child_b'],
  },
  children: [
    { uid: 'child_a', name: 'Amina', plan: 'primary_secondary', status: 'active', currentPeriodEnd: Date.UTC(2026, 10, 17), source: 'stripe' },
    { uid: 'child_b', name: 'Farid', plan: 'igcse_alevel', status: 'active', currentPeriodEnd: Date.UTC(2026, 10, 17), source: 'apple' },
  ],
  requests: [{ id: 'req_1', kind: 'plan', tierId: 'igcse_alevel', status: 'pending', note: 'Please switch me to IGCSE.' }],
  invoices: [{
    id: 'inv_1',
    description: 'Family plan',
    amount: 96,
    currency: 'USD',
    status: 'paid',
    receiptNumber: 'PS-20261017-FAMLY1',
    myInvois: { status: 'ready', typeCode: '01' },
  }],
};

export default function BillingPreviewPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Family billing</p>
      <h1 className="font-heading text-4xl">Parent billing</h1>
      <FamilyBoard preview={sample} />
    </main>
  );
}
