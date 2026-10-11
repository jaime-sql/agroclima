import { formatWeekdayToken, levelWord } from "./format.ts";
import { FORECAST_UNAVAILABLE_TITLE } from "./vision/copy.ts";
import type { RiskLevel } from "./risk/types.ts";

export function whatsAppLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export type RiskStripDay = {
  date: string;
  level: RiskLevel | null;
};

/** Collapse equal consecutive days, such as "Alto lun–dom". */
export function collapseLevels(days: RiskStripDay[]): string {
  const groups: Array<{ label: string; start: string; end: string }> = [];
  for (const day of days) {
    const label = day.level ? levelWord(day.level) : "Sin datos";
    const token = formatWeekdayToken(day.date);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.end = token;
    else groups.push({ label, start: token, end: token });
  }
  return groups
    .map((group) =>
      group.start === group.end
        ? `${group.label} ${group.start}`
        : `${group.label} ${group.start}\u2013${group.end}`,
    )
    .join(", ");
}

/** Place and the collapsed week only. No leaf sentence and no photo. */
export function diagnosisErrorShareText(input: {
  placeName: string;
  days: RiskStripDay[];
  forecastUnavailable?: boolean;
}): string {
  const niveles = input.days.length
    ? collapseLevels(input.days)
    : input.forecastUnavailable
      ? FORECAST_UNAVAILABLE_TITLE
      : "Sin datos";
  return `AgroClima: Riesgo de roya esta semana en la zona cafetalera de ${input.placeName}: ${niveles}. Es una orientación, no un diagnóstico.`;
}

export function agronomistSharePayload(input: {
  diagnoseError: "unavailable" | "offline" | "failed" | null;
  summary: string;
  placeName: string;
  photoDate: string;
  days: RiskStripDay[];
  forecastUnavailable?: boolean;
}): { text: string; includePhoto: boolean } {
  if (input.diagnoseError) {
    return {
      text: diagnosisErrorShareText({
        placeName: input.placeName,
        days: input.days,
        forecastUnavailable: input.forecastUnavailable,
      }),
      includePhoto: false,
    };
  }
  return {
    text: agronomistShareText({
      summary: input.summary,
      placeName: input.placeName,
      photoDate: input.photoDate,
    }),
    includePhoto: true,
  };
}

export function agronomistShareText(input: {
  summary: string;
  placeName: string;
  photoDate: string;
}): string {
  return `AgroClima: ${input.summary} Foto del ${input.photoDate}. Departamento: ${input.placeName}. Es una orientación, no un diagnóstico.`;
}

export function canShareFiles(
  canShare: ((data?: ShareData) => boolean) | undefined,
  file: File,
): boolean {
  if (!canShare) return false;
  try {
    return canShare({ files: [file] });
  } catch {
    return false;
  }
}
