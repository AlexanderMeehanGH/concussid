import {
  REFS, RED_FLAGS, GCS, OBSERVABLE_SIGNS, MADDOCKS, SYMPTOMS, ORIENTATION, WORD_LISTS,
  BALANCE_STANCES, BALANCE_ERRORS, THRESHOLDS, SPEECH_TASKS, SPEECH_LABELS, FACE_LABELS,
} from './protocol.js';
import { recordAudio, analyzeSpeech } from './speech.js';
import { sum, fmt, gcsTotal, anyRed, digitsScore, digitsDone, scoreOf, evaluate, symptomVerdict, severityBand } from './scoring.js';
import { startCamera, stopCamera, initFace, runFaceProtocol, faceMetrics, detectOnce } from './face.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const refLink = (k) => `<a href="#/evidence" title="${esc(REFS[k]?.full)}">${esc(REFS[k]?.short)}</a>`;

// ---------- storage (local only) ----------
const KEY = 'concussid.v1';
let db = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || { athletes: [] }; } catch { return { athletes: [] }; } })();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('Storage unavailable', e); } };
const getAthlete = (id) => db.athletes.find((a) => a.id === id);

// ---------- event delegation ----------
let actions = {};
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled && actions[el.dataset.act]) actions[el.dataset.act](el, e);
});
app.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && actions[el.dataset.change]) actions[el.dataset.change](el, e);
});
app.addEventListener('submit', (e) => {
  const el = e.target.closest('[data-submit]');
  if (el && actions[el.dataset.submit]) { e.preventDefault(); actions[el.dataset.submit](el, e); }
});

