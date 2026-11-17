#!/usr/bin/env node
// False-alarm rate of ConcussID's eye-movement markers in HEALTHY people.
//
// Data: Korthals, Visser & Kucharský (2026) "Eye movement benchmark data for smooth-pursuit
// classification", Scientific Data 13:375. OSF https://osf.io/zx7hc/ (10 healthy adults,
// EyeLink 1000 Plus @1000 Hz, chin rest, 144 trials in two identical blocks of 72).
//
// Design: block 1 (trials 1–72) is treated as the "baseline" and block 2 (73–144) as the
// "follow-up". Nobody is concussed, so every flag the app's rules raise is a FALSE ALARM.
// Metrics are computed with the app's own functions (js/oculomotor.js) and judged with the
// app's own thresholds (js/protocol.js THRESHOLDS.face via js/scoring.js changeBad).
//
// Usage: node eval/eval-eye-korthals.mjs [--data eval/data/korthals2026/clean] [--out eval/results/eye-healthy.md]
import { createReadStream, readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixationDispersion, pursuitFit, saccadeLatencies, mean, median } from '../js/oculomotor.js';
import { changeBad, changeScore } from '../js/scoring.js';
import { THRESHOLDS, FACE_LABELS } from '../js/protocol.js';
import { wilson, ci, quantile, parseCsv } from './lib/stats.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const DATA = resolve(args.data || join(here, 'data/korthals2026/clean'));
const OUT = resolve(args.out || join(here, 'results/eye-healthy.md'));

// Monitor geometry from the dataset authors' preprocessor (mm, px).
const MON = { width: 614, height: 365, distance: 700, res: [2560, 1440] };
const pix2deg = (px, size, res) => 2 * (180 / Math.PI) * Math.atan((px * (size / res)) / (2 * MON.distance));
const degX = (px) => pix2deg(px, MON.width, MON.res[0]);
const degY = (px) => pix2deg(px, MON.height, MON.res[1]);
const EXCLUDE = { '21db28aa': (n) => n >= 82 }; // not recalibrated after a break (authors' note)

async function loadGaze(file) {
  // → Map trial → {t:Float64Array (s from TARGET_ONSET), x, y (deg, centre origin, y up)}
  const trials = new Map();
  let cur = null, onset = null, inTrial = false;
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (first) { first = false; continue; }
    const c = line.split(',');
    const trial = +c[1], t = +c[2], msg = c[c.length - 1];
    if (msg.includes('TARGET_ONSET')) { onset = t; inTrial = true; cur = { t: [], x: [], y: [] }; trials.set(trial, cur); }
    if (inTrial && cur) {
      const gx = parseFloat(c[3]), gy = parseFloat(c[4]);
      cur.t.push((t - onset) / 1000);
      cur.x.push(Number.isFinite(gx) ? degX(gx - MON.res[0] / 2) : NaN);
      cur.y.push(Number.isFinite(gy) ? degY(MON.res[1] / 2 - gy) : NaN);
    }
    if (msg.includes('TARGET_OFFSET')) inTrial = false;
  }
  // Blink/artefact handling: drop samples within 50 ms of any missing sample, or off-screen.
  for (const g of trials.values()) {
    const n = g.t.length, bad = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(g.x[i]) || !Number.isFinite(g.y[i]) || Math.abs(g.x[i]) > 30 || Math.abs(g.y[i]) > 20) {
        for (let k = Math.max(0, i - 50); k <= Math.min(n - 1, i + 50); k++) bad[k] = 1;
      }
    }
    g.ok = bad;
  }
  return trials;
}

function loadTargets(file) {
  const m = new Map();
  for (const r of parseCsv(readFileSync(file, 'utf8'))) {
    const n = +r.trial_number;
    if (!m.has(n)) m.set(n, { t: [], x: [], y: [] });
    const o = m.get(n);
    o.t.push(+r.trial_time); o.x.push(degX(+r.target_x)); o.y.push(degY(+r.target_y));
  }
  return m;
}

// Target position at time t (step-hold interpolation, as displayed).
function targetAt(tg, t) {
  let lo = 0, hi = tg.t.length - 1;
  if (t <= tg.t[0]) return [tg.x[0], tg.y[0]];
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (tg.t[mid] <= t) lo = mid; else hi = mid - 1; }
  return [tg.x[lo], tg.y[lo]];
}

