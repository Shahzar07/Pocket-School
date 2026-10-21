import { redirect } from 'next/navigation';

export default function MathsPacksPage() {
  redirect('/dashboard/studio/exams/packs?subject=mathematics');
}
