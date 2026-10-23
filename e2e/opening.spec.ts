import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { levelWord } from "../src/lib/format.ts";
import { RISK_CUTOFF_FOOTER, assessForecast } from "../src/lib/risk/assess.ts";
import { departmentMapFromWeeks } from "../src/lib/risk/department-catalog.ts";
import {
  MAP_ATTRIBUTION,
  NO_COFFEE_POINTS_COPY,
  mapSourceLine,
} from "../src/lib/risk/department-level.ts";
import { PLACES } from "../src/lib/places.ts";
import { DETECTION_NOTE, ORIENTATION_TAG, buildWhyModel } from "../src/lib/result-why.ts";
import type { WeekAssessment } from "../src/lib/risk/types.ts";

const AT = Date.UTC(2026, 9, 23, 21, 45);
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function fixtureWeek(name: string): WeekAssessment {
  return assessForecast(JSON.parse(readFileSync(path.join("test/fixtures", name), "utf8")));
}

function openingMap() {
  const high = fixtureWeek("dr03_clear_high.json");
  const medium = fixtureWeek("dr02_clear_medium.json");
  const low = fixtureWeek("dr01_clear_low.json");
  const weeks = new Map<string, WeekAssessment>();
  for (const place of PLACES) {
    const week =
      place.department === "Santa Ana" ? low : place.department === "Sonsonate" ? medium : high;
    weeks.set(place.id, week);
  }
  return { map: departmentMapFromWeeks(weeks, AT), high };
}

async function installOpening(page: Page, high: WeekAssessment) {
  await page.route("**://*.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/api/risk**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/departments")) {
      await route.fulfill({ json: openingMap().map });
      return;
    }
    if (url.pathname.endsWith("/map")) {
      await route.fulfill({
        json: {
          ok: true,
          places: PLACES.map((place) => ({ id: place.id, level: "alto", day: "Viernes" })),
        },
      });
      return;
    }
    const id = url.searchParams.get("place") ?? "";
    const place = PLACES.find((item) => item.id === id);
    if (!place) {
      await route.fulfill({ status: 400, json: { ok: false, error: "unknown_place" } });
      return;
    }
    await route.fulfill({
      json: {
        ok: true,
        ...high,
        footer: RISK_CUTOFF_FOOTER,
        place: { id: place.id, name: place.name },
      },
    });
  });
  await page.route("**/api/diagnose", async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        label: "roya",
        confidence: 0.9,
        percent: 90,
        band: "seguro",
        retakeReason: null,
        headline: "Parece roya",
        detail: "",
        advice: null,
        card: "Esto es una orientación, no un diagnóstico. Confirme con un agrónomo.",
      },
    });
  });
  await page.route("**/api/tts", (route) => route.abort());
}