// ---------- router ----------
let W = null; // active wizard
function route() {
  stopCamera();
  speechSynthesis?.cancel?.();
  const [v, a, b] = location.hash.replace(/^#\/?/, '').split('/');
  window.scrollTo(0, 0);
  actions = {};
  const nav = { athletes: 'athletes', athlete: 'athletes', evidence: 'evidence' }[v] || 'home';
  document.querySelectorAll('[data-nav]').forEach((l) => (l.dataset.nav === nav ? l.setAttribute('aria-current', 'page') : l.removeAttribute('aria-current')));
  document.body.classList.toggle('in-wizard', v === 'assess');
  if (v === 'athletes') return viewAthletes();
  if (v === 'athlete') return viewAthlete(a);
  if (v === 'assess') return startWizard(a, b);
  if (v === 'report') return viewReport(a, b);
  if (v === 'evidence') return viewEvidence();
  return viewHome();
}
window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', (e) => { if (W) { e.preventDefault(); e.returnValue = ''; } });

function quickAthlete() {
  const a = { id: uid(), name: `Unregistered player (${new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })})`, team: '', sport: '', created: Date.now(), baseline: null, assessments: [] };
  db.athletes.push(a); persist();
  return a;
}

// ---------- views ----------
const ICON = {
  arrow: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  close: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  phone: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>',
  check: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
  clock: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  alert: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  minus: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>',
  ok: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
  send: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>',
};
const initials = (name) => (String(name).match(/\d+/)?.[0] || String(name).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?');
const lastAssessment = (a) => a.assessments[a.assessments.length - 1];
// The baseline that was on file when an assessment was done.
const baselineFor = (a, x) => [...(a.oldBaselines || []), a.baseline].filter((b) => b && b.date <= x.date).sort((p, q) => p.date.localeCompare(q.date)).pop() || null;
const isUnderReview = (a) => { const x = lastAssessment(a); return x && x.eval?.decision !== 'monitor' && Date.now() - new Date(x.date) < 48 * 3600e3; };
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString(); };

function viewHome() {
  const squad = db.athletes.filter((a) => !a.name.startsWith('Unregistered player'));
  const review = db.athletes.filter(isUnderReview);
  const withBase = squad.filter((a) => a.baseline).length;
  const missing = squad.filter((a) => !a.baseline);
  app.innerHTML = `
  <section class="match-card">
    <div class="eyebrow"><span>Pitchside screen</span><span class="live"><span class="dot"></span>Works offline</span></div>
    <h1>Head knock?<br>Screen in about 10 minutes.</h1>
    <button class="cta-big" data-act="pick" aria-expanded="false" aria-controls="picker">
      <span><strong>Assess a player</strong><span>Red flags first · then quick checks</span></span>${ICON.arrow}
    </button>
    <div class="picker" id="picker" hidden>
      ${squad.map((a) => `<a class="picker-row" href="#/assess/${a.id}/match"><span class="avatar">${esc(initials(a.name))}</span>${esc(a.name)}<small>${a.baseline ? 'Baseline ✓' : 'No baseline'}</small></a>`).join('')}
      <button class="picker-row" data-act="quick"><span class="avatar">?</span>Player not in the squad list</button>
    </div>
  </section>

  ${review.length ? `<div class="section-head"><h2>Under review</h2><span class="small muted">${review.length} player${review.length > 1 ? 's' : ''}</span></div>
  <div class="list">${review.map((a) => { const x = lastAssessment(a); return `<a class="list-row" href="#/report/${a.id}/${x.id}"><span class="avatar ${x.eval.decision === 'emergency' ? 'red' : 'amber'}">${esc(initials(a.name))}</span><span class="grow"><span class="title">${esc(a.name)}</span><span class="sub">${x.eval.decision === 'emergency' ? 'Emergency' : 'Withdrawn from game'} · ${ago(x.date)} · re-check due</span></span>${ICON.arrow}</a>`; }).join('')}</div>` : ''}

  <div class="section-head"><h2>Squad baselines</h2><a class="small" href="#/athletes">${squad.length ? `${withBase} of ${squad.length} recorded` : 'Add your squad'}</a></div>
  ${squad.length ? `<div class="bar" style="margin-bottom:10px"><span style="width:${Math.round((withBase / squad.length) * 100)}%"></span></div>` : ''}
  ${missing.length ? `<div class="list">${missing.slice(0, 4).map((a) => `<a class="list-row" href="#/assess/${a.id}/baseline"><span class="avatar">${esc(initials(a.name))}</span><span class="grow"><span class="title">${esc(a.name)}</span><span class="sub">Tap to record baseline</span></span><span class="tag exp">No baseline</span></a>`).join('')}</div>`
    : squad.length ? '<p class="muted small">Every player has a baseline.</p>' : '<div class="card"><b>Start with your squad.</b><p class="muted small" style="margin:.3em 0 .8em">Record each player’s baseline pre-season so pitchside results can be compared with their own normal.</p><a class="btn primary sm" href="#/athletes">Add players</a></div>'}

  <div class="section-head"><h2>How it works</h2></div>
  <div class="steps4">
    <div class="card"><span class="tag">1</span><b>Baseline</b><span class="small muted">Record each player while healthy.</span></div>
    <div class="card"><span class="tag">2</span><b>Screen</b><span class="small muted">Red flags first, then quick checks.</span></div>
    <div class="card"><span class="tag">3</span><b>Compare</b><span class="small muted">Against the player’s own normal.</span></div>
    <div class="card"><span class="tag">4</span><b>Decide</b><span class="small muted">Emergency, remove, or keep watching.</span></div>
  </div>
  <div class="banner amber small" style="margin-top:18px"><b>Research prototype.</b> Not a regulated medical device and cannot diagnose concussion. A doctor makes the diagnosis; any player with a suspected concussion must be removed from play. <a href="#/evidence" style="color:inherit">Evidence &amp; limits</a></div>`;
  actions.pick = (el) => {
    if (!squad.length) return actions.quick();
    const p = $('#picker'); p.hidden = !p.hidden; el.setAttribute('aria-expanded', String(!p.hidden));
  };
  actions.quick = () => { location.hash = `#/assess/${quickAthlete().id}/match`; };
}

function viewAthletes() {
  const list = db.athletes.slice().sort((a, b) => a.name.localeCompare(b.name));
  app.innerHTML = `
  <h1>Squad</h1>
  <p class="lede">${list.length} player${list.length === 1 ? '' : 's'} · ${list.filter((a) => a.baseline).length} with a baseline</p>
  <div class="list">${list.map((a) => `
    <a class="list-row" href="#/athlete/${a.id}"><span class="avatar">${esc(initials(a.name))}</span>
      <span class="grow"><span class="title">${esc(a.name)}</span><span class="sub">${esc([a.team, a.sport].filter(Boolean).join(' · ') || '—')} · ${a.assessments.length} screen${a.assessments.length === 1 ? '' : 's'}</span></span>
      ${a.baseline ? '<span class="tag green">Baseline ✓</span>' : '<span class="tag exp">No baseline</span>'}</a>`).join('') || '<div class="list-row"><span class="muted">No players yet. Add one below.</span></div>'}</div>
  <details class="card" ${list.length ? '' : 'open'} style="margin-top:16px">
  <summary><b>Add a player</b><span class="tag">+</span></summary>
  <form data-submit="add">
    <div class="grid">
      <label class="field">Name<input name="name" required maxlength="80" autocomplete="off"></label>
      <label class="field">Team<input name="team" maxlength="80" autocomplete="off"></label>
      <label class="field">Sport<select name="sport"><option>Rugby union</option><option>Rugby league</option><option>Football (soccer)</option><option>Gaelic football</option><option>Hurling / camogie</option><option>Australian football</option><option>American football</option><option>Ice hockey</option><option>Other</option></select></label>
    </div>
    <button class="btn primary block">Add player</button>
  </form>
  </details>
  <div class="row gap no-print" style="margin-top:16px">
    <button class="btn sm" data-act="export">Export all data (JSON)</button>
  </div>`;
  actions.add = (form) => {
    const f = new FormData(form);
    db.athletes.push({ id: uid(), name: f.get('name').trim(), team: f.get('team').trim(), sport: f.get('sport'), created: Date.now(), baseline: null, oldBaselines: [], assessments: [] });
    persist(); viewAthletes();
  };
  actions.export = () => download('concussid-export.json', db);
}

function viewAthlete(id) {
  const a = getAthlete(id);
  if (!a) { location.hash = '#/athletes'; return; }
  const decTag = (d) => ({ emergency: '<span class="tag red">Emergency</span>', remove: '<span class="tag red">Withdrawn from game</span>', monitor: '<span class="tag green">No signs detected</span>' }[d] || '');
  app.innerHTML = `
  <div class="wiz-top"><a class="btn icon-btn" href="#/athletes" aria-label="Back to squad">${ICON.back}</a><span></span></div>
  <div class="row gap" style="margin-bottom:6px"><span class="avatar" style="width:56px;height:56px;font-size:1.2rem;border-radius:16px">${esc(initials(a.name))}</span><div><h1 style="margin:0">${esc(a.name)}</h1><span class="muted">${esc([a.team, a.sport].filter(Boolean).join(' · '))}</span></div></div>
  <div class="stack" style="margin:16px 0">
    <a class="btn primary lg block" href="#/assess/${a.id}/match">Pitchside screen ${ICON.arrow}</a>
    <a class="btn block" href="#/assess/${a.id}/baseline">${a.baseline ? 'Re-record baseline' : 'Record baseline'}</a>
  </div>
  <h2>Baseline</h2>
  ${a.baseline ? `<div class="card tight row spread"><span>Recorded ${new Date(a.baseline.date).toLocaleString()}</span><a href="#/report/${a.id}/${a.baseline.id}">View</a></div>` : '<p class="muted">No baseline recorded. Without one, ConcussID can only apply consensus red-flag, observable-sign, Maddocks and symptom rules; experimental markers cannot be interpreted.</p>'}
  <h2>Assessments</h2>
  ${a.assessments.length ? a.assessments.slice().reverse().map((x) => `<div class="card tight row spread"><span>${new Date(x.date).toLocaleString()} ${decTag(x.eval?.decision)}</span><a href="#/report/${a.id}/${x.id}">View report</a></div>`).join('') : '<p class="muted">None yet.</p>'}
  <div class="row gap no-print" style="margin-top:24px">
    <button class="btn sm" data-act="export">Export athlete (JSON)</button>
    <button class="btn sm ghost" data-act="del">Delete athlete</button>
  </div>`;
  actions.export = () => download(`concussid-${a.name.replace(/\W+/g, '_')}.json`, a);
  actions.del = () => {
    if (!confirm(`Permanently delete ${a.name} and all their records from this device? This cannot be undone.`)) return;
    db.athletes = db.athletes.filter((x) => x.id !== a.id); persist(); location.hash = '#/athletes';
  };
}

function download(name, obj) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- wizard ----------
const checkList = (name, items, vals) => `<div class="checklist">${items.map((t, i) => `
  <button type="button" class="check ${vals[i] ? 'on' : ''}" data-act="toggle" data-list="${name}" data-i="${i}" aria-pressed="${!!vals[i]}"><span>${esc(t)}</span><span class="pill">${vals[i] ? 'Present' : 'No'}</span></button>`).join('')}</div>`;
const ynRow = (label, val, act, i, yes = 'Correct', no = 'Incorrect') => `
  <div class="yn"><span>${esc(label)}</span><div class="seg">
    <button type="button" class="${val === true ? 'on good' : ''}" data-act="${act}" data-i="${i}" data-v="1">${yes}</button>
    <button type="button" class="${val === false ? 'on bad' : ''}" data-act="${act}" data-i="${i}" data-v="0">${no}</button>
  </div></div>`;
const randDigits = (n) => { let s = '', last = -1; while (s.length < n) { const d = Math.floor(Math.random() * 9) + 1; if (d !== last) { s += d; last = d; } } return s; };

function beep(freq = 880, ms = 250) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq; g.gain.value = 0.15; o.connect(g); g.connect(ctx.destination);
    o.start(); setTimeout(() => { o.stop(); ctx.close(); }, ms);
  } catch { /* audio not available */ }
}

function speakWords(words, btn) {
  if (!('speechSynthesis' in window)) { alert('Speech synthesis not available — read the words aloud at one per second.'); return; }
  speechSynthesis.cancel();
  btn.disabled = true;
  words.forEach((w, i) => setTimeout(() => {
    const u = new SpeechSynthesisUtterance(w); u.rate = 0.9; speechSynthesis.speak(u);
    if (i === words.length - 1) setTimeout(() => (btn.disabled = false), 1200);
  }, i * 1000));
}

