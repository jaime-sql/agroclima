import { loadPlaceMap, PLACES_FORECAST_CACHE_MS } from "@/lib/risk/places-forecast";

export async function GET() {
  const result = await loadPlaceMap();
  const maxAge = Math.round(PLACES_FORECAST_CACHE_MS / 1000);
  return Response.json(result, {
    status: result.ok ? 200 : 502,
    headers: result.ok
      ? { "Cache-Control": `public, max-age=${maxAge}` }
      : { "Cache-Control": "no-store" },
  });
}
