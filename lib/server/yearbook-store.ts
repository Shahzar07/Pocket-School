import 'server-only';

import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { asAgeTier, isMinorTier } from '../age-tier';
import { publicName } from '../alumni';
import { channelOpen, groupIdFor, readConsent } from '../alumni-network';
import { adminDb } from '../firebase-admin';
import {
  canConnect,
  canEditYearbook,
  canSubmitPage,
  defaultAudiences,
  lockDateFrom,
  pageReleased,
  placeBoard,
  portraitLines,
  readAudiences,
  readSticker,
  readTemplate,
  screenOwnPage,
  screenSignature,
  suggestionAllowed,
  yearbookPdf,
  type YearbookAudience,
  type YearbookSheet,
  type YearbookTemplate,
} from '../yearbook';
import { notifyUser } from './device-push';

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function clip(value: unknown, max: number): string {
  return text(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeId(value: string): string {
  const id = value.trim();
  if (!id || id.includes('/') || id.length > 140) return '';
  return id;
}

function timeId(prefix: string): string {
  return `${prefix}${Date.now().toString().padStart(13, '0')}-${randomBytes(2).toString('hex')}`;
}

export async function ensureYearbookPage(input: {
  institutionId: string;
  studentId: string;
  institutionName: string;
  level: string;
  className: string;
  year: string;
  leftOn: string;
}): Promise<void> {
  const institutionId = safeId(input.institutionId);
  const studentId = safeId(input.studentId);
  if (!institutionId || !studentId) return;
  const group = groupIdFor({ className: input.className, level: input.level, year: input.year });
  const bookRef = adminDb().doc(`institutions/${institutionId}/yearbooks/${group.id}`);
  const book = await bookRef.get();
  if (!book.exists) {
    await bookRef.set({
      institutionId,
      institutionName: input.institutionName,
      name: group.name,
      cohort: /^\d{4}$/.test(input.year) ? input.year : '',
      className: clip(input.className, 60),
      level: clip(input.level, 40),
      lockOn: lockDateFrom(input.leftOn),
      status: 'open',
      template: 'deep',
      principalMessage: '',
      teacherMessage: '',
    });
  }
  const pageRef = bookRef.collection('pages').doc(studentId);
  if (!(await pageRef.get()).exists) {
    await pageRef.set({
      studentId,
      quote: '',
      mostLikely: '',
      clubs: '',
      photo: false,
      audiences: defaultAudiences(),
      status: 'draft',
      parentApproved: false,
    });
  }
}

async function ageOf(uid: string) {
  const id = safeId(uid);
  if (!id) return { tier: asAgeTier(undefined), name: 'Alumnus', avatar: '' };
  const user = await adminDb().doc(`users/${id}`).get();
  return {
    tier: asAgeTier(user.get('ageTier')),
    name: text(user.get('name')) || 'Alumnus',
    avatar: text(user.get('avatarUrl')).startsWith('https://') ? text(user.get('avatarUrl')) : '',
  };
}

async function ping(uid: string, institutionId: string, title: string, message: string, link: string, pref: 'reunions' | 'wall' | 'yearbook' | 'alumni_messages') {
  const consent = readConsent((await adminDb().doc(`users/${uid}/alumni_consent/${institutionId}`).get()).data());
  if (!channelOpen(consent, 'inbox') && !channelOpen(consent, 'push')) return;
  await notifyUser({
    userId: uid,
    title,
    message: message.slice(0, 180),
    type: 'announcement',
    link,
    pref,
    skipPush: !channelOpen(consent, 'push'),
  });
}

async function knownTitles(uid: string): Promise<string[]> {
  const [badges, certificates] = await Promise.all([
    adminDb().collection('badges').where('userId', '==', uid).limit(12).get(),
    adminDb().collection('certificates').where('studentId', '==', uid).limit(12).get(),
  ]);
  return [
    ...badges.docs.map((doc) => text(doc.get('name'))),
    ...certificates.docs.map((doc) => text(doc.get('courseTitle')) || text(doc.get('moduleTitle'))),
  ].filter(Boolean);
}

function bookPath(institutionId: string, bookId: string) {
  return adminDb().doc(`institutions/${safeId(institutionId)}/yearbooks/${safeId(bookId)}`);
}

export async function saveYearbookPage(input: {
  uid: string;
  institutionId: string;
  bookId: string;
  today: string;
  quote: unknown;
  mostLikely: unknown;
  clubs: unknown;
  photo: boolean;
  audiences: unknown;
}): Promise<{ ok: true } | { error: string }> {
  const book = await bookPath(input.institutionId, input.bookId).get();
  if (!book.exists) return { error: 'Choose a yearbook.' };
  if (!canEditYearbook(input.today, text(book.get('lockOn')))) return { error: 'This yearbook is locked.' };
  const pageRef = book.ref.collection('pages').doc(input.uid);
  if (!(await pageRef.get()).exists) return { error: 'This page is not yours.' };
  for (const line of [input.quote, input.mostLikely, input.clubs]) {
    const screened = screenOwnPage(text(line));
    if (!screened.ok) return { error: screened.reason };
  }
  await pageRef.set({
    quote: clip(input.quote, 280),
    mostLikely: clip(input.mostLikely, 120),
    clubs: clip(input.clubs, 160),
    photo: input.photo === true,
    audiences: readAudiences(input.audiences),
  }, { merge: true });
  return { ok: true };
}

export async function submitYearbookPage(input: {
  uid: string;
  institutionId: string;
  bookId: string;
  today: string;
}): Promise<{ ok: true } | { error: string }> {
  const book = await bookPath(input.institutionId, input.bookId).get();
  if (!book.exists) return { error: 'Choose a yearbook.' };
  const pageRef = book.ref.collection('pages').doc(input.uid);
  const page = await pageRef.get();
  if (!page.exists) return { error: 'This page is not yours.' };
  const profile = await ageOf(input.uid);
  const decision = canSubmitPage({
    today: input.today,
    lockOn: text(book.get('lockOn')),
    ageTier: profile.tier,
    parentApproved: page.get('parentApproved') === true,
  });
  if (!decision.ok) return { error: decision.reason };
  await pageRef.set({ status: 'pending' }, { merge: true });
  return { ok: true };
}

export async function parentApproveYearbook(input: {
  parentId: string;
  institutionId: string;
  bookId: string;
  studentId: string;
}): Promise<{ ok: true } | { error: string }> {
  const parent = await adminDb().doc(`users/${input.parentId}`).get();
  const children = Array.isArray(parent.get('childIds')) ? parent.get('childIds') : [];
  if (!children.includes(input.studentId)) return { error: 'A linked parent agrees to this page.' };
  const pageRef = bookPath(input.institutionId, input.bookId).collection('pages').doc(safeId(input.studentId));
  if (!(await pageRef.get()).exists) return { error: 'Choose a page.' };
  await pageRef.set({ parentApproved: true }, { merge: true });
  return { ok: true };
}

export async function approveYearbookPage(institutionId: string, bookId: string, studentId: string): Promise<{ ok: true } | { error: string }> {
  const pageRef = bookPath(institutionId, bookId).collection('pages').doc(safeId(studentId));
  if (!(await pageRef.get()).exists) return { error: 'Choose a page.' };
  await pageRef.set({ status: 'approved', approvedAt: new Date().toISOString() }, { merge: true });
  return { ok: true };
}

export async function saveYearbookStaff(input: {
  institutionId: string;
  bookId: string;
  template: unknown;
  lockOn: unknown;
  principalMessage: unknown;
  teacherMessage: unknown;
}): Promise<{ ok: true } | { error: string }> {
  const bookRef = bookPath(input.institutionId, input.bookId);
  if (!(await bookRef.get()).exists) return { error: 'Choose a yearbook.' };
  for (const line of [input.principalMessage, input.teacherMessage]) {
    const screened = screenOwnPage(text(line));
    if (!screened.ok) return { error: screened.reason };
  }
  const lockOn = text(input.lockOn);
  await bookRef.set({
    template: readTemplate(input.template),
    ...( /^\d{4}-\d{2}-\d{2}$/.test(lockOn) ? { lockOn } : {}),
    principalMessage: clip(input.principalMessage, 600),
    teacherMessage: clip(input.teacherMessage, 600),
  }, { merge: true });
  return { ok: true };
}

export async function releaseYearbook(institutionId: string, bookId: string): Promise<{ notified: number } | { error: string }> {
  const bookRef = bookPath(institutionId, bookId);
  const book = await bookRef.get();
  if (!book.exists) return { error: 'Choose a yearbook.' };
  await bookRef.set({ status: 'released', releasedAt: new Date().toISOString() }, { merge: true });
  const pages = await bookRef.collection('pages').limit(80).get();
  let notified = 0;
  for (const page of pages.docs) {
    await ping(page.id, institutionId, `${text(book.get('name')) || 'Yearbook'} is open`, 'The yearbook is ready to read.', '/dashboard/student/yearbook', 'yearbook');
    notified += 1;
  }
  return { notified };
}

async function blocked(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all([
    adminDb().doc(`users/${a}/blocks/${b}`).get(),
    adminDb().doc(`users/${b}/blocks/${a}`).get(),
  ]);
  return left.exists || right.exists;
}

export async function signYearbook(input: {
  uid: string;
  institutionId: string;
  bookId: string;
  toId: string;
  body: unknown;
  sticker: unknown;
}): Promise<{ id: string; visible: boolean; queued: boolean } | { error: string }> {
  const bookRef = bookPath(input.institutionId, input.bookId);
  if (!(await bookRef.get()).exists) return { error: 'Choose a yearbook.' };
  const mine = await bookRef.collection('pages').doc(input.uid).get();
  if (!mine.exists) return { error: 'This yearbook is for your class.' };
  const toId = input.toId === 'wall' ? 'wall' : safeId(input.toId);
  if (!toId) return { error: 'Choose a page.' };
  if (toId !== 'wall' && !(await bookRef.collection('pages').doc(toId).get()).exists) return { error: 'Choose a classmate page.' };
  if (toId !== 'wall' && toId !== input.uid && await blocked(input.uid, toId)) return { error: 'That page is not open to you.' };
  const profile = await ageOf(input.uid);
  const screened = screenSignature(text(input.body), text(input.sticker), profile.tier);
  if (screened.decision === 'block') return { error: 'That note cannot be shared.' };
  const id = timeId('s');
  await bookRef.collection('signatures').doc(id).set({
    fromId: input.uid,
    fromName: publicName(profile.name),
    toId,
    body: clip(input.body, 280),
    sticker: readSticker(input.sticker),
    decision: screened.decision,
    visible: screened.visible,
    queued: screened.queued,
    at: new Date().toISOString(),
  });
  if (screened.queued) {
    await adminDb().doc(`institutions/${input.institutionId}/alumni_queue/${id}`).set({
      status: 'held',
      kind: 'yearbook',
      bookId: bookRef.id,
      signatureId: id,
      authorId: input.uid,
      authorName: publicName(profile.name),
      body: clip(input.body, 280),
      at: new Date().toISOString(),
    });
  } else if (toId !== 'wall' && toId !== input.uid) {
    await ping(toId, input.institutionId, `A note from ${publicName(profile.name)}`, 'Someone signed your yearbook page.', '/dashboard/student/yearbook', 'wall');
  }
  return { id, visible: screened.visible, queued: screened.queued };
}

export async function addYearbookMemory(input: {
  uid: string;
  institutionId: string;
  bookId: string;
  title: unknown;
  body: unknown;
}): Promise<{ id: string; visible: boolean } | { error: string }> {
  const bookRef = bookPath(input.institutionId, input.bookId);
  if (!(await bookRef.collection('pages').doc(input.uid).get()).exists) return { error: 'This yearbook is for your class.' };
  const profile = await ageOf(input.uid);
  const screened = screenSignature(`${text(input.title)} ${text(input.body)}`, '', profile.tier);
  if (screened.decision === 'block') return { error: 'That memory cannot be shared.' };
  const id = timeId('m');
  await bookRef.collection('memories').doc(id).set({
    authorId: input.uid,
    authorName: publicName(profile.name),
    title: clip(input.title, 80),
    body: clip(input.body, 280),
    visible: screened.visible,
    queued: screened.queued,
    at: new Date().toISOString(),
  });
  if (screened.queued) {
    await adminDb().doc(`institutions/${input.institutionId}/alumni_queue/${id}`).set({
      status: 'held',
      kind: 'yearbook-memory',
      bookId: bookRef.id,
      memoryId: id,
      authorId: input.uid,
      authorName: publicName(profile.name),
      body: clip(`${text(input.title)} ${text(input.body)}`, 280),
      at: new Date().toISOString(),
    });
  }
  return { id, visible: screened.visible };
}

export async function addYearbookGallery(input: {
  institutionId: string;
  bookId: string;
  caption: unknown;
  imageUrl: unknown;
}): Promise<{ id: string } | { error: string }> {
  const bookRef = bookPath(input.institutionId, input.bookId);
  if (!(await bookRef.get()).exists) return { error: 'Choose a yearbook.' };
  const screened = screenOwnPage(text(input.caption));
  if (!screened.ok) return { error: screened.reason };
  const imageUrl = text(input.imageUrl).startsWith('https://') ? text(input.imageUrl).slice(0, 300) : '';
  const id = timeId('g');
  await bookRef.collection('gallery').doc(id).set({ caption: clip(input.caption, 140), imageUrl, at: new Date().toISOString() });
  return { id };
}

async function achievementsFor(uid: string): Promise<string[]> {
  return (await knownTitles(uid)).slice(0, 6);
}

export async function yearbookHome(uid: string, institutionId: string, bookId: string, review = false) {
  const safeUid = safeId(uid);
  const attended = safeUid ? await adminDb().collection(`users/${safeUid}/attended`).limit(12).get() : null;
  const history = attended?.docs.map((doc) => ({ institutionId: doc.id, institutionName: text(doc.get('institutionName')), className: text(doc.get('className')) })) ?? [];
  const suggestions = safeUid ? await achievementsFor(safeUid) : [];
  const chosen = safeId(institutionId) || history[0]?.institutionId || '';
  if (!chosen) return { books: [], book: null, suggestions };
  const booksSnap = await adminDb().collection(`institutions/${chosen}/yearbooks`).limit(12).get();
  const books = booksSnap.docs.map((doc) => ({ id: doc.id, name: text(doc.get('name')), lockOn: text(doc.get('lockOn')), status: text(doc.get('status')) }));
  const selected = safeId(bookId) || books[0]?.id || '';
  if (!selected) return { books, book: null, institutionId: chosen, suggestions };
  const bookRef = adminDb().doc(`institutions/${chosen}/yearbooks/${selected}`);
  const book = await bookRef.get();
  if (!book.exists) return { books, book: null, institutionId: chosen, suggestions };
  const profile = safeUid ? await ageOf(safeUid) : null;
  const pages = await bookRef.collection('pages').limit(40).get();
  const mine = safeUid ? pages.docs.find((doc) => doc.id === safeUid) : undefined;
  const classmate = Boolean(mine);
  const viewer: YearbookAudience = review || classmate ? 'classmates' : 'alumni';
  const portraits = [];
  for (const page of pages.docs) {
    const owner = await ageOf(page.id);
    const released = review || pageReleased({
      ageTier: owner.tier,
      parentApproved: page.get('parentApproved') === true,
      approved: page.get('status') === 'approved',
      viewer: page.id === safeUid ? 'self' : viewer,
    });
    const destination = text((await adminDb().doc(`users/${page.id}/attended/${chosen}`).get()).get('destination'));
    const lines = portraitLines({
      name: page.id === safeUid ? owner.name : publicName(owner.name),
      className: text(book.get('className')),
      quote: text(page.get('quote')),
      mostLikely: text(page.get('mostLikely')),
      clubs: text(page.get('clubs')),
      achievements: await achievementsFor(page.id),
      destination,
      audiences: readAudiences(page.get('audiences')),
      released,
    }, page.id === safeUid || review ? 'classmates' : viewer);
    if (review || page.id === safeUid || lines.length) {
      portraits.push({
        id: page.id,
        lines,
        photo: page.get('photo') === true && Boolean(owner.avatar) && (page.id === safeUid || released),
        initials: publicName(owner.name).slice(0, 2),
        status: text(page.get('status')) || 'draft',
        parentApproved: page.get('parentApproved') === true,
        minor: isMinorTier(owner.tier),
      });
    }
  }
  const signatures = await bookRef.collection('signatures').limit(40).get();
  const wall = signatures.docs.flatMap((doc) => {
    const visible = doc.get('visible') === true || (safeUid !== '' && doc.get('fromId') === safeUid);
    if (!visible) return [];
    return [{
      id: doc.id,
      fromName: text(doc.get('fromName')),
      toId: text(doc.get('toId')),
      body: text(doc.get('body')),
      sticker: text(doc.get('sticker')),
      queued: doc.get('queued') === true,
    }];
  });
  const memories = (await bookRef.collection('memories').limit(20).get()).docs.flatMap((doc) => {
    if (doc.get('visible') !== true && (!safeUid || doc.get('authorId') !== safeUid)) return [];
    return [{ id: doc.id, title: text(doc.get('title')), body: text(doc.get('body')), authorName: text(doc.get('authorName')), queued: doc.get('queued') === true }];
  });
  const gallery = (await bookRef.collection('gallery').limit(12).get()).docs.map((doc) => ({
    id: doc.id,
    caption: text(doc.get('caption')),
    imageUrl: text(doc.get('imageUrl')).startsWith('https://') ? text(doc.get('imageUrl')) : '',
  }));
  return {
    institutionId: chosen,
    books,
    suggestions,
    book: {
      id: book.id,
      name: text(book.get('name')),
      lockOn: text(book.get('lockOn')),
      status: text(book.get('status')),
      template: readTemplate(book.get('template')),
      principalMessage: text(book.get('principalMessage')),
      teacherMessage: text(book.get('teacherMessage')),
      own: mine ? {
        quote: text(mine.get('quote')),
        mostLikely: text(mine.get('mostLikely')),
        clubs: text(mine.get('clubs')),
        photo: mine.get('photo') === true,
        audiences: readAudiences(mine.get('audiences')),
        status: text(mine.get('status')) || 'draft',
        parentApproved: mine.get('parentApproved') === true,
        minor: profile ? isMinorTier(profile.tier) : false,
      } : null,
      portraits,
      wall,
      memories,
      gallery,
    },
  };
}

export async function institutionYearbook(institutionId: string, bookId: string) {
  const booksSnap = await adminDb().collection(`institutions/${institutionId}/yearbooks`).limit(20).get();
  const books = booksSnap.docs.map((doc) => ({
    id: doc.id,
    name: text(doc.get('name')),
    lockOn: text(doc.get('lockOn')),
    status: text(doc.get('status')),
    template: readTemplate(doc.get('template')),
  }));
  const selected = safeId(bookId) || books[0]?.id || '';
  if (!selected) return { books, book: null };
  const home = await yearbookHome('', institutionId, selected, true);
  const bookRef = adminDb().doc(`institutions/${institutionId}/yearbooks/${selected}`);
  const pages = await bookRef.collection('pages').limit(40).get();
  const held = await adminDb().collection(`institutions/${institutionId}/alumni_queue`).where('status', '==', 'held').limit(20).get();
  return {
    books,
    book: {
      ...(home.book ?? { id: selected, name: '', lockOn: '', status: 'open', template: 'deep' as YearbookTemplate, principalMessage: '', teacherMessage: '', portraits: [], wall: [], memories: [], gallery: [], own: null }),
      pages: pages.docs.map((doc) => ({
        id: doc.id,
        status: text(doc.get('status')) || 'draft',
        parentApproved: doc.get('parentApproved') === true,
        quote: text(doc.get('quote')),
        mostLikely: text(doc.get('mostLikely')),
        clubs: text(doc.get('clubs')),
      })),
      held: held.docs.filter((doc) => (doc.get('kind') === 'yearbook' || doc.get('kind') === 'yearbook-memory') && text(doc.get('bookId')) === selected).map((doc) => ({
        id: doc.id,
        authorName: text(doc.get('authorName')),
        body: text(doc.get('body')),
      })),
    },
  };
}

export async function yearbookFile(institutionId: string, bookId: string, viewer: YearbookAudience): Promise<{ pdf: string } | { error: string }> {
  const bookRef = bookPath(institutionId, bookId);
  const book = await bookRef.get();
  if (!book.exists) return { error: 'Choose a yearbook.' };
  const pages = await bookRef.collection('pages').limit(8).get();
  const sheets: YearbookSheet[] = [{
    heading: text(book.get('name')) || 'Yearbook',
    lines: [text(book.get('institutionName')), text(book.get('principalMessage')), text(book.get('teacherMessage'))].filter(Boolean),
  }];
  for (const page of pages.docs) {
    const owner = await ageOf(page.id);
    const released = pageReleased({
      ageTier: owner.tier,
      parentApproved: page.get('parentApproved') === true,
      approved: page.get('status') === 'approved',
      viewer,
    });
    const destination = text((await adminDb().doc(`users/${page.id}/attended/${institutionId}`).get()).get('destination'));
    sheets.push({
      heading: publicName(owner.name),
      lines: portraitLines({
        name: publicName(owner.name),
        className: text(book.get('className')),
        quote: text(page.get('quote')),
        mostLikely: text(page.get('mostLikely')),
        clubs: text(page.get('clubs')),
        achievements: await achievementsFor(page.id),
        destination,
        audiences: readAudiences(page.get('audiences')),
        released,
      }, viewer),
    });
  }
  const bytes = yearbookPdf({ template: readTemplate(book.get('template')), academy: text(book.get('institutionName')), sheets });
  return { pdf: Buffer.from(bytes).toString('base64') };
}

export async function postAlumniUpdate(input: {
  uid: string;
  institutionId: string;
  kind: unknown;
  title: unknown;
  body: unknown;
}): Promise<{ id: string; visible?: boolean } | { error: string }> {
  if (!(await adminDb().doc(`users/${input.uid}/attended/${input.institutionId}`).get()).exists) {
    return { error: 'This academy is not on your history.' };
  }
  const kind = input.kind === 'reunion' || input.kind === 'throwback' || input.kind === 'achievement' ? input.kind : 'update';
  const title = clip(input.title, 120);
  if (kind === 'achievement' && !suggestionAllowed(title, await knownTitles(input.uid))) {
    return { error: 'Share an achievement that is already on your record.' };
  }
  const profile = await ageOf(input.uid);
  const screened = screenSignature(`${title} ${text(input.body)}`, '', profile.tier);
  if (screened.decision === 'block') return { error: 'That update cannot be shared.' };
  const id = timeId('f');
  await adminDb().doc(`alumni_feed/${id}`).set({
    institutionId: input.institutionId,
    authorId: input.uid,
    authorName: publicName(profile.name),
    kind,
    title,
    body: clip(input.body, 400),
    visible: screened.visible,
    queued: screened.queued,
    at: new Date().toISOString(),
    likeCount: 0,
    rsvpCount: 0,
  });
  if (screened.queued) {
    await adminDb().doc(`institutions/${input.institutionId}/alumni_queue/${id}`).set({
      status: 'held',
      kind: 'feed',
      feedId: id,
      authorId: input.uid,
      authorName: publicName(profile.name),
      body: clip(`${title} ${text(input.body)}`, 280),
      at: new Date().toISOString(),
    });
    return { id, visible: false };
  }
  if (kind === 'reunion') {
    const people = await adminDb().collection(`institutions/${input.institutionId}/alumni`).limit(40).get();
    for (const person of people.docs) {
      if (person.id === input.uid) continue;
      await ping(person.id, input.institutionId, title || 'A reunion', 'A reunion is open for RSVPs.', '/dashboard/student/yearbook', 'reunions');
    }
  }
  return { id };
}

export async function likeAlumniUpdate(uid: string, feedId: string): Promise<{ ok: true } | { error: string }> {
  const ref = adminDb().doc(`alumni_feed/${safeId(feedId)}`);
  const like = ref.collection('likes').doc(uid);
  if ((await like.get()).exists) return { ok: true };
  if (!(await ref.get()).exists) return { error: 'That update is not open.' };
  await like.set({ at: new Date().toISOString() });
  await ref.set({ likeCount: FieldValue.increment(1) }, { merge: true });
  return { ok: true };
}

export async function commentAlumniUpdate(input: { uid: string; feedId: string; body: unknown }): Promise<{ visible: boolean } | { error: string }> {
  const ref = adminDb().doc(`alumni_feed/${safeId(input.feedId)}`);
  if (!(await ref.get()).exists) return { error: 'That update is not open.' };
  const profile = await ageOf(input.uid);
  const screened = screenSignature(text(input.body), '', profile.tier);
  if (screened.decision === 'block') return { error: 'That comment cannot be shared.' };
  const id = timeId('c');
  const feed = await ref.get();
  await ref.collection('comments').doc(id).set({
    authorId: input.uid,
    authorName: publicName(profile.name),
    body: clip(input.body, 280),
    visible: screened.visible,
    queued: screened.queued,
    at: new Date().toISOString(),
  });
  const academyId = text(feed.get('institutionId'));
  if (screened.queued && academyId) {
    await adminDb().doc(`institutions/${academyId}/alumni_queue/${id}`).set({
      status: 'held',
      kind: 'feed-comment',
      feedId: ref.id,
      commentId: id,
      authorId: input.uid,
      authorName: publicName(profile.name),
      body: clip(input.body, 280),
      at: new Date().toISOString(),
    });
  }
  return { visible: screened.visible };
}

export async function rsvpAlumniUpdate(uid: string, feedId: string, going: boolean): Promise<{ ok: true } | { error: string }> {
  const ref = adminDb().doc(`alumni_feed/${safeId(feedId)}`);
  const feed = await ref.get();
  if (!feed.exists || feed.get('kind') !== 'reunion') return { error: 'Choose a reunion.' };
  const rsvp = ref.collection('rsvps').doc(uid);
  const prior = await rsvp.get();
  const was = prior.get('going') === true;
  await rsvp.set({ going, at: new Date().toISOString() });
  if (going && !was) await ref.set({ rsvpCount: FieldValue.increment(1) }, { merge: true });
  if (!going && was) await ref.set({ rsvpCount: FieldValue.increment(-1) }, { merge: true });
  return { ok: true };
}

export async function alumniFeed(institutionId: string) {
  const snap = await adminDb().collection('alumni_feed').where('institutionId', '==', institutionId).limit(30).get();
  return snap.docs.flatMap((doc) => {
    if (doc.get('visible') === false) return [];
    return [{
      id: doc.id,
      kind: text(doc.get('kind')),
      title: text(doc.get('title')),
      body: text(doc.get('body')),
      authorName: text(doc.get('authorName')),
      likeCount: typeof doc.get('likeCount') === 'number' ? doc.get('likeCount') : 0,
      rsvpCount: typeof doc.get('rsvpCount') === 'number' ? doc.get('rsvpCount') : 0,
    }];
  });
}

export async function saveAlumniPlace(input: {
  uid: string;
  institutionId: string;
  country: unknown;
  shareName: boolean;
  directory: boolean;
  industry: unknown;
  destination: unknown;
  year: unknown;
  className: unknown;
}): Promise<{ ok: true } | { error: string }> {
  const institutionId = safeId(input.institutionId);
  const uid = safeId(input.uid);
  if (!institutionId || !uid) return { error: 'Choose an academy.' };
  const id = `${institutionId}__${uid}`;
  const profile = await ageOf(uid);
  const minor = isMinorTier(profile.tier);
  if (input.directory && minor) return { error: 'The directory is for adults.' };
  const country = clip(input.country, 60);
  const shareName = input.shareName === true && !minor;
  const directoryRef = adminDb().doc(`alumni_directory/${id}`);
  const placeRef = adminDb().doc(`alumni_places/${id}`);
  const clean = (value: unknown, max: number) => {
    const line = clip(value, max);
    return line.includes('@') ? '' : line;
  };
  if (input.directory) {
    await directoryRef.set({
      institutionId,
      studentId: uid,
      name: publicName(profile.name),
      year: /^\d{4}$/.test(text(input.year)) ? text(input.year) : '',
      className: clean(input.className, 60),
      destination: clean(input.destination, 120),
      industry: clean(input.industry, 80),
      country,
    });
  } else if ((await directoryRef.get()).exists) {
    await directoryRef.delete();
  }
  if (country) {
    await placeRef.set({
      institutionId,
      studentId: uid,
      country,
      shareName,
      name: shareName ? publicName(profile.name) : '',
    });
  } else if ((await placeRef.get()).exists) {
    await placeRef.delete();
  }
  return { ok: true };
}

export async function searchAlumni(institutionId: string, query: {
  year?: unknown;
  className?: unknown;
  destination?: unknown;
  industry?: unknown;
  country?: unknown;
}) {
  const snap = await adminDb().collection('alumni_directory').where('institutionId', '==', institutionId).limit(200).get();
  const year = text(query.year);
  const className = text(query.className).toLowerCase();
  const destination = text(query.destination).toLowerCase();
  const industry = text(query.industry).toLowerCase();
  const country = text(query.country).toLowerCase();
  return snap.docs.map((doc) => ({
    id: text(doc.get('studentId')),
    name: text(doc.get('name')),
    year: text(doc.get('year')),
    className: text(doc.get('className')),
    destination: text(doc.get('destination')),
    industry: text(doc.get('industry')),
    country: text(doc.get('country')),
  })).filter((person) => {
    if (year && person.year !== year) return false;
    if (className && person.className.toLowerCase() !== className) return false;
    if (destination && !person.destination.toLowerCase().includes(destination)) return false;
    if (industry && !person.industry.toLowerCase().includes(industry)) return false;
    if (country && person.country.toLowerCase() !== country) return false;
    return true;
  }).slice(0, 40);
}

export async function alumniMap(institutionId: string) {
  const snap = await adminDb().collection('alumni_places').where('institutionId', '==', institutionId).limit(200).get();
  return placeBoard(snap.docs.map((doc) => ({
    country: text(doc.get('country')),
    shareName: doc.get('shareName') === true,
    name: text(doc.get('name')),
  })));
}

export async function requestConnection(input: { uid: string; institutionId: string; otherId: string }): Promise<{ ok: true } | { error: string }> {
  const otherId = safeId(input.otherId);
  if (!otherId) return { error: 'Choose an alumnus.' };
  const [me, them, blockedPair] = await Promise.all([
    ageOf(input.uid),
    ageOf(otherId),
    blocked(input.uid, otherId),
  ]);
  const directory = await adminDb().collection('alumni_directory').where('institutionId', '==', input.institutionId).limit(200).get();
  const ids = new Set(directory.docs.map((doc) => text(doc.get('studentId'))));
  const allowed = canConnect(
    { id: input.uid, ageTier: me.tier, directory: ids.has(input.uid) },
    { id: otherId, ageTier: them.tier, directory: ids.has(otherId) },
    blockedPair,
  );
  if (!allowed) return { error: 'Connection requests are for adults who opted into the directory.' };
  const payload = { status: 'pending', institutionId: input.institutionId, at: new Date().toISOString() };
  await adminDb().doc(`users/${input.uid}/connections/${otherId}`).set({ ...payload, name: publicName(them.name) });
  await adminDb().doc(`users/${otherId}/connections/${input.uid}`).set({ ...payload, name: publicName(me.name) });
  await ping(otherId, input.institutionId, `A request from ${publicName(me.name)}`, 'An adult alumnus asked to connect.', '/dashboard/student/yearbook', 'alumni_messages');
  return { ok: true };
}

export async function listConnections(uid: string) {
  const safeUid = safeId(uid);
  if (!safeUid) return [];
  const snap = await adminDb().collection(`users/${safeUid}/connections`).limit(20).get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    name: text(doc.get('name')),
    status: text(doc.get('status')) || 'pending',
  }));
}

export async function acceptConnection(uid: string, otherId: string): Promise<{ ok: true } | { error: string }> {
  const other = safeId(otherId);
  const mine = await adminDb().doc(`users/${uid}/connections/${other}`).get();
  if (!mine.exists) return { error: 'Choose a request.' };
  await mine.ref.set({ status: 'accepted' }, { merge: true });
  await adminDb().doc(`users/${other}/connections/${uid}`).set({ status: 'accepted' }, { merge: true });
  return { ok: true };
}
