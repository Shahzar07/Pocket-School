'use client';

import { useEffect, useState } from 'react';

const CHIP = ['#1E6A83', '#E36A4F', '#3C8DFF', '#E9F7FA', '#7DCEA0'];
const INK = ['#203337', '#203337', '#E9F7FA', '#203337', '#203337'];

export function SchoolMarquee({ names }: { names: readonly string[] }) {
  if (names.length === 0) return null;
  const loop = [...names, ...names];
  return (
    <section aria-label="Students from these schools learn with Poket School" className="overflow-hidden bg-[#203337] text-[#E9F7FA]">
      <p className="px-4 pt-5 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-[#1E6A83]">
        Students from these schools learn with Poket School
      </p>
      <div className="relative mt-3 pb-5">
        <div className="school-marquee flex w-max gap-3 px-4 motion-reduce:flex-wrap motion-reduce:w-auto motion-reduce:justify-center">
          {loop.map((name, index) => {
            const colour = index % CHIP.length;
            return (
              <span
                key={`${name}-${index}`}
                className="inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold"
                style={{ background: CHIP[colour], color: INK[colour] }}
              >
                {name}
              </span>
            );
          })}
        </div>
      </div>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .school-marquee { animation: school-marquee 36s linear infinite; }
        }
        @keyframes school-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

export function SchoolStrip() {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    let cancel = false;
    fetch('/api/schools/marquee')
      .then((response) => response.json())
      .then((data: { names?: unknown }) => {
        if (cancel || !Array.isArray(data.names)) return;
        setNames(data.names.filter((name): name is string => typeof name === 'string' && name.trim().length > 0));
      })
      .catch(() => undefined);
    return () => { cancel = true; };
  }, []);
  return <SchoolMarquee names={names} />;
}
