import { can, resolveStaffRole, type StaffRole } from '../admin-console';
import { loadUser, type AuthedUser } from '../api-guard';
import type { DocumentData } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { ActionError } from '../server/actions';
import { saveObject, signedRead } from '../server/files';
import { hasStoreEntitlement, downloadDecision } from './access';
import { isImage, isPdf, isPng } from './bytes';
import { SETUP_NEEDED_MESSAGE } from './copy';
import {
  parseManifest,
  parseMoney,
  reportRows,
  uploadProblems,
  type FileEntry,
  type ManifestRow,
  type RowReport,
} from './manifest';
import { productObjectPaths } from './paths';
import { canSignDownloads, canWriteStorage } from './setup';
import { webpPreview, webpThumb } from './thumb';

export interface StoreProduct {
  id: string;
  sku: string;
  title: string;
  subject: string;
  level: string;
  examBoard: string;
  specCode: string;
  type: string;
  priceUsd: number;
  priceMyr: number;
  access: 'paid' | 'free';
  description: string;
  tags: string[];
  paperPath: string;
  markschemePath: string;
  thumbnailPath: string;
  previewPaths: string[];
  status: 'draft' | 'published';
}

async function staffOf(user: AuthedUser): Promise<StaffRole | null> {
  const profile = await loadUser(user.uid);
  return resolveStaffRole({
    email: user.email ?? text(profile?.email),
    role: user.role ?? text(profile?.role),
    adminRole: user.adminRole ?? text(profile?.adminRole),
  });
}

async function requireContent(user: AuthedUser): Promise<StaffRole> {
  const staff = await staffOf(user);
  if (!can(staff, 'content')) {
    throw new ActionError('FORBIDDEN', 'Only an admin or content editor can change store files.');
  }
  return staff as StaffRole;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asFiles(value: unknown): FileEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const record = item as { path?: unknown; bytes?: unknown };
    if (typeof record.path !== 'string' || typeof record.bytes !== 'number' || record.bytes < 0) return [];
    return [{ path: record.path, bytes: record.bytes }];
  });
}

async function existingSkuSet(skus: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  const unique = [...new Set(skus.filter(Boolean))];
  for (let index = 0; index < unique.length; index += 30) {
    const chunk = unique.slice(index, index + 30);
    if (chunk.length === 0) continue;
    const snap = await adminDb().collection('store_products').where('sku', 'in', chunk).get();
    snap.docs.forEach(doc => {
      const sku = text(doc.data().sku);
      if (sku) found.add(sku);
    });
  }
  return found;
}

export async function dryRunManifest(user: AuthedUser, csv: string, files: unknown): Promise<{ ok: boolean; reports: RowReport[] }> {
  await requireContent(user);
  const parsed = parseManifest(csv);
  if (parsed.headerError) throw new ActionError('BAD_REQUEST', parsed.headerError);
  const existing = await existingSkuSet(parsed.rows.map(row => row.sku));
  const reports = reportRows(parsed.rows, asFiles(files), existing);
  return { ok: reports.every(report => report.ok), reports };
}

export async function startImportJob(user: AuthedUser): Promise<{ jobId: string }> {
  await requireContent(user);
  const ref = adminDb().collection('store_import_jobs').doc();
  await ref.set({ ownerId: user.uid, createdAt: Date.now() });
  return { jobId: ref.id };
}

export async function readImportJob(user: AuthedUser, jobId: string): Promise<{ jobId: string; rows: { sku: string; status: string; productId: string; errors: string[] }[] }> {
  await requireContent(user);
  if (!jobId) throw new ActionError('BAD_REQUEST', 'Missing import job.');
  const job = await adminDb().doc(`store_import_jobs/${jobId}`).get();
  if (!job.exists) throw new ActionError('NOT_FOUND', 'Import job not found.');
  if (text(job.data()?.ownerId) !== user.uid) throw new ActionError('FORBIDDEN', 'That import belongs to someone else.');
  const rows = await job.ref.collection('rows').get();
  return {
    jobId,
    rows: rows.docs.map(doc => ({
      sku: doc.id,
      status: text(doc.data().status),
      productId: text(doc.data().productId),
      errors: Array.isArray(doc.data().errors) ? doc.data().errors.filter((item: unknown): item is string => typeof item === 'string') : [],
    })),
  };
}

