'use client';

import { BookOpen, Flame, Home, Sparkles, Target, Users } from 'lucide-react';
import { DashHeader, DashPage, EmptyState, Panel, PanelHeader, StatCard } from '@/components/dash-ui';
import { RoleChecklist } from '@/components/role-checklist';
import { SeeMore } from '@/components/shell/see-more';
import { MobileNav, type ShellRole } from '@/components/shell/mobile-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { SparksNote } from '@/components/shell/sparks-note';
import type { Role } from '@/lib/roles';

const COPY: Record<ShellRole, { title: string; accent: string; action: string; today: string }> = {
  student: {
    title: 'Welcome back,',
    accent: 'Mina',
    action: 'Resume learning',
    today: 'Fractions practice is the next lesson. Add a goal if today is still empty.',
  },
  teacher: {
    title: 'Your classroom,',
    accent: 'Aisha',
    action: 'Mark 3 waiting',
    today: 'Three pieces of work still need a mark. That is the one thing to do first.',
  },
  parent: {
    title: 'Your family’s',
    accent: 'progress',
    action: 'Check today',
    today: 'Mina has one goal left today. You can cheer it or suggest another.',
  },
  admin: {
    title: 'Control',
    accent: 'centre',
    action: 'Review accounts',
    today: 'Two support conversations are open. Review new accounts before the course builder.',
  },
  institution_admin: {
    title: 'North Campus',
    accent: 'Academy',
    action: 'Invite people',
    today: '12 seats left and 2 invites waiting. Invite teachers and students first.',
  },
};

const ROLE_WASH: Record<ShellRole, string> = {
  student: 'var(--ps-role-student)',
  teacher: 'var(--ps-role-teacher)',
  parent: 'var(--ps-role-parent)',
  admin: 'var(--ps-role-admin)',
  institution_admin: 'var(--ps-role-admin)',
};

export function DesignDesk({ role }: { role: ShellRole }) {
  const copy = COPY[role] ?? COPY.student;
  return (
    <div className="min-h-screen text-foreground" data-design-desk={role} style={{ background: ROLE_WASH[role] }}>
      <div className="flex min-h-screen">
        <aside className="hidden w-[264px] shrink-0 border-e border-sidebar-border bg-sidebar p-4 lg:block" aria-label="Sidebar">
          <p className="text-[13px] font-semibold">Poket School</p>
          <p className="text-[11px] text-muted-foreground">{role.replace('_', ' ')}</p>
          <nav className="mt-6 space-y-1 text-[13px]">
            <p className="rounded-xl bg-muted px-3 py-2 font-semibold text-foreground">Today</p>
            <p className="px-3 py-2 text-muted-foreground">AI Studio</p>
            <p className="px-3 py-2 text-muted-foreground">Books</p>
            <p className="px-3 py-2 text-muted-foreground">Reports</p>
            <p className="px-3 py-2 text-muted-foreground">Settings</p>
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="flex h-[72px] items-center justify-between gap-3 border-b border-border px-4">
            <p className="text-[13px] text-muted-foreground">Home / Today</p>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <span className="rounded-full border border-border bg-secondary px-3 py-1 text-[12px] font-semibold">⌘K</span>
            </div>
          </header>
          <DashPage>
            <RoleChecklist role={role as Role} />
            <DashHeader
              eyebrow="Today"
              title={copy.title}
              accent={copy.accent}
              description={copy.today}
              actions={<button type="button" className="h-10 rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground">{copy.action}</button>}
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={Target} label="Today" value={role === 'teacher' ? 3 : 1} tone="teal" index={0} trend={{ direction: 'up', label: 'On track' }} />
              <StatCard icon={Flame} label="Streak" value={role === 'student' ? '6d' : '—'} tone="coral" index={1} trend={{ direction: 'up', label: 'Keep going' }} />
              <StatCard icon={BookOpen} label="Courses" value={role === 'admin' ? 42 : 4} tone="violet" index={2} />
              <StatCard icon={Users} label="People" value={role === 'institution_admin' ? 128 : 18} tone="sky" index={3} trend={{ direction: 'up', label: 'Active' }} />
            </div>
            <Panel>
              <PanelHeader title="Today" />
              <p className="text-sm text-muted-foreground">{copy.today}</p>
              {role === 'student' && <div className="mt-3"><SparksNote cost={15} balance={4} /></div>}
            </Panel>
            <SeeMore label="More on this dashboard">
              <Panel>
                <EmptyState icon={role === 'teacher' ? BookOpen : role === 'student' ? Target : Home} title="Nothing else needs you right now" body="Secondary charts and tables stay behind See more." />
              </Panel>
            </SeeMore>
            <p className="sr-only">Sparkles and studio stay one tap away.</p>
            <Sparkles className="sr-only" />
          </DashPage>
        </div>
      </div>
      <MobileNav role={role} onMore={() => undefined} />
    </div>
  );
}
