'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authed-fetch';

export interface SchoolChoice {
  id: string;
  name: string;
  onPoket: boolean;
}

const SAMPLE_SCHOOLS: SchoolChoice[] = [
  { id: 'sample-on', name: 'Sample Academy', onPoket: true },
  { id: 'sample-off', name: 'Sample Off Platform School', onPoket: false },
];

export function SchoolField({
  which,
  value,
  onChange,
  sample = false,
}: {
  which: 'victim' | 'bully';
  value: SchoolChoice;
  onChange: (next: SchoolChoice) => void;
  sample?: boolean;
}) {
  const [options, setOptions] = useState<SchoolChoice[]>([]);
  const query = value.name.trim();
  const sampleOptions = sample && query.length >= 2
    ? SAMPLE_SCHOOLS.filter(school => school.name.toLowerCase().includes(query.toLowerCase()))
    : [];
  const shown = sample ? sampleOptions : options;

  useEffect(() => {
    if (sample) return;
    if (query.length < 2) {
      setOptions([]);
      return;
    }
    const handle = setTimeout(() => {
      void authedFetch(`/api/bullying/schools?q=${encodeURIComponent(query)}`)
        .then(async (res) => res.json().catch(() => ({})))
        .then((data: { schools?: SchoolChoice[] }) => {
          setOptions(Array.isArray(data.schools) ? data.schools : []);
        })
        .catch(() => setOptions([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, sample]);

  return (
    <div className="grid gap-1">
      <label className="grid gap-1 text-sm font-semibold">
        {which === 'victim' ? <span>Your school</span> : <span>Bully's school</span>}
        <input
          className="min-h-12 rounded-xl border border-border px-3 font-normal"
          value={value.name}
          aria-label={which === 'victim' ? 'Your school' : "Bully's school"}
          placeholder="School name"
          onChange={event => onChange({ id: '', name: event.target.value, onPoket: false })}
        />
      </label>
      {shown.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {shown.map(school => (
            <button
              key={school.id}
              type="button"
              className="min-h-10 rounded-xl border border-border px-3 text-left text-sm"
              onClick={() => onChange(school)}
            >
              {school.name}
              {school.onPoket ? <span className="ml-2 text-xs font-semibold">On Poket School</span> : <span className="ml-2 text-xs font-semibold">Not on Poket School</span>}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
