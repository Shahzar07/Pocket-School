'use client';

import { StudioToolGrid } from '@/components/studio/hub-tools';
import {
  DeskFrame,
  ParentExplainerPanel,
  ResearchHelperPanel,
  TeacherToolkitPanel,
} from '@/components/studio/desk-panels';

/** Sample of the three studio desk tools. Not a live account and not written to Firestore. */
export default function StudioDeskPreview() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-[1100px] space-y-10">
        <header>
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Preview · Poket School</p>
          <h1 className="mt-1 font-heading text-4xl tracking-[-0.04em]">ET AI Studio tools</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Colour-coded cards, then the three studio modes with sample results. This preview does not spend Sparks or save a course.
          </p>
        </header>
        <StudioToolGrid showAll />
        <section className="overflow-hidden rounded-3xl border border-border" data-testid="preview-teacher-toolkit">
          <DeskFrame
            kicker="15 Sparks · teachers and institution staff"
            title="Teacher Toolkit"
            blurb="Lesson plans, worksheets, rubrics, differentiated versions of the same task, and exit tickets. Save them as course drafts."
            testId="desk-teacher-toolkit"
          >
            <TeacherToolkitPanel sample />
          </DeskFrame>
        </section>
        <section className="overflow-hidden rounded-3xl border border-border" data-testid="preview-parent-explainer">
          <DeskFrame
            kicker="8 Sparks · parents, own children only"
            title="Parent Explainer"
            blurb="A plain-language note on what your child learned, their strengths, their gaps, and how to help at home."
            testId="desk-parent-explainer"
          >
            <ParentExplainerPanel sample />
          </DeskFrame>
        </section>
        <section className="overflow-hidden rounded-3xl border border-border" data-testid="preview-research-helper">
          <DeskFrame
            kicker="10 Sparks · students and teachers"
            title="Research Helper"
            blurb="Trustworthy sources, citations, and a note on credibility. ET AI never writes the assignment."
            testId="desk-research-helper"
          >
            <ResearchHelperPanel sample />
          </DeskFrame>
        </section>
      </div>
    </main>
  );
}
