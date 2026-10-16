import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  academyTaxRate,
  blankAcademySettings,
  fillCertificateTemplate,
  ipAllowed,
  passwordAccepts,
  privacyExport,
  publicTenantPatch,
  rankLeaderboard,
  roleCan,
  sanitiseAcademySettings,
  signupDecision,
  academyAccessWithoutSdk,
} from './academy-settings';

describe('academy policy', () => {
  it('admits open signups and domain-restricted emails', () => {
    assert.equal(signupDecision({ policy: 'open', email: 'a@b.co' }).ok, true);
    assert.equal(signupDecision({ policy: 'invite', email: 'a@north.example' }).ok, false);
    const domain = signupDecision({ policy: 'domain', domains: ['north.example'], email: 'A@North.example' });
    assert.equal(domain.ok, true);
    assert.equal(signupDecision({ policy: 'domain', domains: ['north.example'], email: 'a@other.example' }).ok, false);
  });

  it('checks passwords, allowlists, and role grants', () => {
    assert.equal(passwordAccepts('short', { minLength: 8 }), 'Use at least 8 characters.');
    assert.equal(passwordAccepts('longpassword', { minLength: 8, requireSymbol: true })?.includes('symbol'), true);
    assert.equal(passwordAccepts('long-password', { minLength: 8, requireSymbol: true }), null);
    assert.equal(ipAllowed([], ''), true);
    assert.equal(ipAllowed(['10.0.0.*'], '10.0.0.8'), true);
    assert.equal(ipAllowed(['10.0.0.8'], '10.1.1.1'), false);
    const settings = sanitiseAcademySettings({ roleGrants: { teacher: ['learn'], institution_admin: [] } });
    assert.equal(roleCan(settings, 'institution_admin', 'manage_billing'), true);
    assert.equal(roleCan(settings, 'teacher', 'grade'), false);
    assert.equal(roleCan(settings, 'teacher', 'learn'), true);
  });

  it('ranks a leaderboard, fills a certificate, and publishes only public pages', () => {
    assert.deepEqual(rankLeaderboard([{ name: 'Lee', points: 3 }, { name: 'Amina', points: 9 }])[0], {
      rank: 1, name: 'Amina', points: 9,
    });
    assert.match(fillCertificateTemplate('{{name}} / {{course}}', { name: 'Amina', course: 'Biology', issuer: 'North' }), /Amina/);
    const settings = sanitiseAcademySettings({
      features: { ...blankAcademySettings().features, customPages: true, leaderboard: true },
      pages: [
        { slug: 'About Us', title: 'About', body: 'Hello', published: true },
        { slug: 'draft', title: 'Draft', body: 'Hidden', published: false },
      ],
      leaderboard: [{ name: 'Amina', points: 4 }],
      signupPolicy: 'domain',
      allowedEmailDomains: ['north.example'],
      catalogueVisibility: 'curated',
    });
    const patch = publicTenantPatch(settings);
    assert.equal(patch.publishedPages.length, 1);
    assert.equal(patch.publishedPages[0]?.slug, 'about-us');
    assert.equal(patch.leaderboard[0]?.name, 'Amina');
    assert.equal(patch.signupPolicy, 'domain');
  });

  it('uses the platform tax rate unless the academy overrides it', () => {
    assert.equal(academyTaxRate({ mode: 'exempt', customRate: 0.2, country: 'MY', currency: 'MYR' }), 0);
    assert.equal(academyTaxRate({ mode: 'custom', customRate: 0.05, country: 'MY', currency: 'MYR' }), 0.05);
    assert.ok(academyTaxRate({ mode: 'platform', customRate: 0, country: 'MY', currency: 'MYR' }) > 0);
  });

  it('exports a privacy bundle without inventing secrets', () => {
    const settings = blankAcademySettings();
    const bundle = privacyExport({
      exportedAt: '2026-10-16',
      institutionName: 'North Academy',
      profile: { country: 'MY' },
      members: [],
      catalogue: [],
      audit: [],
      settings,
    });
    assert.equal(bundle.institution, 'North Academy');
    assert.equal('secret' in bundle, false);
  });

  it('fails closed in production when the Admin SDK is missing', () => {
    const production = academyAccessWithoutSdk('production');
    assert.equal(production.status, 503);
    assert.equal(production.body.allowed, false);
    assert.equal(production.body.enforced, true);
    const local = academyAccessWithoutSdk('development');
    assert.equal(local.status, 200);
    assert.equal(local.body.allowed, true);
    assert.equal(local.body.enforced, false);
  });
});
