import { PendingApproval } from '@/components/institutions/pending-approval';

/** Static pending screen so the status page can be reviewed without Firebase. */
export default function InstitutionPendingPreview() {
  return (
    <PendingApproval
      status="pending"
      organisation="Rochfords"
      email="ada@rochfords.example"
    />
  );
}
