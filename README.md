# AgroClima

A small coffee farmer in El Salvador takes one photo of a leaf and, in Spanish, hears whether it's coffee leaf rust (roya), why this week is risky, and exactly what low-cost step to take and when.

## Prior work

Ideas only. No code from these projects is reused here.

- AgroSmart-Corporation (Jaime)
- WebMCPHackChallenge / AgriMCP (Jaime)
- crafterhack / AgroVision Pro (team: jaime-sql, raulpenate, geodesicas, Luis)

## Try the shell

```bash
npm install
npm run dev
```

Open http://localhost:3000. `GET /api/health` returns `{ "ok": true }`.

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run build:cloudflare
```

A live Worker needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, then `npx wrangler deploy --no-autoconfig`. The flag keeps the OpenNext config. The deploy workflow skips with a message when those GitHub Actions secrets are missing. Planning notes are in `devpost/`.

## Riesgo del clima

Estos umbrales de riesgo son una estimación nuestra y no han sido validados por PROCAFE ni por el MAG.

The weather rules and their citations are in `docs/rust-risk-rules.md`. The plan names a fungicide class and says "dosis según etiqueta / su agrónomo". It does not give a numeric dose.
