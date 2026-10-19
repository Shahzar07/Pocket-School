import Image from 'next/image';
import { portraitAlt, teacherPortrait } from '@/lib/teacher-portrait';
import type { AiTeacher } from '@/lib/ai-teachers';

export function TeacherPortrait({
  teacher,
  size = 96,
  className = '',
  priority = false,
}: {
  teacher: Pick<AiTeacher, 'id' | 'category' | 'name'>;
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={teacherPortrait(teacher)}
      alt={portraitAlt(teacher.name)}
      width={size}
      height={size}
      priority={priority}
      className={className}
    />
  );
}
