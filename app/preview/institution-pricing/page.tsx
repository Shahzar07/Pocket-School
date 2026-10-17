import { PriceCalculator } from '@/components/institutions/price-calculator';
import { seedInstitutionCatalogue } from '@/lib/institution-catalogue';

/** Static calculator so the live price, tier, and quote button can be reviewed without Firebase. */
export default function InstitutionPricingPreview() {
  return (
    <main className="min-h-screen bg-[#F6F1E7] px-6 py-8 text-[#1A3C34]">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C8922A]">Poket School</p>
      <h1 className="mt-2 font-heading text-4xl">Institution price calculator</h1>
      <p className="mt-2 max-w-2xl text-sm">Starter, Growth, Pro, and Enterprise follow the seat count. Choose programmes, and the highlighted card is the tier those seats fall into.</p>
      <div className="mt-6">
        <PriceCalculator catalogue={seedInstitutionCatalogue()} institutionName="North Academy" />
      </div>
    </main>
  );
}