// Weighted symptom score card: each symptom counts its own 0–6 severity; pass/fail vs baseline.
function symptomScoreCard(symptoms, baseSymptoms, judge, sticky = false) {
  const v = symptomVerdict(symptoms, baseSymptoms);
  const bands = { Mild: 0, Moderate: 0, Severe: 0 };
  symptoms.forEach((x) => { if (x > 0) bands[severityBand(x)]++; });
  const badge = judge ? (v.pass ? '<span class="score-pill">PASS</span>' : '<span class="score-pill bad">FAIL</span>') : '';
  return `<section class="card score-card ${sticky ? 'sticky' : ''} ${judge && !v.pass ? 'fail' : ''}" aria-live="polite">
    <div class="row spread gap"><span><span class="small muted">Weighted symptom score</span><br><b class="big-num">${v.score}</b><span class="muted"> / 132</span></span>${badge}</div>
    <div class="weights"><span><i class="w1"></i>${bands.Mild} mild (1–2 pts each)</span><span><i class="w3"></i>${bands.Moderate} moderate (3–4 pts)</span><span><i class="w5"></i>${bands.Severe} severe (5–6 pts)</span></div>
    ${judge ? `<p class="small" style="margin:8px 0 0">${v.hasBaseline ? `Baseline ${v.base} · change <b>${v.rise >= 0 ? '+' : ''}${v.rise}</b>` : '<b>No baseline</b>, compared with 0'} · fails at <b>+${v.threshold} or more</b> <span class="muted">(Harmon et al., 2024: catches 87% of concussions, clears 79% of healthy players)</span></p>` : ''}
  </section>`;
}

