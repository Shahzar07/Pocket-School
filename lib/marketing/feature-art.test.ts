import assert from 'node:assert/strict';
import test from 'node:test';
import { MARKET_ART, PATHWAY_STAGE_LABELS } from './art-copy';
import { HOME } from './home';
import { MARKET_PAGES } from './pages';
import { PATHWAYS } from '../pathways/catalog';

const PRODUCT_SLUGS = ['studio', 'safeline', 'id', 'demo', 'institutions', 'about', 'rochfords'] as const;

test('ET AI teachers card matches the Primary to PhD range', () => {
  const body = HOME.features[0]?.body ?? '';
  assert.match(body, /Primary to A-Levels/);
  assert.match(body, /degree to Masters and PhD/);
  assert.match(body, /continuous professional development and independent learning/);
  assert.match(body, /The count on this page is the list in the product/);
  assert.equal(body.includes('degree foundation'), false);
});

test('text-only public marketing pages have an illustration label', () => {
  for (const slug of PRODUCT_SLUGS) {
    assert.equal(typeof MARKET_ART[slug], 'string', slug);
  }
  for (const page of MARKET_PAGES) {
    if (PATHWAYS.some((pathway) => pathway.slug === page.slug)) continue;
    assert.equal(typeof MARKET_ART[page.slug], 'string', page.slug);
  }
  for (const pathway of PATHWAYS) {
    assert.equal(typeof MARKET_ART[pathway.slug], 'string', pathway.slug);
    assert.ok((PATHWAY_STAGE_LABELS[pathway.slug]?.length ?? 0) > 0, pathway.slug);
  }
  assert.equal(typeof MARKET_ART['ai-teachers'], 'string');
  assert.equal(typeof MARKET_ART.offer, 'string');
  assert.equal(typeof MARKET_ART['stand-up'], 'string');
  assert.equal(MARKET_ART.id.includes('Sample'), true);
});
