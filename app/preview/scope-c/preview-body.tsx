'use client';

import { useState } from 'react';
import { CommunityScreen } from '@/components/scope-c/community-screen';
import { ChannelsScreen } from '@/components/scope-c/channels-screen';
import { ExamScreen, LessonQaScreen, ModerationScreen, SnapScreen, StoreScreen, TutorsScreen, type AttemptCard, type BookingCard, type GradeCard, type PaperCard, type ResourceCard } from '@/components/scope-c/market-screens';

const OPEN_SLOT = Date.UTC(2026, 9, 20, 9, 0, 0);

const SCREENS = ['community', 'channels', 'tutors', 'exams', 'store', 'snap', 'lesson', 'moderation'] as const;
type ScreenId = (typeof SCREENS)[number];

export function PreviewBody({ initial }: { initial?: string }) {
  const [screen, setScreen] = useState<ScreenId>(SCREENS.includes(initial as ScreenId) ? initial as ScreenId : 'community');
  const [snap, setSnap] = useState<{ answer: string; steps: string[]; similar: string[] } | null>(null);
  const [blocked, setBlocked] = useState('');
  const [tutorNote, setTutorNote] = useState('Group bookings open a live class. Payment stays pending until the wallet captures it.');
  const [bookings, setBookings] = useState<BookingCard[]>([]);
  const [papers, setPapers] = useState<PaperCard[]>([{
    id: 'paper',
    title: 'Cambridge Maths 2024 Paper 2',
    board: 'Cambridge',
    subject: 'Maths',
    minutes: 90,
    license: 'licensed',
    questions: [{ id: 'q1', prompt: 'Solve 2x + 4 = 10', marks: 2 }],
  }]);
  const [attempt, setAttempt] = useState<AttemptCard | null>(null);
  const [grade, setGrade] = useState<GradeCard | null>(null);
  const [resources, setResources] = useState<ResourceCard[]>([
    { id: 'r1', title: 'Vectors worksheet', kind: 'worksheet', status: 'pending', priceCents: 0, audiences: ['students'] },
    { id: 'r2', title: 'Lesson note template', kind: 'template', status: 'approved', priceCents: 500, audiences: ['students', 'marketplace'] },
  ]);
  const [storeNote, setStoreNote] = useState('');
  const [lessonNote, setLessonNote] = useState('');

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-[1400px] mx-auto px-4 pt-4 flex flex-wrap gap-2">
        {SCREENS.map((id) => (
          <button key={id} type="button" onClick={() => setScreen(id)} className={`h-8 px-3 rounded-full text-xs font-semibold ${screen === id ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
            {id}
          </button>
        ))}
      </div>
      {screen === 'community' && (
        <CommunityScreen
          ageTier="adult"
          explore
          dateOfBirth="1998-04-02"
          spaceTitle="Adult study room"
          spaces={[
            { id: '1', title: 'Adult study room', kind: 'adult', ageTier: 'adult' },
            { id: '2', title: 'A-Level maths', kind: 'subject', ageTier: 'adult' },
          ]}
          posts={[
            { id: 'p1', kind: 'win', body: 'Finished the vectors worksheet.', authorName: 'Ava', moderation: 'allow' },
            { id: 'p2', kind: 'question', body: 'Which paper should I sit first?', authorName: 'Noa', moderation: 'allow', bestAnswerId: 'c1' },
          ]}
        />
      )}
      {screen === 'channels' && (
        <ChannelsScreen
          activeTitle="Year 10 parents"
          quietNote="Quiet hours hold messages to minors between 21:00 and 07:00."
          channels={[
            { id: 'c1', title: 'Year 10 class', kind: 'class', ageTier: 'minor' },
            { id: 'c2', title: 'Year 10 parents', kind: 'parent', ageTier: 'adult' },
          ]}
          messages={[
            { id: 'm1', senderName: 'Tess', body: 'The trip is on Friday.', bodyTranslated: 'Lawatan pada hari Jumaat.' },
          ]}
          onSend={() => {}}
          onAnnounce={() => {}}
        />
      )}
      {screen === 'tutors' && (
        <TutorsScreen
          note={tutorNote}
          tutors={[{ id: 't1', name: 'Ada Lovelace', bio: 'Mechanics and algebra', subjects: ['Maths', 'Physics'], hourlyCents: 4000, slots: [{ startAtMs: OPEN_SLOT, minutes: 45 }] }]}
          bookings={bookings}
          pending={[{ id: 't2', name: 'Grace Hopper', bio: 'Computing', subjects: ['Computing'] }]}
          onBook={(tutorId, kind, startAtMs) => {
            setBookings((current) => [...current, { id: `b${current.length + 1}`, tutorId, kind, startAtMs, minutes: 45, status: 'booked' }]);
            setTutorNote(`Booked a ${kind === 'group' ? 'group' : '1:1'} session.`);
          }}
          onSaveProfile={(_bio, _subjects, _hourly, slots) => setTutorNote(slots.length ? `Profile saved with ${slots.length} open time${slots.length === 1 ? '' : 's'}.` : 'Profile saved.')}
          onReview={(bookingId, rating) => {
            setBookings((current) => current.map((booking) => booking.id === bookingId ? { ...booking, status: 'completed' } : booking));
            setTutorNote(`Review saved at ${rating} stars.`);
          }}
          onVerify={(tutorId, approve) => setTutorNote(approve ? `${tutorId} verified.` : `${tutorId} rejected.`)}
        />
      )}
      {screen === 'exams' && (
        <ExamScreen
          papers={papers}
          attempt={attempt}
          result={grade}
          suggestions={[
            { id: 'u', kind: 'university', title: 'Medicine MBBS', detail: 'Your predicted grades meet a typical A offer in biology and chemistry.' },
            { id: 'c', kind: 'career', title: 'Doctor', detail: 'People who study Medicine MBBS often work as a doctor.' },
          ]}
          onStart={(paperId) => {
            const paper = papers.find((item) => item.id === paperId);
            setGrade(null);
            setAttempt({
              paperId,
              attemptId: 'preview-attempt',
              endsAtMs: Date.now() + (paper?.minutes ?? 60) * 60_000,
              questions: paper?.questions ?? [],
            });
          }}
          onSubmit={() => setGrade({ score: 2, maxScore: 2, predictedGrade: 'A*' })}
          onGuide={() => {}}
          onUpload={(paper) => setPapers((current) => [...current, {
            id: `paper-${current.length + 1}`,
            title: paper.title || 'Teacher paper',
            board: paper.board,
            subject: paper.subject,
            minutes: paper.minutes,
            license: 'teacher_upload',
            questions: paper.questions.map((question, index) => ({ id: `q${index + 1}`, prompt: question.prompt, marks: question.marks })),
          }])}
        />
      )}
      {screen === 'store' && (
        <>
        <StoreScreen
          resources={resources}
          onCreate={(title, _body, kind, audiences) => {
            setResources((current) => [...current, { id: `r${current.length + 1}`, title: title || 'Untitled', kind, status: 'draft', priceCents: 0, audiences }]);
            setStoreNote(`Draft saved for ${audiences.join(', ') || 'everyone'}.`);
          }}
          onSubmit={(id) => setResources((current) => current.map((resource) => resource.id === id ? { ...resource, status: 'pending' } : resource))}
          onApprove={(id) => setResources((current) => current.map((resource) => resource.id === id ? { ...resource, status: 'approved' } : resource))}
          onAllocate={(id, studentId) => setStoreNote(`Allocated ${id} to ${studentId}.`)}
        />
        {storeNote && <p className="px-4 pb-6 text-sm text-muted-foreground">{storeNote}</p>}
        </>
      )}
      {screen === 'snap' && (
        <SnapScreen
          result={snap}
          blocked={blocked}
          onSolve={(text, context, image) => {
            if (context === 'assessment') {
              setSnap(null);
              setBlocked('Snap and solve is turned off during an assessment. This attempt is logged.');
              return;
            }
            setBlocked('');
            setSnap({
              answer: 'x = 3',
              steps: [
                image ? 'Read the question from the photo.' : `Start with ${text}.`,
                'Move the constant: 2x = 6.',
                'Divide by 2.',
                'Check by substituting 3.',
              ],
              similar: ['2x + 6 = 13', '3x + 4 = 15'],
            });
          }}
        />
      )}
      {screen === 'lesson' && (
        <>
          <div className="max-w-[1400px] mx-auto px-4 pt-4">
            <LessonQaScreen
              suggestion="Move the constant to the other side, then divide."
              questions={[{ id: 'q1', body: 'How do I isolate x?', aiSuggestedReply: 'Move the constant to the other side, then divide.', status: 'open' }]}
              onAsk={(body) => setLessonNote(`Asked: ${body}`)}
              onPublish={(id, reply) => setLessonNote(`Published ${id}: ${reply}`)}
            />
            {lessonNote && <p className="mt-3 text-sm text-muted-foreground">{lessonNote}</p>}
          </div>
        </>
      )}
      {screen === 'moderation' && (
        <ModerationScreen
          items={[{ id: 'q1', surface: 'post', text: 'add me on whatsapp', decision: 'hold', ageTier: 'minor' }]}
          onResolve={() => {}}
        />
      )}
    </div>
  );
}
