import Link from 'next/link';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <Link href="/dashboard" className="text-sm font-semibold">Poket School</Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/dashboard/studio/et">ET AI</Link>
          <Link href="/dashboard/studio/maths">ET Maths</Link>
          <Link href="/dashboard/studio/exam-prep">ET Exams</Link>
          <Link href="/dashboard/studio/essay">ET Essay Writer</Link>
        </nav>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
