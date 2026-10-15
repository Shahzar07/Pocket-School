'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { Role } from '@/lib/roles';

const STORAGE = 'poket-checklist-dismissed';

const STEPS: Record<Role, { href: string; label: string }[]> = {
  student: [
    { href: '/courses', label: 'Find a course in the marketplace' },
    { href: '/dashboard/student/tasks', label: 'Set today’s goals' },
    { href: '/dashboard/student/achievements', label: 'See your streak and badges' },
  ],
  teacher: [
    { href: '/dashboard/teacher/courses', label: 'Open a course you teach' },
    { href: '/dashboard/teacher/attendance', label: 'Mark attendance' },
    { href: '/dashboard/teacher/live', label: 'Schedule a live class' },
  ],
  parent: [
    { href: '/dashboard/parent', label: 'Open your family dashboard' },
    { href: '/dashboard/parent/duedates', label: 'Check upcoming due dates' },
  ],
  admin: [
    { href: '/dashboard/admin/allocations', label: 'Review product access' },
    { href: '/dashboard/admin/users', label: 'Confirm new accounts' },
  ],
  institution_admin: [
    { href: '/dashboard/institution', label: 'Open your school home' },
    { href: '/dashboard/admin/allocations', label: 'Check what your school can open' },
  ],
};

export function RoleChecklist({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const steps = STEPS[role];

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE);
      const dismissed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      setOpen(dismissed[role] !== true);
    } catch {
      setOpen(true);
    }
  }, [role]);

  if (!open) return null;

  const dismiss = () => {
    setOpen(false);
    try {
      const raw = window.localStorage.getItem(STORAGE);
      const dismissed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      dismissed[role] = true;
      window.localStorage.setItem(STORAGE, JSON.stringify(dismissed));
    } catch {
      // The card can stay dismissed for this view even if storage is blocked.
    }
  };

  return (
    <section className="mb-4 rounded-2xl border border-border bg-card p-4" aria-label="Getting started">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Getting started</p>
          <h2 className="font-heading text-xl text-foreground mt-1">Your first steps</h2>
        </div>
        <button type="button" onClick={dismiss} className="rounded-full p-1 text-muted-foreground hover:text-foreground" aria-label="Dismiss checklist">
          <X className="h-4 w-4" />
        </button>
      </div>
      <ol className="mt-3 space-y-2">
        {steps.map(step => (
          <li key={step.href}>
            <Link href={step.href} className="text-sm font-medium text-foreground underline-offset-4 hover:underline">
              {step.label}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
