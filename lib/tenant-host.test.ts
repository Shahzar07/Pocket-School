import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  academySlugFromPath,
  cnameInstructions,
  filterTenantCatalogue,
  interpretVercelDomain,
  isReservedSubdomain,
  manualDomainResult,
  normaliseSubdomain,
  prefixAcademyHref,
  renameRedirect,
  slugBlockReason,
  stripAcademyPath,
  tenantFromRequest,
  vercelDomainConfigured,
} from './tenant-host';

describe('academy slugs', () => {
  it('blocks reserved and short labels', () => {
    assert.equal(normaliseSubdomain('North'), 'north');
    assert.equal(normaliseSubdomain('admin'), null);
    assert.equal(normaliseSubdomain('a'), null);
    assert.equal(normaliseSubdomain('login'), null);
    assert.equal(isReservedSubdomain('WWW'), true);
    assert.match(slugBlockReason('api') ?? '', /reserved/);
    assert.match(slugBlockReason('ab') ?? '', /3–63/);
  });

  it('reads the path fallback and ignores the platform host', () => {
    assert.equal(academySlugFromPath('/a/north/login'), 'north');
    assert.equal(academySlugFromPath('/a/admin'), null);
    assert.equal(stripAcademyPath('/a/north/courses'), '/courses');
    assert.equal(stripAcademyPath('/a/north'), '/');
    assert.deepEqual(tenantFromRequest('poketschool.ai', '/'), { kind: 'platform' });
    assert.deepEqual(tenantFromRequest('north.poketschool.ai', '/login'), { kind: 'subdomain', slug: 'north' });
    assert.deepEqual(tenantFromRequest('www.poketschool.ai', '/a/north'), { kind: 'path', slug: 'north' });
    assert.deepEqual(tenantFromRequest('learn.north.example', '/'), { kind: 'custom', hostname: 'learn.north.example' });
    assert.deepEqual(tenantFromRequest('preview.vercel.app', '/'), { kind: 'platform' });
    assert.deepEqual(tenantFromRequest('north.localhost:3000', '/'), { kind: 'subdomain', slug: 'north' });
  });

  it('redirects a renamed slug and keeps path links inside the academy', () => {
    assert.equal(renameRedirect({
      requestedSlug: 'old-north',
      currentSlug: 'north',
      mode: 'path',
      pathname: '/a/old-north/login',
      search: '?next=1',
    }), '/a/north/login?next=1');
    assert.equal(renameRedirect({
      requestedSlug: 'old-north',
      currentSlug: 'north',
      mode: 'subdomain',
      pathname: '/courses',
    }), 'https://north.poketschool.ai/courses');
    assert.equal(renameRedirect({
      requestedSlug: 'north',
      currentSlug: 'north',
      mode: 'path',
      pathname: '/a/north',
    }), null);
    assert.equal(prefixAcademyHref('/login', 'north'), '/a/north/login');
    assert.equal(prefixAcademyHref('/a/north/courses', 'north'), '/a/north/courses');
  });
});

describe('custom domains', () => {
  it('describes the CNAME and stays manual without a token', () => {
    const record = cnameInstructions('learn.north.example');
    assert.equal(record.type, 'CNAME');
    assert.equal(record.value, 'cname.vercel-dns.com');
    assert.equal(vercelDomainConfigured({}), false);
    assert.equal(vercelDomainConfigured({ VERCEL_TOKEN: 't', VERCEL_PROJECT_ID: 'p' }), true);
    assert.equal(manualDomainResult().status, 'manual');
    assert.equal(interpretVercelDomain({ httpStatus: 200, verified: true }).ssl, 'automatic');
    assert.equal(interpretVercelDomain({ httpStatus: 200, misconfigured: true }).status, 'pending');
    assert.equal(interpretVercelDomain({ httpStatus: 400, error: 'declined' }).status, 'error');
  });
});

describe('tenant catalogue', () => {
  const courses = [{ id: 'biology' }, { id: 'history' }];

  it('limits a curated academy to its published ids', () => {
    assert.deepEqual(
      filterTenantCatalogue(courses, { catalogueVisibility: 'curated', publicCatalogueIds: ['biology'] }).map((course) => course.id),
      ['biology'],
    );
    assert.deepEqual(filterTenantCatalogue(courses, { catalogueVisibility: 'private' }), []);
    assert.deepEqual(
      filterTenantCatalogue(courses, { catalogueVisibility: 'private' }, ['history']).map((course) => course.id),
      ['history'],
    );
    assert.equal(filterTenantCatalogue(courses, null).length, 2);
  });
});
