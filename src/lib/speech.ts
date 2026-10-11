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
  return ranked.find((item) => item.lang === "es" || item.lang.startsWith("es-"))?.voice ?? null;
}
