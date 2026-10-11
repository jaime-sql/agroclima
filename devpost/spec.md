---
doc: spec
status: approved
---

# AgroClima — Technical Spec

## How This Works, In Plain Language
The grower's phone loads one Spanish page. The page sends the leaf photo and the chosen place to this app's own server. The server asks a hosted vision model what the leaf shows, asks Open-Meteo for the next week of weather at that place, and asks a small risk module what those numbers mean for roya. The page then shows the diagnosis, the seven days, and the plan, and it can speak them or hand them to WhatsApp.

The risk module does not know about the web page. It takes weather numbers and returns a level and a reason. That is why it can be tested on its own.

This shape is a single Next.js app on Cloudflare Workers. There is no database and no login. A separate frontend, a separate API server, and a database would be more moving parts than this proof needs.

The shell does not call the vision model yet. It serves the Spanish home line, answers a health check, and scores a 7-day Open-Meteo forecast in `src/lib/risk` using `docs/rust-risk-rules.md`. The page does not show that score yet.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. The phone opens `/`. The server renders the Spanish page. In this pass that page is the name and the promise only.
2. Later, the page sends the photo and the department to `POST /api/diagnose` on this same app. The handler reads `VISION_API_KEY` on the server, calls the vision endpoint, and returns one of roya, sana, otro problema, or retomar, plus a confidence. The key is not in the response.
3. The page, or that same handler, calls `GET /api/risk?place=chalatenango`. The handler looks up a fixed point for that department, calls Open-Meteo, and passes each day's humidity, rain, and temperature into `src/lib/risk`. The module returns seven days.
4. The action helper reads the diagnosis and the seven days and returns what, how much, when, and the next dry window. "How much" stays empty until a citation is in the code.
5. The browser speaks the answer with `speechSynthesis` in Spanish, and opens `https://wa.me/?text=` with the same words.
6. `GET /api/health` returns `{ "ok": true }` so a deploy can be checked without a photo.

## Stack
- TypeScript and Next.js 16.4.0 App Router. Documentation: https://nextjs.org/docs/app
- React 19.3.0.
- Cloudflare Workers through `@opennextjs/cloudflare` 1.20.10. Documentation: https://opennext.js.org/cloudflare and https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
- Wrangler 4.149.0, config in `wrangler.jsonc`. Documentation: https://developers.cloudflare.com/workers/wrangler/
- Node.js 22 for local checks and GitHub Actions.
- Unit tests for the risk module use Node's built-in test runner. No test service.

The entrant asked for this stack in the build instructions. The brief did not name a framework. The tradeoff is that OpenNext is an extra build step, and Cloudflare's current default for new Next.js apps is vinext. OpenNext is still the choice, because the build instructions name `@opennextjs/cloudflare`. Peer range checked at install: Next `>=15.5.27 <16 || >=16.3.8`, which 16.4.0 satisfies.

## Where It Runs and How Someone Tries It
The app is a server-rendered page plus route handlers, deployed as one Worker. Local development needs Node.js 22. Vision keys are optional until the diagnosis slice exists. Open-Meteo needs no key.

Local demo of the shell:

```bash
npm install
npm run dev
```

Open http://localhost:3000 and expect the name AgroClima and the Spanish promise. `GET http://localhost:3000/api/health` returns `{ "ok": true }`.

Checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run build:cloudflare
```

`npm run build` is `next build`. `npm run build:cloudflare` is the OpenNext build that produces `.open-next/` for Wrangler.

Submission still needs a public GitHub repository and a video under 3 minutes. Deployment is how reviewers open the live URL the brief's Success section asks for. It is not a substitute for the video.

Deploy target: Cloudflare Workers, Worker name `agroclima`.

```bash
npx wrangler deploy --no-autoconfig
```

`--no-autoconfig` keeps this OpenNext setup. Wrangler's default autoconfig would treat a Next.js app as vinext.

GitHub Actions (`.github/workflows/deploy.yml`) runs that on pushes to `main`. It reads secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. If either is missing it prints a clear skip message and exits successfully. It does not try to create credentials.

After a real deploy, the live URL is `https://agroclima.<account-subdomain>.workers.dev` unless a custom domain is added. The account subdomain is not known until someone deploys.

## Look and Feel
From `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`. One column, large body type, high contrast, light background, dark text, Spanish `lang="es"`. System font stack is enough. No component library. Tailwind may be present if `create-next-app` includes it; it is only for spacing and type size, not a theme.

## Components

