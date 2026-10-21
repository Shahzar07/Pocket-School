'use client';

import { LevelMenu } from '@/components/level-menu';
import { useCoursePlaceholders } from '@/hooks/use-example-course';
import { isKnownLevel } from '@/lib/levels';

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
  const extra = value && !isKnownLevel(value) ? [value] : [];

  return (
    <div id={id} className={className}>
      <LevelMenu
        ariaLabel={ariaLabel}
        value={value}
        valueKind="label"
        allowEmpty
        emptyLabel={placeholder}
        extra={extra}
        onChange={onChange}
      />
    </div>
  );
}
