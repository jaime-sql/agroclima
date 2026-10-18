# AgroClima test cases

Status key: **Built** = in main and testable now. **Library only** = logic exists in `src/lib` with unit tests, but no UI or API exposes it yet. **Pending** = not built.

Live URL: https://agroclima.jaime-8a8.workers.dev

| ID | Case | Status |
|----|------|--------|
| TC-01 | Health route | Built |
| TC-02 | Spanish-first UI | Built |
| TC-03 | Risk score for a location (Open-Meteo) | Built |
| TC-04 | Risk footer caveat | Built |
| TC-05 | Fungicide class only, no doses | Built |
| TC-06 | Diagnosis unavailable without a key | Built |
| TC-07 | AegisFlow isolation | Built |
| TC-08 | Listen without an ElevenLabs key | Built |
| TC-09 | Ask without an OpenAI key | Built |
| TC-10 | Ask stays on the screen data | Built |

## TC-01 Health route
Steps: `curl -i https://agroclima.jaime-8a8.workers.dev/api/health`
Expected: HTTP 200, body `{"ok":true,"sha":"<short sha>"}`. The short sha is the first 7 characters of `GITHUB_SHA`, injected when the deploy workflow builds. A local build uses `"dev"`.

## TC-02 Spanish-first UI
Steps: open `/` in a browser.
Expected: `<html lang="es">`, title "AgroClima", and the Spanish description in the heading paragraph. No English text visible.

## TC-03 Risk score for a location (Open-Meteo)
Steps: `npm test` runs `src/lib/risk/assess.test.ts` and `src/lib/weather/openmeteo.test.ts`. Once it is wired to UI/API: pick a location, then load its weekly risk.
Expected: `assessForecast()` returns a weekly level (alto / medio / bajo) with one of the Spanish reasons (`REASON_ALTO`, `REASON_MEDIO`, `REASON_BAJO_SECO`, `REASON_BAJO_TEMP`) and the next dry spray window, if there is one. `GET /api/risk?place=santa-ana` returns that week for the preset municipio.

## TC-04 Risk footer caveat
Steps: view any risk result.
Expected: footer shows exactly `RISK_CUTOFF_FOOTER`: "Estos umbrales de riesgo son una estimación nuestra y no han sido validados por PROCAFE ni por el MAG." The risk screen renders that sentence.

## TC-05 Fungicide class only, no doses
Steps: view the action plan from `buildPlan()`.
Expected: only class names (`cobre`, `triazol`, `triazol+estrobilurina`) plus the note "dosis según etiqueta / su agrónomo". No numeric rate, dose or volume appears anywhere. The risk screen shows those classes and that note.

## TC-06 Diagnosis unavailable without a key
Preconditions: Worker has no `OPENAI_API_KEY` secret.
Steps: `POST /api/diagnose` with a photo, or submit one from `/`.
Expected:
- HTTP 503 and `{ "ok": false, "error": "unavailable" }`. No network call and no made-up diagnosis.
- With a key and no `VISION_MODEL`, the request uses `gpt-4.1-mini` at `https://api.openai.com/v1/chat/completions`. The JSON contract and confidence cutoffs stay the same.
- The page shows "El servicio no está disponible ahora.", keeps the photo, and offers "Intentar de nuevo". Other errors still use "Algo salió mal. Intente otra vez."
- The risk strip and "Compartir con mi agrónomo" still work.

