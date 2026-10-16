import Link from 'next/link';
import type { Branding } from '@/lib/white-label';

export function AcademyWelcome({
  branding,
  catalogueTitles,
  pages,
  leaderboard,
  signupNote,
  loginHref,
  coursesHref,
  leaderboardHref,
  pageHref,
  address,
}: {
  branding: Branding;
  catalogueTitles: string[];
  pages: { slug: string; title: string }[];
  leaderboard: { rank: number; name: string; points: number }[];
  signupNote: string;
  loginHref: string;
  coursesHref: string;
  leaderboardHref: string;
  pageHref: (slug: string) => string;
  address: string;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Academy</p>
        <h1 className="font-heading text-5xl">{branding.displayName}</h1>
        <p className="max-w-xl text-muted-foreground">{branding.tagline || branding.loginBody || 'Sign in to your academy.'}</p>
        <p className="text-sm text-muted-foreground">{address}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href={loginHref} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Sign in</Link>
          <Link href={coursesHref} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">Catalogue</Link>
        </div>
        {signupNote && <p className="text-sm">{signupNote}</p>}
      </header>
      <section className="rounded-3xl border border-border p-5">
        <h2 className="font-semibold">Catalogue</h2>
        {catalogueTitles.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">This academy has not published catalogue items for visitors yet.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">{catalogueTitles.map((title) => <li key={title}>{title}</li>)}</ul>
        )}
      </section>
      {pages.length > 0 && (
        <section className="rounded-3xl border border-border p-5">
          <h2 className="font-semibold">Pages</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {pages.map((page) => <li key={page.slug}><Link href={pageHref(page.slug)} className="font-semibold text-primary">{page.title}</Link></li>)}
          </ul>
        </section>
      )}
      {leaderboard.length > 0 && (
        <section className="rounded-3xl border border-border p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Leaderboard</h2>
            <Link href={leaderboardHref} className="text-sm font-semibold text-primary">Open</Link>
          </div>
          <ol className="mt-3 space-y-1 text-sm">
            {leaderboard.slice(0, 5).map((row) => <li key={row.rank}>{row.rank}. {row.name} · {row.points}</li>)}
          </ol>
        </section>
      )}
      {!branding.hidePoweredBy && <p className="text-xs text-muted-foreground">Powered by Poket School</p>}
    </div>
  );
}
