'use client';

import Link from 'next/link';
import { AI_TEACHERS, TEACHER_CATEGORIES } from '@/lib/ai-teachers';
import { StudioCanvas } from '@/components/studio/studio-canvas';
import { TeacherPortrait } from '@/components/teachers/portrait';

export default function StudioTeachersPage() {
  return (
    <StudioCanvas
      canvas="teachers"
      title="AI Teachers"
      description="Each teacher is ET AI plus a subject, such as ET Maths. Type, send voice notes, talk live, or open a video session. Replies can be text or voice."
    >
      <div className="space-y-8">
        {TEACHER_CATEGORIES.map(category => {
          const teachers = AI_TEACHERS.filter(teacher => teacher.category === category);
          if (!teachers.length) return null;
          return (
            <section key={category}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-[var(--studio-dim)]">{category}</h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {teachers.map(teacher => (
                  <li key={teacher.id}>
                    <Link href={`/dashboard/studio/teachers/${teacher.id}`} className="flex h-full gap-3 rounded-2xl border border-[var(--studio-border-soft)] bg-[var(--studio-surface)] p-4 hover:border-[#3FE0D0]">
                      <TeacherPortrait teacher={teacher} size={72} className="h-[72px] w-[72px] shrink-0 rounded-2xl object-cover" />
                      <span>
                        <p className="font-heading text-xl text-[var(--studio-text)]">{teacher.name}</p>
                        <p className="mt-1 text-xs text-[var(--studio-dim)]">{teacher.title}</p>
                        <p className="mt-2 line-clamp-3 text-sm text-[var(--studio-text)]">{teacher.tagline}</p>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </StudioCanvas>
  );
}
