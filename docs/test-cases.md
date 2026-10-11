# AgroClima test cases

Status key: **Built** = in main and testable now. **Library only** = logic exists in `src/lib` with unit tests, but no UI or API exposes it yet. **Pending** = not built.

Live URL: https://agroclima.jaime-8a8.workers.dev

| ID | Case | Status |
|----|------|--------|
| TC-01 | Health route | Built |
| TC-02 | Spanish-first UI | Built (shell only) |
| TC-03 | Risk score for a location (Open-Meteo) | Library only |
| TC-04 | Risk footer caveat | Library only |
| TC-05 | Fungicide class only, no doses | Library only |
| TC-06 | Diagnosis unavailable without a key | Pending (diagnosis PR) |
| TC-07 | AegisFlow isolation | Built |

## TC-01 Health route
Steps: `curl -i https://agroclima.jaime-8a8.workers.dev/api/health`
Expected: HTTP 200, body `{"ok":true}` (`src/app/api/health/route.ts`).

## TC-02 Spanish-first UI
Steps: open `/` in a browser.
Expected: `<html lang="es">`, title "AgroClima", and the Spanish description in the heading paragraph. No English text visible.

## TC-03 Risk score for a location (Open-Meteo)
Steps: `npm test` runs `src/lib/risk/assess.test.ts` and `src/lib/weather/openmeteo.test.ts`. Once it is wired to UI/API: pick a location, then load its weekly risk.
Expected: `assessForecast()` returns a weekly level (alto / medio / bajo) with one of the Spanish reasons (`REASON_ALTO`, `REASON_MEDIO`, `REASON_BAJO_SECO`, `REASON_BAJO_TEMP`) and the next dry spray window, if there is one. UI/API exposure: pending.

## TC-04 Risk footer caveat
Steps: view any risk result.
Expected: footer shows exactly `RISK_CUTOFF_FOOTER`: "Estos umbrales de riesgo son una estimación nuestra y no han sido validados por PROCAFE ni por el MAG." UI rendering: pending.

## TC-05 Fungicide class only, no doses
Steps: view the action plan from `buildPlan()`.
Expected: only class names (`cobre`, `triazol`, `triazol+estrobilurina`) plus the note "dosis según etiqueta / su agrónomo". No numeric rate, dose or volume appears anywhere. UI rendering: pending.

## TC-06 Diagnosis unavailable without a key (pending the diagnosis PR)
Preconditions: Worker has no `VISION_API_KEY` secret.
Steps: upload a leaf photo and submit it to the diagnosis endpoint/UI.
Expected:
- A clear "servicio no disponible" error. No made-up diagnosis is returned.
- The photo stays on screen. An "Intentar de nuevo" button is offered.
- The risk strip and share still work.
Status: no diagnosis endpoint or upload UI exists in main yet.

## TC-07 AegisFlow isolation
Steps: after any AgroClima deploy, run `curl -o /dev/null -w "%{http_code}" https://aegisflow.jaime-8a8.workers.dev/aegisflow/sign-in`.
Expected: 200. `wrangler.jsonc` keeps `"name": "agroclima"`, with no routes or custom domains.
