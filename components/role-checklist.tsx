'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { Role } from '@/lib/roles';

const DISMISS = 'poket-checklist-dismissed';
const DONE = 'poket-checklist-done';

const STEPS: Record<Role, { id: string; href: string; label: string; hint: string }[]> = {
  student: [
    { id: 'course', href: '/courses', label: 'Find a course', hint: 'Open the marketplace and enrol in one course.' },
    { id: 'goal', href: '/dashboard/student/goals?add=1', label: 'Add today’s goal', hint: 'One goal beside Resume learning is enough to start.' },
    { id: 'studio', href: '/dashboard/studio', label: 'Open AI Studio', hint: 'Studio spends Sparks only after you confirm a generation.' },
  ],
  teacher: [
    { id: 'course', href: '/dashboard/teacher/courses', label: 'Open a course you teach', hint: 'Your course studio is the place to edit lessons.' },
    { id: 'mark', href: '/dashboard/teacher/gradebook', label: 'Mark waiting work', hint: 'Start with anything still unmarked.' },
    { id: 'live', href: '/dashboard/teacher/live', label: 'Schedule a live class', hint: 'Families see the time on their calendar.' },
  ],
  parent: [
    { id: 'home', href: '/dashboard/parent', label: 'Check today’s goals', hint: 'Each linked child has their own list.' },
    { id: 'due', href: '/dashboard/parent/duedates', label: 'Look at due dates', hint: 'Due dates stay separate from goals.' },
    { id: 'report', href: '/dashboard/parent/reports', label: 'Open a report card', hint: 'You can reply and sign when a card is published.' },
  ],
  admin: [
    { id: 'people', href: '/dashboard/admin/users', label: 'Review new accounts', hint: 'Confirm who can sign in before changing access.' },
    { id: 'access', href: '/dashboard/admin/allocations', label: 'Check product access', hint: 'Allocations decide which products a school can open.' },
    { id: 'cms', href: '/dashboard/admin/curriculum', label: 'Open the course builder', hint: 'Lesson edits save as you go.' },
  ],
  institution_admin: [
    { id: 'home', href: '/dashboard/institution', label: 'Open your school home', hint: 'Invite people and name the academy here.' },
    { id: 'reports', href: '/dashboard/reports', label: 'Open school reports', hint: 'School reports hide individual wellbeing notes.' },
    { id: 'cards', href: '/dashboard/institution/templates', label: 'Set the report card', hint: 'The school template is what teachers publish from.' },
  ],
};

function readMap(key: string): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function RoleChecklist({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const steps = STEPS[role];

  useEffect(() => {
    setOpen(readMap(DISMISS)[role] !== true);
    setDone(readMap(DONE));
  }, [role]);

  if (!open) return null;

  const dismiss = () => {
    setOpen(false);
    const dismissed = readMap(DISMISS);
    dismissed[role] = true;
    try { window.localStorage.setItem(DISMISS, JSON.stringify(dismissed)); } catch { /* stay dismissed in this view */ }
  };

  const toggle = (id: string) => {
    const next = { ...done, [`${role}:${id}`]: !done[`${role}:${id}`] };
    setDone(next);
    try { window.localStorage.setItem(DONE, JSON.stringify(next)); } catch { /* the tick still shows */ }
  };

  const firstOpen = steps.find(step => !done[`${role}:${step.id}`]);

  return (
    <section className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]" aria-label="Getting started">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">First visit</p>
          <h2 className="font-heading text-xl text-foreground mt-1">Your first steps</h2>
          {firstOpen && (
            <p className="mt-1 text-[13px] text-muted-foreground" role="note">{firstOpen.hint}</p>
          )}
        </div>
        <button type="button" onClick={dismiss} className="rounded-full p-1 text-muted-foreground hover:text-foreground" aria-label="Dismiss checklist">
          <X className="h-4 w-4" />
        </button>
      </div>
      <ol className="mt-3 space-y-2">
        {steps.map(step => {
          const checked = Boolean(done[`${role}:${step.id}`]);
          return (
            <li key={step.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(step.id)}
                aria-label={`Mark “${step.label}” done`}
                className="mt-1 h-4 w-4 accent-[var(--primary)]"
              />
              <Link
                href={step.href}
                title={step.hint}
                className={`text-sm font-medium underline-offset-4 hover:underline ${checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}
              >
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
