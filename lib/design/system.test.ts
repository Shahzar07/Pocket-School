import assert from 'node:assert/strict';
import test from 'node:test';
import { friendlyError, sparksCostLine, TOKENS } from './system';

test('tokens keep the Poket School teal and ink', () => {
  assert.equal(TOKENS.color.teal, '#2786A4');
  assert.equal(TOKENS.color.ink, '#203337');
  assert.equal(TOKENS.motion.base, '220ms');
  assert.equal(TOKENS.color.page, '#F4F6F6');
  assert.equal(TOKENS.color.danger, '#B23B2E');
});

test('sparks copy explains the lock', () => {
  assert.equal(sparksCostLine(0), 'This does not spend Sparks.');
  assert.equal(sparksCostLine(15, 4), 'This uses 15 Sparks. You have 4, so this stays locked until you have enough.');
  assert.equal(sparksCostLine(1, 3), 'This uses 1 Spark. You have 3.');
});

test('friendly errors hide Firestore codes', () => {
  assert.equal(
    friendlyError(new Error('Missing or insufficient permissions.')),
    'You do not have access to this. Ask a teacher or the school if you should.',
  );
  assert.equal(
    friendlyError('FirebaseError: internal'),
    'Something went wrong on our side. Try again in a moment.',
  );
  assert.equal(friendlyError('Please choose a class.'), 'Please choose a class.');
});