### Página de inicio
Renders the name and the Spanish promise. Later it hosts the photo control, the place control, and the answer.
PRD ref: `prd.md > Screens and Layout`.

### Foto y lugar
A file input with camera capture, a select of three departments, and an optional geolocation button that only sets that select. Places and their coordinates live in one module, not in a map library.
PRD ref: `prd.md > Foto y lugar`.

### Diagnóstico
Server route. Builds an OpenAI-compatible chat request with the image, parses the four-way label and a confidence, and returns Spanish copy. Failures become "tomar la foto de nuevo."
PRD ref: `prd.md > Diagnóstico`.

### Motor de riesgo
`src/lib/risk`. Pure functions over parsed Open-Meteo hours and days. No network inside this module. Daily level is bajo, medio, or alto from `docs/rust-risk-rules.md`, with one Spanish reason. A dry day is bajo. The footer says the cutoffs are our estimate and are not validated by PROCAFE or MAG.
PRD ref: `prd.md > Riesgo de la semana`.

### Pronóstico
`src/lib/weather/openmeteo.ts` fetches Open-Meteo for a latitude and longitude. The three points are the GeoNames seats of Santa Ana, Ahuachapán, and Chalatenango.
PRD ref: `prd.md > Riesgo de la semana`.

### Plan de acción
Pure helper in the risk module. Fungicide class only (`cobre`, `triazol`, `triazol+estrobilurina`) plus "dosis según etiqueta / su agrónomo". No numeric dose. The next dry window is 4 hours with precipitation under 0.1 mm, probability under 40%, and RH under 90. The 4 h and 40% are our safety margin.
PRD ref: `prd.md > Plan de acción`.

### Escuchar y WhatsApp
Browser only. `speechSynthesis` with `lang` `es-SV` (fall back to `es`). A link to `https://wa.me/?text=` plus the encoded answer.
PRD ref: `prd.md > Escuchar y WhatsApp`.

### Salud
`GET /api/health` returns `{ "ok": true }`.
PRD ref: `prd.md > The Core Journey` step 6 of the system trace above.

## Data Model
Nothing is stored. No tables.

A request holds, in memory only:

- `photo`: bytes from the upload, discarded after the vision call.
- `place`: `santa-ana` | `ahuachapan` | `chalatenango`.
- `diagnosis`: `{ label: "roya" | "sana" | "otro" | "retomar", confidence: number }`.
- `DayAssessment`: `{ date, level: "bajo" | "medio" | "alto", reason, score, wetHours, warmWetHours }` for each forecast day.
- `plan`: fungicide classes, `doseNote` ("dosis según etiqueta / su agrónomo"), and `nextDryWindow` or null. No numeric dose.

When they leave, all of it is gone. Refreshing starts over. That matches "no database."

## File Structure

```
agroclima/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # html lang=es
│   │   ├── page.tsx                # home: name + promise (shell)
│   │   ├── globals.css
│   │   └── api/
│   │       ├── health/route.ts     # { ok: true } (shell)
│   │       ├── diagnose/route.ts   # later
│   │       └── risk/route.ts       # later
│   └── lib/
│       ├── risk/
│       │   ├── types.ts            # parsed Open-Meteo forecast and day result
│       │   ├── assess.ts           # pure rust score, spray window, plan
│       │   └── assess.test.ts      # one test per rule, no network
│       ├── weather/
│       │   ├── openmeteo.ts        # fetch by lat/lon for the three departments
│       │   └── openmeteo.test.ts   # URL only, no network
│       └── vision/                 # later: hosted model client
├── docs/
│   └── rust-risk-rules.md          # approved rules and citations
├── devpost/                        # scope, prd, spec; learner profile is gitignored
├── .github/workflows/
│   ├── ci.yml                      # lint, typecheck, test
│   └── deploy.yml                  # wrangler deploy, or a clear skip
├── open-next.config.ts
├── wrangler.jsonc
├── .env.example                    # names only
├── package.json
└── README.md
```

The shell creates the files marked "(shell)". Later files stay out until their slice.

## External Services and Dependencies

### Open-Meteo forecast
No key. Non-commercial use of the free API fits this proof; confirm that before a production traffic spike. Docs: https://open-meteo.com/en/docs

`GET https://api.open-meteo.com/v1/forecast`

Query: `latitude`, `longitude`, `hourly=temperature_2m,relative_humidity_2m,precipitation,precipitation_probability`, `daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_hours,precipitation_probability_max`, `forecast_days=7`, `timezone=America/El_Salvador`.