const STEPS = {
  redflags: {
    title: 'Any red flags?', refs: ['cisg2023', 'scat6', 'teasdale1974'],
    html(d) {
      d.redflags ??= { items: RED_FLAGS.map(() => false), gcs: { e: 4, v: 5, m: 6 } };
      const r = d.redflags, g = gcsTotal(d);
      return `<p class="lede">Tap any sign you see. One is enough for an emergency.</p>
      ${anyRed(d) ? `<div class="banner red" role="alert"><b>Emergency: call an ambulance.</b> Don’t move the player if the neck may be hurt; only trained staff should remove a helmet. <a href="tel:112"><b>Call 112</b></a></div>` : ''}
      ${checkList('rf', RED_FLAGS, r.items)}
      <details class="card" ${d.gcsOpen ? 'open' : ''} data-gcs>
        <summary><span><b>Glasgow Coma Scale</b><br><span class="small muted">Eyes ${r.gcs.e} · Verbal ${r.gcs.v} · Motor ${r.gcs.m}</span></span><span class="score-pill ${g < 15 ? 'bad' : ''}">${g} / 15</span></summary>
        ${['e', 'v', 'm'].map((k) => `<label class="field">${GCS[k].label}<select data-change="gcs" data-k="${k}">${GCS[k].options.map((o, ix) => { const val = GCS[k].options.length - ix; return `<option value="${val}" ${r.gcs[k] === val ? 'selected' : ''}>${val} – ${o}</option>`; }).join('')}</select></label>`).join('')}
      </details>`;
    },
  },
  observable: {
    title: 'Visible signs', refs: ['scat6', 'davis2019'],
    html(d) {
      d.observable ??= OBSERVABLE_SIGNS.map(() => false);
      return `<p class="lede">Seen directly or on video. Any one means the player comes off.</p>
      ${d.observable.some(Boolean) ? '<div class="banner red" role="alert"><b>Withdraw Player from Game.</b> Keep going to record findings for the doctor.</div>' : ''}
      ${checkList('obs', OBSERVABLE_SIGNS, d.observable)}`;
    },
  },
  maddocks: {
    title: 'Maddocks questions', refs: ['maddocks1995', 'scat6'],
    ready: (d) => d.maddocks.every((v) => v !== null),
    html(d) {
      d.maddocks ??= MADDOCKS.map(() => null);
      return `<p class="lede">Ask the player. Adapt the wording to your sport. Any wrong answer suggests concussion.</p>
      <div class="card">${MADDOCKS.map((q, i) => ynRow(q, d.maddocks[i], 'mad', i)).join('')}</div>`;
    },
  },
  symptoms: {
    title: 'Symptoms', refs: ['scat6'],
    html(d) {
      d.symptoms ??= SYMPTOMS.map(() => 0);
      d.symIdx ??= 0;
      const n = d.symptoms.filter((v) => v > 0).length, sev = sum(d.symptoms);
      const i = d.symIdx, s = SYMPTOMS[i];
      if (d.symList) {
        return `<div class="row spread gap"><p class="lede" style="margin:0">All symptoms · 0 = none, 6 = severe</p><button type="button" class="btn sm" data-act="symview">One at a time</button></div>
        ${symptomScoreCard(d.symptoms, W.athlete.baseline?.symptoms, W.mode === 'match', true)}
        <div class="card">${SYMPTOMS.map((x, k) => `<div class="sym"><span class="sym-name">${esc(x)}</span><div class="rate">${[0, 1, 2, 3, 4, 5, 6].map((v) => `<button type="button" class="${d.symptoms[k] === v ? `on ${v >= 4 ? 'hi' : ''}` : ''}" data-act="rate" data-i="${k}" data-v="${v}" aria-label="${esc(x)} ${v}">${v}</button>`).join('')}</div></div>`).join('')}</div>`;
      }
      return `<div class="row spread gap"><span class="player-pill">${ICON.phone} Player mode</span><button type="button" class="btn sm ghost" data-act="symview">See all</button></div>
      <p class="lede">Hand the phone to the player. <b style="color:var(--text)">How much do you feel this right now?</b></p>
      <section class="sym-card" aria-live="polite">
        <div><span class="count">Symptom ${i + 1} of ${SYMPTOMS.length}</span><h2>${esc(s)}</h2></div>
        <div class="scale">${[0, 1, 2, 3, 4, 5, 6].map((v) => `<button type="button" class="s${v} ${d.symptoms[i] === v && d.symTouched?.[i] ? 'on' : ''}" data-act="rate1" data-v="${v}" aria-label="${esc(s)}: ${v} out of 6">${v}</button>`).join('')}</div>
        <div class="scale-labels"><span>None</span><span>Mild</span><span>Moderate</span><span>Severe</span></div>
        <div class="sym-nav"><button type="button" class="btn sm" data-act="symprev" ${i === 0 ? 'disabled' : ''}>${ICON.back} Previous</button><button type="button" class="btn sm" data-act="symnext" ${i === SYMPTOMS.length - 1 ? 'disabled' : ''}>Next ${ICON.arrow}</button></div>
      </section>
      <div class="chips">${SYMPTOMS.map((x, k) => (d.symptoms[k] > 0 ? `<span class="chip warn">${esc(x)} · ${severityBand(d.symptoms[k])} ${d.symptoms[k]}</span>` : '')).join('')}${n ? '' : '<span class="chip">No symptoms so far</span>'}</div>
      <p class="small muted" style="margin-top:12px">Staff: tap “See all” for the weighted score and pass/fail. It is hidden here so it can’t influence the player’s answers.</p>`;
    },
  },
  orientation: {
    title: 'Orientation', refs: ['scat6', 'mccrea1998'],
    ready: (d) => d.orientation.every((v) => v !== null),
    html(d) {
      d.orientation ??= ORIENTATION.map(() => null);
      return `<div class="card">${ORIENTATION.map((q, i) => ynRow(q, d.orientation[i], 'ori', i)).join('')}</div>`;
    },
  },
  memory: {
    title: 'Immediate memory', refs: ['scat6', 'mccrea1998'],
    html(d) {
      if (!d.memory) {
        const prev = W.athlete.baseline?.memory?.list;
        const opts = WORD_LISTS.map((_, i) => i).filter((i) => i !== prev);
        d.memory = { list: opts[Math.floor(Math.random() * opts.length)], trials: [0, 1, 2].map(() => Array(10).fill(false)) };
      }
      const words = WORD_LISTS[d.memory.list];
      return `<div class="banner info small">Say: “I’ll read a list of words. When I finish, say back as many as you can, in any order.” Read at one word per second. Complete all 3 trials even if every word is recalled. Do not mention a later recall test.</div>
      ${d.memory.trials.map((t, ti) => `
        <div class="card"><div class="row spread gap"><h3 style="margin:0">Trial ${ti + 1} <span class="muted small">· ${t.filter(Boolean).length}/10</span></h3>
          <button class="btn sm" type="button" data-act="speak">Read list aloud</button></div>
          <p class="muted small" style="margin:.5em 0">Tap each word the player recalls.</p>
          <div class="words">${words.map((w, wi) => `<button type="button" class="word ${t[wi] ? 'on' : ''}" data-act="word" data-t="${ti}" data-i="${wi}">${w}</button>`).join('')}</div>
        </div>`).join('')}
      <div class="sticky-sum">Immediate memory: ${sum(d.memory.trials.map((t) => t.filter(Boolean).length))} / 30</div>`;
    },
  },
  concentration: {
    title: 'Concentration', refs: ['scat6', 'mccrea1998'],
    ready: (d) => digitsDone(d.conc) && d.conc.months !== null,
    html(d) {
      d.conc ??= { digits: [3, 4, 5, 6].map((n) => ({ n, s: [randDigits(n), randDigits(n)], r: [null, null] })), months: null };
      const c = d.conc;
      let rows = '';
      for (const [ri, r] of c.digits.entries()) {
        rows += `<div class="yn"><span><span class="muted small">${r.n} digits</span><br><span class="digits">${r.s[0]}</span></span><div class="seg">
          <button type="button" class="${r.r[0] === true ? 'on good' : ''}" data-act="dig" data-r="${ri}" data-k="0" data-v="1">Correct</button>
          <button type="button" class="${r.r[0] === false ? 'on bad' : ''}" data-act="dig" data-r="${ri}" data-k="0" data-v="0">Incorrect</button></div></div>`;
        if (r.r[0] === false) {
          rows += `<div class="yn"><span><span class="muted small">${r.n} digits — 2nd attempt</span><br><span class="digits">${r.s[1]}</span></span><div class="seg">
          <button type="button" class="${r.r[1] === true ? 'on good' : ''}" data-act="dig" data-r="${ri}" data-k="1" data-v="1">Correct</button>
          <button type="button" class="${r.r[1] === false ? 'on bad' : ''}" data-act="dig" data-r="${ri}" data-k="1" data-v="0">Incorrect</button></div></div>`;
        }
        const pass = r.r[0] === true || r.r[1] === true;
        if (!pass) break;
      }
      return `<div class="card"><h3>Digits backwards</h3>
        <p class="muted small">Read the digits at one per second; the player repeats them in reverse order. Stop after two failures at the same length.</p>
        ${rows}<p class="small" style="margin-top:8px"><b>Score: ${digitsScore(c)} / 4</b></p></div>
      <div class="card"><h3>Months in reverse</h3>
        <p class="muted small">“Tell me the months of the year in reverse order, starting with December.” 1 point if correct, with no errors, within 30 s.</p>
        <div class="row gap" style="margin-bottom:8px"><button type="button" class="btn sm" data-act="mtimer">Start 30 s timer</button><span class="timer" id="mt">30</span></div>
        ${ynRow('Result', c.months, 'months', 0)}</div>`;
    },
  },
  balance: {
    title: 'Balance (mBESS)', refs: ['riemann2000', 'scat6'],
    html(d) {
      d.balance ??= { errors: [0, 0, 0], skipped: false };
      const b = d.balance;
      return `<p class="muted">Each stance lasts 20 seconds on a firm surface, without footwear if practical. ${BALANCE_ERRORS}</p>
      <button type="button" class="check good ${b.skipped ? 'on' : ''}" data-act="balskip" aria-pressed="${b.skipped}"><span>Not possible here (unsafe surface or player unable)</span><span class="pill">${b.skipped ? 'Skipped' : 'Off'}</span></button>
      ${b.skipped ? '' : BALANCE_STANCES.map((s, i) => `<div class="card"><div class="row spread gap"><div><h3 style="margin:0">${s.name}</h3><span class="muted small">${s.how}</span></div>
        <div class="row gap"><button type="button" class="btn sm" data-act="btimer" data-i="${i}">Start 20 s</button><span class="timer" id="bt${i}">20</span></div></div>
        <div class="counter" style="margin-top:10px"><span class="muted">Errors</span><button type="button" class="btn sm" data-act="berr" data-i="${i}" data-v="-1" aria-label="Fewer errors">−</button><b>${b.errors[i]}</b><button type="button" class="btn sm" data-act="berr" data-i="${i}" data-v="1" aria-label="More errors">+</button></div></div>`).join('')}
      ${b.skipped ? '' : `<div class="sticky-sum">Total errors: ${sum(b.errors)} / 30</div>`}`;
    },
  },
  speech: {
    title: 'Speech test', refs: ['falcone2013', 'daudet2017', 'talkar2020', 'dejong2009'], exp: true,
    html(d) {
      d.speech ??= {};
      const C = 2 * Math.PI * 38;
      return `<p class="lede">Find the quietest spot and hold the phone about 20 cm from the mouth. Audio is analysed on this phone and never saved.</p>
      ${SPEECH_TASKS.map((t) => {
        const r = d.speech[t.k];
        const chip = r ? (r.quality.ok ? `<span class="chip ok">${ICON.check} Done</span>` : '<span class="chip warn">Redo</span>') : `<span class="chip">${t.secs} s</span>`;
        return `<div class="card task" id="sp-${t.k}">
          <div class="task-head"><h3>${t.title}</h3>${chip}</div>
          <p class="prompt">${esc(t.prompt)}</p>
          <div class="task-body">
            <div class="ring"><svg viewBox="0 0 88 88" aria-hidden="true"><circle class="track" cx="44" cy="44" r="38" fill="none" stroke-width="8"/><circle class="fill" id="rg-${t.k}" cx="44" cy="44" r="38" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${r ? 0 : C}"/></svg><b id="rn-${t.k}">${r ? '✓' : t.secs}</b></div>
            <div style="flex:1;min-width:0">
              <button type="button" class="btn ${r ? '' : 'primary'} block" data-act="rec" data-k="${t.k}">${r ? 'Record again' : 'Start recording'}</button>
              <div class="meter" aria-hidden="true"><span id="lv-${t.k}"></span></div>
              <div class="small muted" id="st-${t.k}" aria-live="polite">${r ? (r.quality.ok ? 'Recorded.' : 'Couldn’t use this one, please record again.') : 'Ready when you are.'}</div>
            </div>
          </div>
          ${r ? `${r.quality.msg ? `<p class="small" style="color:var(--amber);margin:0">${esc(r.quality.msg)}</p>` : ''}<details><summary class="small muted" style="cursor:pointer">Measurements</summary><div class="metrics" style="margin-top:8px">${Object.entries(SPEECH_LABELS[t.k]).map(([m, l]) => `<span class="metric">${l}: <b>${fmt(r.metrics[m])}</b></span>`).join('')}</div></details>` : ''}
        </div>`;
      }).join('')}`;
    },
  },
  face: {
    title: 'Eye-movement test', refs: ['mucha2014', 'maruta2014', 'galetta2011', 'kartynnik2019'], exp: true,
    html(d) {
      const r = d.face;
      return `<p class="lede">Prop the phone at eye level, about 40 cm away, in even light. The player follows a red dot with their <b style="color:var(--text)">eyes only</b> for 35 seconds. Video never leaves this phone.</p>
      <div class="cam-wrap"><video id="cam" playsinline muted></video>
        <div class="oval" aria-hidden="true"><svg width="46%" viewBox="0 0 190 250"><ellipse cx="95" cy="125" rx="86" ry="116" fill="none" stroke="#7EE0C3" stroke-width="3" stroke-dasharray="10 9"/></svg></div>
        <span class="cam-status" id="camst"><span class="dot"></span>Camera off</span></div>
      <ul class="ready" aria-live="polite">
        <li id="rd-cam">${ICON.clock}Camera</li>
        <li id="rd-face">${ICON.clock}Face found</li>
        <li id="rd-model">${ICON.clock}Analyser ready</li>
      </ul>
      <div class="stack">
        <button type="button" class="btn lg block" data-act="camon" id="camon">Turn on camera</button>
        <button type="button" class="btn primary lg block" data-act="facerun" id="facerun" disabled>Start 35-second test</button>
      </div>
      <div id="faceres">${faceResultHtml(r)}</div>`;
    },
  },
  delayed: {
    title: 'Delayed recall', refs: ['scat6', 'mccrea1998'],
    html(d) {
      d.delayed ??= Array(10).fill(false);
      const mins = d.memoryDoneAt ? (Date.now() - d.memoryDoneAt) / 60000 : 0;
      const words = WORD_LISTS[d.memory.list];
      return `${mins < 5 ? `<div class="banner amber small">Only ${mins.toFixed(1)} min since immediate memory. SCAT6 requires at least 5 minutes — wait if you can. <button type="button" class="btn sm" data-act="refresh">Refresh</button></div>` : `<p class="muted">${Math.round(mins)} min since immediate memory.</p>`}
      <div class="banner info small">Say: “Do you remember the list of words I read earlier? Tell me as many as you can, in any order.” Do not read the list.</div>
      <div class="card"><div class="words">${words.map((w, i) => `<button type="button" class="word ${d.delayed[i] ? 'on' : ''}" data-act="dword" data-i="${i}">${w}</button>`).join('')}</div>
      <p class="small" style="margin-top:10px"><b>Delayed recall: ${d.delayed.filter(Boolean).length} / 10</b></p></div>`;
    },
  },
};