test("department map, sin datos, and the second-opinion stepper", async ({ page }) => {
  test.setTimeout(60_000);
  mkdirSync("docs/screenshots", { recursive: true });
  const { map } = openingMap();
  const ahuachapan = map.departments.find((item) => item.name === "Ahuachapán");
  const santaAna = map.departments.find((item) => item.name === "Santa Ana");
  const sonsonate = map.departments.find((item) => item.name === "Sonsonate");
  expect(ahuachapan?.label).toBe("alto · 3 puntos");
  expect(santaAna?.label).toBe("bajo · 1 punto");
  expect(sonsonate?.label).toBe("medio · 2 puntos");

  await installOpening(page, fixtureWeek("dr03_clear_high.json"));
  await page.goto("/");
  await expect(page.getByText(mapSourceLine(map.updatedLabel), { exact: true })).toBeVisible();
  const legend = page.getByRole("list", { name: "Leyenda" });
  await expect(legend.getByText("Alto", { exact: true })).toBeVisible();
  await expect(legend.getByText("Medio", { exact: true })).toBeVisible();
  await expect(legend.getByText("Bajo", { exact: true })).toBeVisible();
  await expect(legend.getByText("Sin datos", { exact: true })).toBeVisible();
  const attribution = page.getByText(MAP_ATTRIBUTION, { exact: true });
  await expect(attribution).toBeVisible();
  const attributionStyle = await attribution.evaluate((element) => {
    const style = getComputedStyle(element);
    return { fontSize: Number.parseFloat(style.fontSize), color: style.color };
  });
  expect(attributionStyle.fontSize).toBeGreaterThanOrEqual(12);
  expect(attributionStyle.color).toBe("rgb(87, 83, 78)");
  await expect(page.locator('[data-department="Cabañas"]')).toHaveAttribute("data-level", "sin-datos");
  await expect(page.locator('[data-department="Ahuachapán"]')).toHaveAttribute("data-level", "alto");
  await page.locator("#mapa-departamentos").screenshot({ path: "docs/screenshots/mapa-departamentos.png" });

  await page.getByRole("button", { name: "Ver como lista" }).click();
  const cabanas = page.getByRole("button", { name: "Cabañas Sin datos" });
  await expect(cabanas).toBeVisible();
  const box = await cabanas.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await page.locator("#mapa-departamentos").screenshot({ path: "docs/screenshots/lista-departamentos.png" });
  await cabanas.click();
  const card = page.locator("#ficha-departamento");
  await expect(card.getByText(NO_COFFEE_POINTS_COPY, { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Ver municipios" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Consultar a un técnico" })).toHaveCount(0);
  await card.screenshot({ path: "docs/screenshots/sin-datos.png" });

  await page.getByRole("button", { name: "Ahuachapán alto · 3 puntos" }).click();
  await expect(card.getByRole("heading", { name: "Ahuachapán" })).toBeVisible();
  await expect(card.getByText("alto · 3 puntos", { exact: true })).toBeVisible();
  for (const point of ahuachapan?.points ?? []) {
    const row = card.locator("li").filter({ hasText: point.name });
    await expect(row).toBeVisible();
    await expect(row.getByText(levelWord(point.level ?? "alto"), { exact: true })).toBeVisible();
  }
  const worst = ahuachapan?.points.find((point) => point.level === ahuachapan.level);
  const weather = buildWhyModel({
    label: null,
    leafDetail: null,
    diagnoseFailed: false,
    day: worst
      ? { wetHours: worst.wetHours, rain: worst.rain, tmax: worst.tmax, reason: worst.reason ?? "" }
      : null,
  });
  await card.getByText("¿Por qué este resultado?").click();
  await expect(card.getByText(weather?.reasons[0] ?? "", { exact: true })).toBeVisible();
  await expect(card.getByText(DETECTION_NOTE)).toHaveCount(0);
  await card.screenshot({ path: "docs/screenshots/ficha-departamento.png" });
  await page.locator("ol[aria-label='Pasos']").screenshot({ path: "docs/screenshots/pasos.png" });
  const steps = page.getByRole("list", { name: "Pasos" });
  await expect(steps.getByText("Segunda opinión", { exact: true })).toBeVisible();
  await expect(steps.getByText("Sin foto de la hoja.", { exact: true })).toBeVisible();
  await expect(steps.getByText("Sin foto, no hay plan.", { exact: true })).toBeVisible();
  await expect(steps.getByText("Ahuachapán: alto · 3 puntos", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Ver municipios" }).click();
  await expect(page.locator("#departamento")).toHaveValue("Ahuachapán");
});

test("a leaf result hides the model score and keeps the technician button", async ({ page }) => {
  test.setTimeout(60_000);
  mkdirSync("docs/screenshots", { recursive: true });
  await page.addInitScript(() => {
    const voice = {
      lang: "es-SV",
      name: "Salvadoreña",
      default: true,
      localService: true,
      voiceURI: "es-SV",
    };
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      onvoiceschanged: null,
      getVoices: () => [voice],
      addEventListener() {},
      removeEventListener() {},
      cancel() {},
      pause() {},
      resume() {},
      speak(utterance: { onend?: () => void }) {
        queueMicrotask(() => utterance.onend?.());
      },
    };
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: synth });
  });
  await installOpening(page, fixtureWeek("dr03_clear_high.json"));
  const tts: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/tts")) tts.push(request.url());
  });
  await page.goto("/");
  await page.locator("#departamento").selectOption("Ahuachapán");
  await page.locator("#municipio").selectOption("ahuachapan");
  await page.locator('input[type="file"]').last().setInputFiles({
    name: "hoja.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByRole("button", { name: "Revisar hoja" }).click();
  await expect(page.getByRole("heading", { name: "Parece roya" })).toBeVisible();
  await expect(page.getByText(ORIENTATION_TAG, { exact: true })).toBeVisible();
  await expect(page.getByText("Alta", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Media", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Baja", { exact: true })).toHaveCount(0);
  await expect(page.getByText("90 %")).toHaveCount(0);
  const consult = page.getByRole("button", { name: "Consultar a un técnico" });
  await expect(consult).toBeVisible();
  await expect(page.locator("#por-que details")).not.toHaveAttribute("open", "");
  await page.getByText("¿Por qué este resultado?").click();
  const note = page.locator("#nota-deteccion");
  await expect(note).toHaveText(DETECTION_NOTE);
  const noteStyle = await note.evaluate((element) => {
    const style = getComputedStyle(element);
    return { fontSize: Number.parseFloat(style.fontSize), color: style.color };
  });
  expect(noteStyle.fontSize).toBeGreaterThanOrEqual(12);
  expect(noteStyle.color).toBe("rgb(87, 83, 78)");
  await page.locator("#por-que").screenshot({ path: "docs/screenshots/por-que.png" });
  await expect(page.getByText("Segunda opinión: manchas observadas en la hoja.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Ver riesgo de 7 días" }).click();
  await expect(page.getByText("Alto", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Ver mi plan" }).click();
  await expect(page.locator("#plan-escrito")).toBeVisible();
  await expect(page.getByText("Voz generada por IA", { exact: true })).toBeVisible();
  await page.locator("#plan-escrito").screenshot({ path: "docs/screenshots/escuchar-plan.png" });
  await page.getByRole("button", { name: "Escuchar plan" }).click();
  expect(tts).toEqual([]);
});
