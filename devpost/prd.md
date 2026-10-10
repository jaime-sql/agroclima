---
doc: prd
status: approved
---

# AgroClima — Product Requirements

AgroClima is a Spanish phone page for a small coffee grower in Santa Ana, Ahuachapán, or Chalatenango. They bring one leaf photo and a place, and they leave with a spoken answer: roya or not, why this week is risky, and the low-cost step and when.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. They open AgroClima on a phone. The first screen is in Spanish, with the name and one sentence about what it does. Large type, one column.
2. They take or upload one photo of a coffee leaf, and they either share the phone's location or pick Santa Ana, Ahuachapán, or Chalatenango.
3. They see a diagnosis: roya, sana, otro problema, or tomar la foto de nuevo, plus a confidence they can understand (a plain percentage, not a chart).
4. They see seven days, each marked bajo, medio, or alto for roya, and a short reason that names humidity, rain, or the temperature window.
5. They see the action: what to do, how much, when, and the next dry spraying window. If no published dose is attached yet, the screen still gives the window and does not invent a number.
6. They tap to hear the whole answer in Spanish.
7. They tap to open WhatsApp with that same text ready to send.
8. Success is that spoken, shareable answer for this leaf and this week. Closing the page clears it. There is no account and nothing to come back to.

## Screens and Layout
One screen. Top: the name AgroClima and the one-sentence promise. Then the photo control and the place control. Then the answer, in this order: diagnosis, seven-day strip, action, hear it, send to WhatsApp. No second page, no menu, no map.

The shell in this pass shows only the name and the promise. The photo, place, and answer arrive in later slices. Source: `scope.md > Assumptions where the brief was silent`.

## Look and Feel
Assumption, because the brief did not set a visual style. One column on a phone. Large type so a quick reader can follow. High contrast, light background, dark text. Short sentences in Spanish (El Salvador). No icons required for the proof. No dashboard, no map, no English on the main path. The English one-liner in the README is for the repository, not the screen.

## Features and Behavior

### Foto y lugar
They use the phone camera or pick a photo already on the phone. One photo at a time. They pick Santa Ana, Ahuachapán, or Chalatenango, or they allow the browser location and the page selects the nearest of those three. They can change the place before asking.

- As a grower in Chalatenango, I want to point my phone at a leaf and name my department so the answer matches my week.
  - [ ] The first screen offers a camera or file photo and the three places, in Spanish.
  - [ ] Choosing a place does not open a map.
  - [ ] If location is denied or fails, the three-place picker still works.
  - [ ] Sharing location never draws a map; it only fills one of the three names.

### Diagnóstico
A hosted vision model answers with one of four results and a confidence: roya, sana, otro problema, or tomar la foto de nuevo.

- As a grower, I want a plain yes, no, other, or retake so I know whether to trust this photo.
  - [ ] The result is one of those four words, in Spanish, with a percentage.
  - [ ] "Tomar la foto de nuevo" tells them the photo could not be read and does not invent a disease.
  - [ ] The photo and the model key stay on the server. The page never shows a key.

### Riesgo de la semana
Seven days from the Open-Meteo forecast. Each day has a level and a reason that can mention humidity, rain, and whether the temperature sits in the rust window. The rules are the ones cited in the technical spec, not a hidden score.

- As a grower, I want each day to say why it is risky so I can match it to the weather I already feel.
  - [ ] Seven days appear, today first, each with bajo, medio, or alto.
  - [ ] Each day shows at least one short reason tied to humidity, rain, or temperature.
  - [ ] The reason text can name the published source in plain language.

### Plan de acción
What to do, how much, when, and the next dry spraying window.

- As a grower, I want one next step and a time when the leaves can dry, so I am not told to spray into rain.
  - [ ] The plan states what, how much, and when only when a published source is attached to that step.
  - [ ] The plan names the next dry spraying window from the forecast, or says that none is in the next seven days.
  - [ ] A healthy leaf does not get a spray dose. It still gets the week's risk, so they know what to watch.

### Escuchar y WhatsApp
They hear the diagnosis, the week's reasons, and the plan in Spanish. They can drop the same text into WhatsApp.

- As a grower who would rather listen, I want the answer read aloud and ready to forward.
  - [ ] One control reads the full answer in Spanish.
  - [ ] One control opens WhatsApp with that text filled in.
  - [ ] If the phone cannot speak, the text is still on the screen.

## States and Boundaries

- **First open** — name, promise, photo control, place control. No answer yet.
- **Waiting** — after they submit, the page says it is looking at the leaf and the week. The controls stay put.
- **Answer** — diagnosis, seven days, plan, listen, WhatsApp.
- **Retake** — diagnosis says to take the photo again. No risk strip and no spray step until a readable leaf exists.
- **Forecast missing** — diagnosis still shows. The week says the forecast could not be loaded, and the plan does not invent a window.
- **Model missing or failed** — the page says the leaf could not be read and asks for another photo. It does not show a key or a stack trace.
- **Location denied** — the three names remain selectable.
- **Leaving** — nothing is kept. Coming back is a fresh page.
- **Who can do what** — anyone with the link. No login. No saved photos.

## Product Decisions

- Coffee rust only, El Salvador only, one grower, one photo — from the locked brief, so the demo can finish inside one flow.
- No accounts, no database, no maps — from the locked brief. The answer does not need to survive a reload to prove the kernel.
- Risk is explained per day from the forecast — from the locked brief, so the week is not a single unlabeled score.
- Spanish on the product, WhatsApp as the share path — from the locked brief, because the user is on a phone and already uses WhatsApp.
- Three departments instead of every municipality — assumption, recorded in `scope.md > Assumptions where the brief was silent`, because those are the only places named.
- Built-in speech and a `wa.me` link — assumptions in that same section. They are the smallest way to hear and share.
- No invented dose — assumption in that same section. "How much" waits for a published source.

## What We're Building
The phone flow above, end to end, on a live URL: photo, place, four-way diagnosis, seven-day cited risk, action with a dry window, Spanish speech, WhatsApp. About 20 real leaf photos get a reported hit rate, and the video is under 3 minutes. The risk rules live in a module that can be tested without the page.

This repository pass only puts up the shell: the Spanish home line, a health check, and the risk module's stub and test. The journey above is still the product.

## Deferred From the POC
- Finer municipality lists and GPS maps — the three departments prove place without a map.
- Saving a photo or a past answer — there is no database, and the demo is one sitting.
- A paid voice — the phone can speak.
- WhatsApp Business API — a link is enough to show the share.

## Possible Later Enhancements
Other crops and diseases. Offline use when the signal drops. A view for a cooperative. SMS for someone who does not use WhatsApp. These are the brief's roadmap.

## Non-Goals
- Accounts and logins — the brief cuts them, and the demo does not need a named user.
- A database — nothing has to persist.
- Maps — place is a name, not a picture of terrain.
- Code copied from AgroSmart, AgriMCP, or AgroVision Pro — those are ideas, credited in the README, and this code is new.

## Open Questions
- Which published source sets the low-cost step and the dose? Must be answered before the action-plan slice. Must not be filled with an invented number. Does not block the shell.
- Is precipitation under 0.1 mm the right "dry window," or does the cited spraying practice say something else? Answer with that source, before the action-plan slice.
- Which hosted vision vendor and model name? Technical, answered in the spec as an environment setting. The product only requires the four outcomes.
