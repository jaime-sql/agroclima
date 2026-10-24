---
doc: scope
status: approved
---

# AgroClima

A small coffee farmer in El Salvador takes one photo of a leaf and, in Spanish, hears whether it's coffee leaf rust (roya), why this week is risky, and exactly what low-cost step to take and when.

## The Unique Kernel
The photo, the week's weather, and the next step stay in one Spanish reply. A diagnosis alone is not the product. The grower also hears why this week is risky for roya and what low-cost step to take, and when, including the next dry spraying window.

## Who It's For
A small coffee grower with 1–5 manzanas in Santa Ana, Ahuachapán, or Chalatenango. They use a phone, literacy is patchy, and they already use WhatsApp. Today they look at a leaf and guess, or they wait to ask someone.

## The Core Loop
They open AgroClima, take or upload one leaf photo, and share a location or pick a place. They get a diagnosis (roya, healthy, other problem, or retake the photo) with a confidence, a 7-day rust-risk strip with a reason for each day, and an action plan. They can hear it in Spanish and send it to WhatsApp.

## Inspiration & Identity
One phone screen, large Spanish text, high contrast, short sentences, no map, no account. Tone is practical and calm, like a neighbor who grows coffee, not a dashboard.

## Why This Matters
A grower with one leaf in hand needs a single answer: whether it is roya, whether this week makes rust more likely, and the next low-cost step, including when the leaves can dry. Success is that this works end to end on the live URL, in Spanish, on a phone.

## What "Working" Looks Like
On a phone, in Spanish: one leaf photo goes in, and the grower hears whether it is roya, why the next seven days are or are not risky, and the low-cost step with the next dry spraying window. They can send that same answer to WhatsApp. The spoken answer that ties the leaf and this week's weather to one next step is the product.

## The POC Boundary
Coffee leaf rust only. El Salvador only. No accounts, no database, no maps. The risk engine is a separate tested module. API keys stay on the server.

The one flow is: photo plus place, hosted vision diagnosis, 7-day Open-Meteo risk strip with a cited reason per day, action plan (what, how much, when, next dry spraying window), read aloud in Spanish, share to WhatsApp.

## Later
Other crops and diseases, offline mode, co-op dashboards, and SMS. These are later work, not this proof.

## Explicitly Cut
- Other crops and diseases — the proof is roya on coffee, and a second disease would hide whether that loop works.
- Offline mode — the proof uses a hosted vision model and a live forecast.
- Co-op dashboards — the user is one grower on a phone, not a cooperative office.
- SMS — they already use WhatsApp, and SMS is a second channel.
- Accounts, a database, and maps — out of scope. Nothing has to be saved, and a map does not prove the kernel.

## Assumptions
Each line below is the simplest option that still fits the grower.

- Review format is Markdown.
- Look and feel is one column, large type, high contrast, Spanish (`es`), short sentences. No illustration system.
- The picker is three departments: Santa Ana, Ahuachapán, Chalatenango. Optional browser location only chooses the nearest of the three. Finer municipalities are not in this proof. No map.
- Nothing is stored when they leave. The answer lives on the page until they close it.
- Read aloud uses the phone's built-in Spanish speech, not a paid voice service.
- WhatsApp share is a `wa.me` link with the answer text, not the WhatsApp Business API.
- The vision call is one server-side OpenAI-compatible vision request. The base URL, key, and model name come from environment variables. The key never reaches the browser.
- No low-cost product or dose is named here. No dose is invented. The action text is written only when a published source is attached to that step. Until then the plan can still say when the next dry window is.
- A dry spraying window is the simplest weather reading that matches the action: a few upcoming hours with precipitation under 0.1 mm. That threshold is an assumption to confirm against a cited spraying practice, not a published rule by itself.
- This pass of the repository is the shell: Spanish home page, health check, risk-module stub with one test, continuous checks, and a deploy workflow. The photo-to-plan journey is specified and not built yet.
