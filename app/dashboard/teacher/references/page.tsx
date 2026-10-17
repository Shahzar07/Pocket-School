'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';

export default function TeacherReferencesPage() {
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
    <div className="mx-auto max-w-xl space-y-4 px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-deep">Poket School</p>
      <h1 className="font-heading text-3xl text-ink">Reference</h1>
      <p className="text-sm text-muted">A short verified reference stays locked. The student cannot edit it. The academy can revoke it.</p>
      <input value={studentId} onChange={(event) => setStudentId(event.target.value)} className="h-11 w-full rounded-xl bg-wash px-3" placeholder="Student id" />
      <textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-28 w-full rounded-2xl bg-wash px-3 py-3" placeholder="What you have seen this student do" />
      <button type="button" onClick={save} className="h-11 rounded-full bg-blue-deep px-5 text-sm text-white">Save reference</button>
    </div>
  );
}
