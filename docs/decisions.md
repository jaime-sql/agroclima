# Decisions

## 2026-10-17 — 20-place picker

Decision: Ship the 20-place picker with the limits above stated in the README. Keep the risk thresholds as they are. Soil pH and "best area to plant" stay out.

Reason: Coordinates are town centres and the forecast is grid-based, so a place is an approximate zone at coffee altitude. The thresholds have no ISC, CENTA or agronomist validation yet (the app footer already says so). Moving them to balance the bands would hide a real signal; alto share is reported as measured.

Date: 2026-10-17

Source: Data Engineer's coffee_municipalities.csv (per-row sources); Instituto Salvadoreño del Café, Denominaciones de Origen: https://isc.gob.sv/distintivo-de-calidad/denominacion-origen/

## 2026-10-18 — Qué hacer hoy

Decision: Advice is the same at every level. Only the level line comes from the engine. No level-specific advice is presented as sourced. The text stays gated until the owner approves it.

Reason: The numbered list, the later line, and the footer do not change with alto, medio, or bajo. The level line has no source. Cited lines show the publication label only. `QUE_HACER_HOY_APPROVED` stays false until Jaime turns it on in `src/lib/que-hacer-hoy.ts`.

Date: 2026-10-18

## 2026-10-18 — Risk footer

Decision: The risk footer is now «Estos umbrales de riesgo son una estimación nuestra y no han sido validados por el ISC, CENTA ni el MAG.»

Reason: The constant, its test, and `docs/test-cases.md` use that same sentence. Unverified contact rows were removed rather than renamed. Limits wording in the README and in the 2026-10-17 entry says ISC, CENTA or agronomist validation.

Date: 2026-10-18

## 2026-10-18 — Connection drops

Decision: Three gaps in the ask path are confirmed and closed. The OpenAI fallback had no abort, so a hung call could leave no response. The route had no handler-level catch. A forced Blaxel failure omitted the `X-Agroclima-Backend` header. The logs and headers will show what happens next.

### Unconfirmed

- Free-plan CPU error 1102.
- An OpenNext streaming wrapper issue.
- Whether the 2 observed drops were a Blaxel reset or a hung OpenAI fallback. No production logs exist for them.

Date: 2026-10-18
