export const ORIENTATION_SENTENCE = "Es una orientación, no un diagnóstico.";

export const LISTEN_COPY = {
  idle: "▶ Escuchar",
  loading: "Preparando audio…",
  playing: "❚❚ Pausar",
  again: "▶ Escuchar otra vez",
  failed: "No pudimos leer en voz alta.",
} as const;

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
