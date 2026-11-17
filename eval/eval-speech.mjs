#!/usr/bin/env node
// Accuracy of ConcussID's speech markers on a labelled set of WAV recordings.
//
// Usage: node eval/eval-speech.mjs --manifest recordings.csv [--out results/speech.md]
//
// recordings.csv columns:
//   subject  – participant ID
//   session  – "baseline" for the healthy reference session; any other value is a follow-up
//   task     – vowel | ddk | reading   (same tasks as the app)
//   label    – for follow-up rows: concussed | control   (ignored for baseline rows)
//   file     – path to a WAV file, relative to the manifest
//
// Each follow-up session is compared with the same subject's baseline using exactly the
// app's feature extraction (js/speech.js) and thresholds (js/protocol.js, js/scoring.js).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { analyzeSpeech } from '../js/speech.js';
import { speechFlags, changeScore } from '../js/scoring.js';
import { THRESHOLDS, SPEECH_LABELS } from '../js/protocol.js';
import { readWav } from './lib/wav.mjs';
import { parseCsv, confusion, auc, ci, quantile } from './lib/stats.mjs';


export function runSpeechEval(manifestPath) {
  const base = dirname(resolve(manifestPath));
  const rows = parseCsv(readFileSync(manifestPath, 'utf8'));
  const sessions = new Map(); // key subject|session → {subject, session, label, speech:{}}
  let failed = 0;
  for (const r of rows) {
    const key = `${r.subject}|${r.session}`;
    if (!sessions.has(key)) sessions.set(key, { subject: r.subject, session: r.session, label: r.label, speech: {} });
    try {
      const { samples, sr } = readWav(resolve(base, r.file));
      sessions.get(key).speech[r.task] = analyzeSpeech(samples, sr, r.task);
    } catch (e) { failed++; console.warn(`skip ${r.file}: ${e.message}`); }
  }
  const baselines = new Map([...sessions.values()].filter((s) => s.session === 'baseline').map((s) => [s.subject, s]));
  const cases = [];
  for (const s of sessions.values()) {
    if (s.session === 'baseline') continue;
    const b = baselines.get(s.subject);
    if (!b) { console.warn(`no baseline for ${s.subject}; skipped`); continue; }
    const flags = speechFlags(s.speech, b.speech);
    const judged = flags.filter((f) => f.flag != null);
    cases.push({
      subject: s.subject, session: s.session, truth: /^concuss/i.test(s.label),
      pred: judged.length ? judged.some((f) => f.flag) : null,
      flags, scores: Object.fromEntries(flags.map((f) => [`${f.task}.${f.metric}`, changeScore(f.val, f.base, THRESHOLDS.speech[f.metric])])),
    });
  }
  return { cases, failed, nRecordings: rows.length };
}

export function speechReport({ cases, failed, nRecordings }, title = 'Speech markers') {
  const c = confusion(cases);
  const nPos = cases.filter((x) => x.truth).length, nNeg = cases.length - nPos;
  const lines = [`## ${title}`, '', `Recordings: ${nRecordings} (${failed} unreadable) · follow-up sessions: ${cases.length} (${nPos} concussed, ${nNeg} control)`, ''];
  lines.push('**Rule: any speech marker beyond its threshold → flag**', '');
  lines.push(`- Sensitivity: ${ci(c.sensitivity)}  (${c.tp}/${c.tp + c.fn})`);
  lines.push(`- Specificity: ${ci(c.specificity)}  (${c.tn}/${c.tn + c.fp})`, '');
  lines.push('| Marker | Threshold | Flag rate in concussed | Flag rate in controls | AUC (change score) | Control 95th pct of change |', '|---|---|---|---|---|---|');
  for (const [task, labels] of Object.entries(SPEECH_LABELS)) {
    for (const [m, label] of Object.entries(labels)) {
      const key = `${task}.${m}`, rule = THRESHOLDS.speech[m];
      const get = (truth) => cases.filter((x) => x.truth === truth).map((x) => x.flags.find((f) => f.task === task && f.metric === m)).filter((f) => f && f.flag != null);
      const P = get(true), N = get(false);
      if (!P.length && !N.length) continue;
      const sc = (truth) => cases.filter((x) => x.truth === truth).map((x) => x.scores[key]);
      const a = auc(sc(true), sc(false));
      const thr = rule ? `${rule.dir} ${rule.abs != null ? `≥${rule.abs}` : `≥${rule.rel * 100}%`}` : 'none';
      lines.push(`| ${label} (${task}) | ${thr} | ${P.length ? `${P.filter((f) => f.flag).length}/${P.length}` : '–'} | ${N.length ? `${N.filter((f) => f.flag).length}/${N.length}` : '–'} | ${Number.isFinite(a) ? a.toFixed(2) : '–'} | ${rule ? fmtQ(quantile(sc(false), 0.95), rule) : '–'} |`);
    }
  }
  lines.push('', 'AUC 0.5 = no better than chance; 1.0 = perfect separation. The last column is the change that 95% of controls stay under (a data-driven threshold candidate).');
  return lines.join('\n');
}
const fmtQ = (q, rule) => (!Number.isFinite(q) ? '–' : rule.abs != null && rule.rel == null ? q.toFixed(3) : `${(q * 100).toFixed(1)}%`);

if (process.argv[1]?.replace(/\\/g, '/').endsWith('eval/eval-speech.mjs')) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
  if (!args.manifest) { console.error('Usage: node eval/eval-speech.mjs --manifest recordings.csv [--out results/speech.md]'); process.exit(1); }
  const res = runSpeechEval(args.manifest);
  const md = speechReport(res);
  console.log(md);
  if (args.out) { mkdirSync(dirname(resolve(args.out)), { recursive: true }); writeFileSync(args.out, md); writeFileSync(args.out.replace(/\.md$/, '.json'), JSON.stringify(res.cases, null, 1)); }
}