async function filePart(value: FormDataEntryValue | null): Promise<{ name: string; bytes: Uint8Array } | null> {
  if (!value || typeof value === 'string') return null;
  const bytes = new Uint8Array(await value.arrayBuffer());
  if (bytes.length === 0) return null;
  const name = 'name' in value && typeof value.name === 'string' ? value.name : 'file';
  return { name, bytes };
}

function rowFromForm(form: FormData, parts: {
  paper: { name: string; bytes: Uint8Array } | null;
  markscheme: { name: string; bytes: Uint8Array } | null;
  thumbnail: { name: string; bytes: Uint8Array } | null;
  previews: { name: string; bytes: Uint8Array }[];
}): ManifestRow {
  const accessRaw = text(form.get('access')).toLowerCase();
  return {
    line: Number(form.get('line')) || 2,
    sku: text(form.get('sku')),
    title: text(form.get('title')),
    subject: text(form.get('subject')),
    level: text(form.get('level')),
    examBoard: text(form.get('exam_board')),
    specCode: text(form.get('spec_code')),
    type: text(form.get('type')),
    priceUsd: parseMoney(text(form.get('price_usd'))),
    priceMyr: parseMoney(text(form.get('price_myr'))),
    access: accessRaw === 'paid' || accessRaw === 'free' ? accessRaw : '',
    description: text(form.get('description')),
    tags: text(form.get('tags')).split('|').map(item => item.trim()).filter(Boolean),
    paperPdf: text(form.get('paper_pdf')) || parts.paper?.name || '',
    markschemePdf: text(form.get('markscheme_pdf')) || parts.markscheme?.name || '',
    thumbnail: text(form.get('thumbnail')) || parts.thumbnail?.name || '',
    previewImages: text(form.get('preview_images')).split('|').map(item => item.trim()).filter(Boolean),
    status: text(form.get('status')).toLowerCase(),
  };
}

function productFromDoc(id: string, data: DocumentData): StoreProduct | null {
  const access = data.access === 'paid' || data.access === 'free' ? data.access : null;
  const status = data.status === 'published' || data.status === 'draft' ? data.status : null;
  if (!access || !status || typeof data.sku !== 'string') return null;
  return {
    id,
    sku: data.sku,
    title: text(data.title),
    subject: text(data.subject),
    level: text(data.level),
    examBoard: text(data.examBoard),
    specCode: text(data.specCode),
    type: text(data.type),
    priceUsd: typeof data.priceUsd === 'number' ? data.priceUsd : 0,
    priceMyr: typeof data.priceMyr === 'number' ? data.priceMyr : 0,
    access,
    description: text(data.description),
    tags: Array.isArray(data.tags) ? data.tags.filter((item: unknown): item is string => typeof item === 'string') : [],
    paperPath: text(data.paperPath),
    markschemePath: text(data.markschemePath),
    thumbnailPath: text(data.thumbnailPath),
    previewPaths: Array.isArray(data.previewPaths) ? data.previewPaths.filter((item: unknown): item is string => typeof item === 'string') : [],
    status,
  };
}

async function findBySku(sku: string): Promise<{ id: string; createdAt: number } | null> {
  const snap = await adminDb().collection('store_products').where('sku', '==', sku).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return null;
  const createdAt = doc.data().createdAt;
  return { id: doc.id, createdAt: typeof createdAt === 'number' ? createdAt : Date.now() };
}

