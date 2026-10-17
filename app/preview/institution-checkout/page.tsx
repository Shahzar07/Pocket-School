import { PlanCheckout } from '@/components/institutions/plan-checkout';
import { InstitutionJourneyFrame } from '@/components/institutions/journey-frame';
import { SANDBOX_BANNER } from '@/lib/institution-self-serve';

/** Static plan and checkout step so the price and sandbox banner can be reviewed without Firebase. */
export default function InstitutionCheckoutPreview() {
  return (
    <InstitutionJourneyFrame
      eyebrow="For Schools & Organisations"
      title="Plan and checkout"
      lede="Choose a level, the programmes on that level, and how many student seats. The price includes tax for the academy’s country."
      align="start"
    >
      <PlanCheckout
        country="MY"
        email="ada@rochfords.example"
        initialSeats={40}
        banner={SANDBOX_BANNER}
        trialDays={14}
        trialSeatCap={25}
      />
    </InstitutionJourneyFrame>
  );
}
