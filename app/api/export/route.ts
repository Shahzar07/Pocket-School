import { NextResponse } from 'next/server';
import firebaseConfig from '@/firebase-applet-config.json';
import { canDownload, type DownloadViewer } from '@/lib/export/allow';
import { buildExport } from '@/lib/export/files';
import { formatsFor, type ExportAsset, type ExportFormat } from '@/lib/export/payload';

export const runtime = 'nodejs';

const ASSETS = new Set<ExportAsset>([
  'notes', 'glossary', 'flashcards', 'quiz', 'problems', 'slides', 'infographic', 'mindmap', 'image',
]);

async function callerUid(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization') ?? '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!idToken) return null;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!response.ok) return null;
  const body = await response.json() as { users?: Array<{ localId?: string }> };
  return body.users?.[0]?.localId ?? null;
}

async function viewerFromStore(caller: string, posted: DownloadViewer, courseId: string): Promise<DownloadViewer> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return { ...posted, courseId };
  try {
    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const existing = getApps()[0];
    const app = existing ?? initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as Record<string, string>),
    });
    const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    const userSnap = await db.collection('users').doc(caller).get();
    const courseSnap = courseId ? await db.collection('courses').doc(courseId).get() : null;
    const user = userSnap.data() ?? {};
    const course = courseSnap?.data() ?? {};
    const permissions = Array.isArray(user.permissions)
      ? user.permissions.filter((item): item is string => typeof item === 'string')
      : posted.permissions;
    return {
      role: typeof user.role === 'string' ? user.role : posted.role,
      tier: typeof user.accessTier === 'number' ? user.accessTier : posted.tier,
      permissions,
      courseId,
      downloadsEnabled: typeof course.downloadsEnabled === 'boolean' ? course.downloadsEnabled : posted.downloadsEnabled,
    };
  } catch {
    return { ...posted, courseId };
  }
}

export async function POST(request: Request) {
  const caller = await callerUid(request);
  if (!caller) return NextResponse.json({ error: 'Sign in to download this file.' }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    asset?: string;
    format?: string;
    title?: string;
    content?: unknown;
    answerKey?: boolean;
    courseId?: string;
    viewer?: DownloadViewer;
  } | null;

  const asset = body?.asset;
  const format = body?.format;
  if (!asset || !ASSETS.has(asset as ExportAsset) || !format || !formatsFor(asset as ExportAsset).includes(format as ExportFormat)) {
    return NextResponse.json({ error: 'That download is not available for this asset.' }, { status: 400 });
  }

  const courseId = typeof body?.courseId === 'string' ? body.courseId : '';
  const viewer = await viewerFromStore(caller, body?.viewer ?? {}, courseId);
  const decision = canDownload(viewer);
  if (!decision.allowed) return NextResponse.json({ error: decision.reason }, { status: 403 });

  try {
    const file = await buildExport({
      asset: asset as ExportAsset,
      format: format as ExportFormat,
      title: typeof body?.title === 'string' ? body.title.slice(0, 120) : 'Poket School',
      content: body?.content,
      answerKey: body?.answerKey !== false,
    });
    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
