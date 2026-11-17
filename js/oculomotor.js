// Pure oculomotor metric functions, shared by the in-app face engine (face.js) and the
// evaluation kit (eval/). Units follow the input: eye-width ratio in the app, degrees
// in lab eye-tracker data. Relative thresholds are unit-free.

export const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
export const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
export const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

// Gaze dispersion around the mean during fixation.
export function fixationDispersion(h, v) {
  return Math.sqrt(sd(h) ** 2 + sd(v) ** 2);
}

// Linear fit of gaze (h) on target (tx): tracking correlation, gain and RMS residual.
export function pursuitFit(tx, h) {
  if (tx.length < 20) return { r: NaN, slope: NaN, resid: NaN };
  const mx = mean(tx), my = mean(h);
  let sxy = 0, sxx = 0, syy = 0;
  tx.forEach((x, i) => { sxy += (x - mx) * (h[i] - my); sxx += (x - mx) ** 2; syy += (h[i] - my) ** 2; });
  const slope = sxy / sxx;
  const r = Math.abs(sxy / Math.sqrt(sxx * syy));
  const resid = Math.sqrt(mean(tx.map((x, i) => (h[i] - (my + slope * (x - mx))) ** 2)));
  return { r, slope, resid };
}

// Saccade latency to target steps. series: [{t, h}] (valid samples, time-sorted, seconds);
// jumps: [{t}] step times; expected: expected gaze displacement for a step (same units as h).
export function saccadeLatencies(series, jumps, expected, { pre = 0.25, postFrom = 0.4, postTo = 0.8, minFrac = 0.4 } = {}) {
  const lat = [];
  let miss = 0;
  for (const j of jumps) {
    const preV = [], postV = [];
    for (const s of series) {
      if (s.t >= j.t - pre && s.t < j.t) preV.push(s.h);
      else if (s.t >= j.t + postFrom && s.t <= j.t + postTo) postV.push(s.h);
    }
    if (preV.length < 2 || postV.length < 2) continue;
    const p0 = mean(preV), d = mean(postV) - p0;
    const exp = typeof expected === 'function' ? expected(j) : expected;
    if (Math.abs(d) < minFrac * exp) { miss++; continue; }
    const hit = series.find((s) => s.t >= j.t && (s.h - p0) * Math.sign(d) >= 0.5 * Math.abs(d));
    if (hit) lat.push((hit.t - j.t) * 1000);
  }
  return { lat, miss };
}
