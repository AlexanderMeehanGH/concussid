#!/usr/bin/env node
// Pipeline self-test with SYNTHETIC data whose answer is known in advance. It checks the kit's
// plumbing (WAV I/O, feature extraction, baseline pairing, scoring, statistics). It says nothing
// about clinical accuracy.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { writeWav } from './lib/wav.mjs';
import { runSpeechEval, speechReport } from './eval-speech.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'data/synthetic');
mkdirSync(dir, { recursive: true });
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const SR = 16000;

function voice(secs, f0, ampAt) {
  const x = new Float32Array(SR * secs);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR, a = ampAt(t);
    ph += (2 * Math.PI * f0 * (1 + 0.01 * Math.sin(2 * Math.PI * 5 * t))) / SR;
    x[i] = a * (0.5 * Math.sin(ph) + 0.25 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph)) + (rnd() - 0.5) * 0.003;
  }
  return x;
}
const vowel = (f0) => voice(6, f0, (t) => (t > 0.4 && t < 5.6 ? 0.5 : 0));
const ddk = (f0, rate, jitter) => {
  const onsets = []; for (let t = 0.4; t < 6.5; t += (1 / rate) * (1 + (rnd() - 0.5) * jitter)) onsets.push(t);
  return voice(7, f0, (t) => { const o = onsets.findLast((s) => s <= t); return o != null && t - o < 0.5 / rate ? 0.5 * Math.sin((Math.PI * (t - o)) / (0.5 / rate)) : 0; });
};

// 12 "controls" (follow-up ≈ baseline) and 12 "cases" (follow-up DDK slowed 25% and more irregular).
const rows = ['subject,session,task,label,file'];
for (let s = 0; s < 24; s++) {
  const isCase = s >= 12, f0 = 100 + rnd() * 120, rate = 5.2 + rnd() * 1.5;
  for (const sess of ['baseline', 'followup']) {
    const r = sess === 'followup' ? (isCase ? rate * 0.75 : rate * (1 + (rnd() - 0.5) * 0.08)) : rate;
    const jit = sess === 'followup' && isCase ? 0.35 : 0.05;
    const files = { vowel: vowel(f0 * (1 + (rnd() - 0.5) * 0.04)), ddk: ddk(f0, r, jit) };
    for (const [task, x] of Object.entries(files)) {
      const f = `s${s}_${sess}_${task}.wav`;
      writeWav(join(dir, f), x, SR);
      rows.push(`s${s},${sess},${task},${isCase ? 'concussed' : 'control'},${f}`);
    }
  }
}
writeFileSync(join(dir, 'manifest.csv'), rows.join('\n'));
const res = runSpeechEval(join(dir, 'manifest.csv'));
console.log(speechReport(res, 'SELF-TEST · synthetic speech (not real people)'));
const tp = res.cases.filter((c) => c.truth && c.pred).length, fp = res.cases.filter((c) => !c.truth && c.pred).length;

// Full-decision self-test: one athlete, baseline + a clearly abnormal and a normal assessment.
const yes = (n) => Array(n).fill(true);
const base = { id: 'b1', mode: 'baseline', date: '2026-01-01T10:00:00Z', symptoms: Array(22).fill(0), orientation: yes(5),
  memory: { list: 0, trials: [yes(8).concat([false, false]), yes(9).concat([false]), yes(10)] },
  conc: { digits: [3, 4, 5, 6].map((n, i) => ({ n, s: ['1', '2'], r: i < 3 ? [true, null] : [false, false] })), months: true },
  delayed: yes(8).concat([false, false]), balance: { errors: [0, 2, 3], skipped: false } };
const clean = { redflags: { items: Array(10).fill(false), gcs: { e: 4, v: 5, m: 6 } }, observable: Array(8).fill(false), maddocks: yes(5) };
const normal = { ...structuredClone(base), ...structuredClone(clean), id: 'a_normal', mode: 'match', date: '2026-03-01T15:00:00Z' };
const hurt = { ...structuredClone(normal), id: 'a_hurt', symptoms: [3, 2].concat(Array(20).fill(0)), maddocks: [true, false, true, true, true] };
writeFileSync(join(dir, 'export.json'), JSON.stringify({ athletes: [{ id: 'x', name: 'Synthetic', baseline: base, assessments: [normal, hurt] }] }));
writeFileSync(join(dir, 'labels.csv'), 'assessment_id,label\na_normal,control\na_hurt,concussed\n');
const out = execFileSync(process.execPath, [join(here, 'eval-exports.mjs'), '--data', join(dir, 'export.json'), '--labels', join(dir, 'labels.csv')], { encoding: 'utf8' });
console.log(out);

const okSpeech = tp >= 10 && fp <= 2;
const okExports = /Full ConcussID decision.*\| 100\.0% .*\| 100\.0% /.test(out);
console.log(`\nSelf-test: speech pipeline ${okSpeech ? 'PASS' : 'FAIL'} (${tp}/12 synthetic cases flagged, ${fp}/12 synthetic controls flagged); decision pipeline ${okExports ? 'PASS' : 'FAIL'}.`);
process.exit(okSpeech && okExports ? 0 : 1);