## TC-08 Listen without an ElevenLabs key
Preconditions: Worker has no `ELEVENLABS_API_KEY` or no `ELEVENLABS_VOICE_ID`.
Steps: tap «Escuchar» on any screen. `npm test` covers `src/lib/tts.test.ts`.
Expected:
- The button reads «▶ Escuchar», full width, 56 px. While the audio is prepared it reads «Preparando audio…» with a spinner. While it plays it reads «❚❚ Pausar» and shows a thin progress bar. After it ends it reads «▶ Escuchar otra vez».
- The tap is the only call to `POST /api/tts`. Nothing is fetched while the page loads.
- Without a key or voice id, the response is HTTP 503 `{ "ok": false, "error": "unavailable" }` and ElevenLabs is not called.
- The phone then uses `speechSynthesis` (es-US, then es-MX, then es-ES). If that voice is also missing, the screen says "No pudimos leer en voz alta."
- Spoken order, when those parts exist: the result, then the plan, then the week risk, then "Es una orientación, no un diagnóstico."
- Text sent to ElevenLabs is capped at 2,500 characters. Successful audio is stored in the R2 bucket `agroclima-audio` (binding `AUDIO_CACHE`) under `sha256(text + voiceId)`. A second tap does not call ElevenLabs again. Errors are not stored. If the binding is missing, the audio still plays and the cache is skipped. No KV and no Cache API.

## TC-09 Ask without an OpenAI key
Preconditions: Worker has no `OPENAI_API_KEY`. The plan screen is open.
Steps: type a short question and tap «Preguntar».
Expected:
- `POST /api/ask` returns HTTP 503 and the answer "AgroClima no puede responder ahora. Pregúntele a su agrónomo." OpenAI is not called.
- Under the plan, collapsed until opened: header "¿Tiene una pregunta?", a chip "¿Por qué el {día} es Alto?" for the first Alto day's weekday (hidden when the week has no Alto day), plus "¿Qué significa Probable?" and "¿Cuándo fumigar?", and placeholder "Escriba su pregunta". The mic shows only when the phone has SpeechRecognition.

## TC-10 Ask stays on the screen data
Steps: `npm test` runs `src/lib/ask.test.ts` with a mocked OpenAI reply.
Expected:
- The system prompt is fixed Spanish. A deterministic check runs first and refuses doses, products, treatment how-to, instruction overrides, prompt reveals, and other crops with no model call. The model still answers what Probable and the risk levels mean, and that the weather is from a nearby zone, not the farm. It names no brands and invents no farm weather. If the data is not enough, or the check matches, the reply is exactly "No puedo responder eso con seguridad. Consulte con su agrónomo." and the screen adds "Compartir con mi agrónomo".
- The question is only in the user message. The data is the zone label, timezone, and each `/api/risk` day (`date`, `level`, `score`, `wetHours`, `tmax`, `rain`, `reason`) plus the diagnosis. There is no separate summary. Unknown client fields are dropped.
- A question longer than 400 characters is rejected with no model call. Replies are capped at 280 tokens and at 3 sentences. Each answer shows a small ▶ and "Basado en el pronóstico y la foto de esta pantalla".
- The same address can ask 8 times in 10 minutes. The 9th gets "Ha hecho muchas preguntas seguidas. Intente en unos minutos." The limiter stores timestamps only.
- A real model call sets `X-Agroclima-Prompt-Tokens`, `X-Agroclima-Completion-Tokens`, and `X-Agroclima-Latency-Ms`. Those headers are numbers. They do not include the question or the address. A missing key sets none of them.

## TC-07 AegisFlow isolation
Steps: after any AgroClima deploy, run `curl -o /dev/null -w "%{http_code}" https://aegisflow.jaime-8a8.workers.dev/aegisflow/sign-in`.
Expected: 200. `wrangler.jsonc` keeps `"name": "agroclima"`, with no routes or custom domains.

## UX cases (Designer) — run on a 390px-wide phone viewport, Spanish

