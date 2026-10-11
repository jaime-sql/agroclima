import type {
  ActionPlan,
  DayAssessment,
  OpenMeteoForecast,
  OpenMeteoHourly,
  RiskLevel,
  SprayWindow,
  WeekAssessment,
} from "./types";

/**
 * Approved copy from docs/rust-risk-rules.md. Cutoffs below are that
 * document's recipe, not a new scale.
 */
export const REASON_ALTO =
  "«Hojas mojadas muchas horas y clima tibio: la roya se pega fácil.»";
export const REASON_MEDIO =
  "«Humedad o lluvia algunas horas: riesgo moderado.»";
export const REASON_BAJO_SECO = "«Día seco: la roya casi no avanza.»";
export const REASON_BAJO_TEMP =
  "«Temperatura poco favorable para la roya.»";

/** Risk bins are our estimate. Not validated by PROCAFE or MAG. */
export const RISK_CUTOFF_FOOTER =
  "Estos umbrales de riesgo son una estimación nuestra y no han sido validados por PROCAFE ni por el MAG.";

export const DOSE_NOTE = "dosis según etiqueta / su agrónomo";

/** Class names only. Trial rates in the rules doc are not shown. */
export const FUNGICIDE_CLASSES = [
  "cobre",
  "triazol",
  "triazol+estrobilurina",
] as const;

/**
 * R7: no numeric altitude bands (sin fuente). Temperature already
 * carries the Open-Meteo elevation downscale.
 */
export const ALTITUDE_THRESHOLD = null;

type HourRow = {
  time: string;
  temperature_2m: number | null;
  relative_humidity_2m: number | null;
  precipitation: number | null;
  precipitation_probability: number | null;
};

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hourRows(hourly: OpenMeteoHourly): HourRow[] {
  const count = hourly.time.length;
  const rows: HourRow[] = [];
  for (let index = 0; index < count; index += 1) {
    rows.push({
      time: hourly.time[index],
      temperature_2m: finite(hourly.temperature_2m[index]),
      relative_humidity_2m: finite(hourly.relative_humidity_2m[index]),
      precipitation: finite(hourly.precipitation[index]),
      precipitation_probability: finite(hourly.precipitation_probability[index]),
    });
  }
  rows.sort((left, right) => left.time.localeCompare(right.time));
  return rows;
}

/** Wet hour: RH ≥ 90% or precipitation ≥ 0.1 mm (rules §2). */
export function isWetHour(hour: HourRow): boolean {
  const humid =
    hour.relative_humidity_2m !== null && hour.relative_humidity_2m >= 90;
  const rain = hour.precipitation !== null && hour.precipitation >= 0.1;
  return humid || rain;
}

function dateKey(time: string): string {
  return time.slice(0, 10);
}

/**
 * Next dry spray window.
 * 4 h and 40% are our own safety margin (sin fuente), above the ~2 h
 * rain-free finding for systemic triazoles. Not label text.
 * The rules ask for the first daytime block and do not give clock hours,
 * so no extra hour-of-day cutoff is applied.
 */
export function isDrySprayHour(hour: HourRow): boolean {
  return (
    hour.precipitation !== null &&
    hour.precipitation < 0.1 &&
    hour.precipitation_probability !== null &&
    hour.precipitation_probability < 40 &&
    hour.relative_humidity_2m !== null &&
    hour.relative_humidity_2m < 90
  );
}

