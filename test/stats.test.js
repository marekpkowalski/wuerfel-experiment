import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../public/stats.js';

test('frequencies ignore empty slots', () => {
  assert.deepEqual(S.frequencies([1, 1, null, 6, 3]), [2, 0, 1, 0, 0, 1]);
});

test('run lengths from the specification example', () => {
  assert.deepEqual(S.runLengths([1, 1, 2, 2, 2]), { 2: 1, 3: 1 });
});

test('runs are broken at gaps', () => {
  // 4 and 4 are separated by an empty slot, so they are two runs of length 1.
  assert.deepEqual(S.runLengths([4, null, 4]), { 1: 2 });
  assert.deepEqual(S.runLengths([5, 5, null, null, 5, 2]), { 2: 1, 1: 2 });
  assert.deepEqual(S.runLengths([null, null]), {});
});

test('segments', () => {
  assert.deepEqual(S.segmentLengths([1, 2, null, 3, null, null, 4, 5, 6]), [2, 1, 3]);
});

test('expected runs account for every roll (sum of k * E[k] = n)', () => {
  for (const n of [1, 2, 5, 37, 100]) {
    let total = 0;
    for (let k = 1; k <= n; k++) total += k * S.expectedRunsInSegment(n, k);
    assert.ok(Math.abs(total - n) < 1e-9, `n=${n}: ${total}`);
  }
});

test('expected runs match a simulation', () => {
  // mulberry32: small seeded generator so the test is reproducible
  let a = 42;
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const trials = 20000;
  const counts = {};
  for (let i = 0; i < trials; i++) {
    const rolls = Array.from({ length: 100 }, () => 1 + Math.floor(rand() * 6));
    for (const [k, c] of Object.entries(S.runLengths(rolls))) counts[k] = (counts[k] || 0) + c;
  }
  const exp = S.expectedRuns([100]);
  for (const k of [1, 2, 3]) {
    const sim = counts[k] / trials;
    assert.ok(Math.abs(sim - exp[k]) / exp[k] < 0.05, `k=${k}: sim ${sim} vs exp ${exp[k]}`);
  }
});
