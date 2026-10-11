import { getCloudflareContext } from "@opennextjs/cloudflare";

const NAMES = [
  "OPENAI_API_KEY",
  "VISION_MODEL",
  "VISION_API_BASE_URL",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
] as const;

export type ServerEnvName = (typeof NAMES)[number];
export type ServerEnv = Record<ServerEnvName, string | undefined>;

export function readServerEnv(): ServerEnv {
  let worker: Record<string, unknown> = {};
  try {
    worker = getCloudflareContext().env as Record<string, unknown>;
  } catch {
    worker = {};
  }
  const out = {} as ServerEnv;
  for (const name of NAMES) {
    const fromWorker = worker[name];
    const value =
      typeof fromWorker === "string" && fromWorker.trim()
        ? fromWorker
        : process.env[name];
    out[name] = value;
  }
  return out;
}
