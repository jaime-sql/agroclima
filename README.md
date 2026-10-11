# AgroClima

A small coffee farmer in El Salvador takes one photo of a leaf and, in Spanish, hears whether it's coffee leaf rust (roya), why this week is risky, and exactly what low-cost step to take and when.

## Prior work

Ideas only. No code from these projects is reused here.

- AgroSmart-Corporation (Jaime)
- WebMCPHackChallenge / AgriMCP (Jaime)
- crafterhack / AgroVision Pro (team: jaime-sql, raulpenate, geodesicas, Luis)

## Try it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The page is in Spanish: take or upload a leaf photo, pick Santa Ana, Ahuachapán, or Chalatenango (or use the phone location), then review the leaf. `GET /api/health` returns `{ "ok": true, "sha": "dev" }` locally, and the deployed short commit SHA after a deploy build. `GET /api/risk?place=santa-ana` returns the 7-day rust risk. `POST /api/diagnose` returns `{ "ok": false, "error": "unavailable" }` until the Worker secret `OPENAI_API_KEY` is set (`VISION_MODEL` defaults to `gpt-4.1-mini`). `POST /api/tts` stays unavailable until `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are set, and Escuchar then uses the phone voice. `POST /api/ask` answers from the plan screen only when `OPENAI_API_KEY` is set, and otherwise tells the farmer to ask an agronomist.

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run build:cloudflare
```

A live Worker needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, then `npx wrangler deploy --no-autoconfig`. The flag keeps the OpenNext config. The deploy workflow skips with a message when those GitHub Actions secrets are missing. Planning notes are in `devpost/`.

Escuchar stores audio in the R2 bucket `agroclima-audio` (binding `AUDIO_CACHE` in `wrangler.jsonc`). The object key is the SHA-256 of the capped text plus the voice id. Create the bucket once before a deploy that should cache audio:

```bash
npx wrangler r2 bucket create agroclima-audio
```

The deploy workflow runs that create. A successful create, or a reply that the bucket already exists, keeps the `AUDIO_CACHE` binding. If R2 is not enabled (`code: 10042`) or the create fails for any other reason, that step still succeeds and removes the binding from the deploy config. `wrangler deploy` then publishes the Worker, and Escuchar plays without a cache. The binding stays in the committed `wrangler.jsonc` for an account where R2 is enabled.

## Known limitations

The place points are representative coffee zones (ISC origin zones Apaneca-Ilamatepec and Alotepec), not the user's farm. At 1,200-1,450 m, December, March, and April often score high under the Avelino 2015 temperature rule, not yet validated by an agronomist.

## Riesgo del clima

Estos umbrales de riesgo son una estimación nuestra y no han sido validados por PROCAFE ni por el MAG.

The weather rules and their citations are in `docs/rust-risk-rules.md`. The plan names a fungicide class and says "dosis según etiqueta / su agrónomo". It does not give a numeric dose.
