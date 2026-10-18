import {
  ASK_INVALID,
  ASK_TOO_LONG,
  ASK_TRY_AGAIN,
  answerQuestion,
  askGuardHeaders,
  askHeaders,
  clientIp,
  logAskEvent,
  readAskForce,
} from "@/lib/ask";
import { readServerEnv } from "@/lib/server-env";

const MAX_BODY = 20_000;

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) {
      return Response.json(
        { ok: false, error: "too_long", answer: ASK_TOO_LONG },
        { status: 400, headers: askGuardHeaders() },
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return Response.json(
        { ok: false, error: "invalid", answer: ASK_INVALID },
        { status: 400, headers: askGuardHeaders() },
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
  } catch {
    logAskEvent("ask_handler", "direct", Date.now() - started, "error");
    return Response.json(
      { ok: false, error: "failed", answer: ASK_TRY_AGAIN, refused: false },
      { status: 502, headers: askGuardHeaders() },
    );
  }
}
