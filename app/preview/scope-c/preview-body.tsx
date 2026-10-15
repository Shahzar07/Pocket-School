'use client';

import { useState } from 'react';
import { CommunityScreen } from '@/components/scope-c/community-screen';
import { ChannelsScreen } from '@/components/scope-c/channels-screen';
import { ExamScreen, ModerationScreen, SnapScreen, StoreScreen, TutorsScreen } from '@/components/scope-c/market-screens';

const SCREENS = ['community', 'channels', 'tutors', 'exams', 'store', 'snap', 'moderation'] as const;
type ScreenId = (typeof SCREENS)[number];

export function PreviewBody({ initial }: { initial?: string }) {
  const [screen, setScreen] = useState<ScreenId>(SCREENS.includes(initial as ScreenId) ? initial as ScreenId : 'community');
  const [snap, setSnap] = useState<{ answer: string; steps: string[]; similar: string[] } | null>(null);
  const [blocked, setBlocked] = useState('');

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
          note="Group bookings open a live class. Payment stays pending until the wallet captures it."
          tutors={[{ id: 't1', name: 'Ada Lovelace', bio: 'Mechanics and algebra', subjects: ['Maths', 'Physics'], hourlyCents: 4000 }]}
          onBook={() => {}}
          onSaveProfile={() => {}}
        />
      )}
      {screen === 'exams' && (
        <ExamScreen
          papers={[{ id: 'paper', title: 'Cambridge Maths 2024 Paper 2', board: 'Cambridge', subject: 'Maths', minutes: 90, license: 'licensed' }]}
          suggestions={[
            { id: 'u', kind: 'university', title: 'Medicine MBBS', detail: 'Your predicted grades meet a typical A offer in biology and chemistry.' },
            { id: 'c', kind: 'career', title: 'Doctor', detail: 'People who study Medicine MBBS often work as a doctor.' },
          ]}
          onStart={() => {}}
          onGuide={() => {}}
        />
      )}
      {screen === 'store' && (
        <StoreScreen
          resources={[
            { id: 'r1', title: 'Vectors worksheet', kind: 'worksheet', status: 'pending', priceCents: 0 },
            { id: 'r2', title: 'Lesson note template', kind: 'template', status: 'approved', priceCents: 500 },
          ]}
          onCreate={() => {}}
          onSubmit={() => {}}
          onApprove={() => {}}
        />
      )}
      {screen === 'snap' && (
        <SnapScreen
          result={snap}
          blocked={blocked}
          onSolve={(text, context) => {
            if (context === 'assessment') {
              setSnap(null);
              setBlocked('Snap and solve is turned off during an assessment. This attempt is logged.');
              return;
            }
            setBlocked('');
            setSnap({
              answer: 'x = 3',
              steps: [`Start with ${text}.`, 'Move the constant: 2x = 6.', 'Divide by 2.', 'Check by substituting 3.'],
              similar: ['2x + 6 = 13', '3x + 4 = 15'],
            });
          }}
        />
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
