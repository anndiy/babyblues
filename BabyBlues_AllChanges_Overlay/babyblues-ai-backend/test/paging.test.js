import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllPages } from '../src/paging.js';

const fakeQuery = (total, failAt = null) => () => ({
  range: async (from, to) => {
    if (failAt !== null && from === failAt) return { data: null, error: { message: 'boom' } };
    const n = Math.max(0, Math.min(to, total - 1) - from + 1);
    return { data: Array.from({ length: n }, (_, i) => ({ i: from + i })), error: null };
  }
});

test('reads every page, not just the first 1000 rows', async () => {
  const r = await fetchAllPages(fakeQuery(2350));
  assert.equal(r.data.length, 2350);
  assert.equal(r.data[2349].i, 2349);
});
test('exact multiple of page size terminates', async () => {
  assert.equal((await fetchAllPages(fakeQuery(2000))).data.length, 2000);
});
test('empty result is fine', async () => {
  assert.equal((await fetchAllPages(fakeQuery(0))).data.length, 0);
});
test('a failing page returns the error and no partial data', async () => {
  const r = await fetchAllPages(fakeQuery(2500, 1000));
  assert.equal(r.data, null);
  assert.equal(r.error.message, 'boom');
});
test('flags truncation at the safety cap', async () => {
  const r = await fetchAllPages(fakeQuery(9000), { maxRows: 3000 });
  assert.equal(r.data.length, 3000);
  assert.equal(r.truncated, true);
});
