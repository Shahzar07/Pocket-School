'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CareerHome, fieldClass, primaryButton } from '@/components/career/app-surface';
import { authedFetch } from '@/lib/api-client';

export default function TeacherReferencesPage() {
  const [section, setSection] = useState('home');
  const [studentId, setStudentId] = useState('');
  const [body, setBody] = useState('');

  async function save() {
    try {
      await authedFetch('/api/institutions/extras', {
        method: 'POST',
        body: JSON.stringify({ action: 'endorse', studentId, body }),
      });
      toast.success('Reference saved. The student can show or hide it.');
      setBody('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Try again.');
    }
  }

  return (
    <CareerHome
      title="Reference"
      blurb="A short verified reference stays locked. The student cannot edit it. The academy can revoke it."
      active={section}
      tasks={[
        { id: 'write', label: 'Write a reference', category: 'people', onSelect: () => setSection('write') },
        { id: 'classes', label: 'My classes', category: 'learning', onSelect: () => { window.location.assign('/dashboard/teacher/classes'); } },
        { id: 'marking', label: 'Mark work', category: 'progress', onSelect: () => { window.location.assign('/dashboard/teacher/gradebook'); } },
      ]}
      tiles={[
        { id: 'write', label: 'Write', hint: 'Locked after saving', category: 'people' },
        { id: 'classes', label: 'Classes', hint: 'Your groups', category: 'learning' },
        { id: 'marking', label: 'Marking', hint: 'Gradebook', category: 'progress' },
      ]}
      onActive={(id) => {
        if (id === 'classes') {
          window.location.assign('/dashboard/teacher/classes');
          return;
        }
        if (id === 'marking') {
          window.location.assign('/dashboard/teacher/gradebook');
          return;
        }
        setSection(id);
      }}
      stats={[{ label: 'Reference', value: 'Locked', hint: 'The student chooses show or hide' }]}
    >
      {section === 'write' ? (
        <div className="space-y-3">
          <h2 className="font-heading text-xl">Write a reference</h2>
          <input value={studentId} onChange={(event) => setStudentId(event.target.value)} className={fieldClass} placeholder="Student id" />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-28 w-full rounded-[18px] border border-border bg-background px-3 py-3 text-sm text-foreground" placeholder="What you have seen this student do" />
          <button type="button" onClick={save} className={primaryButton}>Save reference</button>
        </div>
      ) : null}
    </CareerHome>
  );
}
