import type { RiskLevel } from "./risk/types";
import { SIN_DATOS_CARD } from "./vision/copy.ts";

const LEVEL_WORD: Record<RiskLevel, string> = {
  alto: "Alto",
  medio: "Medio",
  bajo: "Bajo",
};

const LEVEL_MARK: Record<RiskLevel, string> = {
  alto: "▲",
  medio: "●",
  bajo: "▼",
};

export function levelWord(level: RiskLevel): string {
  return LEVEL_WORD[level];
}

export function levelMark(level: RiskLevel): string {
  return LEVEL_MARK[level];
}

function dateAtNoonElSalvador(isoDate: string): Date {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 18));
}

export function formatWeekday(isoDate: string): string {
  const label = new Intl.DateTimeFormat("es-SV", {
    weekday: "long",
    timeZone: "America/El_Salvador",
  }).format(dateAtNoonElSalvador(isoDate));
  return label.charAt(0).toLocaleUpperCase("es-SV") + label.slice(1);
}

/** Short day and date for a risk tile, such as "Dom 11". */
export function formatChipDate(isoDate: string): string {
  const date = dateAtNoonElSalvador(isoDate);
  const weekday = new Intl.DateTimeFormat("es-SV", {
    weekday: "short",
    timeZone: "America/El_Salvador",
  }).format(date).replace(/\.$/, "");
  const day = new Intl.DateTimeFormat("es-SV", {
    day: "numeric",
    timeZone: "America/El_Salvador",
  }).format(date);
  const short = weekday.charAt(0).toLocaleUpperCase("es-SV") + weekday.slice(1);
  return `${short} ${day}`;
}

export function formatPhotoDate(date: Date): string {
  return new Intl.DateTimeFormat("es-SV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/El_Salvador",
  }).format(date);
}

function formatMeasure(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return rounded.toFixed(1);
}

/** Lowercase es-SV short weekday, such as "lun". */
export function formatWeekdayToken(isoDate: string): string {
  const weekday = new Intl.DateTimeFormat("es-SV", {
    weekday: "short",
    timeZone: "America/El_Salvador",
  })
    .format(dateAtNoonElSalvador(isoDate))
    .replace(/\.$/, "");
  return weekday.toLocaleLowerCase("es-SV");
}

/** "11 h húmedas · máx. 24 °C · lluvia 6 mm". A missing figure is "sin dato", never 0. */
export function dayFiguresLine(day: {
  wetHours: number | null;
  tmax: number | null;
  rain: number | null;
}): string {
  const hours = day.wetHours === null ? "h húmedas: sin dato" : `${day.wetHours} h húmedas`;
  const max = day.tmax === null ? "máx.: sin dato" : `máx. ${formatMeasure(day.tmax)} °C`;
  const rain = day.rain === null ? "lluvia: sin dato" : `lluvia ${formatMeasure(day.rain)} mm`;
  return `${hours} · ${max} · ${rain}`;
}

/** Figures first, then the rule sentence. A day with no level stays "sin datos" and has no numbers. */
export function dayCardReason(day: {
  level: RiskLevel | null;
  wetHours: number | null;
  tmax: number | null;
  rain: number | null;
  reason: string;
}): string {
  if (day.level === null) return SIN_DATOS_CARD;
  return `${dayFiguresLine(day)}. ${day.reason}`;
}

export function formatSprayWindow(
  window: { start: string; end: string } | null,
): string {
  if (!window) {
    return "No hay una ventana seca en los próximos 7 días.";
  }
  const day = formatWeekday(window.start);
  const startHour = window.start.slice(11, 16);
  const endHour = window.end.slice(11, 16);
  return `${day}, de ${startHour} a ${endHour}`;
}
