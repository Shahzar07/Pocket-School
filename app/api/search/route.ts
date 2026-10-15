import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { adminDb } from '@/lib/firebase-admin';
import { searchBooks } from '@/lib/platform/search';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
  if (q.length < 2) {
    return NextResponse.json({ courses: [], announcements: [], resources: [], books: [] });
  }
  try {
    const db = adminDb();
    const [courses, announcements, resources] = await Promise.all([
      db.collection('courses').where('status', '==', 'published').limit(40).get(),
      db.collection('announcements').orderBy('createdAt', 'desc').limit(30).get(),
      db.collection('resources').limit(30).get(),
    ]);
    const matchCourses = courses.docs
      .map((d) => ({ id: d.id, ...d.data() }) as { id: string; title?: string; description?: string; subject?: string })
      .filter((c) =>
        (c.title ?? '').toLowerCase().includes(q)
        || (c.description ?? '').toLowerCase().includes(q)
        || (c.subject ?? '').toLowerCase().includes(q))
      .slice(0, 5);
    const matchAnnouncements = announcements.docs
      .map((d) => ({ id: d.id, ...d.data() }) as { id: string; title?: string; content?: string; status?: string })
      .filter((a) => (a.status ?? 'published') === 'published')
      .filter((a) => (a.title ?? '').toLowerCase().includes(q) || (a.content ?? '').toLowerCase().includes(q))
      .slice(0, 3);
    const matchResources = resources.docs
      .map((d) => ({ id: d.id, ...d.data() }) as { id: string; title?: string; description?: string })
      .filter((r) => (r.title ?? '').toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q))
      .slice(0, 3);
    return NextResponse.json({
      courses: matchCourses,
      announcements: matchAnnouncements,
      resources: matchResources,
      books: searchBooks(q),
    });
  } catch {
    return NextResponse.json({ courses: [], announcements: [], resources: [], books: searchBooks(q) });
  }
}
