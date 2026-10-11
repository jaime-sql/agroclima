import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fetchDepartmentForecast, forecastUrl } from "../weather/openmeteo.ts";
import {
  ALTITUDE_THRESHOLD,
  assessForecast,
  FORECAST_UNAVAILABLE,
  nextDrySprayWindow,
  REASON_SIN_DATOS,
  RISK_CUTOFF_FOOTER,
} from "./assess.ts";
import type { OpenMeteoForecast, RiskLevel } from "./types.ts";

type HourInput = {
  time: string;
  temperature_2m?: number | null;
  relative_humidity_2m?: number | null;
  precipitation?: number | null;
  precipitation_probability?: number | null;
};

type DayInput = {
  date: string;
  hours: HourInput[];
  temperature_2m_max?: number | null;
  temperature_2m_min?: number | null;
  precipitation_sum?: number | null;
  precipitation_hours?: number | null;
  precipitation_probability_max?: number | null;
};

function padHours(day: DayInput): HourInput[] {
  const byHour = new Map<string, HourInput>();
  for (const hour of day.hours) byHour.set(hour.time.slice(11, 13), hour);
  return Array.from({ length: 24 }, (_, hour) => {
    const key = String(hour).padStart(2, "0");
    return (
      byHour.get(key) ?? {
        time: `${day.date}T${key}:00`,
        temperature_2m: 18,
        relative_humidity_2m: 60,
        precipitation: 0,
        precipitation_probability: 0,
      }
    );
  });
}

function forecast(days: DayInput[], pad = true): OpenMeteoForecast {
  const hourly: OpenMeteoForecast["hourly"] = {
    time: [],
    temperature_2m: [],
    relative_humidity_2m: [],
    precipitation: [],
    precipitation_probability: [],
  };
  const daily: OpenMeteoForecast["daily"] = {
    time: [],
    temperature_2m_max: [],
    temperature_2m_min: [],
    precipitation_sum: [],
    precipitation_hours: [],
    precipitation_probability_max: [],
  };

  for (const day of days) {
    daily.time.push(day.date);
    daily.temperature_2m_max.push(day.temperature_2m_max ?? 20);
    daily.temperature_2m_min.push(day.temperature_2m_min ?? 18);
    daily.precipitation_sum.push(day.precipitation_sum ?? 0);
    daily.precipitation_hours.push(day.precipitation_hours ?? 0);
    daily.precipitation_probability_max.push(
      day.precipitation_probability_max ?? 0,
    );
    for (const hour of pad ? padHours(day) : day.hours) {
      hourly.time.push(hour.time);
      hourly.temperature_2m.push(hour.temperature_2m ?? 18);
      hourly.relative_humidity_2m.push(hour.relative_humidity_2m ?? 50);
      hourly.precipitation.push(hour.precipitation ?? 0);
      hourly.precipitation_probability.push(
        hour.precipitation_probability ?? 0,
      );
    }
  }

  return { hourly, daily };
}

function wetHours(date: string, count: number, temperature: number): HourInput[] {
  return Array.from({ length: count }, (_, index) => ({
    time: `${date}T${String(index).padStart(2, "0")}:00`,
    temperature_2m: temperature,
    relative_humidity_2m: 95,
    precipitation: 0,
    precipitation_probability: 0,
  }));
}

function sprayHour(time: string, overrides: Partial<HourInput> = {}): HourInput {
  return {
    time,
    temperature_2m: 24,
    relative_humidity_2m: 70,
    precipitation: 0,
    precipitation_probability: 10,
    ...overrides,
  };
}

