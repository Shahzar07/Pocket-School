/** Canonical home for the AI Studio section inside the dashboard. */
export const STUDIO_HUB = '/dashboard/studio';
export const STUDIO_ET = '/dashboard/studio/et';
export const STUDIO_MATHS = '/dashboard/studio/maths';
export const STUDIO_EXAM_PREP = '/dashboard/studio/exam-prep';
export const STUDIO_TIMETABLE = '/dashboard/studio/timetable';

/**
 * Old addresses keep working. Next applies these before the app routes,
 * and query strings travel with the request.
 */
/** Public names that do not match the dashboard folder. */
const AI_STUDIO_RENAMES: Record<string, string> = {
  timetabler: 'timetable',
};

/** `/ai-studio/timetabler` lands on the real timetable route. Other segments are kept. */
export function aiStudioDestination(path: string): string {
  if (path === '/ai-studio') return STUDIO_HUB;
  const prefix = '/ai-studio/';
  if (!path.startsWith(prefix)) return path;
  const rest = path.slice(prefix.length);
  const slash = rest.indexOf('/');
  const head = slash === -1 ? rest : rest.slice(0, slash);
  const tail = slash === -1 ? '' : rest.slice(slash);
  return `${STUDIO_HUB}/${AI_STUDIO_RENAMES[head] ?? head}${tail}`;
}

export const studioRedirects = [
  { source: '/ai-studio', destination: STUDIO_HUB, permanent: false },
  { source: '/ai-studio/timetabler', destination: STUDIO_TIMETABLE, permanent: false },
  { source: '/ai-studio/timetabler/:path*', destination: `${STUDIO_TIMETABLE}/:path*`, permanent: false },
  { source: '/ai-studio/:path*', destination: `${STUDIO_HUB}/:path*`, permanent: false },
  { source: '/dashboard/student/maths', destination: STUDIO_MATHS, permanent: false },
  { source: '/dashboard/student/maths/:path*', destination: `${STUDIO_MATHS}/:path*`, permanent: false },
  { source: '/dashboard/student/exam-prep', destination: STUDIO_EXAM_PREP, permanent: false },
  { source: '/dashboard/student/exam-prep/:path*', destination: `${STUDIO_EXAM_PREP}/:path*`, permanent: false },
  { source: '/creator-store', destination: '/dashboard/store', permanent: false },
  { source: '/et-maths', destination: STUDIO_MATHS, permanent: false },
  { source: '/et-maths/:path*', destination: `${STUDIO_MATHS}/:path*`, permanent: false },
] as const;

/** Same mapping as studioRedirects, including nested paths and query strings. */
export function relocateStudioPath(url: string): string {
  const queryAt = url.indexOf('?');
  const path = queryAt === -1 ? url : url.slice(0, queryAt);
  const search = queryAt === -1 ? '' : url.slice(queryAt);
  if (path === '/ai-studio' || path.startsWith('/ai-studio/')) return aiStudioDestination(path) + search;
  const rules: [string, string][] = [
    ['/dashboard/student/maths', STUDIO_MATHS],
    ['/dashboard/student/exam-prep', STUDIO_EXAM_PREP],
    ['/creator-store', '/dashboard/store'],
    ['/et-maths', STUDIO_MATHS],
  ];
  for (const [from, to] of rules) {
    if (path === from || path.startsWith(`${from}/`)) {
      return to + path.slice(from.length) + search;
    }
  }
  return url;
}
