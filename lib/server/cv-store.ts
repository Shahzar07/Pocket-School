import 'server-only';

import { randomBytes } from 'node:crypto';
import { adminDb } from '../firebase-admin';
import {
  applyCvFields,
  composeCv,
  cvDocumentPdf,
  cvNeedsTranslation,
  cvTranslatableFields,
  readCvDesign,
  sanitizeDesignForItems,
  themeFromDesign,
  type CvDesign,
  type PortfolioTheme,
  type SavedCvVersion,
} from '../cv-builder';
import { cvDocx } from '../cv-docx';
import { isShareToken } from '../linkedin';
import { publicName } from '../alumni';
import { translateContent } from '../i18n/content-cache';
import { buildPortfolio, refreshPortfolio } from './learner-record-store';

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function versionId(value: unknown): string {
  const raw = text(value).trim().toLowerCase();
  return /^cv-[a-z0-9-]{4,40}$/.test(raw) ? raw : '';
}

function versionName(value: unknown): string {
  return text(value).replace(/\s+/g, ' ').trim().slice(0, 80);
}

function readVersion(id: string, data: Record<string, unknown> | undefined): SavedCvVersion | null {
  const name = versionName(data?.name);
  if (!name) return null;
  return {
    id,
    name,
    shareToken: text(data?.shareToken),
    design: readCvDesign(data),
    updatedAt: text(data?.updatedAt),
  };
}

function storedDesign(design: CvDesign, name: string, shareToken: string): Record<string, unknown> {
  return {
    name,
    shareToken,
    updatedAt: new Date().toISOString(),
    template: design.template,
    accent: design.accent,
    font: design.font,
    layout: design.layout,
    photo: design.photo,
    photoUrl: design.photoUrl,
    pageSize: design.pageSize,
    language: design.language,
    sectionOrder: design.sectionOrder,
    sectionTitles: design.sectionTitles,
    hiddenSections: design.hiddenSections,
    hiddenItems: design.hiddenItems,
    customSections: design.customSections,
    wording: design.wording,
    summary: design.summary,
    showScores: design.showScores,
  };
}

