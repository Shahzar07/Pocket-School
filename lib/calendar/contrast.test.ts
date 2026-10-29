import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const INK = '#122226';

function channel(hex: string, index: number): number {
  const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function contrast(foreground: string, background: string): number {
  const lum = (hex: string) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
  const lighter = Math.max(lum(foreground), lum(background));
  const darker = Math.min(lum(foreground), lum(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test('calendar subscription text clears WCAG AA on the dark ink card', () => {
  assert.ok(contrast('#1E6A83', INK) < 4.5);
  assert.ok(contrast('#E7F4F2', INK) >= 4.5);
  assert.ok(contrast('#8FB8B4', INK) >= 4.5);
  const source = readFileSync(new URL('../../components/calendar/google-sync.tsx', import.meta.url), 'utf8');
  assert.match(source, /const onInk = 'text-\[#1E6A83\] dark:text-\[#E7F4F2\]'/);
  const muted = source.split('\n').find(line => line.includes('const outlineMuted')) ?? '';
  assert.match(muted, /disabled:opacity-50/);
  assert.match(muted, /dark:disabled:opacity-100/);
  assert.match(muted, /dark:disabled:text-\[#8FB8B4\]/);
  const note = source.split('\n').find(line => line.includes('data-feed-note')) ?? '';
  const regenerate = source.split('\n').find(line => line.includes('data-action="google-regenerate"')) ?? '';
  const sync = source.split('\n').find(line => line.includes('data-action="google-sync"')) ?? '';
  assert.match(note, /onInk/);
  assert.match(regenerate, /outline/);
  assert.match(sync, /outlineMuted/);
  assert.equal(source.includes('text-[#3FE0D0]'), false);
});
