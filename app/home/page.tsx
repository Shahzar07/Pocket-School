import { redirect } from 'next/navigation';

/** App notice link. The website role home is the dashboard. */
export default function HomeAliasPage() {
  redirect('/dashboard');
}
