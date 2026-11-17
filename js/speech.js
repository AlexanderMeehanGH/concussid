// ConcussID speech engine — runs entirely in the browser; audio never leaves the device.
// Features follow acoustic markers studied in mTBI speech research
// (Falcone 2013; Daudet 2017; Talkar 2020). Syllable-nucleus detection follows the
// intensity-peak / dip approach of de Jong & Wempe (2009).

export async function recordAudio(seconds, onTick) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone API unavailable (page must be served over HTTPS or localhost).');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  await ctx.resume();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  const chunks = [];
  let lvl = 0;
  proc.onaudioprocess = (e) => {
    const x = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(x));
    let s = 0;
    for (let i = 0; i < x.length; i++) s += x[i] * x[i];
    lvl = Math.sqrt(s / x.length);
  };
  src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
  const sr = ctx.sampleRate;
  try {
    await new Promise((res) => {
      const t0 = performance.now();
      const iv = setInterval(() => {
        const el = (performance.now() - t0) / 1000;
        onTick?.(Math.min(el, seconds), lvl);
        if (el >= seconds) { clearInterval(iv); res(); }
      }, 100);
    });
  } finally {
    proc.disconnect(); src.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    ctx.close();
  }
  let n = 0; chunks.forEach((c) => (n += c.length));
  const out = new Float32Array(n);
  let o = 0; chunks.forEach((c) => { out.set(c, o); o += c.length; });
  return { samples: out, sr };
}

// ---------- helpers ----------
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
const pct = (arr, p) => {
  const a = Array.from(arr).sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))];
};
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

function downsample(x, sr) {
  const f = Math.max(1, Math.floor(sr / 16000));
  const n = Math.floor(x.length / f);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < f; k++) s += x[i * f + k]; y[i] = s / f; }
  return { x: y, sr: sr / f };
}

function medianFilter(vals, k = 5) {
  const h = Math.floor(k / 2);
  return vals.map((_, i) => pct(vals.slice(Math.max(0, i - h), i + h + 1), 0.5));
}

// Normalised autocorrelation pitch estimate for one window; returns 0 if unvoiced.
function pitchAt(x, st, pw, minLag, maxLag, sr) {
  let e0 = 0;
  for (let i = 0; i < pw; i++) e0 += x[st + i] * x[st + i];
  if (e0 <= 1e-9) return 0;
  const rs = new Float32Array(maxLag + 2);
  let best = 0;
  for (let l = minLag; l <= maxLag; l++) {
    let c = 0, e1 = 0;
    for (let i = 0; i < pw; i++) { const b = x[st + i + l]; c += x[st + i] * b; e1 += b * b; }
    const r = c / Math.sqrt(e0 * e1 + 1e-12);
    rs[l] = r;
    if (r > best) best = r;
  }
  if (best < 0.5) return 0;
  // Take the shortest lag that is a local max within 90% of the best (avoids sub-octave errors).
  for (let l = minLag + 1; l < maxLag; l++) {
    if (rs[l] >= 0.9 * best && rs[l] >= rs[l - 1] && rs[l] >= rs[l + 1]) {
      const a = rs[l - 1], b = rs[l], c = rs[l + 1];
      const d = a - 2 * b + c;
      const off = d !== 0 ? 0.5 * (a - c) / d : 0; // parabolic interpolation
      return sr / (l + off);
    }
  }
  return 0;
}