function blockMetrics(trials, targets, info, nums, step = 1) {
  const fixH = [], fixV = [], rs = [], resids = [], lats = [];
  let misses = 0, jumpsTotal = 0;
  for (const n of nums) {
    const g = trials.get(n), tg = targets.get(n), ti = info.get(n);
    if (!g || !tg || !ti) continue;
    const idx = [];
    for (let i = 0; i < g.t.length; i += step) if (!g.ok[i]) idx.push(i);
    if (ti.target_type === 'jumping_circle') {
      // Holds between target jumps (> 0.5° change).
      const jumps = [];
      for (let i = 1; i < tg.t.length; i++) {
        const d = Math.hypot(tg.x[i] - tg.x[i - 1], tg.y[i] - tg.y[i - 1]);
        if (d > 0.5) jumps.push({ t: tg.t[i], ux: (tg.x[i] - tg.x[i - 1]) / d, uy: (tg.y[i] - tg.y[i - 1]) / d, size: d });
      }
      const bounds = [0, ...jumps.map((j) => j.t), g.t[g.t.length - 1]];
      for (let k = 0; k < bounds.length - 1; k++) {
        const a = bounds[k] + 0.3, b = bounds[k + 1] - 0.05;
        const hx = [], hy = [];
        for (const i of idx) if (g.t[i] >= a && g.t[i] <= b) { hx.push(g.x[i]); hy.push(g.y[i]); }
        if (hx.length < 10) continue;
        const mx = mean(hx), my = mean(hy);
        hx.forEach((v) => fixH.push(v - mx)); hy.forEach((v) => fixV.push(v - my));
      }
      for (const j of jumps) {
        const series = idx.filter((i) => g.t[i] >= j.t - 0.3 && g.t[i] <= j.t + 0.85).map((i) => ({ t: g.t[i], h: g.x[i] * j.ux + g.y[i] * j.uy }));
        const r = saccadeLatencies(series, [j], j.size);
        jumpsTotal++; misses += r.miss; lats.push(...r.lat);
      }
    } else if (ti.target_type === 'moving_circle') {
      const [x0, y0] = [tg.x[0], tg.y[0]], [x1, y1] = [tg.x[tg.x.length - 1], tg.y[tg.y.length - 1]];
      const L = Math.hypot(x1 - x0, y1 - y0);
      if (L < 1) continue;
      const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
      const tx = [], h = [];
      for (const i of idx) {
        if (g.t[i] < 0.5) continue; // skip pursuit initiation
        const [px, py] = targetAt(tg, g.t[i]);
        tx.push(px * ux + py * uy); h.push(g.x[i] * ux + g.y[i] * uy);
      }
      const f = pursuitFit(tx, h);
      if (Number.isFinite(f.r)) { rs.push(f.r); resids.push(f.resid); }
    }
  }
  return {
    fixationDisp: fixationDispersion(fixH, fixV),
    pursuitR: mean(rs),
    pursuitResid: mean(resids),
    saccadeLatency: lats.length >= 3 ? median(lats) : NaN,
    saccadeMiss: misses,
    nJumps: jumpsTotal, nLat: lats.length, nPursuit: rs.length,
  };
}

const METRICS = ['fixationDisp', 'pursuitR', 'pursuitResid', 'saccadeLatency'];
const fmtRule = (r) => `${r.dir === 'down' ? 'drop' : 'rise'} ${r.abs != null ? `≥ ${r.abs}${r.abs >= 1 ? ' ms' : ''}` : `≥ ${r.rel * 100}%`}`;
const f3 = (v) => (Number.isFinite(v) ? (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(3)) : '–');

