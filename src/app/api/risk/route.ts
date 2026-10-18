import { handleRiskQuery } from "@/lib/risk/load";

export async function GET(request: Request) {
  const result = await handleRiskQuery(new URL(request.url));
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