The pure scorer uses those fields as named in `docs/rust-risk-rules.md`. It does not average them into one temperature.

Fixed points are the GeoNames seats of the three departments (PPLA), cited in `src/lib/weather/openmeteo.ts`:

| Place id | Name | Latitude | Longitude |
| --- | --- | --- | --- |
| `santa-ana` | Santa Ana | 13.98827 | -89.55685 |
| `ahuachapan` | Ahuachapán | 13.92403 | -89.84344 |
| `chalatenango` | Chalatenango | 14.04138 | -88.93951 |

If the browser supplies coordinates, pick the row with the smallest squared distance. Do not store the raw position.

Rate limits: the free API asks for fair use. One forecast per diagnosis is enough. If the call fails, the diagnosis still returns and the week shows the forecast-missing state.

### Hosted vision model
Docs for the wire shape: https://platform.openai.com/docs/guides/images-vision (OpenAI-compatible chat completions). The vendor is not chosen. Set these on the server only, names with empty values in `.env.example`:

- `VISION_API_BASE_URL` — origin plus path prefix, no trailing slash, for example a provider's `/v1` base
- `VISION_API_KEY`
- `VISION_MODEL`

`POST {VISION_API_BASE_URL}/chat/completions`

Header: `Authorization: Bearer <VISION_API_KEY>`.

Body: `model`, one user message, text instruction plus the image as an `image_url` data URL. Instruction asks for JSON only: `label` of `roya` | `sana` | `otro` | `retomar`, and `confidence` from 0 to 1. Temperature 0.

Anything other than that JSON, or any HTTP error, becomes `retomar` with confidence 0. Cost and rate limits depend on the vendor the entrant picks. Unverified until that vendor is set: image size limits and whether `image_url` accepts a data URL. Check both on the first real photo.

### Browser speech and WhatsApp
No key. `speechSynthesis` is built into the phone browser. `https://wa.me/?text=` is a normal link. If speech is missing, the text remains.

### Cloudflare Workers
Hosting. Docs: https://developers.cloudflare.com/workers/. Secrets for deploy are `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in GitHub Actions, and the same token for a local `wrangler deploy`. Worker observability: logs and traces enabled in `wrangler.jsonc`.

The scoring rules and citations are `docs/rust-risk-rules.md`. Open-Meteo does not return leaf wetness. A wet hour is relative humidity at or above 90%, or precipitation of at least 0.1 mm. The footer on the assessment says these cutoffs are our estimate and have not been validated by PROCAFE or MAG.

## Important Failure Modes

- **Vision key missing, vendor down, or unreadable photo** → the page says to take the photo again. No key, no error object, no fake disease.
- **Open-Meteo down or a place id the server does not know** → diagnosis still shows; the week says the forecast is unavailable; no made-up window.
- **Phone has no speech, or WhatsApp is not installed** → the answer text stays on the page; the WhatsApp control is still a link.

## What Was Simplified and Why

- **The risk score is computed, and the home page does not show it yet** — the module and its tests are in place; the photo flow is still later.
- **Three department points** instead of a municipality gazetteer or GPS traces — the brief names those three areas and forbids maps. A gazetteer would not make the kernel clearer.
- **`wa.me` and built-in speech** instead of WhatsApp's API and a voice vendor — same share and listen behaviors, no extra accounts.
- **Class name, not a numeric dose** — the plan says "dosis según etiqueta / su agrónomo". Trial rates in the rules doc stay in that doc.
- **Health check and home line** as the first runnable slice — reviewers can open the URL before a model key exists.

## Decisions and Open Issues
- Stack is Next.js on Cloudflare via OpenNext. Chosen in the build instructions, not in the brief. Tradeoff: vinext is Cloudflare's newer default; OpenNext matches the requested package. Agreement is the written build instruction.
- Vision is one OpenAI-compatible call configured by env. Chosen as the simplest vendor-shaped hole, because the brief did not name a model. Tradeoff: the entrant must supply a key and confirm image upload limits. Not attributed as their product preference.
- Review format, speech, WhatsApp link, three places, and no invented dose are the assumptions in `scope.md > Assumptions where the brief was silent`.
- No learner uncertainty was discussed. There was no live interview. The open technical check during the diagnosis slice is whether the chosen vision endpoint accepts a data-URL image and returns the JSON label. Evidence: one real photo against `POST /api/diagnose` once that route exists.
- Open from `prd.md > Open Questions`: the cited low-cost step and dose, and the dry-window threshold. Neither blocks the shell.
