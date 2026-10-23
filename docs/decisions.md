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

## 2026-10-18 — Ask prompt length

Decision: The ask prompt asks for at most 2 sentences when an answer names a day. Other answers stay at a maximum of 3 short sentences.

Reason: The appended wet-hours sentence made DV-02 and DV-04 a 4th sentence. Before: 13/18 on an ML dev run with a mixed SHA, labelled as such. After: to be measured by ML on the final sha. The prompt is frozen from now and must not change after the sealed held-out run.

Date: 2026-10-18

## 2026-10-18 — Ask client retry

Decision: The ask box retries once when a call drops before any response, then shows a button to send the question again.

Reason: The user cannot resend the way an eval can, because a drop returns no response. The trade-off is that one retry adds up to one extra call of latency and cost on a drop.

Date: 2026-10-18

## 2026-10-23 — Department level is the worst point

Decision: A department's rust level is the worst level among its coffee points. The label is lowercase and includes the count of scored points, for example «alto · 3 puntos». Departments with no coffee point stay «Sin datos».

Reason: Missing a rust outbreak costs more than a false alarm. The rule lives in one function, `aggregateDepartmentLevel`, so it can change without a second copy.

Date: 2026-10-23

## 2026-10-23 — Leaf result shows no model score

Decision: A leaf diagnosis shows no confidence word and no model number. It shows the fixed grey tag «Orientativo — no es un diagnóstico». «Consultar a un técnico» stays on screen for every diagnosis result and uses the existing WhatsApp agronomist handoff. Inside «¿Por qué este resultado?», on a diagnosis result, a 12px grey line cites the published leaf-detector figures (BRACOL, 252 lab photos from Brazil, CC BY 4.0): 73% accuracy (95% CI 68–79%) and 58% of rusted leaves detected. The weather step keeps Alto, Medio, and Bajo from the rules. The leaf step stays a second opinion («Segunda opinión»); the weather engine leads the reasons.

Reason: The vision score is uncalibrated, so it is not an accuracy figure. The cited line is a fixed study result, not this photo's score. ISC and CENTA contacts are still unverified, so the technician button does not invent a directory.

Date: 2026-10-23
