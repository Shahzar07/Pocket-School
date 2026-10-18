'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { CareerHome, fieldClass, primaryButton, quietButton } from '@/components/career/app-surface';
import { EventsDesk } from '@/components/career/events-desk';
import { ROCHFORD_EVENTS } from '@/lib/career/events';
import { authedFetch } from '@/lib/api-client';

export default function InstitutionCareerPage() {
  const { profile } = useAuthSTORE();
  const institutionId = profile?.institutionId ?? '';
  const [giving, setGiving] = useState(false);
  const [section, setSection] = useState('events');
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
    <CareerHome
      title="Career desk"
      blurb="Level names only. ET AI suggests from the opportunities you enter and never adds one."
      active={section}
      onActive={setSection}
      tasks={[
        { id: 'skills', label: 'Add a skill', category: 'learning', onSelect: () => setSection('skills') },
        { id: 'opportunities', label: 'Enter an opportunity', category: 'careers', onSelect: () => setSection('opportunities') },
        { id: 'giving', label: giving ? 'Giving is on' : 'Turn on giving', category: 'payments', onSelect: () => setSection('giving') },
      ]}
      tiles={[
        { id: 'events', label: 'Events', hint: 'Create and edit', category: 'community' },
        { id: 'skills', label: 'Skills', hint: 'Lesson or badge', category: 'learning' },
        { id: 'opportunities', label: 'Opportunities', hint: 'Entered list', category: 'careers' },
        { id: 'giving', label: 'Giving', hint: giving ? 'On' : 'Off', category: 'payments', badge: giving ? 1 : 0 },
        { id: 'reunions', label: 'Reunions', hint: 'Alumni push', category: 'community' },
        { id: 'moderate', label: 'Moderate', hint: 'Openings and talks', category: 'safety' },
      ]}
      stats={[
        { label: 'Giving', value: giving ? 'On' : 'Off', hint: 'Sandbox receipts', ring: giving ? 100 : 0 },
        { label: 'Academy', value: institutionId ? 'Ready' : 'Choose one', hint: 'This desk follows your academy' },
      ]}
    >
      {section === 'events' || section === 'home' ? (
        <EventsDesk
          initial={ROCHFORD_EVENTS}
          person="Leah Tan, careers lead"
          canEdit
          skills={[{ name: 'Algebraic reasoning', evidence: 'Mapped to a lesson', visible: true }]}
          matches={[{ title: 'Hospital shadowing week', organisation: 'City clinic', kind: 'experience' }]}
          jobs={[{ title: 'Saturday lab assistant', employer: 'Science department', level: 'IGCSE', deadline: '30 Nov 2026' }]}
          mentors={[{ name: 'Omar Haddad', field: 'Medicine', optedIn: true }]}
        />
      ) : null}
      {section === 'skills' ? (
        <div className="space-y-3">
          <h2 className="font-heading text-xl">Skill map</h2>
          <input value={skill} onChange={(event) => setSkill(event.target.value)} className={fieldClass} placeholder="Skill name" />
          <input value={lessonId} onChange={(event) => setLessonId(event.target.value)} className={fieldClass} placeholder="Lesson id" />
          <button type="button" onClick={() => send('save-skill', { name: skill, lessonIds: lessonId ? [lessonId] : [], blooms: ['apply'], badgeIds: [] })} className={primaryButton}>Save skill</button>
        </div>
      ) : null}
      {section === 'opportunities' ? (
        <div className="space-y-3">
          <h2 className="font-heading text-xl">Opportunity</h2>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClass} placeholder="Title" />
          <input value={organisation} onChange={(event) => setOrganisation(event.target.value)} className={fieldClass} placeholder="Organisation" />
          <input value={level} onChange={(event) => setLevel(event.target.value)} className={fieldClass} placeholder="Level name" />
          <input value={deadline} onChange={(event) => setDeadline(event.target.value)} className={fieldClass} placeholder="YYYY-MM-DD" />
          <button type="button" onClick={() => send('save-opportunity', { kind: 'internship', title, organisation, deadline, levels: level ? [level] : [], interests: ['study'], url: '' })} className={primaryButton}>Save opportunity</button>
        </div>
      ) : null}
      {section === 'giving' ? (
        <div className="space-y-3">
          <h2 className="font-heading text-xl">Alumni giving</h2>
          <p className="text-sm text-muted-foreground">{giving ? 'On. Gifts use the sandbox and send a receipt.' : 'Off for this academy.'}</p>
          <button type="button" onClick={() => send('set-giving', { enabled: !giving })} className={primaryButton}>{giving ? 'Turn off' : 'Turn on'}</button>
          {giving ? <button type="button" onClick={() => send('save-campaign', { title: 'Sponsor a student seat', kind: 'sponsor_seat', goal: 100, currency: 'USD' })} className={quietButton}>Add a seat campaign</button> : null}
        </div>
      ) : null}
      {section === 'reunions' ? (
        <div className="space-y-3">
          <h2 className="font-heading text-xl">Reunion</h2>
          <p className="text-sm text-muted-foreground">RSVP pushes use the alumni category. Reopening the wall uses that same category.</p>
          <button type="button" onClick={() => send('save-reunion', { title: 'Class reunion', when: deadline || '2026-12-12', place: 'Hall', level })} className={primaryButton}>Create reunion</button>
          <input value={reunionId} onChange={(event) => setReunionId(event.target.value)} className={fieldClass} placeholder="Reunion id" />
          <button type="button" onClick={() => send('reopen-wall', { reunionId })} className={quietButton}>Reopen the signing wall</button>
        </div>
      ) : null}
      {section === 'moderate' ? (
        <div className="space-y-3">
          <h2 className="font-heading text-xl">Moderate</h2>
          <input value={openingId} onChange={(event) => setOpeningId(event.target.value)} className={fieldClass} placeholder="Opening id" />
          <button type="button" onClick={() => send('review-opening', { openingId, publish: true })} className={primaryButton}>Publish opening</button>
          <input value={talkId} onChange={(event) => setTalkId(event.target.value)} className={fieldClass} placeholder="Talk id" />
          <button type="button" onClick={() => send('review-talk', { talkId, approve: true })} className={quietButton}>Approve talk</button>
        </div>
      ) : null}
    </CareerHome>
  );
}
