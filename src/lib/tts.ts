export const TTS_MODEL = "eleven_multilingual_v2";
export const TTS_MAX_CHARS = 2500;
export const LISTEN_FAILED = "No pudimos leer en voz alta.";
const TTS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";

export type TtsEnv = {
  apiKey?: string;
  voiceId?: string;
};

/** R2-shaped cache. A missing binding is null and listening still plays. */
export type AudioBucket = {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
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

export function audioCacheKey(text: string, voiceId: string): Promise<string> {
  return hashTtsText(`${text}${voiceId}`);
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
  bucket?: AudioBucket | null;
}): Promise<SpeechResult> {
  if (typeof options.text !== "string") return { ok: false, error: "failed" };
  const text = capTtsText(options.text);
  if (!text) return { ok: false, error: "failed" };

  const apiKey = options.env.apiKey?.trim() ?? "";
  const voiceId = options.env.voiceId?.trim() ?? "";
  if (!apiKey || !voiceId) return { ok: false, error: "unavailable" };

  const key = await audioCacheKey(text, voiceId);
  const cached = await readCachedAudio(options.bucket, key);
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
  await storeCachedAudio(options.bucket, key, bytes);
  return { ok: true, bytes, contentType: "audio/mpeg", cached: false };
}

async function readCachedAudio(
  bucket: AudioBucket | null | undefined,
  key: string,
): Promise<SpeechResult | null> {
  if (!bucket) return null;
  try {
    const hit = await bucket.get(key);
    if (!hit) return null;
    const bytes = new Uint8Array(await hit.arrayBuffer());
    if (bytes.byteLength === 0) return null;
    return { ok: true, bytes, contentType: "audio/mpeg", cached: true };
  } catch {
    return null;
  }
}

async function storeCachedAudio(
  bucket: AudioBucket | null | undefined,
  key: string,
  bytes: Uint8Array,
): Promise<void> {
  if (!bucket) return;
  try {
    await bucket.put(key, audioBody(bytes), {
      httpMetadata: { contentType: "audio/mpeg" },
    });
  } catch {
    // A missed write still leaves this tap with audio.
  }
}