async function main() {
  if (!existsSync(DATA)) { console.error(`Data not found at ${DATA}. Download https://osf.io/zx7hc/ (clean folder) first.`); process.exit(1); }
  const people = ['train', 'test'].flatMap((s) => (existsSync(join(DATA, s)) ? readdirSync(join(DATA, s)).map((id) => ({ id, dir: join(DATA, s, id) })) : []));
  const results = [];
  for (const p of people) {
    process.stderr.write(`loading ${p.id}… `);
    const info = new Map(parseCsv(readFileSync(join(p.dir, `${p.id}_trials.csv`), 'utf8')).map((r) => [+r.trial_number, r]));
    const targets = loadTargets(join(p.dir, `${p.id}_targets.csv`));
    const gaze = await loadGaze(join(p.dir, `${p.id}_gaze.csv`));
    const excl = EXCLUDE[p.id] || (() => false);
    const A = [...Array(72).keys()].map((i) => i + 1).filter((n) => !excl(n));
    const B = [...Array(72).keys()].map((i) => i + 73).filter((n) => !excl(n));
    const usable = B.length >= 60;
    const row = { id: p.id, usable };
    for (const [hz, step] of [['1000Hz', 1], ['30Hz', 33]]) {
      row[hz] = { A: blockMetrics(gaze, targets, info, A, step), B: usable ? blockMetrics(gaze, targets, info, B, step) : null };
    }
    results.push(row);
    process.stderr.write('done\n');
  }

  const pairs = results.filter((r) => r.usable);
  const lines = [
    '## Eye-movement markers in healthy people (false-alarm study)', '',
    'Data: Korthals, Visser & Kucharský, *Scientific Data* 13:375 (2026), [OSF zx7hc](https://osf.io/zx7hc/). Healthy adults aged 22–27 years, EyeLink 1000 Plus at 1000 Hz, head on a chin rest.',
    `Each person did the same 72 trials twice, about 25 minutes apart. Block 1 is treated as the baseline and block 2 as the follow-up. **${pairs.length} people** are included; participant 21db28aa is excluded because the authors flag their second block as uncalibrated.`,
    'Nobody here is concussed, so **every flag is a false alarm**. The metrics come from the app\'s own `js/oculomotor.js` and the flags from its own thresholds.', '',
  ];
  for (const hz of ['1000Hz', '30Hz']) {
    lines.push(`### ${hz === '1000Hz' ? 'Full lab precision (1000 Hz)' : 'Downsampled to 30 Hz (webcam frame rate)'}`, '');
    lines.push('| Marker | App threshold | False alarms | Largest healthy change | Healthy change, 95th pct |', '|---|---|---|---|---|');
    const anyFlag = pairs.map(() => false);
    for (const m of METRICS) {
      const rule = THRESHOLDS.face[m];
      const flags = pairs.map((r, i) => { const f = changeBad(r[hz].B[m], r[hz].A[m], rule); if (f) anyFlag[i] = true; return f; }).filter((f) => f != null);
      const sc = pairs.map((r) => changeScore(r[hz].B[m], r[hz].A[m], rule));
      const k = flags.filter(Boolean).length;
      const isAbs = rule.abs != null && rule.rel == null;
      const show = (v) => (!Number.isFinite(v) ? '–' : isAbs ? `${v >= 0 ? '+' : ''}${f3(v)}${m === 'saccadeLatency' ? ' ms' : ''}` : `${(v * 100).toFixed(1)}%`);
      lines.push(`| ${FACE_LABELS[m].replace(/ \(.*\)/, '')} | ${fmtRule(rule)} | ${k}/${flags.length} | ${show(Math.max(...sc.filter(Number.isFinite)))} | ${show(quantile(sc, 0.95))} |`);
    }
    const w = wilson(anyFlag.filter(Boolean).length, pairs.length);
    lines.push('', `**Any eye-movement flag (what the app would act on): ${anyFlag.filter(Boolean).length}/${pairs.length} healthy people → false-alarm rate ${ci(w)}; specificity ${ci({ p: 1 - w.p, lo: 1 - w.hi, hi: 1 - w.lo })}.**`, '');
    lines.push('<details><summary>Per-person values</summary>', '', '| Person | Fixation A→B (°) | Pursuit r A→B | Pursuit error A→B (°) | Saccade latency A→B (ms) | Latencies measured |', '|---|---|---|---|---|---|');
    for (const r of pairs) {
      const a = r[hz].A, b = r[hz].B;
      lines.push(`| ${r.id} | ${f3(a.fixationDisp)} → ${f3(b.fixationDisp)} | ${f3(a.pursuitR)} → ${f3(b.pursuitR)} | ${f3(a.pursuitResid)} → ${f3(b.pursuitResid)} | ${f3(a.saccadeLatency)} → ${f3(b.saccadeLatency)} | ${a.nLat}/${a.nJumps}, ${b.nLat}/${b.nJumps} |`);
    }
    lines.push('', '</details>', '');
  }
  lines.push('### How to read this',
    '- This is a **best case**. The lab used a research-grade eye tracker, a chin rest, rested students and two sessions on the same day. Pitchside webcam tracking will be noisier, and athletes will be breathless, so real false-alarm rates are likely **higher**.',
    '- The tasks are close to the app\'s tasks but not identical. Pursuit here uses constant-speed straight lines rather than the app\'s 0.4 Hz back-and-forth sweep, and target jumps come every 1 s on a predictable rhythm, so latencies may be shorter.',
    '- With so few people, the confidence intervals are wide. The study can show that a threshold is clearly too tight, but it cannot prove that one is safe.',
    '- This tells you nothing about **sensitivity**, the share of concussions the app would catch. That needs labelled data from concussed players.');
  const md = lines.join('\n');
  console.log(md);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, md);
  writeFileSync(OUT.replace(/\.md$/, '.json'), JSON.stringify(results, null, 1));
}
main();
