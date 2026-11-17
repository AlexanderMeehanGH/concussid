## Eye-movement markers in healthy people (false-alarm study)

Data: Korthals, Visser & Kucharský, *Scientific Data* 13:375 (2026), [OSF zx7hc](https://osf.io/zx7hc/). Healthy adults aged 22–27 years, EyeLink 1000 Plus at 1000 Hz, head on a chin rest.
Each person did the same 72 trials twice, about 25 minutes apart. Block 1 is treated as the baseline and block 2 as the follow-up. **9 people** are included; participant 21db28aa is excluded because the authors flag their second block as uncalibrated.
Nobody here is concussed, so **every flag is a false alarm**. The metrics come from the app's own `js/oculomotor.js` and the flags from its own thresholds.

### Full lab precision (1000 Hz)

| Marker | App threshold | False alarms | Largest healthy change | Healthy change, 95th pct |
|---|---|---|---|---|
| Fixation instability | rise ≥ 50% | 1/9 | 53.5% | 43.1% |
| Smooth-pursuit tracking | drop ≥ 0.15 | 0/9 | +0.012 | +0.011 |
| Pursuit error | rise ≥ 50% | 1/9 | 77.8% | 53.9% |
| Saccade latency, median | rise ≥ 50 ms | 0/9 | +32 ms | +27 ms |

**Any eye-movement flag (what the app would act on): 2/9 healthy people → false-alarm rate 22.2% (95% CI 6.3%–54.7%); specificity 77.8% (95% CI 45.3%–93.7%).**

<details><summary>Per-person values</summary>

| Person | Fixation A→B (°) | Pursuit r A→B | Pursuit error A→B (°) | Saccade latency A→B (ms) | Latencies measured |
|---|---|---|---|---|---|
| 06b8d2d3 | 0.621 → 0.591 | 0.988 → 0.985 | 1.100 → 1.194 | 125 → 122 | 173/184, 175/184 |
| 68471e16 | 0.959 → 1.033 | 0.995 → 0.994 | 0.554 → 0.624 | 175 → 194 | 154/184, 157/184 |
| 6cde27b5 | 1.379 → 0.752 | 0.982 → 0.997 | 0.840 → 0.421 | 189 → 175 | 169/184, 175/184 |
| 7d248f8f | 0.422 → 0.487 | 0.999 → 0.998 | 0.335 → 0.343 | 192 → 181 | 175/184, 167/184 |
| cf910821 | 0.180 → 0.216 | 0.999 → 0.999 | 0.212 → 0.244 | 146 → 140 | 184/184, 183/184 |
| f7bb2338 | 0.382 → 0.437 | 0.999 → 0.999 | 0.273 → 0.323 | 175 → 170 | 172/184, 166/184 |
| 88878fe6 | 0.902 → 1.151 | 0.996 → 0.986 | 0.469 → 0.834 | 179 → 190 | 166/184, 157/184 |
| d2c0afa4 | 0.687 → 0.575 | 0.996 → 0.997 | 0.610 → 0.529 | 174 → 176 | 170/184, 173/184 |
| eb8c52e6 | 1.198 → 1.839 | 0.972 → 0.960 | 1.036 → 1.185 | 182 → 214 | 152/184, 133/184 |

</details>

### Downsampled to 30 Hz (webcam frame rate)

| Marker | App threshold | False alarms | Largest healthy change | Healthy change, 95th pct |
|---|---|---|---|---|
| Fixation instability | rise ≥ 50% | 1/9 | 52.4% | 42.6% |
| Smooth-pursuit tracking | drop ≥ 0.15 | 0/9 | +0.012 | +0.011 |
| Pursuit error | rise ≥ 50% | 1/9 | 76.1% | 52.6% |
| Saccade latency, median | rise ≥ 50 ms | 0/9 | +34 ms | +27 ms |

**Any eye-movement flag (what the app would act on): 2/9 healthy people → false-alarm rate 22.2% (95% CI 6.3%–54.7%); specificity 77.8% (95% CI 45.3%–93.7%).**

<details><summary>Per-person values</summary>

| Person | Fixation A→B (°) | Pursuit r A→B | Pursuit error A→B (°) | Saccade latency A→B (ms) | Latencies measured |
|---|---|---|---|---|---|
| 06b8d2d3 | 0.603 → 0.573 | 0.988 → 0.985 | 1.101 → 1.193 | 142 → 138 | 172/184, 175/184 |
| 68471e16 | 0.943 → 1.023 | 0.995 → 0.994 | 0.557 → 0.627 | 193 → 211 | 154/184, 155/184 |
| 6cde27b5 | 1.380 → 0.749 | 0.982 → 0.997 | 0.840 → 0.421 | 205 → 191 | 168/184, 174/184 |
| 7d248f8f | 0.418 → 0.465 | 0.999 → 0.998 | 0.335 → 0.342 | 211 → 202 | 175/184, 168/184 |
| cf910821 | 0.164 → 0.197 | 0.999 → 0.999 | 0.212 → 0.247 | 163 → 155 | 184/184, 183/184 |
| f7bb2338 | 0.377 → 0.436 | 0.999 → 0.999 | 0.273 → 0.320 | 196 → 191 | 170/184, 163/184 |
| 88878fe6 | 0.891 → 1.138 | 0.996 → 0.986 | 0.471 → 0.829 | 196 → 206 | 163/184, 156/184 |
| d2c0afa4 | 0.685 → 0.570 | 0.996 → 0.997 | 0.608 → 0.528 | 191 → 190 | 169/184, 172/184 |
| eb8c52e6 | 1.206 → 1.838 | 0.972 → 0.960 | 1.033 → 1.182 | 197 → 231 | 153/184, 131/184 |

</details>

### How to read this
- This is a **best case**. The lab used a research-grade eye tracker, a chin rest, rested students and two sessions on the same day. Pitchside webcam tracking will be noisier, and athletes will be breathless, so real false-alarm rates are likely **higher**.
- The tasks are close to the app's tasks but not identical. Pursuit here uses constant-speed straight lines rather than the app's 0.4 Hz back-and-forth sweep, and target jumps come every 1 s on a predictable rhythm, so latencies may be shorter.
- With so few people, the confidence intervals are wide. The study can show that a threshold is clearly too tight, but it cannot prove that one is safe.
- This tells you nothing about **sensitivity**, the share of concussions the app would catch. That needs labelled data from concussed players.