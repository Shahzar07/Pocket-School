import { isAccountMode, type AccountMode } from '@/lib/account-modes';
import { ModePreview } from './preview';

export default async function ModePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; menu?: string; persona?: string }>;
}) {
  const params = await searchParams;
  const initialMode: AccountMode = params.mode && isAccountMode(params.mode) ? params.mode : 'student';
  return (
    <ModePreview
      initialMode={initialMode}
      menuOpen={params.menu === 'open'}
      learner={params.persona === 'learner'}
    />
  );
}