| ID | Check | Steps | Expected |
|---|---|---|---|
| UX-01 | Spanish copy | Walk every screen and state | Copy matches `flow.md` word for word; no English strings |
| UX-02 | Text size | Inspect body and headings | Body ≥18px, headings ≥24px (only exception: risk-chip word at 12px, repeated at full size in the day card) |
| UX-03 | Tap targets | Inspect all buttons/chips | Every target ≥48×48px |
| UX-04 | Contrast | Check text and icons against their background | WCAG AA: ≥4.5:1 text, ≥3:1 large text and icons |
| UX-05 | Risk not by color alone | 7-day strip | Every day shows icon + word (Alto/Medio/Bajo) |
| UX-06 | Result states | Force each label/confidence | Seguro, Probable ("Confirme con un agrónomo"), Sana only ≥0.85, No estamos seguros (no plan), Repetir foto (reason + tip) |
| UX-07 | Rust as guidance | Rust result | Shows "Parece roya" + "Esto es una orientación, no un diagnóstico" |
| UX-08 | Listen | Tap Escuchar with and without a Spanish voice, and with no ElevenLabs key | Button "▶ Escuchar", 56 px, full width. Loading "Preparando audio…". Playing "❚❚ Pausar" plus a thin bar. Ended "▶ Escuchar otra vez". No key falls back to es-US, then es-MX, then es-ES. If both fail, "No pudimos leer en voz alta." |
| UX-13 | Ask | Open the plan | Collapsed header "¿Tiene una pregunta?". Chips, placeholder "Escriba su pregunta", mic only with SpeechRecognition. Answers show ▶ and the source line. Refusal adds "Compartir con mi agrónomo" |
| UX-09 | Share | Tap "Compartir con mi agrónomo" | Share sheet with photo on Android Chrome / iOS Safari; text-only WhatsApp link elsewhere |
| UX-10 | Unavailable | No vision key | flow.md error copy, photo kept, "Intentar de nuevo"; risk strip and share still work |
| UX-11 | Day without data | Fixture DR-57 | Grey "Sin datos" chip with "–" icon; card text as in flow.md; no level shown |
| UX-12 | Forecast unavailable | Force HTTP error / empty reply / UTC timezone | Strip replaced by "Pronóstico no disponible" copy + "Intentar de nuevo"; diagnosis and share still work |

# AgroClima metrics test cases (Analytics)

All cases run on the live URL https://agroclima.jaime-8a8.workers.dev, on the build whose SHA `/api/health` reports. Until a case is measured, its result reads "not measured yet".

