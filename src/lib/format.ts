import type { RiskLevel } from "./risk/types";

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

export function formatPhotoDate(date: Date): string {
  return new Intl.DateTimeFormat("es-SV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/El_Salvador",
  }).format(date);
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
