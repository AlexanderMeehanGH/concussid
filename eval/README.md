# ConcussID accuracy test kit

Measures how accurate ConcussID is using the **exact code the app runs**: `js/speech.js`,
`js/oculomotor.js` and `js/scoring.js`, together with the thresholds in `js/protocol.js`.
If you change a threshold, re-run the kit and the new accuracy is reported.

Needs Node.js 18 or later. Run everything from the `ConcussID` folder.

## 1. Check the kit works (synthetic data)
```
node eval/selftest.mjs
```
This generates artificial voices and assessments whose correct answers are known, then checks
that the pipeline recovers them. It tests the plumbing only and says nothing about clinical
accuracy.

## 2. False alarms in healthy people (eye movements), open data
```
node eval/eval-eye-korthals.mjs
```
Uses Korthals, Visser & Kucharský (2026), *Scientific Data* 13:375, data at https://osf.io/zx7hc/.
These are 10 healthy adults recorded at 1000 Hz, with every trial done twice. The script expects the
`clean` folder under `eval/data/korthals2026/` (see `MANIFEST.tsv` there for the file list and
download links, about 830 MB). Results are written to `eval/results/eye-healthy.md`.

## 3. Speech accuracy on your own labelled recordings
```
node eval/eval-speech.mjs --manifest path/to/recordings.csv --out eval/results/speech.md
```
`recordings.csv`:
```
subject,session,task,label,file
p01,baseline,vowel,,p01_base_vowel.wav
p01,baseline,ddk,,p01_base_ddk.wav
p01,post_injury,vowel,concussed,p01_post_vowel.wav
p01,post_injury,ddk,concussed,p01_post_ddk.wav
p02,baseline,vowel,,...
p02,end_of_match,vowel,control,...
```
- `task` is `vowel`, `ddk` or `reading`, the same tasks and instructions as the app.
- `label` is the reference diagnosis by a clinician, ideally confirmed at the 24–48 h follow-up. Use `control` for healthy re-tests and uninjured team-mates.
- Files must be WAV. Convert other formats first, e.g. `ffmpeg -i in.m4a out.wav`.

The script reports sensitivity, specificity, the AUC of each marker, and data-driven threshold
candidates (the 95th percentile of change seen in controls).

## 4. Full decision on real ConcussID assessments
```
node eval/eval-exports.mjs --data concussid-export.json --labels labels.csv --out eval/results/exports.md
```
- `concussid-export.json` is the export from the Athletes page.
- `labels.csv` has the columns `assessment_id,label`, where the label is the clinician's diagnosis, not the app's result.

This re-scores every assessment with the current rules against the baseline on file at the time.
It reports the full decision, the consensus components alone and the experimental markers alone.

## What data you still need
| Question | Data needed | Where |
|---|---|---|
| How many concussions are caught (sensitivity)? | Concussed players with baseline and post-injury recordings | Your own ethics-approved study; authors of published speech studies |
| Thresholds for the consensus components | Paired baseline and post-injury SCAT data | CARE Consortium via FITBIR (fitbir.nih.gov), by application |
| False alarms with webcam, pitchside | Healthy players: two baselines plus a post-exercise screen | Your own club data (method 4 above) |
