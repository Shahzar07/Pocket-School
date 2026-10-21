import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flowIndex, flowKeyTarget, flowNeighbor } from './steps';
import { PATHWAY_STEPS, pathwayHref } from './pathways';

const steps = [
  { id: 'question', label: 'Question' },
  { id: 'plan', label: 'Plan' },
  { id: 'write', label: 'Write' },
];

test('flow index and neighbours stay inside the trail', () => {
  assert.equal(flowIndex(steps, 'plan'), 1);
  assert.equal(flowIndex(steps, 'missing'), 0);
  assert.equal(flowNeighbor(steps, 'plan', -1)?.id, 'question');
  assert.equal(flowNeighbor(steps, 'plan', 1)?.id, 'write');
  assert.equal(flowNeighbor(steps, 'question', -1), null);
  assert.equal(flowNeighbor(steps, 'write', 1), null);
});

test('arrow keys skip typing and stop at the ends', () => {
  const typing = { key: 'ArrowRight', altKey: false, metaKey: false, ctrlKey: false, target: { tagName: 'INPUT' } };
  assert.equal(flowKeyTarget(typing, 3, 0), null);
  const plain = { key: 'ArrowLeft', altKey: false, metaKey: false, ctrlKey: false, target: { tagName: 'DIV' } };
  assert.equal(flowKeyTarget(plain, 3, 0), null);
  assert.equal(flowKeyTarget({ ...plain, key: 'ArrowRight' }, 3, 1), 2);
  assert.equal(flowKeyTarget({ ...plain, key: 'ArrowRight', metaKey: true }, 3, 1), null);
});

test('pathway pages keep a stable order', () => {
  assert.deepEqual(PATHWAY_STEPS.map((step) => step.id), ['primary', 'igcse', 'alevel', 'llb', 'mbbs', 'independent']);
  assert.equal(pathwayHref('igcse'), '/igcse');
  assert.equal(pathwayHref('studio'), null);
});
