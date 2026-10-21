import { Suspense } from 'react';
import { EssayWriter } from '@/components/essay-writer';

export default function StudioEssayPage() {
  return (
    <Suspense fallback={null}>
      <EssayWriter purpose="This page is ET AI Essay Writer. ET AI marks the essay against the level you choose. Teachers can assign the same task to a class, one student, or the institution." />
    </Suspense>
  );
}