| ID | Case | Steps | Pass / report |
|---|---|---|---|
| MT-01 | Diagnosis hit rate | Run ML's frozen photo set (`ml/eval/`) once on the live URL, with no prompt changes after seeing the photos. | Report correct/total. "retake" and "No estamos seguros" count as misses. "Probable" rust counts as rust caught, and the number of Probable hits is reported separately. |
| MT-02 | Unsafe misses | From the MT-01 run, count rust photos called healthy. | Report the count. Target: 0. |
| MT-03 | Time to answer | Time from tapping Diagnose to the plan showing on screen. 20 runs, at least 30 s apart. | Report p50 and p95 in seconds. Read-aloud start time is reported separately. |
| MT-04 | Risk strip correctness | 3 municipalities × 7 days. Each day must show a level (word, not just color) and the rule it hit, traceable to `rust_risk_rules.md`. | Report passes out of 21. A day without hourly data passes only if it shows "sin datos" and no level (Data Engineer's DR-57). A failed fetch must show "pronóstico no disponible". |
| MT-05 | Cost per diagnosis | Measured tokens or image price on the chosen vision model, times calls per flow. | Report USD per diagnosis, with the price source and date. |
| MT-06 | Unavailable state | With the vision key missing or failing, run one diagnosis. | Pass if it shows the `flow.md` error, keeps the photo, and never shows a made-up result. Not counted in MT-01 to MT-03. |

# AgroClima rust-risk engine: data test cases (DR)
Data Engineer, 2026-10-11 (SV). Source of truth: `rust_risk_rules.md` §2 (identical to repo `docs/rust-risk-rules.md` at d0b695e).
Fixtures: `fixtures/<name>.json` (Open-Meteo `/v1/forecast` shape, timezone America/El_Salvador, start 2026-10-12). Regenerate: `python3 gen_fixtures.py`. Failed-fetch fixtures wrap `{_http_status, body}`.
Fixture convention: wet hours are 00:00..(k−1) with RH 95; other hours RH 60, 18 °C, no rain. Defaults: max 20 / min 16, sum 0, pmax 0 (→ R4 and R5 off).
Expected levels were computed with an independent script following the rules (not the app code). ⚠ marks rows where the rules don't decide the answer; see Ambiguities.


## Clear days

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-01 | `dr01_clear_low.json` | Load fixture → assessForecast(); read days[0] | bajo, «Día seco: la roya casi no avanza.» | 0 wet h, no rain → R6 bajo (score would be 1 via R5) |
| DR-02 | `dr02_clear_medium.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | warm_wet 4 (+1), sum 2 mm (+1) = 2 |
| DR-03 | `dr03_clear_high.json` | Load fixture → assessForecast(); read days[0] | alto, «Hojas mojadas muchas horas y clima tibio: la roya se pega fácil.» | warm_wet 10 (+2), opt 10 (+1), rain (+1), max 25 (+1) = 5 |

## R3 RH ≥ 90 (2 base wet h @18 °C + test hour, pmax 70)

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-04 | `r3_rh_at.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | RH 90 counts → warm_wet 3 (+1) + rain = 2 |
| DR-05 | `r3_rh_below.json` | Load fixture → assessForecast(); read days[0] | bajo, «Pocas horas húmedas favorables; riesgo bajo de roya» | RH 89.9 not wet → warm_wet 2 (0) + rain = 1 |
| DR-06 | `r3_rh_above.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | RH 90.1 → 3 wet h, score 2 |

## R2 hourly precip ≥ 0.1 mm (test hour RH 60)

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-07 | `r2_precip_at.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 0.1 mm counts → score 2 |
| DR-08 | `r2_precip_below.json` | Load fixture → assessForecast(); read days[0] | bajo, «Pocas horas húmedas favorables; riesgo bajo de roya» | 0.09 mm not wet → score 1 |
| DR-09 | `r2_precip_above.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 0.11 mm → score 2 |

## R1 warm bounds 15 ≤ T ≤ 30 (3 wet h, pmax 70)

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-10 | `r1_warm_15_at.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 15 inclusive → warm 3 (+1) + rain = 2 |
| DR-11 | `r1_warm_15_below.json` | Load fixture → assessForecast(); read days[0] | bajo, «Temperatura poco favorable para la roya.» | 14.9 → warm_wet 0 → bajo (R6/recipe) |
| DR-12 | `r1_warm_15_above.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 15.1 → score 2 |
| DR-13 | `r1_warm_30_at.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 30 inclusive → score 2 |
| DR-14 | `r1_warm_30_below.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 29.9 → score 2 |
| DR-15 | `r1_warm_30_above.json` | Load fixture → assessForecast(); read days[0] | bajo, «Temperatura poco favorable para la roya.» | 30.1 → warm_wet 0 → bajo |

## R1 optimum 21–25 °C (3 wet h, no rain, max 20)

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-16 | `r1_opt_21_at.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | opt 3 (+1) + warm 3 (+1) = 2 |
| DR-17 | `r1_opt_21_below.json` | Load fixture → assessForecast(); read days[0] | bajo, «Pocas horas húmedas favorables; riesgo bajo de roya» | 20.9 → opt 0 → score 1 |
| DR-18 | `r1_opt_21_above.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 21.1 → score 2 |
| DR-19 | `r1_opt_25_at.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 25 inclusive → score 2 |
| DR-20 | `r1_opt_25_below.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 24.9 → score 2 |
| DR-21 | `r1_opt_25_above.json` | Load fixture → assessForecast(); read days[0] | bajo, «Pocas horas húmedas favorables; riesgo bajo de roya» | 25.1 → opt 0 → score 1 |

## R1 opt_wet_h ≥ 3 count (6 wet h @18, k of them @22)

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-22 | `r1_optcount_2h.json` | Load fixture → assessForecast(); read days[0] | medio (score 2), «Humedad o lluvia algunas horas: riesgo moderado.» | opt 2 → +0; score 2 |
| DR-23 | `r1_optcount_3h.json` | Load fixture → assessForecast(); read days[0] | medio (score 3), «Humedad o lluvia algunas horas: riesgo moderado.» | opt 3 → +1; score 3 (check `score`, level unchanged) |
| DR-24 | `r1_optcount_4h.json` | Load fixture → assessForecast(); read days[0] | medio (score 3), «Humedad o lluvia algunas horas: riesgo moderado.» | opt 4 → score 3 |

## R2 warm_wet ≥ 3 bin (k wet h @18, pmax 70)

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-25 | `r2_count3_2h.json` | Load fixture → assessForecast(); read days[0] | bajo, «Pocas horas húmedas favorables; riesgo bajo de roya» | 2 h → 0 + rain = 1 |
| DR-26 | `r2_count3_3h.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 3 h → +1 + rain = 2 |
| DR-27 | `r2_count3_4h.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 4 h → 2 |

## R2 warm_wet ≥ 6 bin (k wet h @18, pmax 70, max 22)

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-28 | `r2_count6_5h.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 5 h → 1 + rain + R5 = 3 |
| DR-29 | `r2_count6_6h.json` | Load fixture → assessForecast(); read days[0] | alto, «Hojas mojadas muchas horas y clima tibio: la roya se pega fácil.» | 6 h → 2 + 1 + 1 = 4 |
| DR-30 | `r2_count6_7h.json` | Load fixture → assessForecast(); read days[0] | alto, «Hojas mojadas muchas horas y clima tibio: la roya se pega fácil.» | 7 h → 4 |

## R4 precipitation_sum ≥ 1 mm (3 wet h @18, pmax 0)

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-31 | `r4_sum_at.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 1.0 → rain +1 → 2 |
| DR-32 | `r4_sum_below.json` | Load fixture → assessForecast(); read days[0] | bajo, «Pocas horas húmedas favorables; riesgo bajo de roya» | 0.9 → no rain → 1 |
| DR-33 | `r4_sum_above.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 1.1 → 2 |

## R4 precipitation_probability_max ≥ 60 % (3 wet h @18)

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-34 | `r4_prob_at.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 60 → 2 |
| DR-35 | `r4_prob_below.json` | Load fixture → assessForecast(); read days[0] | bajo, «Pocas horas húmedas favorables; riesgo bajo de roya» | 59 → 1 |
| DR-36 | `r4_prob_above.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 61 → 2 |

## R5 temperature_2m_max 22–28 °C (3 wet h @18, no rain)

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-37 | `r5_tmax_22_at.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 22 inclusive → +1 → 2 |
| DR-38 | `r5_tmax_22_below.json` | Load fixture → assessForecast(); read days[0] | bajo, «Pocas horas húmedas favorables; riesgo bajo de roya» | 21.9 → 1 |
| DR-39 | `r5_tmax_22_above.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 22.1 → 2 |
| DR-40 | `r5_tmax_28_at.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 28 inclusive → 2 |
| DR-41 | `r5_tmax_28_below.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | 27.9 → 2 |
| DR-42 | `r5_tmax_28_above.json` | Load fixture → assessForecast(); read days[0] | bajo, «Pocas horas húmedas favorables; riesgo bajo de roya» | 28.1 → 1 |

## R5 diurnal range

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-43 | `r5_dtr_large.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» (decided Oct 11: DTR not scored) | max 25 / min 10 (DTR 15) |
| DR-44 | `r5_dtr_small.json` | Load fixture → assessForecast(); read days[0] | medio, «Humedad o lluvia algunas horas: riesgo moderado.» | max 25 / min 23: R5 applies under either reading |

## Consecutive-day bonus (day 2 = 6 wet h @18, pmax 70 → base 3)

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-45 | `bonus_prev_5h.json` | Load fixture → assessForecast(); read days[1] (day 2) | medio (score 3), «Humedad o lluvia algunas horas: riesgo moderado.» | prev 5 h → no bonus |
| DR-46 | `bonus_prev_6h.json` | Load fixture → assessForecast(); read days[1] (day 2) | alto (score 4), «Hojas mojadas muchas horas y clima tibio: la roya se pega fácil.» | prev 6 h → +1 |
| DR-47 | `bonus_prev_7h.json` | Load fixture → assessForecast(); read days[1] (day 2) | alto (score 4), «Hojas mojadas muchas horas y clima tibio: la roya se pega fácil.» | prev 7 h → +1 |
| DR-48 | `bonus_today_lt6.json` | Load fixture → assessForecast(); read days[1] (day 2) | medio (score 2), «Humedad o lluvia algunas horas: riesgo moderado.». No bonus: today has 3 h (<6) | prev 6, today 3 + rain. Level same, score differs |
| DR-49 | `bonus_date_gap.json` | Load fixture → assessForecast(); read days[1] (day 2) | medio (score 3), «Humedad o lluvia algunas horas: riesgo moderado.». Decided Oct 11: 10-13 missing → no bonus. Code gives alto → FAIL | daily.time skips 2026-10-13 |

## R6 / bajo reasons

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-50 | `r6_rainday_no_wet_hours.json` | Load fixture → assessForecast(); read days[0] | bajo, «Llueve, pero sin horas húmedas favorables a la roya» (decided Oct 11). Code gives «Temperatura poco favorable para la roya.» → FAIL | wet_h 0, sum 2 mm → warm_wet 0 → bajo |
| DR-51 | `r6_all_wet_cold.json` | Load fixture → assessForecast(); read days[0] | bajo, «Temperatura poco favorable para la roya.» | 8 wet h @13 °C → warm_wet 0 |
| DR-52 | `bajo_score1_warm_wet.json` | Load fixture → assessForecast(); read days[0] | bajo, «Pocas horas húmedas favorables; riesgo bajo de roya» | score 1; code returns the medio sentence «Humedad o lluvia algunas horas: riesgo moderado.» on a bajo day |

## Missing / null data

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-53 | `null_rh_in_wet_window.json` | Load fixture → assessForecast(); read days[0] | «sin datos», no level. Code: medio → FAIL | RH null in hours 03–05 |
| DR-54 | `null_temp_on_wet_hours.json` | Load fixture → assessForecast(); read days[0] | «sin datos», no level. Code: bajo + «Temperatura poco favorable para la roya.» → FAIL | temp null on all 6 wet hours |
| DR-55 | `null_precip_with_low_rh.json` | Load fixture → assessForecast(); read days[0] | «sin datos», no level. Code: bajo «Día seco» → FAIL | precip null all 24 h, RH 60 |
| DR-56 | `missing_hours_half_day.json` | Load fixture → assessForecast(); read days[0] | «sin datos», no level. Code: alto → FAIL | hours 12–23 absent |
| DR-57 | `missing_all_hours_for_day.json` | Load fixture → assessForecast(); read days[1] (day 2) | 10-12 alto; 10-13 «sin datos», no level. Code: bajo «Día seco» → FAIL | day 2 in daily.time, zero hourly rows |
| DR-58 | `null_daily_fields.json` | Load fixture → assessForecast(); read days[0] | «sin datos», no level. Code: bajo → FAIL | all daily fields null |

## Failed fetch

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-59 | `fetch_http_500.json` | Mock fetch to return fixture `_http_status` + `body`; call fetchDepartmentForecast('santa-ana') → risk screen | «pronóstico no disponible» for the whole strip (no level, color or reason), retry offered | fetchForecast throws on !ok; UI must catch |
| DR-60 | `fetch_http_400_error_body.json` | Mock fetch to return fixture `_http_status` + `body`; call fetchDepartmentForecast('santa-ana') → risk screen | «pronóstico no disponible» | Open-Meteo error JSON {error, reason} |
| DR-61 | `fetch_200_missing_hourly.json` | Mock fetch to return fixture `_http_status` + `body`; call fetchDepartmentForecast('santa-ana') → risk screen | «pronóstico no disponible». Code: TypeError → FAIL unless UI catches | 200 with no `hourly` |
| DR-62 | `fetch_200_empty_arrays.json` | Mock fetch to return fixture `_http_status` + `body`; call fetchDepartmentForecast('santa-ana') → risk screen | «pronóstico no disponible». Code: empty strip, no error → FAIL | 200 with empty arrays |
| DR-63 | (none: network timeout / DNS) | Mock fetch to return fixture `_http_status` + `body`; call fetchDepartmentForecast('santa-ana') → risk screen with fetch rejecting | «pronóstico no disponible»; no cached or default level |  |

## 7-day strip & timezone

| ID | Fixture | Steps | Expected | Why |
|---|---|---|---|---|
| DR-64 | `strip_7day_ordered.json` | Load fixture → assessForecast(); read all days[] | 7 days 10-12…10-18 in order: bajo(seco), medio, alto, bajo «Pocas horas…» (score 1, no bonus: today 3 h), medio, alto, bajo(temp) | day 6 alto via bonus from day 5 |
| DR-65 | `strip_7day_shuffled.json` | Load fixture → assessForecast(); read all days[] | Identical to strip_7day_ordered (engine sorts by date) | daily + hourly arrays reversed |
| DR-66 | (none: request) | Call forecastUrl(13.88,-89.61) | URL has timezone=America/El_Salvador and forecast_days=7 |  |
| DR-67 | `tz_late_night_wet_hours.json` | Load fixture → assessForecast(); read all days[] | 10-12 medio (wet 20:00–23:00 local count on 10-12); 10-13 bajo seco | local 23:00 must not roll to next day |
| DR-68 | `tz_wrong_timezone_utc.json` | Load fixture → assessForecast(); read all days[] | «pronóstico no disponible». Code: accepts the reply → FAIL | timezone GMT, offset 0 |
| DR-69 | (none: drop `timezone` from a scored fixture) | Load a valid fixture, delete `timezone`, call assessForecast() | available false, days [], «pronóstico no disponible». Same as a wrong timezone | missing timezone |
| DR-70 | (none: hourly figures differ from the daily aggregates) | Score one local day whose hourly max is 24 °C and hourly rain is 6 mm, while `temperature_2m_max` is 31 and `precipitation_sum` is 0 | `wetHours`, `tmax`, and `rain` come from those scored hours (11, 24, 6). The level still uses the daily aggregates | same-window numbers |
| DR-71 | `missing_all_hours_for_day.json` plus a null rain figure | Read the day with no hourly rows; format a scored day whose rain is null | No-hour day stays «sin datos» with no numbers, and `wetHours` / `tmax` / `rain` are null, not 0. A missing figure renders `lluvia: sin dato` | sin dato |

## Decided Oct 11 (now in rust_risk_rules.md §2a)
- Bajo days use a bajo sentence. Bonus needs the previous calendar date present (day 1 never). Optimum needs ≥ 3 h. DTR dropped. Rain ≥ 1 mm with 0 wet h → bajo «Llueve, pero sin horas húmedas favorables a la roya». Missing hours or nulls → «sin datos». Fetch failure, empty reply, missing timezone, or wrong timezone → «pronóstico no disponible».

- Oct 11 (2): bonus needs today AND previous date ≥ 6; score 0–1 with warm wet hours → «Pocas horas húmedas favorables; riesgo bajo de roya».

- DR-69 missing timezone. DR-70 same-window numbers. DR-71 sin dato.

Case count: 71.
