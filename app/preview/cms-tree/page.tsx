'use client';

import { useState } from 'react';

const UNITS = [
  { title: 'Algebra', lessons: ['Linear equations', 'Quadratics'] },
  { title: 'Geometry', lessons: ['Circle theorems'] },
];

export default function CmsTreePreview() {
  const [open, setOpen] = useState(true);
  const [lesson, setLesson] = useState('Linear equations');
  return (
    <main className="min-h-screen bg-background">
      <p className="px-4 pt-4 text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Rochford demo · CMS lesson tree</p>
      <div className="mt-3 flex items-center justify-between border-b px-3 py-2 lg:hidden">
        <button type="button" className="h-10 rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83]" onClick={() => setOpen(true)}>Course structure</button>
        <p className="text-sm font-semibold">{lesson}</p>
      </div>
      {open ? <button type="button" className="fixed inset-0 z-30 bg-black/40 lg:hidden" aria-label="Close course structure" onClick={() => setOpen(false)} /> : null}
      <aside className={`${open ? 'fixed inset-y-0 left-0 z-40 flex w-72' : 'hidden'} flex-col border-r bg-white p-3`}>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#1E6A83]">Course structure</p>
        <ul className="mt-3 space-y-3">
          {UNITS.map((unit) => (
            <li key={unit.title}>
              <p className="font-semibold">{unit.title}</p>
              <ul className="mt-1 space-y-1">
                {unit.lessons.map((item) => (
                  <li key={item}>
                    <button type="button" className="text-sm text-[#1E6A83]" onClick={() => { setLesson(item); setOpen(false); }}>{item}</button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </aside>
      <section className="p-4 lg:pl-80">
        <h1 className="font-heading text-3xl">{lesson}</h1>
        <p className="mt-2 text-sm text-[#1E6A83]">On a phone the lesson tree opens as a drawer. Choosing a lesson closes it.</p>
      </section>
    </main>
  );
}
