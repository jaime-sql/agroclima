# Evaluation

## Leaf diagnosis eval (BRACOL, Oct 22, 2026)

One sealed run of the deployed diagnosis endpoint on public BRACOL lab photos. The protocol was written Thu Oct 22, 2026, 23:00 SV (UTC-6), before any model call or scoring. The run itself was Thu Oct 22, 2026, 23:01–23:11 SV (UTC-6).

### Setup

252 BRACOL test leaves, one call each, through the deployed `POST /api/diagnose` (`https://agroclima.jaime-8a8.workers.dev/api/diagnose`, form field `photo`). All 252 calls returned HTTP 200. There were no retries.

`/api/health` reported sha **39644d8** (main HEAD `39644d87a3cb`) on every call. The prompt was the production `INSTRUCTION` in `src/lib/vision/diagnose.ts`, unedited. The default model is `gpt-4.1-mini` (`src/lib/openai.ts`). The deployed `VISION_MODEL` override cannot be seen from outside, so the exact model in production is unconfirmed. No key was on the box. Nothing was tuned on this test split: one pass, production prompt, and the baseline was fit on the train split only.

Client prep matched `src/lib/image.ts`: longest edge ≤ 1280 (a no-op on these images), JPEG quality 0.82.

The official split was rebuilt with the authors' code, `esgario/lara2018` `split_dataset` (seed 150, 70/15/15, fold 1), on lara2018 `dataset.csv` (1,685 rows: the Mendeley CSV minus the 62 rows with class 5). That yields train 1,180, val 253, and test 252 (rust 73, phoma 60, miner 58, healthy 40, cercospora 21). Validation was not used. Train was used only for the baselines. The test list sha256, recorded before the run, is `c9b88e6b21cd23953f6c8dac63f8244119ca2b2930c6c7018fa2f3c8c31c6895`.

Label mapping, fixed before scoring: roya → rust, sana → healthy, otro → other (miner, phoma, cercospora), retomar or failed → abstain. Multi-symptom leaves are scored by the dataset's `predominant_stress`. The primary metric is rust vs not-rust on the raw label. An abstention counts as wrong. The headline variant treats the app thresholds (sana below 0.85, or roya/otro below 0.6, shown as «No seguro») as abstentions. Intervals are Wilson 95% for accuracy and a bootstrap of 2,000 resamples (seed 0) for macro-F1.

### Results

Rust vs not-rust is the app's main claim. The app scored 185/252 = 73.4% (Wilson 95% CI 67.6–78.5%), macro-F1 0.683 (0.620–0.743), with 0 abstentions. That is no better than trivial: always answering «no es roya» scores 71.0% (65.1–76.3%), and the intervals overlap. A colour-histogram logistic regression, trained on the BRACOL train split only, scores 81.3% (76.1–85.7%), macro-F1 0.787 (0.732–0.836). The raw label and the headline-threshold variant are the same score, because nothing abstained.

Healthy leaves are handled well: 39/40 came back «sana». On the 39 multi-symptom test leaves, rust-vs-not-rust was correct for 20/39.

| System | Task | n | Accuracy, abstain = wrong (Wilson 95%) | Macro-F1 (bootstrap 95%) | Abstain |
| --- | --- | --- | --- | --- | --- |
| AgroClima app, raw label | rust vs not-rust | 252 | 185/252 = 73.4% (67.6%–78.5%) | 0.683 (0.620–0.743) | 0 |
| AgroClima app, headline (thresholds) | rust vs not-rust | 252 | 185/252 = 73.4% (67.6%–78.5%) | 0.683 (0.620–0.743) | 0 |
| LogReg HSV histogram (train only) | rust vs not-rust | 252 | 205/252 = 81.3% (76.1%–85.7%) | 0.787 (0.732–0.836) | 0 |
| Majority class from train («rust») | rust vs not-rust | 252 | 73/252 = 29.0% (23.7%–34.9%) | 0.225 (0.190–0.259) | 0 |
| Always «not rust» (binary majority, added after the run) | rust vs not-rust | 252 | 179/252 = 71.0% (65.1%–76.3%) | 0.415 (0.394–0.434) | 0 |
| AgroClima app, raw label | 3-class | 252 | 167/252 = 66.3% (60.2%–71.8%) | 0.670 (0.610–0.726) | 0 |
| AgroClima app, headline (thresholds) | 3-class | 252 | 167/252 = 66.3% (60.2%–71.8%) | 0.670 (0.610–0.726) | 0 |
| LogReg HSV histogram (train only) | 3-class | 252 | 189/252 = 75.0% (69.3%–79.9%) | 0.729 (0.667–0.787) | 0 |
| Majority class from train («rust») | 3-class | 252 | 73/252 = 29.0% (23.7%–34.9%) | 0.150 (0.126–0.173) | 0 |

