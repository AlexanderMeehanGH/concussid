// Small statistics helpers for the ConcussID evaluation kit.

// Wilson score 95% confidence interval for a proportion k/n.
export function wilson(k, n, z = 1.96) {
  if (!n) return { p: NaN, lo: NaN, hi: NaN };
  const p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return { p, lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
}

// ROC AUC via Mann–Whitney U: probability a positive case scores higher than a negative one.
export function auc(pos, neg) {
  const P = pos.filter(Number.isFinite), N = neg.filter(Number.isFinite);
  if (!P.length || !N.length) return NaN;
  let u = 0;
  for (const p of P) for (const n of N) u += p > n ? 1 : p === n ? 0.5 : 0;
  return u / (P.length * N.length);
}

// Sensitivity / specificity of boolean predictions against boolean truth.
export function confusion(rows) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const { truth, pred } of rows) {
    if (pred == null) continue;
    if (truth && pred) tp++; else if (truth) fn++; else if (pred) fp++; else tn++;
  }
  return { tp, fp, tn, fn, sensitivity: wilson(tp, tp + fn), specificity: wilson(tn, tn + fp) };
}

// Threshold giving at most `alpha` false-alarm rate in a set of healthy change scores.
export function quantile(vals, q) {
  const s = vals.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

export const pct = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : 'n/a');
export const ci = (w) => (Number.isFinite(w.p) ? `${pct(w.p)} (95% CI ${pct(w.lo)}–${pct(w.hi)})` : 'n/a');

// Minimal CSV reader (no quoted commas needed for our files; handles quoted fields simply).
export function parseCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim().length);
  const split = (l) => {
    const out = []; let cur = '', q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => { const v = split(l); return Object.fromEntries(head.map((h, i) => [h, v[i]])); });
}
