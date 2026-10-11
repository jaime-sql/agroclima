import { readAudioBucket, readServerEnv } from "@/lib/server-env";
import { audioBody, synthesizeSpeech } from "@/lib/tts";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "failed" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const text =
    body && typeof body === "object" && typeof (body as { text?: unknown }).text === "string"
      ? (body as { text: string }).text
      : "";
  const env = readServerEnv();
  const result = await synthesizeSpeech({
    text,
    env: { apiKey: env.ELEVENLABS_API_KEY, voiceId: env.ELEVENLABS_VOICE_ID },
    bucket: readAudioBucket(),
  });
  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error },
      {
        status: result.error === "unavailable" ? 503 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  return new Response(audioBody(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "no-store",
      "X-Agroclima-Tts-Cache": result.cached ? "hit" : "miss",
    },
  });
}
