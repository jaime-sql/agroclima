import { shortSha } from "@/lib/build-sha";

export function GET() {
  return Response.json({ ok: true, sha: shortSha(process.env.BUILD_SHA) });
}
