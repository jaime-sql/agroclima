import { placeById, type Place } from "../places.ts";
import { fetchForecast } from "../weather/openmeteo.ts";
import { assessForecast } from "./assess.ts";
import { parseGpsQuery } from "./gps.ts";
import { readCachedPlaceRisk } from "./places-forecast.ts";
import type { WeekAssessment } from "./types.ts";

export type RiskResponse =
  | ({
      ok: true;
      place: { id: Place["id"]; name: string };
    } & WeekAssessment)
  | { ok: false; error: "unknown_place" | "forecast_unavailable" };

export async function loadPlaceRisk(
  placeId: string,
  fetchImpl?: typeof fetch,
): Promise<RiskResponse> {
  const place = placeById(placeId);
  if (!place) return { ok: false, error: "unknown_place" };
  try {
    const loaded = await fetchForecast(
      place.latitude,
      place.longitude,
      fetchImpl,
    );
    if (!loaded.ok) return { ok: false, error: "forecast_unavailable" };
    const week = assessForecast(loaded.forecast);
    if (!week.available) return { ok: false, error: "forecast_unavailable" };
    return {
      ok: true,
      place: { id: place.id, name: place.name },
      ...week,
    };
  } catch {
    return { ok: false, error: "forecast_unavailable" };
  }
}

export type PointRiskResponse =
  | ({
      ok: true;
      place: { id: "punto"; name: string };
      elevation_m: number | null;
    } & WeekAssessment)
  | { ok: false; error: "forecast_unavailable" };

/** Forecast for an already validated, 3-decimal GPS point. Does not keep the coordinates. */
export async function loadPointRisk(
  latitude: number,
  longitude: number,
  fetchImpl?: typeof fetch,
): Promise<PointRiskResponse> {
  try {
    const loaded = await fetchForecast(latitude, longitude, fetchImpl);
    if (!loaded.ok) return { ok: false, error: "forecast_unavailable" };
    const week = assessForecast(loaded.forecast);
    if (!week.available) return { ok: false, error: "forecast_unavailable" };
    const elevation = loaded.forecast.elevation;
    return {
      ok: true,
      place: { id: "punto", name: "Punto de la cuadrícula más cercano" },
      elevation_m: typeof elevation === "number" && Number.isFinite(elevation) ? elevation : null,
      ...week,
    };
  } catch {
    return { ok: false, error: "forecast_unavailable" };
  }
}

export type RiskQueryResult = {
  status: number;
  body:
    | RiskResponse
    | PointRiskResponse
    | { ok: false; error: "invalid_point" | "outside_el_salvador"; message: string };
};

/**
 * `place` is the listed-municipality path and is not checked against the country polygon.
 * `lat` and `lon` are the GPS path: polygon plus 1 km, then rounded for the forecast request.
 */
export async function handleRiskQuery(
  url: URL,
  fetchImpl?: typeof fetch,
): Promise<RiskQueryResult> {
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  if (lat !== null || lon !== null) {
    const parsed = parseGpsQuery(lat, lon);
    if (!parsed.ok) return { status: 400, body: parsed };
    const result = await loadPointRisk(parsed.latitude, parsed.longitude, fetchImpl);
    return { status: result.ok ? 200 : 502, body: result };
  }
  const placeId = url.searchParams.get("place") ?? "";
  const cached = readCachedPlaceRisk(placeId);
  if (cached) return { status: 200, body: cached };
  const result = await loadPlaceRisk(placeId, fetchImpl);
  const status = result.ok ? 200 : result.error === "unknown_place" ? 400 : 502;
  return { status, body: result };
}
