import { PLACES } from "../places.ts";
import { departmentMapFromWeeks, parseDepartmentMap, type DepartmentMapOk } from "./department-catalog.ts";
import { loadPlaceMap, readCachedPlaceRisk } from "./places-forecast.ts";
import type { WeekAssessment } from "./types.ts";

/** Six hours. A shorter TTL would spend the free KV write budget on cold isolates. */
export const DEPARTMENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export const DEPARTMENT_CACHE_KEY = "dept-risk-v1";

export type RiskKv = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<unknown>;
};

export type WeeksResult =
  | { ok: true; weeks: Map<string, WeekAssessment> }
  | { ok: false };

/**
 * Write only when the stored value is missing or older than the TTL.
 * A hit must not write: Workers Free allows 1,000 KV writes a day.
 */
export function shouldWriteDepartmentCache(
  storedAt: number | null,
  now: number,
  ttlMs = DEPARTMENT_CACHE_TTL_MS,
): boolean {
  if (storedAt === null || !Number.isFinite(storedAt)) return true;
  return now - storedAt >= ttlMs;
}

type Memory = { at: number; body: DepartmentMapOk };

let memory: Memory | null = null;
let pending: Promise<{ ok: true; body: DepartmentMapOk } | { ok: false; error: "forecast_unavailable" }> | null =
  null;

export function clearDepartmentRiskCache(): void {
  memory = null;
  pending = null;
}

function parseStored(raw: string | null): Memory | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { at?: unknown; body?: unknown };
    if (typeof parsed.at !== "number") return null;
    const body = parseDepartmentMap(parsed.body);
    if (!body) return null;
    return { at: parsed.at, body };
  } catch {
    return null;
  }
}

async function loadWeeksFromPlaces(): Promise<WeeksResult> {
  const map = await loadPlaceMap();
  if (!map.ok) return { ok: false };
  const weeks = new Map<string, WeekAssessment>();
  for (const place of PLACES) {
    const cached = readCachedPlaceRisk(place.id);
    if (!cached) continue;
    weeks.set(place.id, {
      available: cached.available,
      timezone: cached.timezone,
      days: cached.days,
      plan: cached.plan,
      footer: cached.footer,
    });
  }
  return { ok: true, weeks };
}

async function compute(
  now: number,
  ttlMs: number,
  kv: RiskKv | null,
  loadWeeks: () => Promise<WeeksResult>,
): Promise<{ ok: true; body: DepartmentMapOk } | { ok: false; error: "forecast_unavailable" }> {
  let storedAt: number | null = null;
  if (kv) {
    try {
      const stored = parseStored(await kv.get(DEPARTMENT_CACHE_KEY));
      if (stored && !shouldWriteDepartmentCache(stored.at, now, ttlMs)) {
        memory = stored;
        return { ok: true, body: stored.body };
      }
      storedAt = stored?.at ?? null;
    } catch {
      storedAt = null;
    }
  }

  let loaded: WeeksResult;
  try {
    loaded = await loadWeeks();
  } catch {
    return { ok: false, error: "forecast_unavailable" };
  }
  if (!loaded.ok) return { ok: false, error: "forecast_unavailable" };

  const body = departmentMapFromWeeks(loaded.weeks, now);
  memory = { at: now, body };
  if (kv && shouldWriteDepartmentCache(storedAt, now, ttlMs)) {
    try {
      await kv.put(DEPARTMENT_CACHE_KEY, JSON.stringify({ at: now, body }), {
        expirationTtl: Math.max(60, Math.round(ttlMs / 1000)),
      });
    } catch {
      // The forecast is still returned. A rejected write is not a failed map.
    }
  }
  return { ok: true, body };
}

export async function loadDepartmentRisk(options?: {
  now?: number;
  ttlMs?: number;
  kv?: RiskKv | null;
  loadWeeks?: () => Promise<WeeksResult>;
}): Promise<{ ok: true; body: DepartmentMapOk } | { ok: false; error: "forecast_unavailable" }> {
  const now = options?.now ?? Date.now();
  const ttlMs = options?.ttlMs ?? DEPARTMENT_CACHE_TTL_MS;
  const kv = options?.kv ?? null;
  if (memory && !shouldWriteDepartmentCache(memory.at, now, ttlMs)) {
    return { ok: true, body: memory.body };
  }
  if (pending) return pending;
  const loadWeeks = options?.loadWeeks ?? loadWeeksFromPlaces;
  pending = compute(now, ttlMs, kv, loadWeeks).finally(() => {
    pending = null;
  });
  return pending;
}
