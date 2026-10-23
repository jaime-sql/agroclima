import pointsFile from "../../../data/dept_map/department_points.json" with { type: "json" };
import { placeById } from "../places.ts";
import { worstDay } from "./pin-card.ts";
import {
  aggregateDepartmentLevel,
  departmentDisplayName,
  formatSvClock,
} from "./department-level.ts";
import type { RiskLevel, WeekAssessment } from "./types.ts";

type PointsFile = {
  sources: { boundaries_sha256: string; locations_sha256: string };
  departments: Array<{
    department: string;
    n_points: number;
    location_ids: string[];
    has_data: boolean;
  }>;
};

const FILE = pointsFile as PointsFile;

export type DepartmentEntry = {
  shapeName: string;
  name: string;
  hasPoints: boolean;
  locationIds: string[];
};

export type DepartmentPointView = {
  id: string;
  name: string;
  level: RiskLevel | null;
  wetHours: number | null;
  tmax: number | null;
  rain: number | null;
  reason: string | null;
};

export type DepartmentView = {
  name: string;
  hasPoints: boolean;
  level: RiskLevel | null;
  count: number;
  label: string;
  points: DepartmentPointView[];
};

export type DepartmentMapOk = {
  ok: true;
  updatedAt: string;
  updatedLabel: string;
  departments: DepartmentView[];
};

export function departmentCatalog(): DepartmentEntry[] {
  return FILE.departments
    .map((row) => ({
      shapeName: row.department,
      name: departmentDisplayName(row.department),
      hasPoints: row.has_data && row.location_ids.length > 0,
      locationIds: [...row.location_ids],
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
}

export function boundarySha256(): string {
  return FILE.sources.boundaries_sha256;
}

export function locationsSha256(): string {
  return FILE.sources.locations_sha256;
}

function pointFromWeek(week: WeekAssessment): Omit<DepartmentPointView, "id" | "name"> | null {
  if (!week.available) return null;
  const worst = worstDay(week.days);
  if (!worst) return null;
  const day = week.days.find((item) => item.date === worst.date);
  if (!day?.level) return null;
  return {
    level: day.level,
    wetHours: day.wetHours,
    tmax: day.tmax,
    rain: day.rain,
    reason: day.reason,
  };
}

/** Join coffee points to weeks already scored by the Open-Meteo engine. */
export function departmentMapFromWeeks(
  weeks: ReadonlyMap<string, WeekAssessment>,
  atMs: number,
): DepartmentMapOk {
  const departments = departmentCatalog().map((entry) => {
    const points: DepartmentPointView[] = entry.locationIds.map((id) => {
      const place = placeById(id);
      const detail = weeks.has(id) ? pointFromWeek(weeks.get(id) as WeekAssessment) : null;
      return {
        id,
        name: place?.name ?? id,
        level: detail?.level ?? null,
        wetHours: detail?.wetHours ?? null,
        tmax: detail?.tmax ?? null,
        rain: detail?.rain ?? null,
        reason: detail?.reason ?? null,
      };
    });
    const aggregate = entry.hasPoints
      ? aggregateDepartmentLevel(points.map((point) => point.level))
      : { level: null, count: 0, label: "Sin datos" };
    return {
      name: entry.name,
      hasPoints: entry.hasPoints,
      level: aggregate.level,
      count: aggregate.count,
      label: aggregate.label,
      points: entry.hasPoints ? points : [],
    };
  });
  return {
    ok: true,
    updatedAt: new Date(atMs).toISOString(),
    updatedLabel: formatSvClock(atMs),
    departments,
  };
}

function isLevel(value: unknown): value is RiskLevel | null {
  return value === null || value === "bajo" || value === "medio" || value === "alto";
}

function isPoint(value: unknown): value is DepartmentPointView {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  if (typeof point.id !== "string" || typeof point.name !== "string") return false;
  if (!isLevel(point.level)) return false;
  for (const key of ["wetHours", "tmax", "rain"] as const) {
    const figure = point[key];
    if (figure !== null && typeof figure !== "number") return false;
  }
  if (point.reason !== null && typeof point.reason !== "string") return false;
  return true;
}

export function parseDepartmentMap(value: unknown): DepartmentMapOk | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.ok !== true) return null;
  if (typeof record.updatedAt !== "string" || typeof record.updatedLabel !== "string") return null;
  if (!Array.isArray(record.departments)) return null;
  const departments: DepartmentView[] = [];
  for (const item of record.departments) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (typeof row.name !== "string" || typeof row.label !== "string") return null;
    if (typeof row.hasPoints !== "boolean" || typeof row.count !== "number") return null;
    if (!isLevel(row.level) || !Array.isArray(row.points) || !row.points.every(isPoint)) return null;
    departments.push({
      name: row.name,
      hasPoints: row.hasPoints,
      level: row.level,
      count: row.count,
      label: row.label,
      points: row.points,
    });
  }
  return {
    ok: true,
    updatedAt: record.updatedAt,
    updatedLabel: record.updatedLabel,
    departments,
  };
}
