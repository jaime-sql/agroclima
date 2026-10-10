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

A live Worker needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, then `npx wrangler deploy`. The deploy workflow skips with a message when those GitHub Actions secrets are missing. Planning notes are in `devpost/`.
