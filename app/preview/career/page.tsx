'use client';

import { EventsDesk } from '@/components/career/events-desk';
import { ROCHFORD_EVENTS } from '@/lib/career/events';

export default function CareerPreviewPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F6] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <p className="mb-3"><span className="rounded-full bg-[#3FE0D0] px-2 py-0.5 text-xs font-bold text-[#203337]">Sample data</span></p>
        <EventsDesk
          initial={ROCHFORD_EVENTS}
          person="Amina Rahman, student"
          canEdit={false}
          skills={[
            { name: 'Algebraic reasoning', evidence: 'IGCSE Mathematics unit test', visible: true },
            { name: 'Scientific method', evidence: 'Biology practical badge', visible: true },
          ]}
          matches={[
            { title: 'Hospital shadowing week', organisation: 'City clinic', kind: 'experience' },
          ]}
          jobs={[{ title: 'Saturday lab assistant', employer: 'Rochford science dept', level: 'IGCSE', deadline: '30 Nov 2026' }]}
          mentors={[{ name: 'Omar Haddad', field: 'Medicine', optedIn: true }]}
        />
      </div>
    </main>
  );
}
