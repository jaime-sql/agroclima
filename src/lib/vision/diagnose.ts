import { resolveOpenAI } from "../openai.ts";
import {
  CONFIRM_AGRONOMIST,
  ORIENTATION_ROYA,
  ORIENTATION_SANA,
  OTRO_DETAIL,
  RETAKE_COPY,
  SANA_DETAIL,
  UNSURE_DETAIL,
  type RetakeReason,
} from "./copy.ts";

export type VisionLabel = "roya" | "sana" | "otro" | "retomar";

export type ConfidenceBand = "seguro" | "probable" | "no_seguro";

export type VisionEnv = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export type Diagnosis =
  | {
      ok: true;
      label: VisionLabel;
      confidence: number;
      band: ConfidenceBand;
      retakeReason: RetakeReason | null;
      headline: string;
      detail: string;
      advice: string | null;
      card: string | null;
      percent: number;
    }
  | { ok: false; error: "unavailable" };

const LABELS = new Set<VisionLabel>(["roya", "sana", "otro", "retomar"]);

const INSTRUCTION = [
  "Mira una foto de una hoja de café en El Salvador.",
  "Responde solo JSON con estas claves:",
  'label: "roya" | "sana" | "otro" | "retomar",',
  "confidence: número de 0 a 1,",
  'retake_reason: "borrosa" | "no_hoja" | "lejos" | "otra" | null.',
  "Usa retomar si la foto no se puede leer.",
  "No des dosis ni nombres de productos.",
].join(" ");

export function interpretDiagnosis(
  label: VisionLabel,
  confidence: number,
  retakeReason: RetakeReason | null,
): Exclude<Diagnosis, { ok: false }> {
  const bounded = Math.min(1, Math.max(0, confidence));
  const percent = Math.round(bounded * 100);
  const reason = retakeReason ?? "otra";

  if (label === "retomar") {
    const copy = RETAKE_COPY[reason];
    return {
      ok: true,
      label,
      confidence: bounded,
      band: "no_seguro",
      retakeReason: reason,
      headline: "Repetir foto",
      detail: copy.reason,
      advice: copy.advice,
      card: null,
      percent,
    };
  }

  const unsure = label === "sana" ? bounded < 0.85 : bounded < 0.6;
  if (unsure) {
    return {
      ok: true,
      label,
      confidence: bounded,
      band: "no_seguro",
      retakeReason: null,
      headline: `No seguro · ${percent} %`,
      detail: UNSURE_DETAIL,
      advice: null,
      card: null,
      percent,
    };
  }

  const band: ConfidenceBand = bounded >= 0.8 ? "seguro" : "probable";
  const bandWord = band === "seguro" ? "Seguro" : "Probable";

  if (label === "sana") {
    return {
      ok: true,
      label,
      confidence: bounded,
      band,
      retakeReason: null,
      headline: "Parece sana",
      detail: `${bandWord} · ${percent} %. ${SANA_DETAIL}`,
      advice: null,
      card: ORIENTATION_SANA,
      percent,
    };
  }

  if (label === "otro") {
    return {
      ok: true,
      label,
      confidence: bounded,
      band,
      retakeReason: null,
      headline: "No parece roya",
      detail: OTRO_DETAIL,
      advice: band === "probable" ? CONFIRM_AGRONOMIST : null,
      card: null,
      percent,
    };
  }

  return {
    ok: true,
    label: "roya",
    confidence: bounded,
    band,
    retakeReason: null,
    headline: "Parece roya",
    detail:
      band === "probable"
        ? `Probable · ${percent} %. ${CONFIRM_AGRONOMIST}`
        : `Seguro · ${percent} %`,
    advice: null,
    card: ORIENTATION_ROYA,
    percent,
  };
}

function asRetakeReason(value: unknown): RetakeReason | null {
  if (value === "borrosa" || value === "no_hoja" || value === "lejos" || value === "otra") {
    return value;
  }
  return null;
}

export function parseModelPayload(raw: string): Diagnosis {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return interpretDiagnosis("retomar", 0, "otra");
  }
  if (!parsed || typeof parsed !== "object") {
    return interpretDiagnosis("retomar", 0, "otra");
  }
  const record = parsed as {
    label?: unknown;
    confidence?: unknown;
    retake_reason?: unknown;
  };
  if (typeof record.label !== "string" || !LABELS.has(record.label as VisionLabel)) {
    return interpretDiagnosis("retomar", 0, "otra");
  }
  const confidence =
    typeof record.confidence === "number" && Number.isFinite(record.confidence)
      ? record.confidence
      : 0;
  return interpretDiagnosis(
    record.label as VisionLabel,
    confidence,
    asRetakeReason(record.retake_reason),
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function messageText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  return typeof message?.content === "string" ? message.content : null;
}

export function visionConfigured(env: VisionEnv): boolean {
  return resolveOpenAI(env) !== null;
}

export async function diagnoseImage(options: {
  bytes: Uint8Array;
  mediaType: string;
  env: VisionEnv;
  fetchImpl?: typeof fetch;
}): Promise<Diagnosis> {
  const openai = resolveOpenAI(options.env);
  if (!openai) {
    return { ok: false, error: "unavailable" };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const dataUrl = `data:${options.mediaType};base64,${bytesToBase64(options.bytes)}`;
  let response: Response;
  try {
    response = await fetchImpl(`${openai.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openai.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openai.model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: INSTRUCTION },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
  } catch {
    return interpretDiagnosis("retomar", 0, "otra");
  }
  if (!response.ok) {
    return interpretDiagnosis("retomar", 0, "otra");
  }
  const text = messageText(await response.json());
  if (!text) return interpretDiagnosis("retomar", 0, "otra");
  return parseModelPayload(text);
}
