export interface ReportLink {
  href: string;
  label: string;
}

export function reportLinks(role: string | undefined): ReportLink[] {
  if (role === 'teacher') {
    return [
      { href: '/dashboard/teacher/attendance', label: 'Attendance' },
      { href: '/dashboard/teacher/analytics', label: 'Analytics' },
      { href: '/dashboard/behaviour', label: 'Behaviour' },
    ];
  }
  if (role === 'parent') {
    return [
      { href: '/dashboard/parent/analytics', label: 'Analytics' },
      { href: '/dashboard/behaviour', label: 'Behaviour' },
    ];
  }
  if (role === 'admin' || role === 'institution_admin') {
    return [
      { href: '/dashboard/teacher/attendance', label: 'Attendance' },
      { href: '/dashboard/teacher/analytics', label: 'Analytics' },
      { href: '/dashboard/behaviour', label: 'Behaviour' },
      { href: '/dashboard/admin/moderation', label: 'Moderation' },
    ];
  }
  return [
    { href: '/dashboard/student/attendance', label: 'Attendance' },
    { href: '/dashboard/student/analytics', label: 'Analytics' },
    { href: '/dashboard/behaviour', label: 'Behaviour' },
  ];
}

/** ET AI drafts a note. A person still allows or rejects the item. */
export function moderationPrompt(text: string, surface: string): string {
  const item = text.trim().slice(0, 500) || 'Empty item';
  const where = surface.trim() || 'community';
  return `Draft a moderation note a person will confirm. Do not allow or reject the item yourself. Surface: ${where}. Item: ${item}. Sign the note as ET AI.`;
}
