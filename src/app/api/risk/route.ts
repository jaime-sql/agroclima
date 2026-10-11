import { loadPlaceRisk } from "@/lib/risk/load";

export async function GET(request: Request) {
  const place = new URL(request.url).searchParams.get("place") ?? "";
  const result = await loadPlaceRisk(place);
  const status = result.ok ? 200 : result.error === "unknown_place" ? 400 : 502;
  return Response.json(result, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
