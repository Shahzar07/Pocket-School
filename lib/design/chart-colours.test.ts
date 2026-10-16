import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  ACCENT_IDS,
  DARK_CARD,
  DARK_CANVAS,
  DARK_INKS,
  DARK_MEDALS,
  LIGHT_CANVAS,
  LIGHT_INKS,
  LIGHT_MEDALS,
  LIGHT_PAGE,
  MEDAL_IDS,
} from './chart-colours';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function channel(hex: string, index: number): number {
  const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const color = hex.replace('#', '');
  return 0.2126 * channel(color, 0) + 0.7152 * channel(color, 2) + 0.0722 * channel(color, 4);
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test('dashboard accents and medals clear WCAG AA for text', () => {
  for (const id of ACCENT_IDS) {
    const light = LIGHT_INKS[id];
    const dark = DARK_INKS[id];
    assert.ok(contrast(light.ink, LIGHT_CANVAS) >= 4.5, `${id} light ink on white`);
    assert.ok(contrast(light.ink, LIGHT_PAGE) >= 4.5, `${id} light ink on page`);
    assert.ok(contrast(light.onFill, light.ink) >= 4.5, `${id} text on light fill`);
    assert.ok(contrast(dark.ink, DARK_CANVAS) >= 4.5, `${id} dark ink on canvas`);
    assert.ok(contrast(dark.ink, DARK_CARD) >= 4.5, `${id} dark ink on card`);
    assert.ok(contrast(dark.onFill, dark.ink) >= 4.5, `${id} text on dark fill`);
  }
  for (const id of MEDAL_IDS) {
    assert.ok(contrast(LIGHT_MEDALS[id].ink, LIGHT_MEDALS[id].fill) >= 4.5, `${id} light medal`);
    assert.ok(contrast(DARK_MEDALS[id].ink, DARK_MEDALS[id].fill) >= 4.5, `${id} dark medal`);
  }
});

test('globals.css carries the same accent and medal hexes', () => {
  const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
  for (const id of ACCENT_IDS) {
    assert.match(css, new RegExp(`--ps-${id}:\\s*${LIGHT_INKS[id].ink}`, 'i'));
    assert.match(css, new RegExp(`--ps-on-${id}:\\s*${LIGHT_INKS[id].onFill}`, 'i'));
    assert.match(css, new RegExp(`--ps-${id}:\\s*${DARK_INKS[id].ink}`, 'i'));
    assert.match(css, new RegExp(`--ps-on-${id}:\\s*${DARK_INKS[id].onFill}`, 'i'));
  }
  for (const id of MEDAL_IDS) {
    assert.match(css, new RegExp(`--medal-${id}:\\s*${LIGHT_MEDALS[id].fill}`, 'i'));
    assert.match(css, new RegExp(`--medal-${id}-ink:\\s*${LIGHT_MEDALS[id].ink}`, 'i'));
    assert.match(css, new RegExp(`--medal-${id}:\\s*${DARK_MEDALS[id].fill}`, 'i'));
  }
});
