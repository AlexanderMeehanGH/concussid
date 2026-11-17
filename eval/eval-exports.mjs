#!/usr/bin/env node
// Accuracy of the full ConcussID decision on real assessments exported from the app.
//
// Usage: node eval/eval-exports.mjs --data concussid-export.json --labels labels.csv [--out results/exports.md]
//
// concussid-export.json – the "Export all data (JSON)" file from the Athletes page
//                          (or several, comma-separated)
// labels.csv columns:
//   assessment_id – the id of a pitchside assessment (shown in its report URL / JSON)
//   label         – concussed | control   (reference standard: diagnosis by a clinician,
//                   ideally confirmed at 24–48 h follow-up; NOT the app's own result)
//
// Every assessment is re-scored with the CURRENT rules (js/scoring.js) against the
// baseline that was on file at the time of the assessment.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { evaluate, scoreOf } from '../js/scoring.js';
import { parseCsv, confusion, auc, ci } from './lib/stats.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
if (!args.data || !args.labels) { console.error('Usage: node eval/eval-exports.mjs --data export.json --labels labels.csv [--out results/exports.md]'); process.exit(1); }

const athletes = args.data.split(',').flatMap((p) => { const j = JSON.parse(readFileSync(p, 'utf8')); return j.athletes || [j.athlete || j]; });
const labels = new Map(parseCsv(readFileSync(args.labels, 'utf8')).map((r) => [r.assessment_id, /^concuss/i.test(r.label)]));

const cases = [];
for (const a of athletes) {
  const baselines = [...(a.oldBaselines || []), a.baseline].filter(Boolean).sort((x, y) => x.date.localeCompare(y.date));
  for (const x of a.assessments || []) {
    if (!labels.has(x.id)) continue;
    const base = baselines.filter((b) => b.date <= x.date).pop() || null;
    const ev = evaluate(x, base);
    const s = scoreOf(x), b = base ? scoreOf(base) : null;
    cases.push({
      id: x.id, truth: labels.get(x.id), hasBaseline: !!base, decision: ev.decision,
      pred: ev.decision !== 'monitor',
      core: ev.decision === 'emergency' || ev.coreFlag,
      exp: ev.expFlag || ev.urgentFace,
      change: {
        symptomSeverityRise: b ? s.symSeverity - b.symSeverity : s.symSeverity,
        cognitiveDrop: b && s.cogTotal != null && b.cogTotal != null ? b.cogTotal - s.cogTotal : null,
        balanceRise: b && s.balance != null && b.balance != null ? s.balance - b.balance : null,
      },
    });
  }
}

const pos = cases.filter((c) => c.truth).length;
const all = confusion(cases), core = confusion(cases.map((c) => ({ ...c, pred: c.core }))), exp = confusion(cases.map((c) => ({ ...c, pred: c.exp })));
const row = (name, c) => `| ${name} | ${ci(c.sensitivity)} | ${ci(c.specificity)} |`;
const aucRow = (k, label) => {
  const a = auc(cases.filter((c) => c.truth).map((c) => c.change[k]), cases.filter((c) => !c.truth).map((c) => c.change[k]));
  return `| ${label} | ${Number.isFinite(a) ? a.toFixed(2) : '–'} |`;
};
const md = [
  '## Full decision on labelled ConcussID assessments', '',
  `Assessments: ${cases.length} (${pos} concussed, ${cases.length - pos} control) · with baseline: ${cases.filter((c) => c.hasBaseline).length}`, '',
  '| Rule set | Sensitivity | Specificity |', '|---|---|---|',
  row('Full ConcussID decision (remove or emergency)', all),
  row('Consensus components only (red flags, signs, Maddocks, symptoms, SAC, mBESS)', core),
  row('Experimental markers only (speech, eye movement, face)', exp),
  '', '| Continuous change from baseline | AUC |', '|---|---|',
  aucRow('symptomSeverityRise', 'Symptom severity increase'),
  aucRow('cognitiveDrop', 'Cognitive total (/50) drop'),
  aucRow('balanceRise', 'mBESS error increase'),
].join('\n');
console.log(md);
if (args.out) { mkdirSync(dirname(resolve(args.out)), { recursive: true }); writeFileSync(args.out, md); writeFileSync(args.out.replace(/\.md$/, '.json'), JSON.stringify(cases, null, 1)); }
