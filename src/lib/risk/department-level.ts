import type { RiskLevel } from "./types.ts";

/**
 * One department's rust level. This is the only aggregation rule.
 * Change this function if the Captain picks a different summary.
 *
 * The level is the worst scored point (alto beats medio, medio beats bajo).
 * The count is how many points returned a level. A point with no forecast
 * is left out of both, and the card still lists it as Sin datos.
 * No scored point means Sin datos: no risk colour and no risk word.
 * Missing an outbreak costs more than a false alarm, so the worst point wins.
 * See docs/decisions.md (2026-10-23).
 */
export type DepartmentAggregate = {
  level: RiskLevel | null;
  count: number;
  label: string;
};

const RANK: Record<RiskLevel, number> = { bajo: 1, medio: 2, alto: 3 };

export function aggregateDepartmentLevel(
  levels: readonly (RiskLevel | null | undefined)[],
): DepartmentAggregate {
  const scored = levels.filter(
    (level): level is RiskLevel => level === "bajo" || level === "medio" || level === "alto",
  );
  if (scored.length === 0) return { level: null, count: 0, label: "Sin datos" };
  let level = scored[0];
  for (const item of scored) {
    if (RANK[item] > RANK[level]) level = item;
  }
  const noun = scored.length === 1 ? "punto" : "puntos";
  return { level, count: scored.length, label: `${level} · ${scored.length} ${noun}` };
}

/** geoBoundaries shapeName to the picker name, such as "Departamento de Ahuachapán". */
export function departmentDisplayName(shapeName: string): string {
  const prefix = "Departamento de ";
  return shapeName.startsWith(prefix) ? shapeName.slice(prefix.length) : shapeName;
}

export function formatSvClock(epochMs: number): string {
  const parts = new Intl.DateTimeFormat("es-SV", {
    timeZone: "America/El_Salvador",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(epochMs));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  return `${hour}:${minute}`;
}

export function mapSourceLine(clock: string): string {
  return `Riesgo calculado con pronóstico de Open-Meteo · actualizado ${clock}`;
}

export const MAP_ATTRIBUTION = "Límites: geoBoundaries / © OpenStreetMap, CC BY-SA";

export const NO_COFFEE_POINTS_COPY =
  "Aún no tenemos puntos cafetaleros en este departamento.";

export const VIEW_AS_LIST = "Ver como lista";
export const VIEW_AS_MAP = "Ver como mapa";
export const SEE_MUNICIPALITIES = "Ver municipios";

/** Page background in src/app/globals.css. Attribution is measured against it. */
export const PAGE_BACKGROUND = "#F7F4EF";

/** Grey that stays at least 4.5:1 on PAGE_BACKGROUND. #78716C does not. */
export const ATTRIBUTION_COLOR = "#57534E";

export const SIN_DATOS_FILL = "#E7E5E4";
export const SIN_DATOS_INK = "#1C1917";

/** Same pairs as the risk-card chips in src/components/risk-panel.tsx. */
export const LEVEL_STYLE = {
  alto: { fill: "#FDE2E1", text: "#8A1C14", chip: "bg-[#FDE2E1] text-[#8A1C14]" },
  medio: { fill: "#FFF1C2", text: "#6B4B00", chip: "bg-[#FFF1C2] text-[#6B4B00]" },
  bajo: { fill: "#DDF2E0", text: "#1E5B2A", chip: "bg-[#DDF2E0] text-[#1E5B2A]" },
} as const;
