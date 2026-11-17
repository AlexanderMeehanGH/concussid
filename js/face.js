// ConcussID facial / oculomotor engine.
// Uses MediaPipe Face Landmarker (478 landmarks incl. iris + blendshapes; Kartynnik et al., 2019)
// to derive screen-based proxies of the oculomotor domains used in VOMS (Mucha 2014) and
// eye-tracking concussion research (Maruta & Ghajar 2014): fixation stability, smooth
// pursuit and saccades, plus blink rate and facial (smile) symmetry.
// Video is processed on-device; no frames are stored or transmitted.

import { mean, sd, median, fixationDispersion, pursuitFit, saccadeLatencies } from './oculomotor.js';

const VER = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let landmarker = null;
let stream = null;

export async function startCamera(video) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API unavailable (page must be served over HTTPS or localhost).');
  stopCamera();
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
}

export function stopCamera() {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
}

export async function initFace() {
  if (landmarker) return landmarker;
  let mod;
  try { mod = await import(`${CDN}/vision_bundle.mjs`); }
  catch { mod = await import(`${CDN}/+esm`); }
  const lib = mod.FaceLandmarker ? mod : mod.default;
  const fileset = await lib.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
  });
  try { landmarker = await lib.FaceLandmarker.createFromOptions(fileset, opts('GPU')); }
  catch { landmarker = await lib.FaceLandmarker.createFromOptions(fileset, opts('CPU')); }
  return landmarker;
}

function extract(res) {
  const lm = res?.faceLandmarks?.[0];
  if (!lm || lm.length < 478) return null;
  const hr = (p, a, b) => (p.x - a.x) / ((b.x - a.x) || 1e-6);
  const vr = (p, t, b) => (p.y - t.y) / ((b.y - t.y) || 1e-6);
  const bs = {};
  (res.faceBlendshapes?.[0]?.categories || []).forEach((c) => (bs[c.categoryName] = c.score));
  return {
    h: (hr(lm[468], lm[33], lm[133]) + hr(lm[473], lm[362], lm[263])) / 2,
    v: (vr(lm[468], lm[159], lm[145]) + vr(lm[473], lm[386], lm[374])) / 2,
    nx: lm[1].x, ny: lm[1].y,
    blink: Math.max(bs.eyeBlinkLeft || 0, bs.eyeBlinkRight || 0),
    sL: bs.mouthSmileLeft || 0, sR: bs.mouthSmileRight || 0,
  };
}

// Live face check for the preview: returns true if a face is visible.
export function detectOnce(video) {
  if (!landmarker || video.readyState < 2) return null;
  return extract(landmarker.detectForVideo(video, performance.now()));
}

export const PHASES = [
  { k: 'intro', d: 4 }, { k: 'fixation', d: 7 }, { k: 'pursuit', d: 12 }, { k: 'saccade', d: 12 }, { k: 'smile', d: 4 },
];

