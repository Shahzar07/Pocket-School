import assert from 'node:assert/strict';
import test from 'node:test';
import { QUESTION_TYPES, questionTypeLabel } from './builder-copy';

test('exam question types use readable labels', () => {
  assert.equal(questionTypeLabel('multiple_choice'), 'Multiple choice');
  assert.equal(questionTypeLabel('true_false'), 'True or false');
  assert.equal(questionTypeLabel('short_answer'), 'Short answer');
  for (const item of QUESTION_TYPES) {
    assert.equal(item.label.includes('_'), false, item.id);
  }
});
