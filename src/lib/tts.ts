export const TTS_MODEL = "eleven_multilingual_v2";
export const TTS_MAX_CHARS = 2500;
export const LISTEN_FAILED = "No pudimos leer en voz alta.";
const TTS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";

export type TtsEnv = {
  apiKey?: string;
  voiceId?: string;
};

export type AudioCache = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

export type SpeechResult =
  | { ok: true; bytes: Uint8Array; contentType: "audio/mpeg"; cached: boolean }
  | { ok: false; error: "unavailable" | "failed" };

export function capTtsText(text: string): string {
  return [...text.trim()].slice(0, TTS_MAX_CHARS).join("");
}

export async function hashTtsText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function ttsCacheRequest(hash: string): Request {
  return new Request(`https://agroclima.internal/tts/${hash}`);
}

export function audioBody(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export function listenFallback(input: {
  serverAudio: boolean;
  hasSpanishVoice: boolean;
}): "server" | "browser" | "failed" {
  if (input.serverAudio) return "server";
  if (input.hasSpanishVoice) return "browser";
  return "failed";
}

export async function synthesizeSpeech(options: {
  text: string;
  env: TtsEnv;
  fetchImpl?: typeof fetch;
  cache?: AudioCache | null;
}): Promise<SpeechResult> {
  if (typeof options.text !== "string") return { ok: false, error: "failed" };
  const text = capTtsText(options.text);
  if (!text) return { ok: false, error: "failed" };

  const apiKey = options.env.apiKey?.trim() ?? "";
  const voiceId = options.env.voiceId?.trim() ?? "";
  if (!apiKey || !voiceId) return { ok: false, error: "unavailable" };

  const cacheKey = ttsCacheRequest(await hashTtsText(text));
  const cached = await readCachedAudio(options.cache, cacheKey);
  if (cached) return cached;

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${TTS_ENDPOINT}/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text, model_id: TTS_MODEL }),
    });
  } catch {
    return { ok: false, error: "failed" };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.startsWith("audio/")) {
    return { ok: false, error: "failed" };
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) return { ok: false, error: "failed" };
  await storeCachedAudio(options.cache, cacheKey, bytes);
  return { ok: true, bytes, contentType: "audio/mpeg", cached: false };
}

async function readCachedAudio(
  cache: AudioCache | null | undefined,
  request: Request,
): Promise<SpeechResult | null> {
  if (!cache) return null;
  try {
    const hit = await cache.match(request);
    if (!hit?.ok) return null;
    const bytes = new Uint8Array(await hit.arrayBuffer());
    if (bytes.byteLength === 0) return null;
    return { ok: true, bytes, contentType: "audio/mpeg", cached: true };
  } catch {
    return null;
  }
}

async function storeCachedAudio(
  cache: AudioCache | null | undefined,
  request: Request,
  bytes: Uint8Array,
): Promise<void> {
  if (!cache) return;
  try {
    await cache.put(
      request,
      new Response(audioBody(bytes), {
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );
  } catch {
    // A cache miss on the next tap is still a valid listen.
  }
}
