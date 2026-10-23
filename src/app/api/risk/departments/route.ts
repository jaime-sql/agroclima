import { DEPARTMENT_CACHE_TTL_MS, loadDepartmentRisk } from "@/lib/risk/department-forecast";
import { readRiskKv } from "@/lib/server-env";

export async function GET() {
  const result = await loadDepartmentRisk({ kv: readRiskKv() });
  if (!result.ok) {
    return Response.json(result, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const maxAge = Math.round(DEPARTMENT_CACHE_TTL_MS / 1000);
  return Response.json(result.body, {
    status: 200,
    headers: { "Cache-Control": `public, max-age=${maxAge}` },
  });
}
