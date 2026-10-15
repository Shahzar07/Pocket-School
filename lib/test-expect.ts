import assert from 'node:assert/strict';

/** Small stand-in so community tests run under node:test. */
export function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      assert.equal(actual, expected);
    },
    toEqual(expected: unknown) {
      assert.deepEqual(actual, expected);
    },
    toBeNull() {
      assert.equal(actual, null);
    },
    toContain(item: unknown) {
      if (typeof actual === 'string') assert.ok(actual.includes(String(item)));
      else if (Array.isArray(actual)) assert.ok(actual.includes(item));
      else assert.fail('value cannot contain an item');
    },
    toBeGreaterThan(bound: number) {
      assert.equal(typeof actual, 'number');
      assert.ok(typeof actual === 'number' && actual > bound);
    },
    toHaveLength(length: number) {
      assert.ok(actual != null && typeof actual === 'object' && 'length' in actual);
      assert.equal((actual as { length: number }).length, length);
    },
    not: {
      toBeNull() {
        assert.notEqual(actual, null);
      },
    },
  };
}
