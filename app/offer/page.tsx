import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'The offer',
  description: 'Poket School with ET AI for Primary, Secondary, IGCSE, and A-Level. Open an account when you are ready.',
  alternates: { canonical: '/offer' },
  openGraph: {
    title: 'The Poket School offer',
    description: 'ET AI, lessons, and a pathway named in plain language.',
    url: '/offer',
    siteName: 'Poket School',
  },
};

const PATHS = ['Primary', 'Secondary', 'IGCSE', 'A-Level'];

export default function OfferPage() {
  return (
    <main id="content" className="min-h-screen bg-[#F8F4EE] text-[#203337]">
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-xs font-bold tracking-[0.22em] text-[#2786A4]">POKET SCHOOL</p>
        <h1 className="mt-3 font-heading text-4xl tracking-tight sm:text-6xl">The offer</h1>
        <p className="mt-4 text-lg leading-8 text-[#203337]/80">
          Poket School is the school around ET AI. A learner gets a one-to-one conversation, lessons, and practice. A family can see the rhythm. A school keeps its own teachers.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {PATHS.map((name) => (
            <li key={name} className="rounded-2xl bg-white px-4 py-3 font-semibold">{name}</li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="inline-flex min-h-12 items-center rounded-full bg-[#2786A4] px-6 text-sm font-bold text-white">
            Create an account
          </Link>
          <Link href="/pricing" className="inline-flex min-h-12 items-center rounded-full border border-[#203337]/15 bg-white px-6 text-sm font-bold">
            See pricing
          </Link>
        </div>
      </section>
    </main>
  );
}
