'use client';

import { NAMED_LEVELS, isNamedLevel } from '@/lib/example-courses';
import { useCoursePlaceholders } from '@/hooks/use-example-course';

export function LevelSelect({
  value,
  onChange,
  id,
  ariaLabel = 'Level',
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const { level: placeholder } = useCoursePlaceholders();
  const known = !value || isNamedLevel(value);

  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={event => onChange(event.target.value)}
      className={`${className} ${value ? 'text-foreground' : 'text-muted-foreground'}`}
    >
      <option value="">{placeholder}</option>
      {NAMED_LEVELS.map(level => (
        <option key={level} value={level} className="text-foreground">{level}</option>
      ))}
      {!known ? <option value={value}>{value}</option> : null}
    </select>
  );
}