async function writeDraft(row: ManifestRow, parts: {
  paper: { name: string; bytes: Uint8Array };
  markscheme: { name: string; bytes: Uint8Array } | null;
  thumbnail: { name: string; bytes: Uint8Array };
  previews: { name: string; bytes: Uint8Array }[];
}): Promise<string> {
  if (!canWriteStorage()) throw new ActionError('SETUP_NEEDED', SETUP_NEEDED_MESSAGE);
  const existing = await findBySku(row.sku);
  const ref = existing
    ? adminDb().collection('store_products').doc(existing.id)
    : adminDb().collection('store_products').doc();
  const paths = productObjectPaths(ref.id, parts.previews.length);
  const thumb = await webpThumb(parts.thumbnail.bytes);
  if (thumb.length > 5 * 1024 * 1024) throw new ActionError('BAD_REQUEST', 'thumbnail: oversized file');
  const previews: Uint8Array[] = [];
  for (const preview of parts.previews) {
    if (!isImage(preview.bytes)) throw new ActionError('BAD_REQUEST', 'preview must be an image');
    const webp = await webpPreview(preview.bytes);
    if (webp.length > 5 * 1024 * 1024) throw new ActionError('BAD_REQUEST', 'preview: oversized file');
    previews.push(webp);
  }
  if (!isPdf(parts.paper.bytes) || !isPng(parts.thumbnail.bytes)) {
    throw new ActionError('BAD_REQUEST', 'paper must be a PDF and the thumbnail must be a PNG');
  }
  try {
    await saveObject(paths.paper, parts.paper.bytes, 'application/pdf');
    if (parts.markscheme) await saveObject(paths.markscheme, parts.markscheme.bytes, 'application/pdf');
    await saveObject(paths.thumb, thumb, 'image/webp');
    for (let index = 0; index < previews.length; index += 1) {
      const path = paths.previews[index];
      const bytes = previews[index];
      if (!path || !bytes) continue;
      await saveObject(path, bytes, 'image/webp');
    }
  } catch (error) {
    if (error instanceof ActionError) throw error;
    console.error('store file save failed', error);
    throw new ActionError('SETUP_NEEDED', SETUP_NEEDED_MESSAGE);
  }
  const now = Date.now();
  await ref.set({
    sku: row.sku,
    title: row.title,
    subject: row.subject,
    level: row.level,
    examBoard: row.examBoard,
    specCode: row.specCode,
    type: row.type,
    priceUsd: row.priceUsd ?? 0,
    priceMyr: row.priceMyr ?? 0,
    access: row.access,
    description: row.description,
    tags: row.tags,
    paperPath: paths.paper,
    markschemePath: parts.markscheme ? paths.markscheme : '',
    thumbnailPath: paths.thumb,
    previewPaths: paths.previews,
    status: 'draft',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  return ref.id;
}

export async function saveProductForm(user: AuthedUser, form: FormData, jobId = ''): Promise<{ sku: string; status: 'draft' | 'done'; productId: string; errors: string[]; resumed: boolean }> {
  await requireContent(user);
  const parts = {
    paper: await filePart(form.get('paper')),
    markscheme: await filePart(form.get('markscheme')),
    thumbnail: await filePart(form.get('thumbnail')),
    previews: (await Promise.all(form.getAll('preview').map(item => filePart(item)))).filter((item): item is { name: string; bytes: Uint8Array } => item !== null),
  };
  const row = rowFromForm(form, parts);
  if (jobId) {
    const job = await adminDb().doc(`store_import_jobs/${jobId}`).get();
    if (!job.exists) throw new ActionError('NOT_FOUND', 'Import job not found.');
    if (text(job.data()?.ownerId) !== user.uid) throw new ActionError('FORBIDDEN', 'That import belongs to someone else.');
    const previous = await job.ref.collection('rows').doc(row.sku).get();
    if (previous.exists && previous.data()?.status === 'done') {
      return {
        sku: row.sku,
        status: 'done',
        productId: text(previous.data()?.productId),
        errors: [],
        resumed: true,
      };
    }
  }
  const files: FileEntry[] = [];
  if (parts.paper) files.push({ path: row.paperPdf, bytes: parts.paper.bytes.length });
  if (parts.markscheme) files.push({ path: row.markschemePdf, bytes: parts.markscheme.bytes.length });
  if (parts.thumbnail) files.push({ path: row.thumbnail, bytes: parts.thumbnail.bytes.length });
  row.previewImages.forEach((path, index) => {
    const preview = parts.previews[index];
    if (preview) files.push({ path, bytes: preview.bytes.length });
  });
  const [report] = reportRows([row], files, await existingSkuSet([row.sku]));
  const byteErrors = report ? uploadProblems(row, {
    paper: parts.paper?.bytes ?? null,
    markscheme: parts.markscheme?.bytes ?? null,
    thumbnail: parts.thumbnail?.bytes ?? null,
    previews: parts.previews.map(item => item.bytes),
  }) : ['row is missing'];
  const errors = [...new Set([...(report?.errors ?? []), ...byteErrors])];
  if (errors.length > 0) {
    if (jobId) {
      await adminDb().doc(`store_import_jobs/${jobId}/rows/${row.sku || 'invalid'}`).set({
        status: 'error',
        errors,
        productId: '',
        updatedAt: Date.now(),
      });
    }
    return { sku: row.sku, status: 'draft', productId: '', errors, resumed: false };
  }
  if (!parts.paper || !parts.thumbnail) {
    return { sku: row.sku, status: 'draft', productId: '', errors: ['missing file'], resumed: false };
  }
  const productId = await writeDraft(row, {
    paper: parts.paper,
    markscheme: parts.markscheme,
    thumbnail: parts.thumbnail,
    previews: parts.previews,
  });
  if (jobId) {
    await adminDb().doc(`store_import_jobs/${jobId}/rows/${row.sku}`).set({
      status: 'done',
      errors: [],
      productId,
      updatedAt: Date.now(),
    });
  }
  return { sku: row.sku, status: 'draft', productId, errors: [], resumed: false };
}

export async function listStoreProducts(user: AuthedUser): Promise<{ products: StoreProduct[] }> {
  await requireContent(user);
  const snap = await adminDb().collection('store_products').orderBy('updatedAt', 'desc').limit(50).get();
  return {
    products: snap.docs.flatMap(doc => {
      const product = productFromDoc(doc.id, doc.data());
      return product ? [product] : [];
    }),
  };
}

export async function publishStoreProduct(user: AuthedUser, sku: string): Promise<{ sku: string; status: 'published' }> {
  const staff = await requireContent(user);
  if (staff !== 'admin' && staff !== 'super_admin') {
    throw new ActionError('FORBIDDEN', 'Only an admin can publish a store product.');
  }
  const existing = await findBySku(sku);
  if (!existing) throw new ActionError('NOT_FOUND', 'Product not found.');
  await adminDb().doc(`store_products/${existing.id}`).set({
    status: 'published',
    publishedAt: Date.now(),
    updatedAt: Date.now(),
  }, { merge: true });
  return { sku, status: 'published' };
}

export async function signProductDownload(user: AuthedUser, sku: string, file: 'paper' | 'markscheme'): Promise<{ ok: true; url: string; expiresAt: number }> {
  const productSnap = await adminDb().collection('store_products').where('sku', '==', sku).limit(1).get();
  const doc = productSnap.docs[0];
  if (!doc) throw new ActionError('NOT_FOUND', 'Product not found.');
  const product = productFromDoc(doc.id, doc.data());
  if (!product) throw new ActionError('NOT_FOUND', 'Product not found.');
  const staff = await staffOf(user);
  const profile = await loadUser(user.uid);
  const permissions = Array.isArray(profile?.permissions)
    ? profile.permissions.filter((item: unknown): item is string => typeof item === 'string')
    : [];
  const purchase = await adminDb().doc(`store_purchases/${user.uid}_${product.id}`).get();
  const decision = downloadDecision({
    contentStaff: can(staff, 'content'),
    access: product.access,
    status: product.status,
    purchased: purchase.exists,
    entitled: hasStoreEntitlement(permissions, product.id),
  });
  if (decision !== 'allow') throw new ActionError('FORBIDDEN', 'A purchase or entitlement is required for this file.');
  const path = file === 'markscheme' ? product.markschemePath : product.paperPath;
  if (!path) throw new ActionError('NOT_FOUND', 'That file is not on this product.');
  if (!canSignDownloads()) throw new ActionError('SETUP_NEEDED', SETUP_NEEDED_MESSAGE);
  const signed = await signedRead(path);
  await adminDb().collection('store_download_logs').add({
    userId: user.uid,
    productId: product.id,
    sku: product.sku,
    file,
    createdAt: Date.now(),
    expiresAt: signed.expiresAt,
  });
  return { ok: true, url: signed.url, expiresAt: signed.expiresAt };
}
