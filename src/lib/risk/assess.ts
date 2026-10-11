import type {
  ActionPlan,
  DayAssessment,
  OpenMeteoDaily,
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
export const REASON_BAJO_POCAS =
  "«Pocas horas húmedas favorables; riesgo bajo de roya»";
export const REASON_BAJO_LLUVIA =
  "«Llueve, pero sin horas húmedas favorables a la roya»";
export const REASON_SIN_DATOS = "«sin datos»";
export const FORECAST_UNAVAILABLE = "«pronóstico no disponible»";

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
      precipitation_probability: finite(hourly.precipitation_probability?.[index]),
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

function reasonFor(input: {
  level: RiskLevel;
  wetHours: number;
  warmWetHours: number;
  precipitationSum: number | null;
}): string {
  if (input.level === "bajo") {
    if (input.wetHours === 0 && input.precipitationSum !== null && input.precipitationSum >= 1) {
      return REASON_BAJO_LLUVIA;
    }
    if (input.wetHours === 0) return REASON_BAJO_SECO;
    if (input.warmWetHours === 0) return REASON_BAJO_TEMP;
    return REASON_BAJO_POCAS;
  }
  if (input.level === "alto") return REASON_ALTO;
  return REASON_MEDIO;
}

function previousCalendarDate(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  utc.setUTCDate(utc.getUTCDate() - 1);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

function missingDay(date: string): DayAssessment {
  return {
    date,
    level: null,
    reason: REASON_SIN_DATOS,
    score: 0,
    wetHours: null,
    tmax: null,
    rain: null,
    warmWetHours: 0,
    optWetHours: 0,
    rainDay: false,
    latencyBand: false,
    consecutiveBonus: false,
  };
}

function unavailableWeek(): WeekAssessment {
  return {
    available: false,
    timezone: null,
    days: [],
    plan: buildPlan(null),
    footer: RISK_CUTOFF_FOOTER,
  };
}

function forecastUsable(forecast: OpenMeteoForecast): forecast is OpenMeteoForecast & {
  hourly: OpenMeteoHourly;
  daily: OpenMeteoDaily;
} {
  if (forecast.timezone !== "America/El_Salvador") return false;
  const hourly = forecast.hourly;
  const daily = forecast.daily;
  if (!hourly || !daily) return false;
  if (!Array.isArray(hourly.time) || hourly.time.length === 0) return false;
  if (!Array.isArray(daily.time) || daily.time.length === 0) return false;
  if (
    !Array.isArray(hourly.temperature_2m) ||
    !Array.isArray(hourly.relative_humidity_2m) ||
    !Array.isArray(hourly.precipitation)
  ) {
    return false;
  }
  if (
    !Array.isArray(daily.temperature_2m_max) ||
    !Array.isArray(daily.precipitation_sum) ||
    !Array.isArray(daily.precipitation_probability_max)
  ) {
    return false;
  }
  return true;
}

/** 24 local hours, each with temperature, humidity, and precipitation. */
function completeDayHours(rows: HourRow[], date: string): HourRow[] | null {
  const byHour = new Map<string, HourRow>();
  for (const row of rows) {
    if (!row.time.startsWith(date)) continue;
    byHour.set(row.time.slice(11, 13), row);
  }
  const ordered: HourRow[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const row = byHour.get(String(hour).padStart(2, "0"));
    if (!row) return null;
    if (
      row.temperature_2m === null ||
      row.relative_humidity_2m === null ||
      row.precipitation === null
    ) {
      return null;
    }
    ordered.push(row);
  }
  return ordered;
}

function dailyNumber(
  values: Array<number | null> | undefined,
  index: number,
): number | null {
  if (!values) return null;
  return finite(values[index]);
}

export function assessForecast(forecast: OpenMeteoForecast): WeekAssessment {
  if (!forecastUsable(forecast)) return unavailableWeek();

  const hours = hourRows(forecast.hourly);
  const daily = forecast.daily;
  const order = daily.time
    .map((date, index) => ({ date, index }))
    .sort((left, right) => left.date.localeCompare(right.date));

  const measured = order.map((entry) => {
    const dayHours = completeDayHours(hours, entry.date);
    const precipitationSum = dailyNumber(daily.precipitation_sum, entry.index);
    const probabilityMax = dailyNumber(daily.precipitation_probability_max, entry.index);
    const tempMax = dailyNumber(daily.temperature_2m_max, entry.index);
    const dailyReady =
      precipitationSum !== null && probabilityMax !== null && tempMax !== null;
    if (!dayHours || !dailyReady || tempMax === null) {
      return { date: entry.date, incomplete: true as const, warmWetHours: null };
    }

    let wetHours = 0;
    let warmWetHours = 0;
    let optWetHours = 0;
    // Figures use this same local-day hour list. Do not read them from the daily aggregates.
    let tmax = Number.NEGATIVE_INFINITY;
    let rain = 0;
    for (const hour of dayHours) {
      const temperature = hour.temperature_2m;
      const precipitation = hour.precipitation;
      if (temperature !== null && temperature > tmax) tmax = temperature;
      if (precipitation !== null) rain += precipitation;
      if (!isWetHour(hour)) continue;
      wetHours += 1;
      if (temperature === null) continue;
      if (temperature < 15 || temperature > 30) continue;
      warmWetHours += 1;
      if (temperature >= 21 && temperature <= 25) optWetHours += 1;
    }
    if (!Number.isFinite(tmax)) {
      return { date: entry.date, incomplete: true as const, warmWetHours: null };
    }

    const rainDay =
      precipitationSum >= 1 || (probabilityMax !== null && probabilityMax >= 60);
    // R5 scores the daily max only. The max−min range is not a gate.
    const latencyBand = tempMax >= 22 && tempMax <= 28;
    return {
      date: entry.date,
      incomplete: false as const,
      wetHours,
      warmWetHours,
      optWetHours,
      rainDay,
      precipitationSum,
      tmax,
      rain,
      latencyBand,
    };
  });

  const warmByDate = new Map<string, number | null>();
  for (const day of measured) {
    warmByDate.set(day.date, day.incomplete ? null : day.warmWetHours);
  }

  const days: DayAssessment[] = measured.map((day) => {
    if (day.incomplete) return missingDay(day.date);
    const previous = previousCalendarDate(day.date);
    const previousWarm = previous ? warmByDate.get(previous) : undefined;
    const consecutiveBonus =
      day.warmWetHours >= 6 && previousWarm !== undefined && previousWarm !== null && previousWarm >= 6;

    let score = 0;
    if (day.warmWetHours >= 6) score += 2;
    else if (day.warmWetHours >= 3) score += 1;
    if (day.optWetHours >= 3) score += 1;
    if (day.rainDay) score += 1;
    if (day.latencyBand) score += 1;
    if (consecutiveBonus) score += 1;

    let level: RiskLevel;
    if (day.wetHours === 0 || day.warmWetHours === 0) level = "bajo";
    else if (score >= 4) level = "alto";
    else if (score >= 2) level = "medio";
    else level = "bajo";

    return {
      date: day.date,
      level,
      reason: reasonFor({
        level,
        wetHours: day.wetHours,
        warmWetHours: day.warmWetHours,
        precipitationSum: day.precipitationSum,
      }),
      score,
      wetHours: day.wetHours,
      tmax: day.tmax,
      rain: day.rain,
      warmWetHours: day.warmWetHours,
      optWetHours: day.optWetHours,
      rainDay: day.rainDay,
      latencyBand: day.latencyBand,
      consecutiveBonus,
    };
  });

  return {
    available: true,
    timezone: "America/El_Salvador",
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
