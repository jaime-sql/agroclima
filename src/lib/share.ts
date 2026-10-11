import { dayCardReason, formatChipDate, levelWord } from "./format.ts";
import {
  coffeeZoneLabel,
  FORECAST_MISSING_COPY,
  FORECAST_UNAVAILABLE_TITLE,
} from "./vision/copy.ts";
import type { RiskLevel } from "./risk/types.ts";

export function whatsAppLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export type RiskStripDay = {
  date: string;
  level: RiskLevel | null;
  reason: string;
  wetHours: number;
  tmax: number | null;
  rain: number | null;
};

export function riskStripText(days: RiskStripDay[]): string {
  return days
    .map((day) => {
      if (!day.level) return `${formatChipDate(day.date)}: Sin datos.`;
      return `${formatChipDate(day.date)}: ${levelWord(day.level)}. ${dayCardReason(day)}`;
    })
    .join(" ");
}

/** Place and the week only. No leaf sentence and no photo. */
export function diagnosisErrorShareText(input: {
  placeName: string;
  days: RiskStripDay[];
  forecastUnavailable?: boolean;
}): string {
  const place = coffeeZoneLabel(input.placeName);
  const strip = input.days.length
    ? riskStripText(input.days)
    : input.forecastUnavailable
      ? `${FORECAST_UNAVAILABLE_TITLE}. ${FORECAST_MISSING_COPY}`
      : "";
  return strip ? `${place}. ${strip}` : place;
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
