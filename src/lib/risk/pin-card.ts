import { formatWeekday } from "../format.ts";
import type { RiskLevel } from "./types.ts";

const LEVEL_RANK: Record<RiskLevel, number> = { bajo: 1, medio: 2, alto: 3 };

type ScoredDay = { date: string; level: RiskLevel | null };

/** Earliest day that reaches the week's highest level. Null when no day was scored. */
export function worstDay(days: readonly ScoredDay[]): { level: RiskLevel; date: string } | null {
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

/**
 * Worst-day line for a listed place, on a pin tap and in the municipio picker.
 * All seven days one level: "Toda la semana: alto" (no day).
 * Today among the worst days: "Peor día: hoy".
 * Otherwise the earliest of those days: "Peor día: Martes".
 * `today` defaults to the first day, which is the forecast's local today.
 */
export function pinCardLine(days: readonly ScoredDay[], today = days[0]?.date ?? ""): string | null {
  const first = days[0];
  if (days.length === 7 && first?.level && days.every((day) => day.level === first.level)) {
    return `Toda la semana: ${first.level}`;
  }
  const worst = worstDay(days);
  if (!worst) return null;
  if (days.some((day) => day.date === today && day.level === worst.level)) return "Peor día: hoy";
  return `Peor día: ${formatWeekday(worst.date)}`;
}