Accuracy on the calls that were answered equals the headline accuracy on every row. The logistic regression is sklearn with default `C=1`, `max_iter` 2000, standardized 3×16-bin HSV histograms, trained as 5-class on the 1,180 train images (the same 512×256 GitHub files) and then collapsed to binary and 3-class. It was not tuned on the test split. The «always not rust» row was added after the run. It was not in the protocol.

### Rust recall

Rust recall is **42/73 = 57.5%**. Of the 73 rust leaves, 42 came back «roya», 26 came back «otro», and 5 came back «sana». None were abstentions. Rust precision is 0.538 (F1 0.556): 36 non-rust leaves, mostly miner and cercospora, were called «roya». On the binary collapse, not-rust precision is 0.822, recall 0.799, F1 0.810 (n = 179).

### Calibration

Confidence is not calibrated. The app returns a confidence, but only five distinct values, from 0.70 to 0.95: 0.7 (14), 0.8 (63), 0.85 (96), 0.9 (33), and 0.95 (46). Against binary rust/not-rust correctness, on answered calls only:

| Confidence bin | n | Mean confidence | Observed accuracy |
| --- | --- | --- | --- |
| [0.0, 0.6) | 0 | – | – |
| [0.6, 0.7) | 0 | – | – |
| [0.7, 0.8) | 14 | 0.700 | 0.429 |
| [0.8, 0.9) | 159 | 0.830 | 0.686 |
| [0.9, 1.0] | 79 | 0.929 | 0.886 |

ECE = 0.120. The model is overconfident (about 0.43 correct at confidence 0.70, 0.69 at mean confidence 0.83, and 0.89 at mean confidence 0.93). Under the rule set before scoring, the UI should not show the percentage.

### Latency

Client wall time to the deployed endpoint, HTTP 200 only, n = 252: p50 **0.83 s**, p95 **1.05 s**, max 2.38 s.

### Token cost

Token cost was not measured. The endpoint does not return token usage, and there was no direct API access. For reference only, a Wikimedia smoke test on different images logged about $0.00087 per image. That figure is not a BRACOL measurement.

### Data issues

These are public lab photos from Brazil (BRACOL, CC BY 4.0), not photos from El Salvador.

- The official Mendeley zip (164,516,964 bytes, sha256 `25a2fc97…fdfc1f`) is truncated. It has no zip central directory, and the last entry (`688.jpg`) is cut off. Only 1,401 of 1,747 whole-leaf images can be recovered, plus `dataset.csv`. The zip has no split folders and no symptom set.
- The split above is the authors' own code, not folders shipped in the archive. `dataset.csv` has 1,685 rows.
- 44 of the 252 test originals are missing from the Mendeley zip. All 252 images were taken from the authors' GitHub mirror (lara2018 `classification/dataset/leaf/<id>.jpg`) so the source is uniform and the split is complete. Those copies are 512×256 with a tighter crop, versus 2048×1024 originals. A visual spot check shows the same leaves. Lower resolution may hurt small symptoms.
- Class codes 0–4 are healthy, miner, rust, phoma, cercospora, from the order of the authors' symptom folders (`1_health` through `5_cercospora`).
- The test-list sha256 is `c9b88e6b21cd23953f6c8dac63f8244119ca2b2930c6c7018fa2f3c8c31c6895`.

### Limits

- These are not El Salvador photos. They are detached Arabica leaves from Espírito Santo, Brazil, photographed underside-up on a white background with smartphones, under "partially controlled conditions". A farmer's field photo looks very different.
- n = 252, one split, one run. The accuracy interval is about ±5–6 points.
- The app has four labels (roya, sana, otro, retomar). It cannot name miner, phoma, or cercospora, so 5-class accuracy penalizes it by design. App 5-class exact accuracy is 81/252 = 32.1% (26.7%–38.1%), macro-F1 over 5 classes 0.266. The same logistic regression scores 176/252 = 69.8% (63.9%–75.2%), macro-F1 0.586 (0.542–0.627). Only the binary and 3-class results are fair comparisons.
- The images are downscaled 512×256 author-mirror copies, because the official archive is broken.
- The baseline was trained on the same distribution. The app was not, so the baseline has a home advantage and would likely transfer worse to field photos.
- The «always not rust» row was added after the run as a trivial reference. It was not in the protocol.

### Decision

The app shows no accuracy figure. «Consultar a un técnico» is always visible on any roya answer.

The run does not support presenting diagnosis accuracy as a strength. The app does not beat «always not rust» or the colour baseline, and the confidence percentage should not be shown.

### On-screen line

«Detección de roya: acierto 73% (IC 95% 68–79%) en 252 fotos públicas de hojas de Brasil (BRACOL, CC BY 4.0), tomadas en laboratorio, no en El Salvador. Detecta 58% de las hojas con roya. No es un diagnóstico; consulte a un técnico.»
