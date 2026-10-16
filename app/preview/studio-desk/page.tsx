'use client';

import { StudioToolGrid } from '@/components/studio/hub-tools';
import { ParentExplainerView, ResearchPackView, TeacherPackView } from '@/components/studio/desk-panels';
import { parentExplainerFromFacts, teacherFallback, type ResearchPack } from '@/lib/studio/desk';

const pack = teacherFallback({
  topic: 'Photosynthesis',
  subject: 'Science',
  level: 'IGCSE',
  kind: 'pack',
});

const note = parentExplainerFromFacts({
  childName: 'Mina',
  studyMinutes: 40,
  quizAverage: 72,
  mastery: 61,
  lessonsCompleted: 3,
  goalsMet: 2,
  goalsMissed: 1,
  strengths: ['fractions'],
  gaps: ['decimals'],
  courses: [{ label: 'Mathematics', progress: 48 }],
  goalTitles: ['Finish the fractions goal'],
  misconceptions: ['place value'],
});

const research: ResearchPack = {
  question: 'How do plants store energy from light?',
  integrity: 'ET AI finds and summarises trustworthy sources, with citations and a note on how credible each one is. It never writes the assignment, the essay, or the answers. You write the work.',
  refusedWriting: false,
  nextSteps: [
    'Read one source and note the claim you might use.',
    'Check the credibility note before you quote it.',
    'Write the assignment yourself.',
  ],
  sources: [
    {
      title: 'NASA Climate',
      authors: 'NASA',
      url: 'https://climate.nasa.gov',
      summary: 'A public page on how plants use light. It describes the process. It is not a finished answer.',
      credibility: 'A government science office. Check the date on the page before you cite it.',
      citations: {
        apa: 'NASA. NASA Climate. https://climate.nasa.gov',
        harvard: 'NASA, NASA Climate. Available at: https://climate.nasa.gov',
        mla: 'NASA. "NASA Climate." https://climate.nasa.gov',
      },
    },
  ],
};

/** Sample of the three studio desk tools. Not a live account and not written to Firestore. */
export default function StudioDeskPreview() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-[1100px] space-y-8">
        <header>
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Preview · Poket School</p>
          <h1 className="mt-1 font-heading text-4xl tracking-[-0.04em]">ET AI Studio tools</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Colour-coded cards, then a sample teacher pack, parent note, and source list. This preview does not spend Sparks.
          </p>
        </header>
        <StudioToolGrid showAll />
        <TeacherPackView pack={pack} />
        <ParentExplainerView note={note} />
        <ResearchPackView pack={research} />
      </div>
    </main>
  );
}
