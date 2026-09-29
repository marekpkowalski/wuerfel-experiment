// Statistics shared by the browser and the server (plain ES module, no dependencies).
//
// A team's rolls are stored as an array of 100 slots: a number 1–6, or null for
// "not entered yet". Gaps can occur when a student clears a single cell.

export const FACES = [1, 2, 3, 4, 5, 6];
export const P_FACE = 1 / 6;

export function isFace(v) {
  return Number.isInteger(v) && v >= 1 && v <= 6;
}

export function countRolls(rolls) {
  let n = 0;
  for (const r of rolls) if (r != null) n++;
  return n;
}

/** Counts per face, as an array [count of 1s, ..., count of 6s]. */
export function frequencies(rolls) {
  const f = [0, 0, 0, 0, 0, 0];
  for (const r of rolls) if (isFace(r)) f[r - 1]++;
  return f;
}

export function sumFrequencies(list) {
  const f = [0, 0, 0, 0, 0, 0];
  for (const x of list) for (let i = 0; i < 6; i++) f[i] += x[i];
  return f;
}

/**
 * Run lengths: a run is a maximal stretch of identical consecutive values.
 * [1,1,2,2,2] has one run of length 2 and one of length 3.
 *
 * Runs are broken at empty slots (null): rolls on both sides of a gap were not
 * rolled one after the other, so they must not be merged into one run.
 * Returns { length: numberOfRuns }.
 */
export function runLengths(rolls) {
  const out = {};
  let prev = null;
  let len = 0;
  const flush = () => {
    if (len > 0) out[len] = (out[len] || 0) + 1;
    len = 0;
  };
  for (const r of rolls) {
    if (r == null) {
      flush();
      prev = null;
      continue;
    }
    if (r === prev) {
      len++;
    } else {
      flush();
      len = 1;
    }
    prev = r;
  }
  flush();
  return out;
}

/** Lengths of the contiguous (gap-free) stretches of entered rolls. */
export function segmentLengths(rolls) {
  const segs = [];
  let len = 0;
  for (const r of rolls) {
    if (r == null) {
      if (len) segs.push(len);
      len = 0;
    } else {
      len++;
    }
  }
  if (len) segs.push(len);
  return segs;
}

/**
 * Expected number of runs of length exactly k in n consecutive rolls of a fair die.
 *   p = 1/6 (next roll repeats the previous one), q = 5/6
 *   A run touching one end of the sequence:  q * p^(k-1)      (two ends)
 *   A run in the interior:                   q^2 * p^(k-1)    (n-k-1 start positions)
 *   A single run covering everything (k = n): p^(n-1)
 */
export function expectedRunsInSegment(n, k) {
  const p = P_FACE;
  const q = 1 - p;
  if (k < 1 || k > n) return 0;
  if (k === n) return Math.pow(p, n - 1);
  return Math.pow(p, k - 1) * (2 * q + (n - k - 1) * q * q);
}

/** Expected run-length counts summed over several gap-free segments. */
export function expectedRuns(segLens) {
  const out = {};
  for (const n of segLens) {
    for (let k = 1; k <= n; k++) {
      const e = expectedRunsInSegment(n, k);
      if (e < 1e-4) break;
      out[k] = (out[k] || 0) + e;
    }
  }
  return out;
}

export function mergeCounts(list) {
  const out = {};
  for (const obj of list) for (const [k, v] of Object.entries(obj)) out[k] = (out[k] || 0) + v;
  return out;
}

/** Standard deviation of the count of one face in n fair rolls (binomial). */
export function countSd(n, p = P_FACE) {
  return Math.sqrt(n * p * (1 - p));
}
