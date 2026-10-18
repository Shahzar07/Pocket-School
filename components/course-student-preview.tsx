'use client';

import type { StudioSection } from '@/lib/course-builder';

const KIND_LABEL = {
  lecture: 'Lecture',
  quiz: 'Quiz',
  assignment: 'Assignment',
  resource: 'Resource',
} as const;

/**
 * Read-only student view. It does not change the signed-in account.
 */
export function CourseStudentPreview({
  title,
  subtitle,
  description,
  category,
  level,
  language,
  thumbnailUrl,
  previewUrl,
  priceLabel,
  sections,
}: {
  title: string;
  subtitle?: string;
  description: string;
  category?: string;
  level?: string;
  language?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  priceLabel: string;
  sections: StudioSection[];
}) {
  return (
    <div className="space-y-6" data-student-preview>
      <div className="rounded-2xl border border-[var(--ps-cyan-border)]/30 bg-[var(--ps-cyan-soft)] px-4 py-3 text-sm text-foreground">
        Preview as a student. Your sign-in stays the teacher account.
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="h-52 w-full object-cover" />
        ) : (
          <div className="h-36 bg-gradient-to-br from-success/20 to-teal-500/10" />
        )}
        <div className="space-y-3 p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-success">
            {[category, level, language].filter(Boolean).join(' · ') || 'Course'}
          </p>
          <h2 className="font-heading text-3xl text-foreground">{title || 'Untitled course'}</h2>
          {subtitle && <p className="text-lg text-muted-foreground">{subtitle}</p>}
          <p className="text-sm leading-relaxed text-foreground">{description || 'No description yet.'}</p>
          <p className="text-sm font-semibold text-foreground">{priceLabel}</p>
          {previewUrl && (
            <p className="text-sm">
              <a href={previewUrl} className="font-semibold text-primary underline" target="_blank" rel="noreferrer">
                Promo video
              </a>
            </p>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <h3 className="font-heading text-2xl text-foreground">Curriculum</h3>
        {sections.length === 0 && <p className="text-sm text-muted-foreground">No sections yet.</p>}
        {sections.map((section, index) => (
          <section key={section.id} className="rounded-2xl border border-border bg-card p-4">
            <h4 className="font-semibold text-foreground">Section {index + 1}. {section.title}</h4>
            <ol className="mt-2 space-y-1">
              {section.lectures.map(lecture => (
                <li key={lecture.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{lecture.title}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{KIND_LABEL[lecture.kind]}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
