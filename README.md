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

Open http://localhost:3000. The page is in Spanish: take or upload a leaf photo, pick Santa Ana, Ahuachapán, or Chalatenango (or use the phone location), then review the leaf. `GET /api/health` returns `{ "ok": true, "sha": "dev" }` locally, and the deployed short commit SHA after a deploy build. `GET /api/risk?place=santa-ana` returns the 7-day rust risk. `POST /api/diagnose` returns `{ "ok": false, "error": "unavailable" }` until the Worker secret `OPENAI_API_KEY` is set (`VISION_MODEL` defaults to `gpt-4.1-mini`). `POST /api/tts` stays unavailable until `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are set, and Escuchar then uses the phone voice. `POST /api/ask` answers from the plan screen. With Worker secrets `BLAXEL_ASK_URL` and `BLAXEL_API_KEY` it asks the Blaxel agent first. Without both of those, it calls OpenAI directly when `OPENAI_API_KEY` is set, and otherwise tells the farmer to ask an agronomist.

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

## Hosting

The site, the 7-day risk API, diagnosis, and Escuchar run on the Cloudflare Worker `agroclima`. Pregúntele a AgroClima can run on Blaxel as the agent `agroclima-ask` in workspace `hackatonhf2025`. The Worker and that agent share one prompt, the same refusal sentence, and the same caps. Audio cache stays on Cloudflare R2 and is optional.

| Piece | Where |
| --- | --- |
| Worker `agroclima` (pages, `/api/risk`, `/api/diagnose`, `/api/tts`, `/api/ask`) | Cloudflare Workers |
| Ask agent `agroclima-ask` | Blaxel |
| Bucket `agroclima-audio` | Cloudflare R2, optional |

Deploy the ask agent by hand with `blaxel/deploy.sh`. There is no Blaxel GitHub Action. The key stays out of the repo and out of GitHub. `bl deploy` uploads only the directory it starts in, so the script copies `blaxel/ask-agent` into a temp directory (without `node_modules` or tests), copies `src/lib/ask-core.ts` and `src/lib/openai.ts` to `src/shared/`, rewrites the service imports to `./shared/`, and runs `bl deploy --yes --wait -s OPENAI_API_KEY="$OPENAI_API_KEY"` there. The key is read from the environment. The script does not print it and does not write it to disk. The committed service still imports `src/lib`, so the Worker and the agent keep one source file.

Set `OPENAI_API_KEY` in the environment, then:

```bash
./blaxel/deploy.sh
```

`VISION_MODEL` defaults to `gpt-4.1-mini`. `VISION_API_BASE_URL` defaults to `https://api.openai.com/v1`. Do not put the key in `blaxel.toml`. Local `npm start` and `npm run dev` in `blaxel/ask-agent` use `tsx` and bind `HOST` and `PORT`.

On the Worker, set secrets `BLAXEL_ASK_URL` (`https://run.blaxel.ai/hackatonhf2025/agents/agroclima-ask`) and `BLAXEL_API_KEY`. The live agent endpoint is `POST https://run.blaxel.ai/hackatonhf2025/agents/agroclima-ask` with headers `X-Blaxel-Authorization: Bearer <token>` and `X-Blaxel-Workspace: hackatonhf2025`, and body `{ "question", "grounding" }`. The call times out after 8 seconds. A timeout, a network error, or any non-200 falls back to the Worker's direct OpenAI call. If either secret is missing, that direct call is the only path. The response header `X-Agroclima-Backend` is `blaxel` or `direct`.

```bash
curl -sS -X POST "https://run.blaxel.ai/hackatonhf2025/agents/agroclima-ask" -H "Content-Type: application/json" -H "X-Blaxel-Authorization: Bearer <token>" -H "X-Blaxel-Workspace: hackatonhf2025" -d '{"question":"¿Qué significa Probable?","grounding":{"place":"Zona cafetalera de Santa Ana","timezone":"America/El_Salvador","days":[],"diagnosis":null}}'
```

`GET /health` on the agent returns 200.

## Ask decisions

A fixed check runs before any model call, on the Worker and on the Blaxel agent. It refuses doses, quantities, mixing, product or brand requests, treatment how-to, instruction overrides, prompt reveals, and other crops, and it returns the exact refusal sentence without calling OpenAI. The model still answers questions the check allows, including what Probable, Alto, Medio, and Bajo mean, and whether the weather is from the farm. That second step exists because the check only catches obvious requests. The model must not invent a dose or repeat its own prompt.

## Known limitations

The place points are representative coffee zones (ISC origin zones Apaneca-Ilamatepec and Alotepec), not the user's farm. At 1,200-1,450 m, December, March, and April often score high under the Avelino 2015 temperature rule, not yet validated by an agronomist.

## Riesgo del clima

Estos umbrales de riesgo son una estimación nuestra y no han sido validados por PROCAFE ni por el MAG.

The weather rules and their citations are in `docs/rust-risk-rules.md`. The plan names a fungicide class and says "dosis según etiqueta / su agrónomo". It does not give a numeric dose.
