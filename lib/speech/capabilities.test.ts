import assert from 'node:assert/strict';
import { test } from 'node:test';
import { capabilityNotices, providerStatus } from './capabilities';

test('placeholder keys count as missing and notices name the provider', () => {
  const status = providerStatus({
    OPENROUTER_API_KEY: 'your_key',
    GEMINI_API_KEY: '',
    SPEECH_API_KEY: 'sk-real',
  });
  assert.deepEqual(status, { openrouter: false, gemini: false, speech: true });
  const notes = capabilityNotices(status);
  assert.equal(notes.some(note => note.includes('OPENROUTER_API_KEY') && note.includes('ET AI')), true);
  assert.equal(notes.some(note => note.includes('GEMINI_API_KEY')), true);
  assert.equal(notes.some(note => note.includes('SPEECH_API_KEY')), false);
});
