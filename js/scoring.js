// ConcussID scoring and decision rules. Shared by the web app and the evaluation kit
// (eval/), so accuracy is always measured on exactly the logic the app runs.
import { RED_FLAGS, OBSERVABLE_SIGNS, SYMPTOMS, THRESHOLDS, SPEECH_TASKS, SPEECH_LABELS, FACE_LABELS } from './protocol.js';

export const sum = (a) => a.reduce((s, v) => s + (v || 0), 0);
export const fmt = (v) => (v == null || Number.isNaN(v) ? '—' : typeof v === 'number' ? (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100) : v);
export const gcsTotal = (d) => (d.redflags ? d.redflags.gcs.e + d.redflags.gcs.v + d.redflags.gcs.m : 15);
export const anyRed = (d) => !!d.redflags && (d.redflags.items.some(Boolean) || gcsTotal(d) < 15);
export const digitsScore = (c) => c.digits.filter((r) => r.r[0] === true || r.r[1] === true).length;
export const digitsDone = (c) => {
  for (const r of c.digits) {
    if (r.r[0] === false && r.r[1] === false) return true;
    if (!(r.r[0] === true || r.r[1] === true)) return false;
  }
  return true;
};

export function scoreOf(d) {
  const s = {};
  if (d.redflags) { s.redCount = d.redflags.items.filter(Boolean).length; s.gcs = gcsTotal(d); }
  if (d.observable) s.obsCount = d.observable.filter(Boolean).length;
  if (d.maddocks) s.maddocks = d.maddocks.filter((v) => v === true).length;
  if (d.symptoms) { s.symCount = d.symptoms.filter((v) => v > 0).length; s.symSeverity = sum(d.symptoms); }
  if (d.orientation) s.orientation = d.orientation.filter((v) => v === true).length;
  if (d.memory) s.immediate = sum(d.memory.trials.map((t) => t.filter(Boolean).length));
  if (d.conc) s.concentration = digitsScore(d.conc) + (d.conc.months ? 1 : 0);
  if (d.delayed) s.delayed = d.delayed.filter(Boolean).length;
  if (s.orientation != null && s.immediate != null && s.concentration != null && s.delayed != null) s.cogTotal = s.orientation + s.immediate + s.concentration + s.delayed;
  if (d.balance && !d.balance.skipped) s.balance = sum(d.balance.errors);
  return s;
}

// True if the change from baseline breaches the rule; null if it cannot be judged.
export function changeBad(val, base, rule) {
  if (val == null || base == null || !Number.isFinite(val) || !Number.isFinite(base) || !rule) return null;
  const diff = val - base, rel = base ? diff / Math.abs(base) : 0;
  const mag = rule.dir === 'down' ? -diff : rule.dir === 'up' ? diff : Math.abs(diff);
  const rmag = rule.dir === 'down' ? -rel : rule.dir === 'up' ? rel : Math.abs(rel);
  return (rule.abs != null && mag >= rule.abs) || (rule.rel != null && rmag >= rule.rel);
}

// Signed "badness" of a change, for ROC analysis: larger = more concerning.
export function changeScore(val, base, rule) {
  if (val == null || base == null || !Number.isFinite(val) || !Number.isFinite(base) || !rule) return null;
  const diff = rule.abs != null && rule.rel == null ? val - base : base ? (val - base) / Math.abs(base) : 0;
  return rule.dir === 'down' ? -diff : rule.dir === 'up' ? diff : Math.abs(diff);
}

// Experimental-marker flags only (speech + face). Used by evaluate() and by the eval kit.
export function speechFlags(speech, baseSpeech, T = THRESHOLDS) {
  const out = [];
  for (const t of SPEECH_TASKS) {
    const r = speech?.[t.k];
    if (!r?.quality?.ok) continue;
    const br = baseSpeech?.[t.k]?.quality?.ok ? baseSpeech[t.k].metrics : null;
    for (const [m, label] of Object.entries(SPEECH_LABELS[t.k])) {
      out.push({ task: t.k, taskTitle: t.title, metric: m, label, val: r.metrics[m], base: br?.[m], flag: changeBad(r.metrics[m], br?.[m], T.speech[m]) });
    }
  }
  return out;
}

export function faceFlags(face, baseFace, T = THRESHOLDS) {
  if (!face?.quality?.ok) return [];
  const fm = face.metrics, bf = baseFace?.quality?.ok ? baseFace.metrics : null;
  return Object.entries(FACE_LABELS).map(([m, label]) => {
    let flag = changeBad(fm[m], bf?.[m], T.face[m]);
    let urgent = false;
    if (m === 'smileAsym' && fm[m] != null && fm[m] >= T.smileAsymUrgent && (bf?.[m] == null || bf[m] < T.smileAsymUrgent)) { flag = true; urgent = true; }
    return { metric: m, label, val: fm[m], base: bf?.[m], flag, urgent };
  });
}