function faceResultHtml(r) {
  if (!r) return '';
  return `<div class="card"><div class="task-head"><h3>Test recorded</h3>${r.quality.ok ? `<span class="chip ok">${ICON.check} Done</span>` : '<span class="chip warn">Redo</span>'}</div>
    ${r.quality.msg ? `<p class="small" style="color:var(--amber)">${esc(r.quality.msg)}</p>` : ''}
    <div class="metrics">${Object.entries(FACE_LABELS).map(([m, l]) => `<span class="metric">${l}: <b>${fmt(r.metrics[m])}</b></span>`).join('')}</div>
    <p class="small muted" style="margin-top:8px">Frame rate ${fmt(r.metrics.fps)} fps · face detected in ${Math.round((r.metrics.detectRate || 0) * 100)}% of frames. You can re-run the test.</p></div>`;
}

function startWizard(id, mode) {
  const athlete = getAthlete(id);
  if (!athlete || !['match', 'baseline'].includes(mode)) { location.hash = '#/athletes'; return; }
  const steps = mode === 'baseline'
    ? ['symptoms', 'orientation', 'memory', 'concentration', 'balance', 'speech', 'face', 'delayed']
    : ['redflags', 'observable', 'maddocks', 'symptoms', 'orientation', 'memory', 'concentration', 'balance', 'speech', 'face', 'delayed'];
  W = { athlete, mode, steps, i: 0, data: { id: uid(), mode, date: new Date().toISOString() } };
  renderStep();
}

function renderStep() {
  const key = W.steps[W.i], st = STEPS[key];
  const mins = Math.floor((Date.now() - new Date(W.data.date)) / 60000);
  app.innerHTML = `
    <div class="wiz-top">
      <button type="button" class="btn icon-btn" data-act="${W.i === 0 ? 'abort' : 'back'}" aria-label="${W.i === 0 ? 'Exit screen' : 'Previous step'}">${ICON.back}</button>
      <div class="who"><b>${esc(W.athlete.name)}</b><span>${W.mode === 'baseline' ? 'Baseline' : 'Pitchside'} · step ${W.i + 1} of ${W.steps.length} · ${mins} min</span></div>
      <button type="button" class="btn icon-btn ghost" data-act="abort" aria-label="Exit without saving">${ICON.close}</button>
    </div>
    <div class="segs" aria-hidden="true">${W.steps.map((_, k) => `<span class="${k < W.i ? 'done' : k === W.i ? 'now' : ''}"></span>`).join('')}</div>
    <div class="step-title"><h1>${st.title}</h1>${st.exp ? '<span class="tag exp">Experimental</span>' : ''}</div>
    <div id="stepBody">${st.html(W.data)}</div>
    <div class="refs-line">Sources: ${st.refs.map(refLink).join(' · ')}</div>
    <div class="wiz-nav">${W.i > 0 ? '<button type="button" class="btn" data-act="back">Back</button>' : ''}
      <button type="button" class="btn primary" data-act="next" id="nextBtn">Next</button></div>`;
  actions = { ...wizActions };
  updateNext();
}

function refresh() {
  const y = window.scrollY;
  $('#stepBody').innerHTML = STEPS[W.steps[W.i]].html(W.data);
  window.scrollTo(0, y);
  updateNext();
}

