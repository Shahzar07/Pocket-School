'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';

export default function InstitutionCareerPage() {
  const { profile } = useAuthSTORE();
  const institutionId = profile?.institutionId ?? '';
  const [giving, setGiving] = useState(false);
  const [skill, setSkill] = useState('Algebraic reasoning');
  const [lessonId, setLessonId] = useState('');
  const [title, setTitle] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [deadline, setDeadline] = useState('');
  const [level, setLevel] = useState('');
  const [reunionId, setReunionId] = useState('');
  const [openingId, setOpeningId] = useState('');
  const [talkId, setTalkId] = useState('');

  const load = useCallback(() => {
    if (!institutionId) return;
    authedFetch(`/api/institutions/extras?view=institution&institutionId=${encodeURIComponent(institutionId)}`)
      .then((data) => setGiving(data.givingEnabled === true))
      .catch((error: Error) => toast.error(error.message));
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  async function send(action: string, body: Record<string, unknown>) {
    try {
      await authedFetch('/api/institutions/extras', {
        method: 'POST',
        body: JSON.stringify({ action, institutionId, ...body }),
      });
      toast.success('Saved.');
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Try again.');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-deep">Poket School</p>
        <h1 className="font-heading text-3xl text-ink">Career desk</h1>
        <p className="mt-2 text-sm text-muted">Level names only. ET AI suggests from the opportunities you enter and never adds one.</p>
      </header>

      <section className="rounded-3xl bg-white p-5 space-y-3">
        <h2 className="font-semibold text-ink">Skill map</h2>
        <input value={skill} onChange={(event) => setSkill(event.target.value)} className="h-11 w-full rounded-xl bg-wash px-3" placeholder="Skill name" />
        <input value={lessonId} onChange={(event) => setLessonId(event.target.value)} className="h-11 w-full rounded-xl bg-wash px-3" placeholder="Lesson id" />
        <button type="button" onClick={() => send('save-skill', { name: skill, lessonIds: lessonId ? [lessonId] : [], blooms: ['apply'], badgeIds: [] })} className="h-10 rounded-full bg-blue-deep px-4 text-sm text-white">Save skill</button>
      </section>

      <section className="rounded-3xl bg-white p-5 space-y-3">
        <h2 className="font-semibold text-ink">Opportunity</h2>
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 w-full rounded-xl bg-wash px-3" placeholder="Title" />
        <input value={organisation} onChange={(event) => setOrganisation(event.target.value)} className="h-11 w-full rounded-xl bg-wash px-3" placeholder="Organisation" />
        <input value={level} onChange={(event) => setLevel(event.target.value)} className="h-11 w-full rounded-xl bg-wash px-3" placeholder="Level name" />
        <input value={deadline} onChange={(event) => setDeadline(event.target.value)} className="h-11 w-full rounded-xl bg-wash px-3" placeholder="YYYY-MM-DD" />
        <button type="button" onClick={() => send('save-opportunity', { kind: 'internship', title, organisation, deadline, levels: level ? [level] : [], interests: ['study'], url: '' })} className="h-10 rounded-full bg-blue-deep px-4 text-sm text-white">Save opportunity</button>
      </section>

      <section className="rounded-3xl bg-white p-5 space-y-3">
        <h2 className="font-semibold text-ink">Alumni giving</h2>
        <p className="text-sm text-muted">{giving ? 'On. Gifts use the sandbox and send a receipt.' : 'Off for this academy.'}</p>
        <button type="button" onClick={() => send('set-giving', { enabled: !giving })} className="h-10 rounded-full bg-blue-deep px-4 text-sm text-white">{giving ? 'Turn off' : 'Turn on'}</button>
        {giving ? <button type="button" onClick={() => send('save-campaign', { title: 'Sponsor a student seat', kind: 'sponsor_seat', goal: 100, currency: 'USD' })} className="h-10 rounded-full bg-white px-4 text-sm text-ink">Add a seat campaign</button> : null}
      </section>

      <section className="rounded-3xl bg-white p-5 space-y-3">
        <h2 className="font-semibold text-ink">Reunion</h2>
        <button type="button" onClick={() => send('save-reunion', { title: 'Class reunion', when: deadline || '2026-12-12', place: 'Hall', level })} className="h-10 rounded-full bg-blue-deep px-4 text-sm text-white">Create reunion</button>
        <p className="text-sm text-muted">RSVP pushes use the alumni category. Reopening the wall uses that same category.</p>
        <input value={reunionId} onChange={(event) => setReunionId(event.target.value)} className="h-11 w-full rounded-xl bg-wash px-3" placeholder="Reunion id" />
        <button type="button" onClick={() => send('reopen-wall', { reunionId })} className="h-10 rounded-full bg-white px-4 text-sm text-ink">Reopen the signing wall</button>
      </section>

      <section className="rounded-3xl bg-white p-5 space-y-3">
        <h2 className="font-semibold text-ink">Moderate</h2>
        <input value={openingId} onChange={(event) => setOpeningId(event.target.value)} className="h-11 w-full rounded-xl bg-wash px-3" placeholder="Opening id" />
        <button type="button" onClick={() => send('review-opening', { openingId, publish: true })} className="h-10 rounded-full bg-blue-deep px-4 text-sm text-white">Publish opening</button>
        <input value={talkId} onChange={(event) => setTalkId(event.target.value)} className="h-11 w-full rounded-xl bg-wash px-3" placeholder="Talk id" />
        <button type="button" onClick={() => send('review-talk', { talkId, approve: true })} className="h-10 rounded-full bg-white px-4 text-sm text-ink">Approve talk</button>
      </section>
    </div>
  );
}
