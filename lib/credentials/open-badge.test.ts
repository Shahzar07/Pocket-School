import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CERTIFICATE_ISSUER_NAME } from '../certificates';
import {
  badgeStanding,
  buildOpenBadge,
  DEFAULT_TEMPLATE,
  linkedInCertificationUrl,
  normaliseIssuerName,
  normaliseTemplate,
  shareLinks,
} from './badge-model';
import {
  crc32,
  generateBadgeKey,
  insertPngText,
  jcsCanonicalize,
  publicKeyFromMultibase,
  publicKeyMultibase,
  readPngText,
  signCredential,
  verifyCredential,
} from './open-badge';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Open Badges 3.0', () => {
  it('canonicalizes object keys and checksums the PNG standard vector', () => {
    assert.equal(
      jcsCanonicalize({ b: 1, a: { d: true, c: 'x' } }),
      '{"a":{"c":"x","d":true},"b":1}',
    );
    assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  });

  it('signs a credential and rejects a changed document', () => {
    const { publicKey, privateKey } = generateBadgeKey();
    const method = 'https://poketschool.ai/api/credentials/issuer#key-1';
    const signed = signCredential(
      { '@context': ['https://www.w3.org/ns/credentials/v2'], id: 'urn:badge:1', name: 'Cells' },
      privateKey,
      method,
      '2026-03-01T00:00:00.000Z',
    );
    assert.equal(verifyCredential(signed, publicKey), true);
    assert.equal(verifyCredential({ ...signed, name: 'Forged' }, publicKey), false);
    const restored = publicKeyFromMultibase(publicKeyMultibase(publicKey));
    assert.equal(publicKeyMultibase(restored), publicKeyMultibase(publicKey));
    assert.equal(verifyCredential(signed, restored), true);
  });

  it('keeps the issuer name as Poket School and builds a LinkedIn add link', () => {
    assert.equal(normaliseIssuerName('Pocket School'), CERTIFICATE_ISSUER_NAME);
    assert.equal(normaliseIssuerName('Poket School'), 'Poket School');
    const template = normaliseTemplate({ issuerName: 'Pocket School', expiresInMonths: 0, accent: 'red' });
    assert.equal(template.issuerName, 'Poket School');
    assert.equal(template.expiresInMonths, null);
    assert.equal(template.accent, '#1E6A83');
    assert.equal(normaliseTemplate({ expiresInMonths: 200 }).expiresInMonths, 120);

    const badge = buildOpenBadge({
      id: 'abc',
      origin: 'https://poketschool.ai',
      studentId: 'student-1',
      studentName: 'Amina',
      courseId: 'biology',
      courseTitle: 'Biology',
      moduleId: 'cells',
      moduleTitle: 'Cells',
      issuedAt: '2026-03-01T00:00:00.000Z',
      expiresAt: null,
      template: DEFAULT_TEMPLATE,
      identityHash: 'sha256$abc',
    });
    assert.equal(badge.id, 'https://poketschool.ai/api/credentials/abc');
    const issuer = badge.issuer as { name: string };
    assert.equal(issuer.name, 'Poket School');

    const url = linkedInCertificationUrl({
      name: 'Cells',
      issuedAt: '2026-03-01T00:00:00.000Z',
      certUrl: 'https://poketschool.ai/verify/abc',
      certId: 'abc',
    });
    assert.equal(new URL(url).searchParams.get('organizationName'), 'Poket School');
    assert.equal(shareLinks('https://poketschool.ai/verify/abc', 'Cells').copy, 'https://poketschool.ai/verify/abc');
    const now = Date.parse('2026-06-01T00:00:00.000Z');
    assert.equal(badgeStanding({ signature: 'valid', revoked: true, expiresAt: '2000-01-01T00:00:00.000Z', now }), 'revoked');
    assert.equal(badgeStanding({ signature: 'valid', revoked: false, expiresAt: '2000-01-01T00:00:00.000Z', now }), 'expired');
    assert.equal(badgeStanding({ signature: 'invalid', revoked: false, expiresAt: null, now }), 'unverified');
  });

  it('bakes the verify URL into a badge PNG', () => {
    const baked = insertPngText(PNG_1X1, [
      { keyword: 'openbadges', text: 'https://poketschool.ai/verify/abc' },
      { keyword: 'openbadgecredential', text: '{"issuer":"Poket School"}' },
    ]);
    assert.equal(readPngText(baked, 'openbadges'), 'https://poketschool.ai/verify/abc');
    assert.equal(readPngText(baked, 'openbadgecredential'), '{"issuer":"Poket School"}');
    assert.equal(Buffer.from(baked).includes(Buffer.from('IEND')), true);
  });
});