function updateNext() {
  const key = W.steps[W.i], st = STEPS[key], btn = $('#nextBtn'), d = W.data;
  const last = W.i === W.steps.length - 1;
  btn.disabled = st.ready ? !st.ready(d) : false;
  btn.className = 'btn primary';
  let label = last ? (W.mode === 'baseline' ? 'Save baseline' : 'See result') : 'Continue';
  if (key === 'redflags') {
    if (anyRed(d)) { label = 'Emergency · end screen'; btn.className = 'btn danger'; } else label = 'None seen · continue';
  } else if (key === 'observable') label = d.observable.some(Boolean) ? 'Noted · continue' : 'None seen · continue';
  else if (key === 'symptoms' && !d.symList && d.symIdx < SYMPTOMS.length - 1) label = d.symIdx === 0 ? 'No symptoms · continue' : `Rest are none · continue`;
  else if ((key === 'speech' && !Object.keys(d.speech || {}).length) || (key === 'face' && !d.face)) label = 'Skip this test';
  else if (st.ready && btn.disabled) label = 'Answer all to continue';
  btn.textContent = label;
}

let timers = [];
const clearTimers = () => { timers.forEach(clearInterval); timers = []; };
function countdown(el, secs, done) {
  const t0 = Date.now();
  const iv = setInterval(() => {
    const left = Math.max(0, secs - (Date.now() - t0) / 1000);
    if (el) el.textContent = Math.ceil(left);
    if (left <= 0) { clearInterval(iv); beep(); done?.(); }
  }, 100);
  timers.push(iv);
}

const wizActions = {
  abort() { if (confirm('Exit without saving this assessment?')) { const id = W.athlete.id; W = null; clearTimers(); location.hash = `#/athlete/${id}`; } },
  back() { clearTimers(); stopCamera(); W.i--; renderStep(); window.scrollTo(0, 0); },
  next() {
    clearTimers(); stopCamera(); speechSynthesis?.cancel?.();
    const key = W.steps[W.i];
    if (key === 'memory' && !W.data.memoryDoneAt) W.data.memoryDoneAt = Date.now();
    if ((key === 'redflags' && anyRed(W.data)) || W.i === W.steps.length - 1) return finishWizard();
    W.i++; renderStep(); window.scrollTo(0, 0);
  },
  refresh,
  toggle(el) {
    const i = +el.dataset.i;
    const arr = el.dataset.list === 'rf' ? W.data.redflags.items : W.data.observable;
    arr[i] = !arr[i]; refresh();
  },
  gcs(el) { W.data.redflags.gcs[el.dataset.k] = +el.value; W.data.gcsOpen = true; refresh(); },
  rate1(el) {
    const d = W.data, i = d.symIdx;
    d.symptoms[i] = +el.dataset.v;
    (d.symTouched ??= {})[i] = true;
    if (i < SYMPTOMS.length - 1) d.symIdx = i + 1;
    refresh();
  },
  symprev() { W.data.symIdx = Math.max(0, W.data.symIdx - 1); refresh(); },
  symnext() { W.data.symIdx = Math.min(SYMPTOMS.length - 1, W.data.symIdx + 1); refresh(); },
  symview() { W.data.symList = !W.data.symList; refresh(); },
  mad(el) { W.data.maddocks[+el.dataset.i] = el.dataset.v === '1'; refresh(); },
  ori(el) { W.data.orientation[+el.dataset.i] = el.dataset.v === '1'; refresh(); },
  rate(el) { W.data.symptoms[+el.dataset.i] = +el.dataset.v; refresh(); },
  speak(el) { speakWords(WORD_LISTS[W.data.memory.list], el); },
  word(el) { const t = W.data.memory.trials[+el.dataset.t]; t[+el.dataset.i] = !t[+el.dataset.i]; refresh(); },
  dword(el) { W.data.delayed[+el.dataset.i] = !W.data.delayed[+el.dataset.i]; refresh(); },
  dig(el) {
    const r = W.data.conc.digits[+el.dataset.r], k = +el.dataset.k;
    r.r[k] = el.dataset.v === '1';
    if (k === 0 && r.r[0]) r.r[1] = null;
    // Clear later rows if an earlier row changed to a stop condition.
    const idx = +el.dataset.r;
    if (!(r.r[0] === true || r.r[1] === true)) W.data.conc.digits.slice(idx + 1).forEach((x) => (x.r = [null, null]));
    refresh();
  },
  months(el) { W.data.conc.months = el.dataset.v === '1'; clearTimers(); refresh(); },
  mtimer(el) { el.disabled = true; countdown($('#mt'), 30, () => (el.disabled = false)); },
  btimer(el) { el.disabled = true; countdown($(`#bt${el.dataset.i}`), 20, () => (el.disabled = false)); },
  berr(el) { const e = W.data.balance.errors, i = +el.dataset.i; e[i] = Math.max(0, Math.min(10, e[i] + +el.dataset.v)); refresh(); },
  balskip() { W.data.balance.skipped = !W.data.balance.skipped; refresh(); },
  async rec(el) {
    const k = el.dataset.k, task = SPEECH_TASKS.find((t) => t.k === k);
    const st = $(`#st-${k}`), lv = $(`#lv-${k}`), rg = $(`#rg-${k}`), rn = $(`#rn-${k}`);
    const C = 2 * Math.PI * 38;
    app.querySelectorAll('[data-act="rec"]').forEach((b) => (b.disabled = true));
    $('#nextBtn').disabled = true;
    try {
      rg.style.strokeDashoffset = C;
      for (let n = 3; n > 0; n--) { st.textContent = 'Get ready…'; rn.textContent = n; await new Promise((r) => setTimeout(r, 1000)); }
      beep(660, 150);
      const { samples, sr } = await recordAudio(task.secs, (el2, level) => {
        st.textContent = level > 0.02 ? 'Recording · good level' : 'Recording · speak up';
        rn.textContent = Math.ceil(task.secs - el2);
        rg.style.strokeDashoffset = C * (1 - el2 / task.secs);
        lv.style.width = `${Math.min(100, level * 400)}%`;
      });
      st.textContent = 'Analysing…';
      await new Promise((r) => setTimeout(r, 30));
      W.data.speech[k] = analyzeSpeech(samples, sr, k);
    } catch (err) {
      st.textContent = `Microphone error: ${err.message}`;
      app.querySelectorAll('[data-act="rec"]').forEach((b) => (b.disabled = false));
      $('#nextBtn').disabled = false;
      return;
    }
    refresh();
  },
  async camon(el) {
    const st = $('#camst'), video = $('#cam');
    const mark = (id, state, text) => { const li = $(`#rd-${id}`); li.className = state; li.innerHTML = `${state === 'ok' ? ICON.check : ICON.clock}${text}`; };
    const setSt = (t) => (st.innerHTML = `<span class="dot"></span>${t}`);
    el.disabled = true;
    try {
      setSt('Starting camera…');
      await startCamera(video);
      mark('cam', 'ok', 'Camera');
      setSt('Live camera');
      mark('model', 'warn', 'Loading analyser');
      await initFace();
      mark('model', 'ok', 'Analyser ready');
      el.hidden = true;
      $('#facerun').disabled = false;
      const iv = setInterval(() => {
        if (!video.srcObject) return clearInterval(iv);
        const r = detectOnce(video);
        mark('face', r ? 'ok' : 'warn', r ? 'Face found' : 'Line up face');
      }, 500);
      timers.push(iv);
    } catch (err) {
      setSt('Unavailable');
      mark('cam', 'warn', 'No camera');
      $('#faceres').innerHTML = `<div class="banner amber small">Camera or face model unavailable: ${esc(err.message)}. You can skip this step.</div>`;
      el.disabled = false;
    }
  },
  async facerun(el) {
    const video = $('#cam');
    el.disabled = true;
    clearTimers();
    const res = await runFaceProtocol(video);
    el.disabled = false;
    if (!res) return;
    W.data.face = faceMetrics(res);
    $('#faceres').innerHTML = faceResultHtml(W.data.face);
  },
};

