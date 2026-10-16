'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { getInstitution, getProgrammes, listOemLicences, saveOemLicence, type Institution, type Programme } from '@/lib/db';
import { licencePhase, programmeLicensed, type OemLicence } from '@/lib/oem';
import { usePricing } from '@/hooks/use-pricing';
import { formatMoney, quotePlan } from '@/lib/pricing';
import { AllocationPicker } from '@/components/allocation-picker';
import { Button } from '@/components/ui/button';
import { DocumentDelivery } from '@/components/document-delivery';
import { textDocument } from '@/lib/documents/packet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const today = () => new Date().toISOString().slice(0, 10);

export default function InstitutionLicencePage() {
  const { institutionId } = useParams<{ institutionId: string }>();
  const { config, currency } = usePricing();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [licences, setLicences] = useState<OemLicence[]>([]);
  const [programmeIds, setProgrammeIds] = useState<string[]>([]);
  const [seats, setSeats] = useState('30');
  const [startsOn, setStartsOn] = useState(today());
  const [endsOn, setEndsOn] = useState(`${new Date().getFullYear()}-12-31`);
  const [amount, setAmount] = useState('');
  const [allowOwnCourses, setAllowOwnCourses] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!institutionId) return;
    Promise.all([
      getInstitution(institutionId),
      getProgrammes(),
      listOemLicences(institutionId),
    ]).then(([inst, progs, rows]) => {
      setInstitution(inst);
      setProgrammes(progs);
      setLicences(rows);
    }).catch(() => toast.error('Could not load this institution.'));
  }, [institutionId]);

  const usePlanPrice = () => {
    const quote = quotePlan(config, 'professional', 'annual', currency);
    if (!quote) return;
    setAmount(String(quote.amount));
  };

  const save = async () => {
    if (!institutionId) return;
    const seatCount = Math.max(1, Number(seats) || 0);
    const price = Number(amount);
    if (!programmeIds.length) { toast.error('Choose at least one programme.'); return; }
    if (!Number.isFinite(price) || price < 0) { toast.error('Enter the licence price.'); return; }
    setSaving(true);
    try {
      const licence: OemLicence = {
        institutionId,
        programmeIds,
        seats: seatCount,
        seatsUsed: 0,
        startsOn,
        endsOn,
        currency,
        amount: price,
        allowOwnCourses,
        status: 'active',
      };
      const id = await saveOemLicence(institutionId, licence);
      setLicences(prev => [...prev, { ...licence, id }]);
      toast.success('Licence saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the licence.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-16 space-y-8">
      <div>
        <Link href="/dashboard/admin/institutions" className="text-xs font-semibold text-muted-foreground">Institutions</Link>
        <h1 className="font-heading text-4xl mt-2">{institution?.name ?? 'Institution'} licence</h1>
        <p className="text-sm text-muted-foreground mt-2">Choose programmes, seats and a term. The price is stored from the pricing config so a later rate change does not rewrite this contract.</p>
        <div className="mt-4">
          <DocumentDelivery
            documents={[
              textDocument({
                id: `quote-${institutionId}`,
                title: `${institution?.name || 'Institution'} quote`,
                lines: [
                  'Quote',
                  `Seats: ${seats}`,
                  `Price: ${amount || '—'} ${currency}`,
                  `Term: ${startsOn} to ${endsOn}`,
                  ...programmeIds.map(id => programmes.find(programme => programme.id === id)?.name || id),
                ],
              }),
              ...licences.map((licence, index) => textDocument({
                id: licence.id || `licence-${index}`,
                title: `${institution?.name || 'Institution'} licence`,
                lines: [
                  'Invoice',
                  `${licencePhase(licence, today())}`,
                  `${licence.seatsUsed}/${licence.seats} seats`,
                  `${formatMoney(licence.amount, licence.currency)}`,
                  `${licence.startsOn} to ${licence.endsOn}`,
                ],
              })),
            ]}
            studentIds={[]}
            institutionId={institutionId}
          />
        </div>
      </div>

      <section className="rounded-3xl border border-border p-5 space-y-4">
        <AllocationPicker
          label="Programmes on this licence"
          chips={[]}
          allowCustom={false}
          value={programmeIds.map(id => `programme:${id}`)}
          options={programmes.map(programme => ({ token: `programme:${programme.id}`, label: programme.name, group: 'Programmes' }))}
          onChange={tokens => setProgrammeIds(tokens.filter(token => token.startsWith('programme:')).map(token => token.slice('programme:'.length)))}
        />
        {programmes.length === 0 && <p className="text-sm text-muted-foreground">Create a programme in the curriculum CMS first.</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Seats</Label>
            <Input value={seats} onChange={event => setSeats(event.target.value)} type="number" min={1} className="rounded-xl h-11" />
          </div>
          <div>
            <Label>Price ({currency})</Label>
            <Input value={amount} onChange={event => setAmount(event.target.value)} type="number" min={0} className="rounded-xl h-11" />
            <button type="button" className="text-xs font-semibold text-violet-700 mt-1" onClick={usePlanPrice}>
              Use the Professional annual price
            </button>
          </div>
          <div>
            <Label>Starts</Label>
            <Input value={startsOn} onChange={event => setStartsOn(event.target.value)} type="date" className="rounded-xl h-11" />
          </div>
          <div>
            <Label>Ends</Label>
            <Input value={endsOn} onChange={event => setEndsOn(event.target.value)} type="date" className="rounded-xl h-11" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allowOwnCourses} onChange={event => setAllowOwnCourses(event.target.checked)} />
          The school may add its own courses
        </label>
        <Button onClick={() => void save()} disabled={saving} className="rounded-full">{saving ? 'Saving…' : 'Create licence'}</Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Current licences</h2>
        {licences.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
        {licences.map(licence => (
          <article key={licence.id} className="rounded-2xl border border-border p-4 text-sm">
            <p className="font-semibold capitalize">{licencePhase(licence, today())}</p>
            <p>{licence.seatsUsed}/{licence.seats} seats · {formatMoney(licence.amount, licence.currency)} · {licence.startsOn} to {licence.endsOn}</p>
            <p className="text-muted-foreground">{licence.programmeIds.filter(id => programmeLicensed(licence, id, today())).length} programmes live</p>
          </article>
        ))}
      </section>
    </div>
  );
}
