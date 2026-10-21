import { Suspense } from 'react';
import { EssayWriter } from '@/components/essay-writer';

export default function StudentEssayPage() {
  return (
    <Suspense fallback={null}>
      <EssayWriter purpose="Write an essay for ET AI Essay Writer. ET AI marks it against the level you choose. Assigned essays from your teacher also appear under Assignments." />
    </Suspense>
  );
}