function finishWizard() {
  const { athlete, data } = W;
  clearTimers(); stopCamera();
  if (data.mode === 'baseline') {
    data.scores = scoreOf(data);
    if (athlete.baseline) (athlete.oldBaselines ??= []).push(athlete.baseline);
    athlete.baseline = data;
  } else {
    data.eval = evaluate(data, athlete.baseline);
    athlete.assessments.push(data);
  }
  persist();
  W = null;
  location.hash = `#/report/${athlete.id}/${data.id}`;
}

function viewReport(aid, rid) {
  const a = getAthlete(aid);
  const r = a && (a.baseline?.id === rid ? a.baseline : a.assessments.find((x) => x.id === rid) || a.oldBaselines?.find((x) => x.id === rid));
  if (!r) { location.hash = '#/athletes'; return; }
  const isBase = r.mode === 'baseline';
  const ev = isBase ? evaluate(r, null) : r.eval;
  const V = isBase
    ? { cls: 'green', icon: ICON.ok, title: 'Baseline saved', text: `Future pitchside screens for ${esc(a.name)} will be compared with these values. Re-record each season, when the player is rested and hasn’t trained in the last few hours.` }
    : {
      emergency: { cls: 'red', icon: ICON.alert.replace('class="icon"', 'width="26" height="26"'), title: 'Emergency', text: 'Call an ambulance now. Don’t move the player if the neck may be hurt, and don’t leave them alone.', extra: '<a class="btn" href="tel:112">Call 112</a>' },
      remove: { cls: 'red', icon: ICON.minus, title: 'Withdraw Player from Game', text: `Suspected concussion. Must not return today. A doctor decides the diagnosis.${ev.expOnly ? ' This result comes only from the experimental speech or eye measures.' : ''}` },
      monitor: { cls: 'amber', icon: ICON.clock.replace('class="icon"', 'width="26" height="26"'), title: 'No signs found', text: `This screen found nothing, but that does not rule out concussion. Symptoms can appear over hours.${ev.hadBaseline ? '' : ' No baseline on file, so many checks could not be compared.'}` },
    }[ev.decision];
  const banner = `<section class="verdict ${V.cls}" ${isBase ? '' : 'role="alert"'}><span class="vi">${V.icon}</span><h1>${V.title}</h1><p>${V.text}</p>${V.extra || ''}</section>`;
  const why = !isBase && ev.reasons.length ? `<section class="card"><h3>Why</h3>${ev.reasons.map((x) => `<div class="why-row"><span>${esc(x)}</span>${/^(Speech|Eye movement)/.test(x) ? '<span class="tag exp">Experimental</span>' : '<span class="tag core">Core</span>'}</div>`).join('')}</section>` : '';
  const flagged = isBase ? [] : ev.rows.filter((x) => x.flag === true && Number.isFinite(+x.val) && Number.isFinite(+x.base));
  const cmp = flagged.length ? `<section class="card"><div class="row spread gap"><h3 style="margin:0">Today vs baseline</h3><span class="legend"><span><i style="background:color-mix(in srgb, var(--muted) 60%, var(--surface))"></i>Baseline</span><span><i style="background:var(--orange)"></i>Today</span></span></div>
    ${flagged.map((x) => { const m = Math.max(Math.abs(+x.val), Math.abs(+x.base)) || 1; return `<div class="cmp"><div class="cmp-head"><span>${esc(x.label)}</span><span class="muted">${fmt(x.base)} → <b>${fmt(x.val)}</b></span></div><div class="bar"><span class="base" style="width:${Math.max(3, (Math.abs(+x.base) / m) * 100)}%"></span></div><div class="bar"><span class="today" style="width:${Math.max(3, (Math.abs(+x.val) / m) * 100)}%"></span></div></div>`; }).join('')}</section>` : '';
  const steps = isBase ? [] : {
    emergency: ['Call an ambulance (112)', 'Keep the neck still if it may be hurt', 'Stay with the player until help arrives'],
    remove: ['Hand over to the team doctor', 'Keep them with a responsible adult for 24 h', 'No driving or alcohol tonight', 'Re-check in 24–48 h, then graded return to sport'],
    monitor: ['Re-check at the end of play', 'Re-check tomorrow', 'If anything changes, remove from play'],
  }[ev.decision];
  const todo = steps.length ? `<section class="card"><h3>Next steps</h3>${steps.map((s) => `<button type="button" class="todo" data-act="tick" aria-pressed="false"><span class="tick"></span><span>${s}</span></button>`).join('')}</section>` : '';

  let lastGroup = '';
  const rowsHtml = ev.rows.map((row) => {
    const g = row.group !== lastGroup ? `<tr class="group"><td colspan="4">${esc(row.group)} ${row.kind === 'exp' ? '<span class="tag exp">Experimental</span>' : ''}</td></tr>` : '';
    lastGroup = row.group;
    const status = row.flag === true ? '<span class="tag red">Flag</span>' : row.flag === false ? '<span class="tag green">OK</span>' : '<span class="muted">—</span>';
    return `${g}<tr><td>${esc(row.label)}</td><td class="num">${fmt(row.val)}</td><td class="num">${isBase ? '' : fmt(row.base)}</td><td>${isBase ? '' : status}</td></tr>`;
  }).join('');

  app.innerHTML = `
    <div class="wiz-top no-print"><a class="btn icon-btn" href="#/athlete/${a.id}" aria-label="Back to ${esc(a.name)}">${ICON.back}</a>
      <div class="who"><b>${esc(a.name)}</b><span>${isBase ? 'Baseline' : 'Pitchside screen'} · ${new Date(r.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span></div><span style="width:44px"></span></div>
    ${banner}
    ${r.symptoms ? symptomScoreCard(r.symptoms, isBase ? null : baselineFor(a, r)?.symptoms, !isBase) : ''}
    ${why}
    ${cmp}
    ${todo}
    <div class="stack no-print" style="margin:16px 0">
      <button class="btn primary lg block" data-act="print">${ICON.send} Share or print report</button>
      <div class="row gap"><button class="btn" style="flex:1" data-act="export">Export data</button>${isBase ? '' : `<a class="btn" style="flex:1" href="#/assess/${a.id}/match">Re-check now</a>`}</div>
    </div>
    <details class="card"${isBase ? ' open' : ''}><summary><b>All measures (${ev.rows.length})</b><span class="tag">${isBase ? 'Values' : 'Detail'}</span></summary>
    <div class="table-wrap"><table>
      <thead><tr><th>Measure</th><th>${isBase ? 'Value' : 'Today'}</th><th>${isBase ? '' : 'Baseline'}</th><th>${isBase ? '' : 'Status'}</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table></div></details>
    <p class="small muted">Thresholds for change from baseline are prototype placeholders, not validated cut-offs. Speech and eye measures are experimental. ConcussID does not diagnose concussion.</p>`;
  actions.tick = (el) => el.setAttribute('aria-pressed', String(el.getAttribute('aria-pressed') !== 'true'));
  actions.print = () => window.print();
  actions.export = () => download(`concussid-report-${r.id}.json`, { athlete: { name: a.name, team: a.team, sport: a.sport }, report: r });
}

