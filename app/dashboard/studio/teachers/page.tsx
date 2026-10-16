'use client';

import Link from 'next/link';
import { AI_TEACHERS, TEACHER_CATEGORIES } from '@/lib/ai-teachers';
import { DashHeader, DashPage } from '@/components/dash-ui';

export default function StudioTeachersPage() {
  return (
    <DashPage>
      <DashHeader
        eyebrow="AI Studio"
        title="AI Teachers,"
        accent="one conversation."
        description="Each teacher is ET AI plus a subject, such as ET Maths. Type, send voice notes, talk live, or open a video session. Replies can be text or voice."
      />
      <div className="space-y-8">
        {TEACHER_CATEGORIES.map(category => {
          const teachers = AI_TEACHERS.filter(teacher => teacher.category === category);
          if (!teachers.length) return null;
          return (
            <section key={category}>
              <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground mb-3">{category}</h2>
              <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {teachers.map(teacher => (
                  <li key={teacher.id}>
                    <Link href={`/dashboard/studio/teachers/${teacher.id}`} className="block h-full rounded-2xl border border-border bg-card p-4 hover:border-primary">
                      <p className="font-heading text-xl">{teacher.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{teacher.title}</p>
                      <p className="text-sm mt-2 line-clamp-3">{teacher.tagline}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </DashPage>
  );
}
