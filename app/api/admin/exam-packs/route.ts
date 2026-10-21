import { errorResponse } from '@/lib/server-auth';
import { readPackStore } from '@/lib/study/pack-admin';
import {
  adminCatalog,
  deleteRemotePack,
  importRemotePacks,
  isPackAuthError,
  PackHttpError,
  requirePlatformAdmin,
  saveRemotePack,
} from '@/lib/study/pack-server';

function failed(err: unknown) {
  if (err instanceof PackHttpError || isPackAuthError(err)) {
    const status = err instanceof PackHttpError ? err.status : 401;
    return Response.json({ error: err.message }, { status });
  }
  return errorResponse(err, 'Could not update exam packs.');
}

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin(req);
    return Response.json({ packs: await adminCatalog() });
  } catch (err) {
    return failed(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePlatformAdmin(req);
    const body = await req.json() as { action?: string; pack?: unknown; store?: unknown };
    if (body.action === 'import') {
      const store = readPackStore(JSON.stringify(body.store ?? {}));
      return Response.json({ packs: await importRemotePacks(store, user.uid) });
    }
    return Response.json({ packs: await saveRemotePack(body.pack, user.uid) });
  } catch (err) {
    return failed(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requirePlatformAdmin(req);
    const body = await req.json() as { id?: unknown };
    const packs = await deleteRemotePack(typeof body.id === 'string' ? body.id : '', user.uid);
    return Response.json({ packs });
  } catch (err) {
    return failed(err);
  }
}
