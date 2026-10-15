import { NextRequest, NextResponse } from 'next/server';
import { getAllPublishedCourses, getAnnouncements, getResources } from '@/lib/db';
import { filterCatalog } from '@/lib/learning';
import { searchBooks as searchShelf } from '@/lib/platform/search';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
  if (q.length < 2) {
    return NextResponse.json({ courses: [], announcements: [], resources: [], books: [] });
  }
  try {
    const [courses, announcements, resources] = await Promise.all([
      getAllPublishedCourses(),
      getAnnouncements('all'),
      getResources(),
    ]);

    const subject = req.nextUrl.searchParams.get('subject') ?? '';
    const level = req.nextUrl.searchParams.get('level') ?? '';
    const maxPrice = req.nextUrl.searchParams.get('maxPrice');
    const matchCourses = filterCatalog(courses, {
      q,
      subject,
      level,
      maxPrice: maxPrice ? Number(maxPrice) : null,
    }).slice(0, 5);

    const matchAnnouncements = announcements.filter(a =>
      a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)
    ).slice(0, 3);

    const matchResources = resources.filter(r =>
      r.title.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q)
    ).slice(0, 3);

    return NextResponse.json({
      courses: matchCourses,
      announcements: matchAnnouncements,
      resources: matchResources,
      books: searchShelf(q),
    });
  } catch {
    return NextResponse.json({ courses: [], announcements: [], resources: [], books: [] });
  }
}