function viewEvidence() {
  app.innerHTML = `
  <h1>Evidence &amp; methods</h1>
  <p class="lead">What each part of ConcussID is based on, and how far that evidence goes.</p>
  <div class="card table-wrap"><table>
    <thead><tr><th>Domain</th><th>Implementation</th><th>Evidence status</th></tr></thead>
    <tbody>
      <tr><td>Red flags, GCS</td><td>Checklist + GCS; any positive → emergency</td><td><span class="tag core">Consensus</span> ${refLink('cisg2023')}, ${refLink('teasdale1974')}</td></tr>
      <tr><td>Observable signs</td><td>Checklist incl. video-sign definitions; any → remove</td><td><span class="tag core">Consensus</span> ${refLink('scat6')}, ${refLink('davis2019')}</td></tr>
      <tr><td>Maddocks questions</td><td>5 recent-memory questions; any error → remove</td><td><span class="tag core">Consensus</span> ${refLink('maddocks1995')}</td></tr>
      <tr><td>Symptoms</td><td>22 items, each scored by severity (none 0 · mild 1–2 · moderate 3–4 · severe 5–6) and summed into a weighted score out of 132. <b>Fail</b> = a rise of 2 or more over the player’s baseline (no baseline: over 0). In the source study this caught 87% of concussions (95% CI 78–94%) and cleared 79% of healthy players (70–87%); AUC 0.94.</td><td><span class="tag core">Peer-reviewed cut-off</span> ${refLink('harmon2024')}, ${refLink('scat6')}</td></tr>
      <tr><td>Cognition (SAC)</td><td>Orientation, 10-word immediate memory ×3, digits backward, months reverse, delayed recall (/50)</td><td><span class="tag core">Consensus</span> ${refLink('mccrea1998')}, ${refLink('scat6')}</td></tr>
      <tr><td>Balance</td><td>Modified BESS, 3 × 20 s stances, error count</td><td><span class="tag core">Consensus</span> ${refLink('riemann2000')}</td></tr>
      <tr><td>Speech acoustics</td><td>Sustained vowel (pitch, pitch variability, period &amp; amplitude perturbation), “pa-ta-ka” rate &amp; regularity, reading (speech/articulation rate, pauses, prosody). Syllable nuclei via intensity peaks.</td><td><span class="tag exp">Experimental</span> ${refLink('falcone2013')}, ${refLink('daudet2017')}, ${refLink('talkar2020')}, method ${refLink('dejong2009')}</td></tr>
      <tr><td>Eye movements</td><td>Iris position relative to eye corners from 478-point face mesh: fixation stability, smooth pursuit (0.4 Hz), prosaccade latency.</td><td><span class="tag exp">Experimental</span> ${refLink('mucha2014')}, ${refLink('maruta2014')}, ${refLink('galetta2011')}, ${refLink('kartynnik2019')}</td></tr>
      <tr><td>Facial symmetry &amp; blink</td><td>Blendshape-based smile asymmetry (marked new asymmetry → urgent review) and blink rate</td><td><span class="tag exp">Exploratory</span> no concussion-specific validation</td></tr>
    </tbody></table></div>

  <h2>Validation status</h2>
  <div class="banner amber">
    <b>Accuracy in concussed players: not yet measured.</b> No open dataset of concussed athletes' speech or eye movements exists, so ConcussID's sensitivity is unknown.
  </div>
  <div class="card">
    <h3>False alarms in healthy people (eye-movement markers)</h3>
    <p>Tested on open data from nine healthy adults (Korthals, Visser &amp; Kucharský, <i>Scientific Data</i>, 2026), recorded twice about 25 minutes apart with a lab-grade eye tracker. The app's current thresholds flagged <b>2 of 9 healthy people (22%; 95% CI 6–55%)</b>, at both 1000 Hz and a webcam-like 30 Hz.</p>
    <ul class="small">
      <li>Fixation instability (+54%) and pursuit error (+78%) each produced one false alarm against the 50% thresholds. Healthy people varied by up to about 55–80% between sessions.</li>
      <li>Saccade latency and pursuit tracking produced no false alarms. The largest healthy change was +34 ms, against a 50 ms threshold.</li>
      <li>This is a best case (chin rest, research tracker, rested people, same day). Real pitchside false-alarm rates will be higher.</li>
    </ul>
    <p class="small muted">Reproduce with the accuracy kit: <code>node eval/eval-eye-korthals.mjs</code> (see <code>eval/README.md</code>).</p>
  </div>

  <h2>Known limitations</h2>
  <ul>
    <li>Concussion is a clinical diagnosis. ConcussID is a screening and documentation aid and cannot rule concussion in or out.</li>
    <li>Change-from-baseline thresholds are conservative placeholders, not reliable-change indices derived from data. They need calibration in a prospective study.</li>
    <li>Speech features are sensitive to crowd noise, wind, breathlessness after exertion, accent and microphone; sideline exertion alone changes voice and speech rate.</li>
    <li>Webcam-based eye tracking is far less precise than infrared eye trackers; it uses consumer-camera frame rates (~15–30 fps) so latency resolution is ~33–66 ms.</li>
    <li>Pupil response is not measured: RGB cameras cannot reliably measure pupils in daylight (cf. ${refLink('mariakakis2017')} for a dedicated approach).</li>
    <li>Word lists are original to ConcussID and are not psychometrically equated to SCAT6 lists. For formal use, administer the official SCAT6 / CRT6.</li>
    <li>Not cleared by any regulator (e.g. MHRA, FDA, CE/UKCA). Software that informs diagnosis is a medical device and would need clinical evaluation before deployment.</li>
  </ul>

  <h2>References</h2>
  <p class="small muted">Citations should be independently verified against the original publications before any clinical, regulatory or academic use.</p>
  <ol class="refs">${Object.values(REFS).map((r) => `<li>${esc(r.full)} <a href="https://scholar.google.com/scholar?q=${encodeURIComponent(r.full.split('. ').slice(1, 2).join(''))}" target="_blank" rel="noopener">Find</a></li>`).join('')}</ol>`;
}

route();
