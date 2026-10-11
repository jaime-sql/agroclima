import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LISTEN_FAILED,
  TTS_MAX_CHARS,
  TTS_MODEL,
  audioCacheKey,
  capTtsText,
  listenFallback,
  synthesizeSpeech,
  type AudioBucket,
} from "./tts.ts";

function memoryBucket(): AudioBucket & { puts: number; keys: string[] } {
  const store = new Map<string, ArrayBuffer>();
  return {
    puts: 0,
    keys: [],
    async get(key) {
      const hit = store.get(key);
      if (!hit) return null;
      const copy = hit.slice(0);
      return { async arrayBuffer() { return copy; } };
    },
    async put(key, value) {
      this.puts += 1;
      this.keys.push(key);
      store.set(key, value.slice(0));
    },
  };
}

describe("text to speech", () => {
  it("does not call ElevenLabs when the key or the voice id is missing", async () => {
    let called = false;
    const fetchImpl: typeof fetch = async () => {
      called = true;
      return new Response("no");
    };
    const missingKey = await synthesizeSpeech({
      text: "Riesgo alto el lunes.",
      env: { apiKey: "", voiceId: "voice-1" },
      fetchImpl,
    });
    const missingVoice = await synthesizeSpeech({
      text: "Riesgo alto el lunes.",
      env: { apiKey: "secret" },
      fetchImpl,
    });
    assert.equal(called, false);
    assert.deepEqual(missingKey, { ok: false, error: "unavailable" });
    assert.deepEqual(missingVoice, { ok: false, error: "unavailable" });
    assert.equal(LISTEN_FAILED, "No pudimos leer en voz alta.");
  });

  it("caps the text, uses the Spanish multilingual model, and caches the audio by that hash", async () => {
    const text = `${"á".repeat(TTS_MAX_CHARS)} extra que no debe enviarse`;
    const capped = capTtsText(text);
    assert.equal([...capped].length, TTS_MAX_CHARS);
    assert.equal(capped.endsWith("extra"), false);
    const bucket = memoryBucket();
    let calls = 0;
    let sent = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      calls += 1;
      assert.equal(String(input), "https://api.elevenlabs.io/v1/text-to-speech/voice-1");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("xi-api-key"), "secret");
      assert.equal(headers.get("accept"), "audio/mpeg");
      const body = JSON.parse(String(init?.body)) as { text: string; model_id: string };
      sent = body.text;
      assert.equal(body.model_id, TTS_MODEL);
      assert.equal(body.model_id, "eleven_multilingual_v2");
      return new Response(Uint8Array.from([1, 2, 3]), {
        headers: { "Content-Type": "audio/mpeg" },
      });
    };
    const first = await synthesizeSpeech({
      text,
      env: { apiKey: "secret", voiceId: "voice-1" },
      fetchImpl,
      bucket,
    });
    const second = await synthesizeSpeech({
      text,
      env: { apiKey: "secret", voiceId: "voice-1" },
      fetchImpl,
      bucket,
    });
    const skipped = await synthesizeSpeech({
      text,
      env: { apiKey: "secret", voiceId: "voice-1" },
      fetchImpl,
      bucket: null,
    });
    assert.equal(sent, capped);
    assert.equal(calls, 2);
    assert.equal(bucket.puts, 1);
    assert.deepEqual(bucket.keys, [await audioCacheKey(capped, "voice-1")]);
    assert.notEqual(bucket.keys[0], await audioCacheKey(capped, "other-voice"));
    assert.equal(first.ok && first.cached, false);
    assert.equal(second.ok && second.cached, true);
    assert.equal(skipped.ok && skipped.cached, false);
    if (first.ok && second.ok) {
      assert.deepEqual(second.bytes, first.bytes);
    }
  });

  it("does not cache a vendor error, and falls back when there is no server audio", async () => {
    const bucket = memoryBucket();
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response("no", { status: 500, headers: { "Content-Type": "application/json" } });
    };
    const failed = await synthesizeSpeech({
      text: "Riesgo alto.",
      env: { apiKey: "secret", voiceId: "voice-1" },
      fetchImpl,
      bucket,
    });
    await synthesizeSpeech({
      text: "Riesgo alto.",
      env: { apiKey: "secret", voiceId: "voice-1" },
      fetchImpl,
      bucket,
    });
    assert.deepEqual(failed, { ok: false, error: "failed" });
    assert.equal(calls, 2);
    assert.equal(bucket.puts, 0);
    assert.equal(listenFallback({ serverAudio: false, hasSpanishVoice: true }), "browser");
    assert.equal(listenFallback({ serverAudio: true, hasSpanishVoice: false }), "server");
    assert.equal(listenFallback({ serverAudio: false, hasSpanishVoice: false }), "failed");
  });
});
