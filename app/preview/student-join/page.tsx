import { StudentJoinPreview } from './view';

export default async function Page({ searchParams }: { searchParams: Promise<{ panel?: string }> }) {
  const params = await searchParams;
  return <StudentJoinPreview panel={params.panel || 'register'} />;
}
