import type { VisionLabel } from "./vision/diagnose.ts";
import { worstDay } from "./risk/pin-card.ts";
import type { DayAssessment } from "./risk/types.ts";

/** Fixed tag on a leaf result. The model score is not shown. */
export const ORIENTATION_TAG = "Orientativo \u2014 no es un diagnóstico";

/**
 * Published leaf-detector figures. Shown only inside the why panel,
 * and only on a diagnosis result. Not the weather engine's level.
 */
export const DETECTION_NOTE =
  "Detección de roya: acierto 73% (IC 95% 68\u201379%) en 252 fotos públicas de hojas de Brasil (BRACOL, CC BY 4.0), tomadas en laboratorio, no en El Salvador. Detecta 58% de las hojas con roya. No es un diagnóstico; consulte a un técnico.";

/** Grey that stays at least 4.5:1 on the white why panel. */
export const DETECTION_NOTE_COLOR = "#57534E";

export type WhyModel = {
  reasons: string[];
  /** Every diagnosis result, including a failed review, keeps this button on screen. */
  showTechnician: boolean;
  /** The cited leaf accuracy. Null on a weather-only result. */
  detectionNote: string | null;
};

function figure(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return rounded.toFixed(1);
}

function plainReason(reason: string): string {
  return reason.replaceAll("«", "").replaceAll("»", "").trim();
}

const LEAF_REASON: Record<Exclude<VisionLabel, "retomar">, string> = {
  roya: "Segunda opinión: manchas observadas en la hoja.",
  sana: "Segunda opinión: no vemos señales de roya en la hoja.",
  otro: "Segunda opinión: la hoja tiene algo que no parece roya.",
};

/** Weather first, then at most one leaf line. Three reasons at most. */
export function whyReasons(input: {
  label: VisionLabel | null;
  leafDetail: string | null;
  wetHours: number | null;
  rain: number | null;
  tmax: number | null;
  engineReason: string | null;
}): string[] {
  const weather: string[] = [];
  if (typeof input.wetHours === "number" && Number.isFinite(input.wetHours)) {
    weather.push(`${figure(input.wetHours)} h de humedad.`);
  }
  const engine = input.engineReason ? plainReason(input.engineReason) : "";
  if (engine) weather.push(engine);
  if (weather.length < 2 && typeof input.rain === "number" && Number.isFinite(input.rain)) {
    weather.push(`Lluvia ${figure(input.rain)} mm.`);
  }
  if (weather.length < 2 && typeof input.tmax === "number" && Number.isFinite(input.tmax)) {
    weather.push(`Máxima ${figure(input.tmax)} °C.`);
  }

  let leaf = "";
  if (input.label === "retomar") {
    const detail = input.leafDetail?.trim() ?? "";
    if (detail) leaf = `Segunda opinión: ${detail}`;
  } else if (input.label) leaf = LEAF_REASON[input.label];

  if (!leaf) return weather.slice(0, 3);
  return [...weather.slice(0, 2), leaf];
}

export function worstDayDetail(
  days: readonly DayAssessment[],
): { wetHours: number | null; rain: number | null; tmax: number | null; reason: string } | null {
  const worst = worstDay(days);
  if (!worst) return null;
  const day = days.find((item) => item.date === worst.date);
  if (!day?.level) return null;
  return { wetHours: day.wetHours, rain: day.rain, tmax: day.tmax, reason: day.reason };
}

export function buildWhyModel(input: {
  label: VisionLabel | null;
  leafDetail: string | null;
  diagnoseFailed: boolean;
  day: { wetHours: number | null; rain: number | null; tmax: number | null; reason: string } | null;
}): WhyModel | null {
  const diagnosisResult = input.label !== null || input.diagnoseFailed;
  const reasons = whyReasons({
    label: input.label,
    leafDetail: input.leafDetail,
    wetHours: input.day?.wetHours ?? null,
    rain: input.day?.rain ?? null,
    tmax: input.day?.tmax ?? null,
    engineReason: input.day?.reason ?? null,
  });
  if (!diagnosisResult && reasons.length === 0) return null;
  return {
    reasons,
    showTechnician: diagnosisResult,
    detectionNote: diagnosisResult ? DETECTION_NOTE : null,
  };
}
