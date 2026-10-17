import assert from 'node:assert/strict';
import test from 'node:test';
import {
  alertAttachmentPublic,
  canViewAttachment,
  hotlineStoragePath,
  sizeLimit,
} from './policy';
import { prepareAttachment } from './prepare';
import { scanBytes } from './scan';
import { stripLocation } from './strip';

function jpegWithGps(): Uint8Array {
  const exif = Buffer.from('Exif\0\0GPSLatitude', 'latin1');
  const length = 2 + exif.length;
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe1, (length >> 8) & 255, length & 255,
    ...exif,
    0xff, 0xd9,
  ]);
}

test('location data is stripped even when the file already claims to be clean', () => {
  const clean = stripLocation(jpegWithGps(), 'image/jpeg');
  assert.equal(Buffer.from(clean).toString('latin1').includes('GPSLatitude'), false);
  assert.equal(clean[0], 0xff);
  assert.equal(clean[1], 0xd8);
  const twice = stripLocation(clean, 'image/jpeg');
  assert.equal(Buffer.from(twice).toString('latin1').includes('GPSLatitude'), false);
});

test('a photo over the limit, a bad type, and the EICAR string are refused', async () => {
  const jpeg = jpegWithGps();
  assert.equal(sizeLimit('image/jpeg'), 10 * 1024 * 1024);
  assert.equal(sizeLimit('application/pdf'), 15 * 1024 * 1024);
  assert.equal(sizeLimit('video/mp4'), 50 * 1024 * 1024);
  const tooBig = await prepareAttachment({
    declaredMime: 'image/jpeg',
    label: 'photo',
    bytes: new Uint8Array(10 * 1024 * 1024 + 1),
  });
  assert.equal(tooBig.ok, false);
  const mismatch = await prepareAttachment({
    declaredMime: 'application/pdf',
    label: 'report',
    bytes: jpeg,
  });
  assert.equal(mismatch.ok, false);
  const infected = await prepareAttachment({
    declaredMime: 'image/jpeg',
    label: 'photo',
    bytes: jpeg,
    scan: async () => ({ clean: false, engine: 'hook', detail: 'blocked' }),
  });
  assert.equal(infected.ok, false);
  const eicar = await scanBytes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'), 'text/plain');
  assert.equal(eicar.clean, false);
  const ready = await prepareAttachment({ declaredMime: 'image/jpeg', label: 'photo', bytes: jpeg });
  assert.equal(ready.ok, true);
  if (ready.ok) {
    assert.equal(ready.file.exifStripped, true);
    assert.equal(Buffer.from(ready.file.bytes).toString('latin1').includes('GPSLatitude'), false);
  }
});

test('medical certificates and safeguarding evidence stay with assigned staff', () => {
  const base = {
    role: 'parent',
    staffPost: '',
    actorId: 'parent-1',
    assigneeUid: 'teacher-1',
    addressedTo: 'teacher',
    category: 'attendance',
    parentUid: 'parent-1',
    label: 'mc',
    internal: false,
  };
  assert.equal(canViewAttachment(base), false);
  assert.equal(canViewAttachment({ ...base, role: 'teacher', staffPost: 'teacher', actorId: 'teacher-1' }), true);
  assert.equal(canViewAttachment({ ...base, role: 'teacher', staffPost: 'teacher', actorId: 'other', label: 'photo' }), true);
  assert.equal(canViewAttachment({
    ...base,
    role: 'teacher',
    staffPost: 'teacher',
    actorId: 'teacher-1',
    category: 'safeguarding',
    label: 'evidence',
  }), false);
  assert.equal(canViewAttachment({
    ...base,
    role: 'teacher',
    staffPost: 'safeguarding_lead',
    actorId: 'lead-1',
    addressedTo: 'safeguarding_lead',
    category: 'safeguarding',
    label: 'evidence',
  }), true);
  assert.equal(alertAttachmentPublic({
    label: 'photo',
    mime: 'image/jpeg',
    internal: false,
    guardianConsent: true,
    consentRecordId: 'consent-1',
  }), true);
  assert.equal(alertAttachmentPublic({
    label: 'photo',
    mime: 'image/jpeg',
    internal: false,
    guardianConsent: true,
    consentRecordId: '',
  }), false);
  assert.equal(alertAttachmentPublic({
    label: 'evidence',
    mime: 'application/pdf',
    internal: false,
    guardianConsent: true,
    consentRecordId: 'consent-1',
  }), false);
  assert.match(hotlineStoragePath('school', 'ticket', 'file', '../a.jpg'), /^institutions\/school\/hotline\/ticket\/file-/);
});
