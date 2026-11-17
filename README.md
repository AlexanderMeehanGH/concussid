# ConcussID — pitchside concussion screening (prototype v0.1)

Research prototype. **Not a medical device.** It does not diagnose concussion; under the
CISG 6th consensus (Patricios et al., 2023), concussion is a clinical diagnosis made by a
healthcare professional, and any player with a suspected concussion is removed from play.

## Run locally
```
python -m http.server 8765 --directory C:\ConcussID
```
Open http://localhost:8765. Camera and microphone need `localhost` or HTTPS.

## Structure
- `index.html`, `styles.css`: the page shell and theme (light/dark, mobile-first)
- `js/protocol.js`: assessment content, references and the prototype thresholds
- `js/speech.js`: on-device speech features (pitch, perturbation, DDK rate, speech rate, pauses)
- `js/face.js`: MediaPipe Face Landmarker eye-movement and facial metrics
- `js/app.js`: routing, assessment flow, comparison with baseline, decision rules and reports

## Flow
Pitchside: red flags + GCS → observable signs → Maddocks → symptoms (22 items) → orientation →
immediate memory → concentration → mBESS → speech → eye movement → delayed recall → report.
Baseline mode skips the match-specific steps.

## Decision rules
- Any red flag, or GCS below 15 → **Emergency**
- Any observable sign, a Maddocks error, a symptom worse than baseline, a cognitive or balance
  drop beyond threshold, or an experimental marker beyond threshold → **Remove from play**
- Otherwise → **No signs detected** (never "cleared"; re-assess)

The thresholds in `THRESHOLDS` are placeholders and need calibration in a prospective study.

## Accuracy testing
See `eval/README.md`. The kit measures accuracy with the app's own code. Current status: sensitivity in
concussed players is **unmeasured** (there is no open data). In healthy people, the eye markers gave false
alarms for 2 of 9 people on open lab data (`eval/results/eye-healthy.md`).

## Data
Everything is stored in the browser's localStorage on the device. Audio and video are analysed
in memory and thrown away. Export with the JSON buttons.
