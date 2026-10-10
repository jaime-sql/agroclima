import type { DayForecast, DayRisk } from "./types";

/**
 * Placeholder until the cited rust thresholds are applied.
 * Keeps the module boundary the forecast route will call.
 */
export function assessDayRisk(day: DayForecast): DayRisk {
  return {
    date: day.date,
    level: "bajo",
    reasons: [],
  };
}