export function runFaceProtocol(video) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'face-overlay';
    ov.innerHTML = '<div class="fo-msg"></div><div class="fo-dot"></div><button class="btn fo-cancel">Cancel</button>';
    document.body.appendChild(ov);
    const msg = ov.querySelector('.fo-msg'), dot = ov.querySelector('.fo-dot');
    let cancelled = false;
    ov.querySelector('.fo-cancel').onclick = () => (cancelled = true);

    // Saccade targets alternate sides at jittered intervals (unpredictable timing).
    const jumps = [];
    for (let t = 0.6, side = 0; t < 11; side ^= 1, t += 0.9 + Math.random() * 0.5) jumps.push({ t, x: side ? 0.9 : 0.1 });

    const samples = [];
    const T0 = performance.now();
    let lastVT = -1;
    const phaseAt = (el) => { let acc = 0; for (const p of PHASES) { if (el < acc + p.d) return { p, tp: el - acc }; acc += p.d; } return null; };

    function frame() {
      const ph = phaseAt((performance.now() - T0) / 1000);
      if (!ph || cancelled) { ov.remove(); resolve(cancelled ? null : { samples, jumps }); return; }
      let tx = 0.5, show = true, text = '';
      switch (ph.p.k) {
        case 'intro': text = `Keep your head still. Follow the red dot with your eyes only. Starting in ${Math.ceil(ph.p.d - ph.tp)}…`; break;
        case 'fixation': text = 'Look steadily at the dot'; break;
        case 'pursuit': tx = 0.5 + 0.4 * Math.sin(2 * Math.PI * 0.4 * ph.tp); text = 'Follow the dot smoothly'; break;
        case 'saccade': for (const j of jumps) if (ph.tp >= j.t) tx = j.x; text = 'Look at the dot as quickly as you can'; break;
        case 'smile': show = false; text = 'Now give a big smile, showing your teeth'; break;
      }
      msg.textContent = text;
      dot.style.display = show ? 'block' : 'none';
      dot.style.left = `${tx * 100}%`;
      if (ph.p.k !== 'intro' && landmarker && video.readyState >= 2 && video.currentTime !== lastVT) {
        lastVT = video.currentTime;
        const r = extract(landmarker.detectForVideo(video, performance.now()));
        samples.push({ t: ph.tp, phase: ph.p.k, tx, ...(r || { miss: true }) });
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

export function faceMetrics({ samples, jumps }) {
  const ok = (s) => !s.miss && s.blink < 0.4;
  const by = (k) => samples.filter((s) => s.phase === k);
  const recDur = PHASES.filter((p) => p.k !== 'intro').reduce((s, p) => s + p.d, 0);
  const found = samples.filter((s) => !s.miss);
  const detectRate = samples.length ? found.length / samples.length : 0;
  const fps = samples.length / recDur;

  const fix = by('fixation').filter((s) => ok(s) && s.t > 1);
  const fixationDisp = fixationDispersion(fix.map((s) => s.h), fix.map((s) => s.v)) * 100;

  const pur = by('pursuit').filter((s) => ok(s) && s.t > 1);
  const fit = pursuitFit(pur.map((s) => s.tx), pur.map((s) => s.h));
  const pursuitR = fit.r, pursuitResid = fit.resid * 100, slope = fit.slope;

  const sac = by('saccade').filter(ok);
  const expected = Number.isFinite(slope) && pursuitR > 0.4 ? Math.abs(slope) * 0.8 : 0.04;
  const { lat, miss } = saccadeLatencies(sac, jumps, expected);

  let blinks = 0, closed = false;
  found.forEach((s) => { if (!closed && s.blink > 0.5) { blinks++; closed = true; } else if (closed && s.blink < 0.3) closed = false; });

  const sm = by('smile').filter((s) => !s.miss && s.t > 1);
  const peakSmile = sm.length ? Math.max(...sm.map((s) => (s.sL + s.sR) / 2)) : 0;
  const smiling = sm.filter((s) => (s.sL + s.sR) / 2 > 0.25);
  const smileAsym = smiling.length ? mean(smiling.map((s) => Math.abs(s.sL - s.sR) / Math.max(s.sL, s.sR))) : NaN;

  const head = found.filter((s) => ['fixation', 'pursuit', 'saccade'].includes(s.phase));
  const headMotion = Math.sqrt(sd(head.map((s) => s.nx)) ** 2 + sd(head.map((s) => s.ny)) ** 2) * 100;

  const warn = [];
  if (detectRate < 0.8) warn.push('Face lost in many frames — improve lighting and framing.');
  if (headMotion > 3) warn.push('Head moved during the test — repeat with the head still.');
  if (pursuitR < 0.3) warn.push('Weak eye-tracking signal — hold the device closer (≈40 cm) and repeat.');
  if (fps < 12) warn.push('Low camera frame rate — timing measures are less reliable.');
  if (peakSmile < 0.25) warn.push('Smile not detected — symmetry not measured.');

  return {
    metrics: {
      fixationDisp: r3(fixationDisp), pursuitR: r3(pursuitR), pursuitResid: r3(pursuitResid),
      saccadeLatency: r3(lat.length >= 3 ? median(lat) : NaN), saccadeMiss: miss,
      blinkRate: r3(blinks / (recDur / 60)), smileAsym: r3(smileAsym), headMotion: r3(headMotion),
      fps: r3(fps), detectRate: r3(detectRate),
    },
    quality: { ok: detectRate >= 0.5, msg: warn.join(' ') },
  };
}
