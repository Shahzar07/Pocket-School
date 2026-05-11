import { NextRequest, NextResponse } from 'next/server';
import { getAllPublishedCourses, getAnnouncements, getResources } from '@/lib/db';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
  if (q.length < 2) {
    return NextResponse.json({ courses: [], announcements: [], resources: [] });
  }
  try {
    const [courses, announcements, resources] = await Promise.all([
      getAllPublishedCourses(),
      getAnnouncements('all'),
      getResources(),
    ]);

    const matchCourses = courses.filter(c =>
      c.title.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q) || (c.subject ?? '').toLowerCase().includes(q)
    ).slice(0, 5);

    const matchAnnouncements = announcements.filter(a =>
      a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)
    ).slice(0, 3);

    const matchResources = resources.filter(r =>
      r.title.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q)
    ).slice(0, 3);

    return NextResponse.json({ courses: matchCourses, announcements: matchAnnouncements, resources: matchResources });
  } catch {
    return NextResponse.json({ courses: [], announcements: [], resources: [] });
  }
}
