import { answerQuestion, askHeaders, clientIp, readAskForce } from "@/lib/ask";
import { readServerEnv } from "@/lib/server-env";

const MAX_BODY = 20_000;

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) {
    return Response.json(
      {
        ok: false,
        error: "too_long",
        answer: "La pregunta es muy larga. Escríbala más corta.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json(
      { ok: false, error: "invalid", answer: "No pudimos leer la pregunta. Intente otra vez." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const env = readServerEnv();
  const force = readAskForce((name) => request.headers.get(name));
  const result = await answerQuestion({
    body,
    env: {
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.VISION_API_BASE_URL,
      model: env.VISION_MODEL,
      blaxelAskUrl: env.BLAXEL_ASK_URL,
      blaxelApiKey: env.BLAXEL_API_KEY,
    },
    ip: clientIp((name) => request.headers.get(name)),
    forceBackend: force.forceBackend,
    evalToken: force.evalToken,
  });
  return Response.json(
    { ok: result.ok, error: result.error, answer: result.answer, refused: result.refused },
    { status: result.status, headers: askHeaders(result) },
  );
}
