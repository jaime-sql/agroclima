import { formatWeekday } from "../format.ts";
import { PLACES } from "../places.ts";
import { placesForecastUrl } from "../weather/openmeteo.ts";
import { assessForecast } from "./assess.ts";
import type { RiskLevel, WeekAssessment, OpenMeteoForecast } from "./types.ts";

/** One scored batch is reused so a page view does not call Open-Meteo again. */
export const PLACES_FORECAST_CACHE_MS = 30 * 60 * 1000;

export type PlaceMapPin = {
  id: string;
  level: RiskLevel | null;
  day: string | null;
};

type CacheEntry = {
  at: number;
  places: PlaceMapPin[];
  weeks: Map<string, { ok: true; place: { id: string; name: string } } & WeekAssessment>;
};

let cache: CacheEntry | null = null;

export function clearPlaceMapCache(): void {
  cache = null;
}

const LEVEL_RANK: Record<RiskLevel, number> = { bajo: 1, medio: 2, alto: 3 };

/** Earliest day that reaches the week's highest level. Null when no day was scored. */
export function worstDay(days: WeekAssessment["days"]): { level: RiskLevel; date: string } | null {
  let best: { level: RiskLevel; date: string; rank: number } | null = null;
  for (const day of days) {
    if (!day.level) continue;
    const rank = LEVEL_RANK[day.level];
    const earlierTie = best !== null && rank === best.rank && day.date < best.date;
    if (!best || rank > best.rank || earlierTie) {
      best = { level: day.level, date: day.date, rank };
    }
  }
  return best ? { level: best.level, date: best.date } : null;
}

function pinFor(id: string, week: WeekAssessment): PlaceMapPin {
  const worst = week.available ? worstDay(week.days) : null;
  return {
    id,
    level: worst?.level ?? null,
    day: worst ? formatWeekday(worst.date) : null,
  };
}

function asForecastList(body: unknown, count: number): OpenMeteoForecast[] | null {
  if (Array.isArray(body)) {
    if (body.length !== count) return null;
    return body as OpenMeteoForecast[];
  }
  if (count === 1 && body && typeof body === "object") return [body as OpenMeteoForecast];
  return null;
}

export async function loadPlaceMap(
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<{ ok: true; places: PlaceMapPin[] } | { ok: false; error: "forecast_unavailable" }> {
  if (cache && now - cache.at < PLACES_FORECAST_CACHE_MS) {
    return { ok: true, places: cache.places };
  }
  try {
    const response = await fetchImpl(placesForecastUrl(PLACES));
    const body = (await response.json().catch(() => null)) as unknown;
    const forecasts = response.ok ? asForecastList(body, PLACES.length) : null;
    if (!forecasts) return { ok: false, error: "forecast_unavailable" };
    const places: PlaceMapPin[] = [];
    const weeks: CacheEntry["weeks"] = new Map();
    for (let index = 0; index < PLACES.length; index += 1) {
      const place = PLACES[index];
      const week = assessForecast(forecasts[index]);
      places.push(pinFor(place.id, week));
      if (week.available) {
        weeks.set(place.id, {
          ok: true,
          ...week,
          place: { id: place.id, name: place.name },
        });
      }
    }
    cache = { at: now, places, weeks };
    return { ok: true, places };
  } catch {
    return { ok: false, error: "forecast_unavailable" };
  }
}

/** A week already scored for the map. Misses fall back to the single-place fetch. */
export function readCachedPlaceRisk(
  placeId: string,
): ({ ok: true; place: { id: string; name: string } } & WeekAssessment) | null {
  return cache?.weeks.get(placeId) ?? null;
}