describe("coffee rust risk rules", () => {
  it("R1 uses 15–30 °C as the warm wet window and 21–25 °C for the extra point", () => {
    const optimum = assessForecast(
      forecast([
        {
          date: "2026-10-10",
          hours: wetHours("2026-10-10", 3, 22),
          temperature_2m_max: 20,
        },
      ]),
    ).days[0];
    const warmOnly = assessForecast(
      forecast([
        {
          date: "2026-10-10",
          hours: wetHours("2026-10-10", 3, 18),
          temperature_2m_max: 20,
        },
      ]),
    ).days[0];
    assert.equal(optimum.optWetHours, 3);
    assert.equal(optimum.score, 2);
    assert.equal(warmOnly.warmWetHours, 3);
    assert.equal(warmOnly.optWetHours, 0);
    assert.equal(warmOnly.score, 1);

    const twoOptimumHours = assessForecast(
      forecast([
        {
          date: "2026-10-10",
          hours: wetHours("2026-10-10", 2, 22),
          temperature_2m_max: 20,
        },
      ]),
    ).days[0];
    assert.equal(twoOptimumHours.score, 0);

    const cold = assessForecast(
      forecast([
        {
          date: "2026-10-10",
          hours: wetHours("2026-10-10", 8, 14.9),
          temperature_2m_max: 25,
          precipitation_sum: 5,
          precipitation_probability_max: 80,
        },
      ]),
    ).days[0];
    assert.equal(cold.wetHours, 8);
    assert.equal(cold.warmWetHours, 0);
    assert.equal(cold.level, "bajo");
    assert.equal(
      cold.reason,
      "«Temperatura poco favorable para la roya.»",
    );

    const hot = assessForecast(
      forecast([
        {
          date: "2026-10-10",
          hours: wetHours("2026-10-10", 8, 30.1),
          temperature_2m_max: 31,
        },
      ]),
    ).days[0];
    assert.equal(hot.warmWetHours, 0);
    assert.equal(hot.level, "bajo");

    const edges = (temperature: number, max: number) =>
      assessForecast(
        forecast([
          {
            date: "2026-10-10",
            hours: wetHours("2026-10-10", 1, temperature),
            temperature_2m_max: max,
          },
        ]),
      ).days[0];
    assert.equal(edges(15, 15).warmWetHours, 1);
    assert.equal(edges(15, 15).optWetHours, 0);
    assert.equal(edges(30, 30).warmWetHours, 1);
    assert.equal(edges(30, 30).optWetHours, 0);
    assert.equal(edges(21, 21).optWetHours, 1);
    assert.equal(edges(25, 21).optWetHours, 1);
    assert.equal(edges(20.9, 20).optWetHours, 0);
    assert.equal(edges(20.9, 20).warmWetHours, 1);
    assert.equal(edges(25.1, 20).optWetHours, 0);
    assert.equal(edges(25.1, 20).warmWetHours, 1);

    const alto = assessForecast(
      forecast([
        {
          date: "2026-10-10",
          hours: wetHours("2026-10-10", 6, 22),
          temperature_2m_max: 22,
        },
      ]),
    ).days[0];
    assert.equal(alto.score, 4);
    assert.equal(alto.level, "alto");
    assert.equal(
      alto.reason,
      "«Hojas mojadas muchas horas y clima tibio: la roya se pega fácil.»",
    );
  });

  it("R2 gives +2 for ≥6 warm wet hours, +1 for 3–5, and the bonus only when today and the previous date both have ≥6", () => {
    const scoreFor = (count: number) =>
      assessForecast(
        forecast([
          {
            date: "2026-10-10",
            hours: wetHours("2026-10-10", count, 18),
            temperature_2m_max: 20,
          },
        ]),
      ).days[0];
    assert.equal(scoreFor(6).score, 2);
    assert.equal(scoreFor(6).level, "medio");
    assert.equal(
      scoreFor(6).reason,
      "«Humedad o lluvia algunas horas: riesgo moderado.»",
    );
    assert.equal(scoreFor(5).score, 1);
    assert.equal(scoreFor(5).level, "bajo");
    assert.equal(scoreFor(3).score, 1);
    assert.equal(scoreFor(2).score, 0);

    const paired = assessForecast(
      forecast([
        {
          date: "2026-10-10",
          hours: wetHours("2026-10-10", 6, 18),
          temperature_2m_max: 20,
        },
        {
          date: "2026-10-11",
          hours: wetHours("2026-10-11", 6, 18),
          temperature_2m_max: 20,
        },
      ]),
    );
    assert.equal(paired.days[0].consecutiveBonus, false);
    const withBonus = paired.days[1];
    assert.equal(withBonus.consecutiveBonus, true);
    assert.equal(withBonus.score, 3);
    assert.equal(withBonus.level, "medio");

    const skippedDate = assessForecast(
      forecast([
        {
          date: "2026-10-10",
          hours: wetHours("2026-10-10", 6, 18),
          temperature_2m_max: 20,
        },
        {
          date: "2026-10-12",
          hours: wetHours("2026-10-12", 6, 18),
          temperature_2m_max: 20,
        },
      ]),
    ).days[1];
    assert.equal(skippedDate.consecutiveBonus, false);
    assert.equal(skippedDate.score, 2);

    const todayShort = assessForecast(
      forecast([
        {
          date: "2026-10-10",
          hours: wetHours("2026-10-10", 6, 18),
          temperature_2m_max: 20,
        },
        {
          date: "2026-10-11",
          hours: wetHours("2026-10-11", 3, 18),
          temperature_2m_max: 20,
        },
      ]),
    ).days[1];
    assert.equal(todayShort.consecutiveBonus, false);
    assert.equal(todayShort.score, 1);
    assert.equal(
      todayShort.reason,
      "«Pocas horas húmedas favorables; riesgo bajo de roya»",
    );

    const noBonus = assessForecast(
      forecast([
        {
          date: "2026-10-10",
          hours: wetHours("2026-10-10", 5, 18),
          temperature_2m_max: 20,
        },
        {
          date: "2026-10-11",
          hours: wetHours("2026-10-11", 3, 18),
          temperature_2m_max: 20,
        },
      ]),
    ).days[1];
    assert.equal(noBonus.consecutiveBonus, false);
    assert.equal(noBonus.score, 1);
  });

  it("counts a wet hour when RH ≥ 90 or precipitation ≥ 0.1 mm", () => {
    const day = assessForecast(
      forecast([
        {
          date: "2026-10-10",
          temperature_2m_max: 20,
          hours: [
            {
              time: "2026-10-10T00:00",
              relative_humidity_2m: 90,
              precipitation: 0,
              temperature_2m: 18,
            },
            {
              time: "2026-10-10T01:00",
              relative_humidity_2m: 89.9,
              precipitation: 0,
              temperature_2m: 18,
            },
            {
              time: "2026-10-10T02:00",
              relative_humidity_2m: 50,
              precipitation: 0.1,
              temperature_2m: 18,
            },
            {
              time: "2026-10-10T03:00",
              relative_humidity_2m: 50,
              precipitation: 0.09,
              temperature_2m: 18,
            },
          ],
        },
      ]),
    ).days[0];
    assert.equal(day.wetHours, 2);
    assert.equal(day.warmWetHours, 2);
  });

  it("R4 adds 1 when the daily rain sum ≥ 1 mm or the max probability ≥ 60%", () => {
    const day = (sum: number, probability: number) =>
      assessForecast(
        forecast([
          {
            date: "2026-10-10",
            hours: wetHours("2026-10-10", 3, 18),
            temperature_2m_max: 20,
            precipitation_sum: sum,
            precipitation_probability_max: probability,
          },
        ]),
      ).days[0];
    assert.equal(day(0, 0).rainDay, false);
    assert.equal(day(0, 0).score, 1);
    assert.equal(day(1, 0).rainDay, true);
    assert.equal(day(1, 0).score, 2);
    assert.equal(day(0.9, 59).score, 1);
    assert.equal(day(0, 60).score, 2);
    assert.equal(day(0, 60).level, "medio");
  });

  it("R5 adds 1 for a daily max of 22–28 °C and does not apply a diurnal-range cutoff", () => {
    const day = (max: number, min: number) =>
      assessForecast(
        forecast([
          {
            date: "2026-10-10",
            hours: wetHours("2026-10-10", 3, 18),
            temperature_2m_max: max,
            temperature_2m_min: min,
          },
        ]),
      ).days[0];
    assert.equal(day(21.9, 18).latencyBand, false);
    assert.equal(day(21.9, 18).score, 1);
    assert.equal(day(22, 10).latencyBand, true);
    assert.equal(day(22, 10).score, 2);
    assert.equal(day(28, 27).score, 2);
    assert.equal(day(28.1, 27).latencyBand, false);
    assert.equal(day(28.1, 27).score, 1);
  });

  it("R6 keeps a dry day at bajo even when temperature and the previous day would add points", () => {
    const dry = assessForecast(
      forecast([
        {
          date: "2026-10-10",
          hours: wetHours("2026-10-10", 6, 18),
          temperature_2m_max: 20,
        },
        {
          date: "2026-10-11",
          hours: [
            {
              time: "2026-10-11T12:00",
              temperature_2m: 25,
              relative_humidity_2m: 40,
              precipitation: 0,
              precipitation_probability: 0,
            },
          ],
          temperature_2m_max: 25,
          temperature_2m_min: 24,
          precipitation_sum: 0,
          precipitation_probability_max: 0,
        },
      ]),
    ).days[1];
    assert.equal(dry.wetHours, 0);
    assert.equal(dry.rainDay, false);
    assert.equal(dry.latencyBand, true);
    assert.equal(dry.consecutiveBonus, false);
    assert.equal(dry.score, 1);
    assert.equal(dry.level, "bajo");
    assert.equal(dry.reason, "«Día seco: la roya casi no avanza.»");
  });

  it("R7 does not score altitude bands", () => {
    assert.equal(ALTITUDE_THRESHOLD, null);
    const highAndCool = assessForecast(
      forecast([
        {
          date: "2026-10-10",
          hours: wetHours("2026-10-10", 6, 14),
          temperature_2m_max: 14,
        },
      ]),
    ).days[0];
    assert.equal(highAndCool.level, "bajo");
    assert.equal(
      highAndCool.reason,
      "«Temperatura poco favorable para la roya.»",
    );
  });

  it("the spray window needs 4 hours with precipitation < 0.1 mm and probability < 40%", () => {
    const window = nextDrySprayWindow(
      forecast([
        {
          date: "2026-10-10",
          hours: [
            sprayHour("2026-10-10T08:00", { precipitation: 0.1 }),
            sprayHour("2026-10-10T09:00", { precipitation_probability: 40 }),
            sprayHour("2026-10-10T10:00"),
            sprayHour("2026-10-10T11:00"),
            sprayHour("2026-10-10T12:00"),
            sprayHour("2026-10-10T13:00", { precipitation: 1 }),
            sprayHour("2026-10-10T14:00"),
            sprayHour("2026-10-10T15:00"),
            sprayHour("2026-10-10T16:00"),
            sprayHour("2026-10-10T17:00"),
          ],
        },
      ], false).hourly!,
    );
    assert.deepEqual(window, {
      start: "2026-10-10T14:00",
      end: "2026-10-10T17:00",
    });
  });

  it("the spray window also needs dry leaves, RH < 90", () => {
    const window = nextDrySprayWindow(
      forecast([
        {
          date: "2026-10-10",
          hours: [
            sprayHour("2026-10-10T08:00", { relative_humidity_2m: 90 }),
            sprayHour("2026-10-10T09:00"),
            sprayHour("2026-10-10T10:00"),
            sprayHour("2026-10-10T11:00"),
            sprayHour("2026-10-10T12:00"),
          ],
        },
      ], false).hourly!,
    );
    assert.deepEqual(window, {
      start: "2026-10-10T09:00",
      end: "2026-10-10T12:00",
    });

    const tooShort = nextDrySprayWindow(
      forecast([
        {
          date: "2026-10-10",
          hours: [
            sprayHour("2026-10-10T08:00", { relative_humidity_2m: 90 }),
            sprayHour("2026-10-10T09:00"),
            sprayHour("2026-10-10T10:00"),
            sprayHour("2026-10-10T11:00"),
          ],
        },
      ], false).hourly!,
    );
    assert.equal(tooShort, null);
  });

  it("the plan names fungicide classes and no numeric dose", () => {
    const result = assessForecast(
      forecast([
        {
          date: "2026-10-10",
          hours: [sprayHour("2026-10-10T08:00")],
          temperature_2m_max: 20,
        },
      ]),
    );
    assert.deepEqual(result.plan.fungicideClasses, [
      "cobre",
      "triazol",
      "triazol+estrobilurina",
    ]);
    assert.equal(result.plan.doseNote, "dosis según etiqueta / su agrónomo");
    const text = `${result.plan.doseNote} ${result.plan.fungicideClasses.join(" ")}`;
    assert.doesNotMatch(text, /\d/);
    assert.equal(
      result.footer,
      "Estos umbrales de riesgo son una estimación nuestra y no han sido validados por PROCAFE ni por el MAG.",
    );
    assert.equal(result.footer, RISK_CUTOFF_FOOTER);
  });
});

