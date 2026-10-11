import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALTITUDE_THRESHOLD,
  assessForecast,
  nextDrySprayWindow,
  RISK_CUTOFF_FOOTER,
} from "./assess.ts";
import type { OpenMeteoForecast } from "./types.ts";

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

function forecast(days: DayInput[]): OpenMeteoForecast {
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
    for (const hour of day.hours) {
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

  it("R2 gives +2 for ≥6 warm wet hours, +1 for 3–5, and +1 after a previous ≥6 day", () => {
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

    const withBonus = assessForecast(
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
    assert.equal(withBonus.consecutiveBonus, true);
    assert.equal(withBonus.score, 2);
    assert.equal(withBonus.level, "medio");

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
    assert.equal(dry.consecutiveBonus, true);
    assert.ok(dry.score >= 2);
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
      ]).hourly,
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
      ]).hourly,
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
      ]).hourly,
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
