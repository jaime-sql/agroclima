import { placeById, type Place } from "../places.ts";
import { fetchForecast } from "../weather/openmeteo.ts";
import { assessForecast } from "./assess.ts";
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
    const forecast = await fetchForecast(
      place.latitude,
      place.longitude,
      fetchImpl,
    );
    const week = assessForecast(forecast);
    return {
      ok: true,
      place: { id: place.id, name: place.name },
      ...week,
    };
  } catch {
    return { ok: false, error: "forecast_unavailable" };
  }
}
