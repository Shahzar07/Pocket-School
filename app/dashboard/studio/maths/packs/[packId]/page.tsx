import { redirect } from 'next/navigation';

export default async function MathsPackPage({ params }: { params: Promise<{ packId: string }> }) {
  const { packId } = await params;
  redirect('/dashboard/studio/exams/packs/' + packId);
}