const ALTO = "«Hojas mojadas muchas horas y clima tibio: la roya se pega fácil.»";
const MEDIO = "«Humedad o lluvia algunas horas: riesgo moderado.»";
const SECO = "«Día seco: la roya casi no avanza.»";
const TEMP = "«Temperatura poco favorable para la roya.»";
const POCAS = "«Pocas horas húmedas favorables; riesgo bajo de roya»";
const LLUVIA = "«Llueve, pero sin horas húmedas favorables a la roya»";

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(process.cwd(), "test/fixtures", name), "utf8"));
}

function expectScoredDay(
  file: string,
  index: number,
  level: RiskLevel | null,
  reason: string,
  score?: number,
) {
  const week = assessForecast(readFixture(file) as OpenMeteoForecast);
  assert.equal(week.available, true, file);
  const day = week.days[index];
  assert.ok(day, file);
  assert.equal(day.level, level, `${file} level`);
  assert.equal(day.reason, reason, `${file} reason`);
  if (score !== undefined) assert.equal(day.score, score, `${file} score`);
}

describe("DR-01 to DR-68 fixtures", () => {
  const scored: Array<[string, RiskLevel | null, string, number?]> = [
    ["dr01_clear_low.json", "bajo", SECO],
    ["dr02_clear_medium.json", "medio", MEDIO],
    ["dr03_clear_high.json", "alto", ALTO],
    ["r3_rh_at.json", "medio", MEDIO],
    ["r3_rh_below.json", "bajo", POCAS],
    ["r3_rh_above.json", "medio", MEDIO],
    ["r2_precip_at.json", "medio", MEDIO],
    ["r2_precip_below.json", "bajo", POCAS],
    ["r2_precip_above.json", "medio", MEDIO],
    ["r1_warm_15_at.json", "medio", MEDIO],
    ["r1_warm_15_below.json", "bajo", TEMP],
    ["r1_warm_15_above.json", "medio", MEDIO],
    ["r1_warm_30_at.json", "medio", MEDIO],
    ["r1_warm_30_below.json", "medio", MEDIO],
    ["r1_warm_30_above.json", "bajo", TEMP],
    ["r1_opt_21_at.json", "medio", MEDIO],
    ["r1_opt_21_below.json", "bajo", POCAS],
    ["r1_opt_21_above.json", "medio", MEDIO],
    ["r1_opt_25_at.json", "medio", MEDIO],
    ["r1_opt_25_below.json", "medio", MEDIO],
    ["r1_opt_25_above.json", "bajo", POCAS],
    ["r1_optcount_2h.json", "medio", MEDIO, 2],
    ["r1_optcount_3h.json", "medio", MEDIO, 3],
    ["r1_optcount_4h.json", "medio", MEDIO, 3],
    ["r2_count3_2h.json", "bajo", POCAS],
    ["r2_count3_3h.json", "medio", MEDIO],
    ["r2_count3_4h.json", "medio", MEDIO],
    ["r2_count6_5h.json", "medio", MEDIO],
    ["r2_count6_6h.json", "alto", ALTO],
    ["r2_count6_7h.json", "alto", ALTO],
    ["r4_sum_at.json", "medio", MEDIO],
    ["r4_sum_below.json", "bajo", POCAS],
    ["r4_sum_above.json", "medio", MEDIO],
    ["r4_prob_at.json", "medio", MEDIO],
    ["r4_prob_below.json", "bajo", POCAS],
    ["r4_prob_above.json", "medio", MEDIO],
    ["r5_tmax_22_at.json", "medio", MEDIO],
    ["r5_tmax_22_below.json", "bajo", POCAS],
    ["r5_tmax_22_above.json", "medio", MEDIO],
    ["r5_tmax_28_at.json", "medio", MEDIO],
    ["r5_tmax_28_below.json", "medio", MEDIO],
    ["r5_tmax_28_above.json", "bajo", POCAS],
    ["r5_dtr_large.json", "medio", MEDIO],
    ["r5_dtr_small.json", "medio", MEDIO],
    ["r6_rainday_no_wet_hours.json", "bajo", LLUVIA],
    ["r6_all_wet_cold.json", "bajo", TEMP],
    ["bajo_score1_warm_wet.json", "bajo", POCAS],
    ["null_rh_in_wet_window.json", null, REASON_SIN_DATOS],
    ["null_temp_on_wet_hours.json", null, REASON_SIN_DATOS],
    ["null_precip_with_low_rh.json", null, REASON_SIN_DATOS],
    ["missing_hours_half_day.json", null, REASON_SIN_DATOS],
    ["null_daily_fields.json", null, REASON_SIN_DATOS],
  ];

  for (const [file, level, reason, score] of scored) {
    it(`${file} matches its DR level and sentence`, () => {
      expectScoredDay(file, 0, level, reason, score);
    });
  }

  it("DR-45 to DR-49 score the second day, including a calendar gap", () => {
    expectScoredDay("bonus_prev_5h.json", 1, "medio", MEDIO, 3);
    expectScoredDay("bonus_prev_6h.json", 1, "alto", ALTO, 4);
    expectScoredDay("bonus_prev_7h.json", 1, "alto", ALTO, 4);
    expectScoredDay("bonus_today_lt6.json", 1, "medio", MEDIO, 2);
    expectScoredDay("bonus_date_gap.json", 1, "medio", MEDIO, 3);
  });

  it("DR-57 keeps the scored day and marks the day with no hours sin datos", () => {
    const week = assessForecast(readFixture("missing_all_hours_for_day.json") as OpenMeteoForecast);
    assert.equal(week.available, true);
    assert.equal(week.days[0].date, "2026-10-12");
    assert.equal(week.days[0].level, "alto");
    assert.equal(week.days[1].date, "2026-10-13");
    assert.equal(week.days[1].level, null);
    assert.equal(week.days[1].reason, REASON_SIN_DATOS);
  });

  it("DR-64 and DR-65 keep seven ordered days after a shuffled reply", () => {
    const levels: RiskLevel[] = ["bajo", "medio", "alto", "bajo", "medio", "alto", "bajo"];
    const reasons = [SECO, MEDIO, ALTO, POCAS, MEDIO, ALTO, TEMP];
    const ordered = assessForecast(readFixture("strip_7day_ordered.json") as OpenMeteoForecast);
    const shuffled = assessForecast(readFixture("strip_7day_shuffled.json") as OpenMeteoForecast);
    assert.deepEqual(
      ordered.days.map((day) => day.date),
      ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"],
    );
    assert.deepEqual(ordered.days.map((day) => day.level), levels);
    assert.deepEqual(ordered.days.map((day) => day.reason), reasons);
    assert.equal(ordered.days[3].score, 1);
    assert.deepEqual(
      shuffled.days.map((day) => [day.date, day.level, day.reason, day.score]),
      ordered.days.map((day) => [day.date, day.level, day.reason, day.score]),
    );
  });

  it("DR-67 counts late local wet hours on the same calendar day", () => {
    const week = assessForecast(readFixture("tz_late_night_wet_hours.json") as OpenMeteoForecast);
    assert.equal(week.days[0].date, "2026-10-12");
    assert.equal(week.days[0].level, "medio");
    assert.equal(week.days[1].date, "2026-10-13");
    assert.equal(week.days[1].level, "bajo");
    assert.equal(week.days[1].reason, SECO);
  });

  it("DR-66 requests America/El_Salvador for seven days", () => {
    const url = new URL(forecastUrl(13.98827, -89.55685));
    assert.equal(url.searchParams.get("timezone"), "America/El_Salvador");
    assert.equal(url.searchParams.get("forecast_days"), "7");
  });

  it("DR-68 rejects a forecast whose timezone is not America/El_Salvador", () => {
    const week = assessForecast(readFixture("tz_wrong_timezone_utc.json") as OpenMeteoForecast);
    assert.equal(FORECAST_UNAVAILABLE, "«pronóstico no disponible»");
    assert.equal(week.available, false);
    assert.deepEqual(week.days, []);
  });

  it("DR-59 to DR-63 end in pronóstico no disponible without throwing", async () => {
    const files = [
      "fetch_http_500.json",
      "fetch_http_400_error_body.json",
      "fetch_200_missing_hourly.json",
      "fetch_200_empty_arrays.json",
    ];
    for (const file of files) {
      const fixture = readFixture(file) as { _http_status: number; body: unknown };
      const result = await fetchDepartmentForecast("santa-ana", async () => {
        return new Response(JSON.stringify(fixture.body), { status: fixture._http_status });
      });
      assert.deepEqual(result, { ok: false, error: "forecast_unavailable" }, file);
      assert.doesNotThrow(() => assessForecast(fixture.body as OpenMeteoForecast));
      assert.equal(assessForecast(fixture.body as OpenMeteoForecast).available, false, file);
    }

    const rejected = await fetchDepartmentForecast("santa-ana", async () => {
      throw new TypeError("dns");
    });
    assert.deepEqual(rejected, { ok: false, error: "forecast_unavailable" });
  });
});