export async function listCvVersions(uid: string): Promise<SavedCvVersion[]> {
  if (!uid) return [];
  const snap = await adminDb().collection(`users/${uid}/cv_versions`).limit(20).get();
  return snap.docs
    .flatMap((doc) => {
      const version = readVersion(doc.id, doc.data());
      return version ? [version] : [];
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listOwnedShareLinks(uid: string): Promise<{ token: string; label: string }[]> {
  if (!uid) return [];
  const snap = await adminDb().collection('share_links').where('studentId', '==', uid).limit(40).get();
  return snap.docs.flatMap((doc) => {
    if (doc.get('revoked') === true) return [];
    if (!isShareToken(doc.id)) return [];
    return [{ token: doc.id, label: text(doc.get('label')).slice(0, 80) || 'Share link' }];
  });
}

async function ownedShare(uid: string, token: string): Promise<boolean> {
  if (!token) return true;
  if (!isShareToken(token)) return false;
  const link = await adminDb().doc(`share_links/${token}`).get();
  return link.exists && link.get('studentId') === uid && link.get('revoked') !== true;
}

export async function saveCvVersion(uid: string, input: {
  id?: unknown;
  name?: unknown;
  shareToken?: unknown;
  design?: unknown;
}): Promise<SavedCvVersion | { error: string }> {
  const name = versionName(input.name);
  if (!name) return { error: 'Name this CV, for example Company X - Analyst.' };
  const shareToken = text(input.shareToken).trim();
  if (!(await ownedShare(uid, shareToken))) return { error: 'Choose a share link from this portfolio.' };
  const built = await buildPortfolio(uid);
  const design = sanitizeDesignForItems(readCvDesign(input.design), built.items);
  if (design.photo) design.photoUrl = built.avatarUrl;
  const id = versionId(input.id) || `cv-${randomBytes(6).toString('hex')}`;
  const ref = adminDb().doc(`users/${uid}/cv_versions/${id}`);
  const current = await ref.get();
  if (!current.exists) {
    const existing = await adminDb().collection(`users/${uid}/cv_versions`).limit(20).get();
    if (existing.size >= 20) return { error: 'Twenty CV versions are the limit. Remove one to save another.' };
  }
  const updatedAt = new Date().toISOString();
  await ref.set({ ...storedDesign(design, name, shareToken), updatedAt });
  return { id, name, shareToken, design, updatedAt };
}

export async function deleteCvVersion(uid: string, id: unknown): Promise<{ deleted: boolean } | { error: string }> {
  const version = versionId(id);
  if (!version) return { error: 'Choose a CV version.' };
  const ref = adminDb().doc(`users/${uid}/cv_versions/${version}`);
  const snap = await ref.get();
  if (!snap.exists) return { deleted: false };
  await ref.delete();
  return { deleted: true };
}

export async function savePortfolioTheme(uid: string, designInput: unknown): Promise<PortfolioTheme> {
  const built = await buildPortfolio(uid);
  const design = sanitizeDesignForItems(readCvDesign(designInput), built.items);
  design.photoUrl = design.photo ? built.avatarUrl : '';
  const theme = themeFromDesign(design);
  await adminDb().doc(`users/${uid}/portfolio/profile`).set({ theme }, { merge: true });
  await refreshPortfolio(uid);
  return theme;
}

async function designFor(
  uid: string,
  items: Parameters<typeof sanitizeDesignForItems>[1],
  input: { id?: unknown; design?: unknown },
): Promise<CvDesign | { error: string }> {
  if (input.design && typeof input.design === 'object') {
    return sanitizeDesignForItems(readCvDesign(input.design), items);
  }
  const id = versionId(input.id);
  if (!id) return { error: 'Choose a CV version.' };
  const snap = await adminDb().doc(`users/${uid}/cv_versions/${id}`).get();
  if (!snap.exists) return { error: 'That CV version is not on this account.' };
  return sanitizeDesignForItems(readCvDesign(snap.data()), items);
}

export async function translateCv(uid: string, input: { id?: unknown; design?: unknown }): Promise<{
  fields: Record<string, string>;
  notice: string;
  language: string;
} | { error: string }> {
  const built = await buildPortfolio(uid);
  const design = await designFor(uid, built.items, input);
  if ('error' in design) return design;
  const composed = composeCv({ name: publicName(built.name), items: built.items, design });
  if (!cvNeedsTranslation(design.language)) return { fields: {}, notice: '', language: 'en' };
  const result = await translateContent({
    id: `cv-${uid}`,
    language: design.language,
    fields: cvTranslatableFields(composed),
  });
  return { fields: result.fields, notice: result.error ?? '', language: design.language };
}

export async function exportCvFile(uid: string, input: {
  format?: unknown;
  id?: unknown;
  design?: unknown;
}): Promise<{ pdf?: string; docx?: string; filename: string; notice: string; language: string } | { error: string }> {
  const format = input.format === 'docx' ? 'docx' : 'pdf';
  const built = await buildPortfolio(uid);
  const design = await designFor(uid, built.items, input);
  if ('error' in design) return design;
  if (design.photo) design.photoUrl = built.avatarUrl;
  let composed = composeCv({ name: publicName(built.name), items: built.items, design });
  let notice = '';
  if (cvNeedsTranslation(design.language)) {
    const result = await translateContent({
      id: `cv-${uid}`,
      language: design.language,
      fields: cvTranslatableFields(composed),
    });
    composed = applyCvFields(composed, result.fields);
    notice = result.error ?? '';
  }
  if (format === 'docx') {
    const bytes = await cvDocx(composed);
    return { docx: Buffer.from(bytes).toString('base64'), filename: 'poket-school-cv.docx', notice, language: design.language };
  }
  return { pdf: Buffer.from(cvDocumentPdf(composed)).toString('base64'), filename: 'poket-school-cv.pdf', notice, language: design.language };
}
