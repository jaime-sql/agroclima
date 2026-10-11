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
Preconditions: Worker has no `VISION_API_KEY` secret.
Steps: `POST /api/diagnose` with a photo, or submit one from `/`.
Expected:
- HTTP 503 and `{ "ok": false, "error": "unavailable" }`. No made-up diagnosis.
- The page shows "Algo salió mal. Intente otra vez.", keeps the photo, and offers "Intentar de nuevo".
- The risk strip and "Compartir con mi agrónomo" still work.

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
| UX-08 | Listen | Phone with and without a Spanish voice | Escuchar reads the screen; hidden when no es-US/es-MX/es-ES voice |
| UX-09 | Share | Tap "Compartir con mi agrónomo" | Share sheet with photo on Android Chrome / iOS Safari; text-only WhatsApp link elsewhere |
| UX-10 | Unavailable | No vision key | flow.md error copy, photo kept, "Intentar de nuevo"; risk strip and share still work |
