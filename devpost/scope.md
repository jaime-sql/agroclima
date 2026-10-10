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
Not stated in the brief. The simplest direction that still fits the user: one phone screen, large Spanish text, high contrast, short sentences, no map, no account. Tone is practical and calm, like a neighbor who grows coffee, not a dashboard.

## Why This Matters to the Learner
Not stated beyond the entry itself. Jaime García is the solo entrant for Devpost Build With AI: Basics, due Monday October 26, 2026, 3:00 PM SV. Success in the brief: it works end to end on the live URL, about 20 real leaf photos are tested and the real hit rate is reported, and the video is under 3 minutes.

## What "Working" Looks Like
On a phone, in Spanish: one leaf photo goes in, and the grower hears whether it is roya, why the next seven days are or are not risky, and the low-cost step with the next dry spraying window. They can send that same answer to WhatsApp. The "oh, that's cool" beat is the spoken answer that ties the leaf and this week's weather to one next step.

## The POC Boundary
Coffee leaf rust only. El Salvador only. No accounts, no database, no maps. The risk engine is a separate tested module. API keys stay on the server.

The one flow is: photo plus place, hosted vision diagnosis, 7-day Open-Meteo risk strip with a cited reason per day, action plan (what, how much, when, next dry spraying window), read aloud in Spanish, share to WhatsApp.

## Later
Other crops and diseases, offline mode, co-op dashboards, and SMS. These are the brief's roadmap, not this proof.

## Explicitly Cut
- Other crops and diseases — the proof is roya on coffee, and a second disease would hide whether that loop works.
- Offline mode — the proof uses a hosted vision model and a live forecast.
- Co-op dashboards — the user is one grower on a phone, not a cooperative office.
- SMS — they already use WhatsApp, and SMS is a second channel.
- Accounts, a database, and maps — named out of scope in the brief. Nothing has to be saved for the demo, and a map does not prove the kernel.

## Assumptions where the brief was silent
The brief was the whole interview. Each line below is the simplest option, not a preference the entrant stated.

- Review format is Markdown.
- Coding experience, agent experience, plan-first experience, and a learning goal were not stated. They stay "not established" in the learner profile. Getting the proof working stands in for a learning goal because Success asks for a live URL, a reported hit rate, and a short video.
- Look and feel is one column, large type, high contrast, Spanish (`es`), short sentences. No illustration system.
- The brief says "pick municipality" and names three departments. The picker is those three: Santa Ana, Ahuachapán, Chalatenango. Optional browser location only chooses the nearest of the three. Finer municipalities are not in this proof. No map.
- Nothing is stored when they leave. The answer lives on the page until they close it.
- Read aloud uses the phone's built-in Spanish speech, not a paid voice service.
- WhatsApp share is a `wa.me` link with the answer text, not the WhatsApp Business API.
- The brief says "hosted vision model" and does not name a vendor. The call is one server-side OpenAI-compatible vision request. The base URL, key, and model name come from environment variables. The key never reaches the browser.
- The brief does not name the low-cost product or a dose. No dose is invented here. The action text is written only when a published source is attached to that step. Until then the plan can still say when the next dry window is.
- A dry spraying window is the simplest weather reading that matches the brief: a few upcoming hours with precipitation under 0.1 mm. That threshold is an assumption to confirm against a cited spraying practice, not a published rule by itself.
- This pass of the repository is the shell: Spanish home page, health check, risk-module stub with one test, continuous checks, and a deploy workflow. The photo-to-plan journey is specified and not built yet.
