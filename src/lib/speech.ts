import { levelWord } from "./format.ts";
import { pinCardLine, worstDay } from "./risk/pin-card.ts";
import type { RiskLevel } from "./risk/types.ts";

export const ORIENTATION_SENTENCE = "Es una orientación, no un diagnóstico.";

export const LISTEN_COPY = {
  idle: "▶ Escuchar",
  loading: "Preparando audio…",
  playing: "❚❚ Pausar",
  again: "▶ Escuchar otra vez",
  failed: "No pudimos leer en voz alta.",
} as const;

/** The plan player. The small ask button keeps LISTEN_COPY.idle. */
export const PLAN_LISTEN_LABEL = "Escuchar plan";

/** Shown on its own line under the audio player. */
export const AI_VOICE_DISCLOSURE = "Voz generada por IA";

export const CONSULT_TECHNICIAN_SENTENCE = "Consulte a un técnico.";

/**
 * Spoken-summary budget. Spanish at a plain pace is about 14 characters a
 * second, so 420 characters is about 30 seconds. The old week script was longer.
 */
export const SPOKEN_SUMMARY_MAX_CHARS = 420;

/** Result, then the plan, then the week, then Qué hacer hoy when it is on screen, then the orientation sentence. */
export function listenScript(parts: {
  result?: string | null;
  plan?: string | null;
  week?: string | null;
  advice?: string | null;
}): string {
  const body = [parts.result, parts.plan, parts.week, parts.advice]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean);
  if (body.length === 0) return "";
  return [...body, ORIENTATION_SENTENCE].join(" ");
}

/** Cuts at a sentence end when one sits in the second half of the budget. */
export function capSpokenText(text: string, max = SPOKEN_SUMMARY_MAX_CHARS): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const chars = [...trimmed];
  if (chars.length <= max) return trimmed;
  const sliced = chars.slice(0, max).join("").trimEnd();
  const sentence = sliced.lastIndexOf(". ");
  if (sentence >= Math.floor(max * 0.5)) return sliced.slice(0, sentence + 1).trim();
  return sliced.trim();
}

/**
 * Risk level, the next step, and a reminder to consult a technician.
 * Always at most SPOKEN_SUMMARY_MAX_CHARS, and the reminder is kept.
 */
/** The week's risk, in one or two short sentences. Matches the pin-card line. */
export function spokenRiskSentence(
  days: readonly { date: string; level: RiskLevel | null }[],
): string | null {
  const line = pinCardLine(days);
  const worst = worstDay(days);
  if (!line || !worst) return null;
  const word = levelWord(worst.level).toLocaleLowerCase("es-SV");
  if (line.startsWith("Toda la semana")) return `Riesgo ${word} toda la semana.`;
  if (line === "Peor día: hoy") return `Riesgo ${word}. El peor día es hoy.`;
  return `Riesgo ${word}. ${line}.`.replace("..", ".");
}

export function planListenText(input: {
  riskSentence?: string | null;
  nextStep?: string | null;
}): string {
  const consult = CONSULT_TECHNICIAN_SENTENCE;
  const room = Math.max(0, SPOKEN_SUMMARY_MAX_CHARS - [...consult].length - 1);
  const head = capSpokenText(
    [input.riskSentence, input.nextStep]
      .map((part) => part?.replace(/\s+/g, " ").trim() ?? "")
      .filter(Boolean)
      .join(" "),
    room,
  );
  return head ? `${head} ${consult}` : consult;
}

export function pickSpanishVoice<T extends { lang: string }>(voices: T[]): T | null {
  const ranked = voices.map((voice) => ({
    voice,
    lang: voice.lang.toLowerCase().replaceAll("_", "-"),
  }));
  for (const prefix of ["es-us", "es-mx", "es-es"]) {
    const match = ranked.find(
      (item) => item.lang === prefix || item.lang.startsWith(`${prefix}-`),
    );
    if (match) return match.voice;
  }
  return null;
}

/**
 * Any Spanish voice for the plan button. es-SV first, then the same
 * es-US / es-MX / es-ES order, then any other es-* voice.
 */
export function pickEsVoice<T extends { lang: string }>(voices: T[]): T | null {
  const ranked = voices.map((voice) => ({
    voice,
    lang: voice.lang.toLowerCase().replaceAll("_", "-"),
  }));
  for (const prefix of ["es-sv", "es-us", "es-mx", "es-es"]) {
    const match = ranked.find(
      (item) => item.lang === prefix || item.lang.startsWith(`${prefix}-`),
    );
    if (match) return match.voice;
  }
  return ranked.find((item) => item.lang === "es" || item.lang.startsWith("es-"))?.voice ?? null;
}
