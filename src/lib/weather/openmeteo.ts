import { assessForecast } from "../risk/assess.ts";
import type { OpenMeteoForecast } from "../risk/types";

export type LoadedForecast =
  | { ok: true; forecast: OpenMeteoForecast }
  | { ok: false; error: "forecast_unavailable" };

const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

/**
 * Seats of the three departments (GeoNames PPLA), not polygon centroids
 * and not a farm. Retrieved 2026-10-11.
 * Santa Ana 13.98827, -89.55685 — https://www.geonames.org/3583334/santa-ana.html
 * Ahuachapán 13.92403, -89.84344 — https://www.geonames.org/3587426/ahuachapan.html
 * Chalatenango 14.04138, -88.93951 — https://www.geonames.org/3587091/chalatenango.html
 */
export const DEPARTMENTS = [
  {
    id: "santa-ana",
    name: "Santa Ana",
    latitude: 13.98827,
    longitude: -89.55685,
  },
  {
    id: "ahuachapan",
    name: "Ahuachapán",
    latitude: 13.92403,
    longitude: -89.84344,
  },
  {
    id: "chalatenango",
    name: "Chalatenango",
    latitude: 14.04138,
    longitude: -88.93951,
  },
] as const;

export type DepartmentId = (typeof DEPARTMENTS)[number]["id"];

/**
 * Hourly and daily fields named in docs/rust-risk-rules.md.
 * `dew_point_2m` is listed there as an optional proxy whose threshold
 * was not adopted, so it is not requested.
 * `elevation` is left unset so Open-Meteo uses its default DEM
 * downscale. R7 has no altitude band of our own.
 */
export function forecastUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: "America/El_Salvador",
    forecast_days: "7",
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "precipitation_probability",
    ].join(","),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_hours",
      "precipitation_probability_max",
    ].join(","),
  });
  return `${FORECAST_ENDPOINT}?${params.toString()}`;
}

export async function fetchForecast(
  latitude: number,
  longitude: number,
  fetchImpl: typeof fetch = fetch,
): Promise<LoadedForecast> {
  try {
    const response = await fetchImpl(forecastUrl(latitude, longitude));
    const body = (await response.json().catch(() => null)) as OpenMeteoForecast | null;
    if (!response.ok || !body || typeof body !== "object") {
      return { ok: false, error: "forecast_unavailable" };
    }
    if (!assessForecast(body).available) {
      return { ok: false, error: "forecast_unavailable" };
    }
    return { ok: true, forecast: body };
  } catch {
    return { ok: false, error: "forecast_unavailable" };
  }
}

export function fetchDepartmentForecast(
  departmentId: DepartmentId,
  fetchImpl?: typeof fetch,
): Promise<LoadedForecast> {
  const department = DEPARTMENTS.find((item) => item.id === departmentId);
  if (!department) {
    return Promise.resolve({ ok: false, error: "forecast_unavailable" });
  }
  return fetchForecast(department.latitude, department.longitude, fetchImpl);
}