export function evaluate(d, baseline, T = THRESHOLDS) {
  const s = scoreOf(d), b = baseline ? scoreOf(baseline) : null;
  const rows = [], reasons = [];
  let emergency = false, core = false, exp = false, urgentFace = false;
  const match = d.mode === 'match';
  const add = (group, label, val, base, flag, kind = 'core') => rows.push({ group, label, val, base, flag, kind });

  if (d.redflags) {
    if (s.redCount) { emergency = true; reasons.push(`Red flag present: ${RED_FLAGS.filter((_, i) => d.redflags.items[i]).join('; ')}`); }
    if (s.gcs < 15) { emergency = true; reasons.push(`GCS ${s.gcs}/15`); }
    add('Immediate assessment', 'Red flags present', s.redCount, null, s.redCount > 0);
    add('Immediate assessment', 'Glasgow Coma Scale', s.gcs, null, s.gcs < 15);
  }
  if (d.observable) {
    if (s.obsCount) { core = true; reasons.push(`Observable sign: ${OBSERVABLE_SIGNS.filter((_, i) => d.observable[i]).join('; ')}`); }
    add('Immediate assessment', 'Observable signs', s.obsCount, null, s.obsCount > 0);
  }
  if (d.maddocks) {
    const bad = s.maddocks < 5;
    if (bad) { core = true; reasons.push(`Maddocks ${s.maddocks}/5 correct`); }
    add('Immediate assessment', 'Maddocks questions correct', `${s.maddocks}/5`, null, bad);
  }
  let symptom = null;
  if (d.symptoms) {
    symptom = symptomVerdict(d.symptoms, baseline?.symptoms, T);
    const flag = match ? !symptom.pass : null;
    if (flag) {
      core = true;
      reasons.push(`Weighted symptom score ${symptom.score}${symptom.hasBaseline ? ` (baseline ${symptom.base})` : ''}: up ${symptom.rise}, fail threshold is ${symptom.threshold}`);
    }
    add('Symptoms', 'Weighted symptom score (/132)', s.symSeverity, b?.symSeverity, flag);
    add('Symptoms', 'Number of symptoms (/22)', s.symCount, b?.symCount, null);
  }
  const cog = (label, key, drop, noBaseRule) => {
    if (s[key] == null) return;
    let flag = null;
    if (b?.[key] != null) flag = b[key] - s[key] >= drop;
    else if (noBaseRule) flag = noBaseRule(s[key]);
    if (flag && match) { core = true; reasons.push(`${label}: ${s[key]}${b?.[key] != null ? ` (baseline ${b[key]})` : ''}`); }
    add('Cognition', label, s[key], b?.[key], match ? flag : null);
  };
  cog('Orientation (/5)', 'orientation', T.orientationDrop, (v) => v < 5);
  cog('Immediate memory (/30)', 'immediate', T.immediateDrop);
  cog('Concentration (/5)', 'concentration', T.concentrationDrop);
  cog('Delayed recall (/10)', 'delayed', T.delayedDrop);
  if (s.cogTotal != null) add('Cognition', 'Cognitive total (/50)', s.cogTotal, b?.cogTotal, null);
  if (s.balance != null) {
    const flag = match && b?.balance != null ? s.balance - b.balance >= T.balanceIncrease : null;
    if (flag) { core = true; reasons.push(`Balance errors ${s.balance} (baseline ${b.balance})`); }
    add('Balance', 'mBESS total errors (/30)', s.balance, b?.balance, flag);
  }
  for (const f of speechFlags(d.speech, baseline?.speech, T)) {
    const flag = match ? f.flag : null;
    if (flag) { exp = true; reasons.push(`Speech — ${f.label}: ${fmt(f.val)} vs baseline ${fmt(f.base)}`); }
    add(`Speech · ${f.taskTitle}`, f.label, f.val, f.base, flag, 'exp');
  }
  for (const f of faceFlags(d.face, baseline?.face, T)) {
    const flag = match || f.urgent ? f.flag : null;
    if (f.urgent) { urgentFace = true; reasons.push('Marked facial (smile) asymmetry — urgent medical review to exclude focal neurological deficit.'); }
    else if (flag) { exp = true; reasons.push(`Eye movement — ${f.label}: ${fmt(f.val)} vs baseline ${fmt(f.base)}`); }
    add('Facial & eye movement', f.label, f.val, f.base, flag, 'exp');
  }
  let decision = 'monitor';
  if (emergency) decision = 'emergency';
  else if (core || exp || urgentFace) decision = 'remove';
  return { decision, coreFlag: core, expFlag: exp, expOnly: !core && exp && !urgentFace, urgentFace, reasons, rows, scores: s, symptom, hadBaseline: !!baseline };
}

// Severity band for one 0–6 rating (SCAT wording).
export const severityBand = (v) => (v <= 0 ? 'None' : v <= 2 ? 'Mild' : v <= 4 ? 'Moderate' : 'Severe');

// Weighted symptom score and pass/fail against the research threshold (THRESHOLDS.symptomSeverityRise).
export function symptomVerdict(symptoms, baseSymptoms, T = THRESHOLDS) {
  const score = sum(symptoms);
  const hasBaseline = Array.isArray(baseSymptoms);
  const base = hasBaseline ? sum(baseSymptoms) : 0;
  const rise = score - base;
  const threshold = T.symptomSeverityRise;
  return { score, base, rise, threshold, hasBaseline, pass: rise < threshold };
}