function nextStamp(stamp: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})/.exec(stamp);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const utc = new Date(Date.UTC(year, month - 1, day, hour));
  utc.setUTCHours(utc.getUTCHours() + 1);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}T${pad(utc.getUTCHours())}:00`;
}

export function nextDrySprayWindow(hourly: OpenMeteoHourly): SprayWindow | null {
  const rows = hourRows(hourly);
  for (let start = 0; start <= rows.length - 4; start += 1) {
    let consecutive = true;
    for (let offset = 0; offset < 4; offset += 1) {
      if (!isDrySprayHour(rows[start + offset])) {
        consecutive = false;
        break;
      }
      if (offset > 0) {
        const expected = nextStamp(rows[start + offset - 1].time);
        const actual = rows[start + offset].time.slice(0, 16);
        if (expected === null || actual !== expected) {
          consecutive = false;
          break;
        }
      }
    }
    if (consecutive) {
      return {
        start: rows[start].time,
        end: rows[start + 3].time,
      };
    }
  }
  return null;
}

function reasonFor(
  level: RiskLevel,
  dryDay: boolean,
  warmWetHours: number,
): string {
  if (dryDay) return REASON_BAJO_SECO;
  if (warmWetHours === 0) return REASON_BAJO_TEMP;
  if (level === "alto") return REASON_ALTO;
  if (level === "medio") return REASON_MEDIO;
  // Score 0–1 with some warm wet hours. The approved "algunas horas"
  // line is the top factor; there is no fifth sentence.
  return REASON_MEDIO;
}

function dailyNumber(
  values: Array<number | null> | undefined,
  index: number,
): number | null {
  if (!values) return null;
  return finite(values[index]);
}

export function assessForecast(forecast: OpenMeteoForecast): WeekAssessment {
  const hours = hourRows(forecast.hourly);
  const byDate = new Map<string, HourRow[]>();
  for (const hour of hours) {
    const key = dateKey(hour.time);
    const bucket = byDate.get(key);
    if (bucket) bucket.push(hour);
    else byDate.set(key, [hour]);
  }

  const daily = forecast.daily;
  const order = daily.time
    .map((date, index) => ({ date, index }))
    .sort((left, right) => left.date.localeCompare(right.date));

  const days: DayAssessment[] = [];
  let previousWarmWet = 0;

  for (const entry of order) {
    const dayHours = byDate.get(entry.date) ?? [];
    let wetHours = 0;
    let warmWetHours = 0;
    let optWetHours = 0;

    for (const hour of dayHours) {
      if (!isWetHour(hour)) continue;
      wetHours += 1;
      const temperature = hour.temperature_2m;
      if (temperature === null) continue;
      const warm = temperature >= 15 && temperature <= 30;
      if (!warm) continue;
      warmWetHours += 1;
      if (temperature >= 21 && temperature <= 25) optWetHours += 1;
    }

    const precipitationSum = dailyNumber(daily.precipitation_sum, entry.index);
    const probabilityMax = dailyNumber(
      daily.precipitation_probability_max,
      entry.index,
    );
    const tempMax = dailyNumber(daily.temperature_2m_max, entry.index);
    const rainDay =
      (precipitationSum !== null && precipitationSum >= 1) ||
      (probabilityMax !== null && probabilityMax >= 60);
    // R5: daily max in 22–28 °C. Diurnal range is context only (sin umbral),
    // so max−min is not a numeric gate.
    const latencyBand = tempMax !== null && tempMax >= 22 && tempMax <= 28;
    const consecutiveBonus = previousWarmWet >= 6;

    let score = 0;
    if (warmWetHours >= 6) score += 2;
    else if (warmWetHours >= 3) score += 1;
    if (optWetHours >= 3) score += 1;
    if (rainDay) score += 1;
    if (latencyBand) score += 1;
    if (consecutiveBonus) score += 1;

    const dryDay = wetHours === 0 && !rainDay;
    let level: RiskLevel;
    if (dryDay || warmWetHours === 0) level = "bajo";
    else if (score >= 4) level = "alto";
    else if (score >= 2) level = "medio";
    else level = "bajo";

    days.push({
      date: entry.date,
      level,
      reason: reasonFor(level, dryDay, warmWetHours),
      score,
      wetHours,
      warmWetHours,
      optWetHours,
      rainDay,
      latencyBand,
      consecutiveBonus,
    });
    previousWarmWet = warmWetHours;
  }

  return {
    days,
    plan: buildPlan(nextDrySprayWindow(forecast.hourly)),
    footer: RISK_CUTOFF_FOOTER,
  };
}

export function buildPlan(nextDryWindow: SprayWindow | null): ActionPlan {
  return {
    fungicideClasses: [...FUNGICIDE_CLASSES],
    doseNote: DOSE_NOTE,
    nextDryWindow,
  };
}