export function analyzeSpeech(raw, rawSr, task) {
  const { x, sr } = downsample(raw, rawSr);
  const m0 = mean(Array.from(x));
  for (let i = 0; i < x.length; i++) x[i] -= m0;

  const hop = Math.round(0.01 * sr), win = Math.round(0.03 * sr);
  const nF = Math.max(0, Math.floor((x.length - win) / hop));
  const skip = 20; // ignore first 200 ms (device start-up transients)
  const db = new Float32Array(nF), lin = new Float32Array(nF);
  for (let f = 0; f < nF; f++) {
    let s = 0; const st = f * hop;
    for (let i = 0; i < win; i++) s += x[st + i] * x[st + i];
    lin[f] = Math.sqrt(s / win);
    db[f] = 20 * Math.log10(lin[f] + 1e-9);
  }
  const usable = db.slice(skip);
  if (usable.length < 50) return { metrics: {}, quality: { ok: false, msg: 'Recording too short.' } };
  const noise = pct(usable, 0.1), p95 = pct(usable, 0.95);
  const snr = p95 - noise;
  // Capped at p95 − 6 dB so a recording with little or no silence (e.g. a vowel held for the
  // whole task) is not mistaken for noise.
  const thr = Math.min(Math.max(noise + 10, p95 - 30), p95 - 6);
  const voiced = Array.from(db, (v, i) => i >= skip && v > thr);

  // Smoothed intensity envelope.
  const env = new Float32Array(nF);
  for (let i = 0; i < nF; i++) { let s = 0, c = 0; for (let k = -2; k <= 2; k++) if (i + k >= 0 && i + k < nF) { s += db[i + k]; c++; } env[i] = s / c; }

  // Pitch track every 20 ms.
  const pw = Math.round(0.04 * sr), minLag = Math.floor(sr / 400), maxLag = Math.ceil(sr / 75);
  const f0 = new Float32Array(nF);
  for (let f = skip; f < nF; f += 2) {
    if (!voiced[f]) continue;
    const st = f * hop;
    if (st + pw + maxLag + 1 >= x.length) break;
    f0[f] = pitchAt(x, st, pw, minLag, maxLag, sr);
  }
  const pitchIdx = []; for (let f = 0; f < nF; f++) if (f0[f] > 0) pitchIdx.push(f);
  const f0Clean = medianFilter(pitchIdx.map((f) => f0[f]));

  // Voiced span, pauses, runs.
  const fv = voiced.indexOf(true), lv = voiced.lastIndexOf(true);
  const voicedFrames = voiced.filter(Boolean).length;
  if (fv < 0 || voicedFrames * hop / sr < 0.8) {
    return { metrics: {}, quality: { ok: false, msg: 'Too little voice detected — move closer to the microphone and repeat.' } };
  }
  const span = (lv - fv + 1) * hop / sr;
  let pauses = 0, pauseT = 0, run = 0, longest = 0, longestStart = fv, curStart = fv, vrun = 0;
  for (let i = fv; i <= lv; i++) {
    if (!voiced[i]) { run++; if (vrun > longest) { longest = vrun; longestStart = curStart; } vrun = 0; }
    else { if (run >= 25) { pauses++; pauseT += run * hop / sr; } run = 0; if (vrun === 0) curStart = i; vrun++; }
  }
  if (vrun > longest) { longest = vrun; longestStart = curStart; }

  // Syllable nuclei: voiced intensity peaks with ≥2 dB dips on both sides, ≥80 ms apart.
  const W = 12, cand = [];
  for (let i = 2; i < nF - 2; i++) {
    if (!voiced[i] || !(env[i] >= env[i - 1] && env[i] > env[i + 1])) continue;
    let lmin = env[i], rmin = env[i];
    for (let k = 1; k <= W; k++) { if (i - k >= 0) lmin = Math.min(lmin, env[i - k]); if (i + k < nF) rmin = Math.min(rmin, env[i + k]); }
    if (env[i] - lmin >= 2 && env[i] - rmin >= 2) cand.push(i);
  }
  const syl = [];
  for (const p of cand) {
    if (syl.length && p - syl[syl.length - 1] < 8) { if (env[p] > env[syl[syl.length - 1]]) syl[syl.length - 1] = p; }
    else syl.push(p);
  }

  const st = (hz) => 12 * Math.log2(hz / 100);
  const metrics = {};
  const warn = [];
  if (snr < 15 && voicedFrames / usable.length < 0.85) warn.push('Low signal-to-noise — find a quieter spot or hold the phone closer.');

  if (task === 'vowel') {
    const inRun = pitchIdx.map((f, i) => [f, f0Clean[i]]).filter(([f]) => f >= longestStart && f < longestStart + longest).map(([, v]) => v);
    const periods = inRun.map((v) => 1 / v);
    let dj = 0; for (let i = 1; i < periods.length; i++) dj += Math.abs(periods[i] - periods[i - 1]);
    const amps = Array.from(lin.slice(longestStart, longestStart + longest));
    let da = 0; for (let i = 1; i < amps.length; i++) da += Math.abs(amps[i] - amps[i - 1]);
    metrics.phonation = r3(longest * hop / sr);
    metrics.f0Median = r3(pct(inRun, 0.5));
    metrics.f0SdSt = r3(sd(inRun.map(st)));
    metrics.jitter = r3(periods.length > 3 ? (dj / (periods.length - 1)) / mean(periods) : NaN);
    metrics.ampVar = r3(amps.length > 3 ? (da / (amps.length - 1)) / mean(amps) : NaN);
    if (inRun.length < 20) warn.push('Pitch could not be tracked reliably — sustain the vowel steadily.');
  } else if (task === 'ddk') {
    const iv = []; for (let i = 1; i < syl.length; i++) iv.push((syl[i] - syl[i - 1]) * hop / sr);
    metrics.syllables = syl.length;
    metrics.ddkRate = r3(syl.length / span);
    metrics.ddkCv = r3(iv.length > 2 ? sd(iv) / mean(iv) : NaN);
    if (syl.length < 8) return { metrics, quality: { ok: false, msg: 'Too few syllables detected — repeat “pa-ta-ka” clearly and loudly.' } };
  } else {
    metrics.syllables = syl.length;
    metrics.speechRate = r3(syl.length / span);
    metrics.articulationRate = r3(syl.length / Math.max(0.5, span - pauseT));
    metrics.pauseRatio = r3(pauseT / span);
    metrics.pauseCount = pauses;
    metrics.f0SdSt = r3(sd(f0Clean.map(st)));
    metrics.f0Median = r3(pct(f0Clean, 0.5));
    if (syl.length < 15) warn.push('Few syllables detected — read the whole passage aloud.');
  }
  metrics.snrDb = r3(snr);
  return { metrics, quality: { ok: true, msg: warn.join(' ') } };
}
