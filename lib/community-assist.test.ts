import assert from 'node:assert/strict';
import test from 'node:test';
import { channelSummaryPrompt } from './community-assist';

test('an empty channel does not ask ET AI for a summary', () => {
  assert.equal(channelSummaryPrompt(['', '  ']), '');
});

test('the prompt keeps the latest lines and asks for a suggested reply', () => {
  const prompt = channelSummaryPrompt(['hello', 'is the test tomorrow?']);
  assert.match(prompt, /suggested reply|suggest one reply/i);
  assert.match(prompt, /is the test tomorrow/);
});
