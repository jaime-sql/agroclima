import { expect, test, type Page } from "@playwright/test";

const QUESTION = "¿Lloverá mañana?";
const ANSWER = "El lunes el riesgo es alto.";
const RETRY_ANSWER = "Mañana el riesgo es medio.";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function week() {
  const dates = [
    "2026-10-18",
    "2026-10-19",
    "2026-10-20",
    "2026-10-21",
    "2026-10-22",
    "2026-10-23",
    "2026-10-24",
  ];
  return {
    ok: true,
    place: { id: "santa-ana", name: "Santa Ana" },
    available: true,
    timezone: "America/El_Salvador",
    footer: "Estimación.",
    plan: {
      fungicideClasses: ["triazol"],
      doseNote: "dosis según etiqueta / su agrónomo",
      nextDryWindow: null,
    },
    days: dates.map((date) => ({
      date,
      level: "alto",
      reason: "Humedad o lluvia algunas horas.",
      score: 2,
      wetHours: 4,
      tmax: 24,
      rain: 1,
      warmWetHours: 4,
      optWetHours: 1,
      rainDay: false,
      latencyBand: true,
      consecutiveBonus: false,
    })),
  };
}

async function installApp(page: Page) {
  await page.route("**://*.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/api/risk**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/map")) {
      await route.fulfill({
        json: { ok: true, places: [{ id: "santa-ana", level: "alto", day: "Domingo" }] },
      });
      return;
    }
    await route.fulfill({ json: week() });
  });
  await page.route("**/api/diagnose", async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        label: "sana",
        confidence: 0.95,
        band: "seguro",
        retakeReason: null,
        headline: "Parece sana",
        detail: "No vemos señales de roya.",
        advice: null,
        card: null,
        percent: 95,
      },
    });
  });
}

async function openAsk(page: Page) {
  await installApp(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await page.locator("#departamento").selectOption("Santa Ana");
  await page.locator("#municipio").selectOption("santa-ana");
  await page.locator('input[type="file"]').last().setInputFiles({
    name: "hoja.png",
    mimeType: "image/png",
    buffer: png,
  });
  const review = page.getByRole("button", { name: "Revisar hoja" });
  await expect(review).toBeEnabled();
  await review.click();
  await page.getByRole("button", { name: "Ver riesgo de 7 días" }).click();
  await page.getByRole("button", { name: "Ver mi plan" }).click();
  await page.getByRole("button", { name: "¿Tiene una pregunta?" }).click();
  await expect(page.locator("#agroclima-pregunta")).toBeVisible();
}

async function sendQuestion(page: Page) {
  const field = page.locator("#agroclima-pregunta");
  await field.fill(QUESTION);
  await field.press("Enter");
}

test("a dropped ask retries once and then shows the answer", async ({ page }) => {
  test.setTimeout(60_000);
  let calls = 0;
  let releaseSecond: () => void = () => {};
  const secondHeld = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });
  await openAsk(page);
  await page.route("**/api/ask", async (route) => {
    calls += 1;
    if (calls === 1) {
      await route.abort("failed");
      return;
    }
    await secondHeld;
    await route.fulfill({
      json: { ok: true, answer: ANSWER, refused: false },
    });
  });
  await sendQuestion(page);
  const status = page.getByRole("status").filter({ hasText: "Reintentando…" });
  await expect(status).toBeVisible();
  await expect(status.locator(".animate-spin")).toBeVisible();
  await expect(page.locator("#agroclima-pregunta")).toBeDisabled();
  await expect(page.getByRole("button", { name: "¿Qué significa Probable?" })).toBeDisabled();
  releaseSecond();
  await expect(page.getByText(ANSWER)).toBeVisible();
  await expect(page.getByText("Reintentando…")).toHaveCount(0);
  expect(calls).toBe(2);
});

test("two drops show a retry button and keep the question", async ({ page }) => {
  test.setTimeout(60_000);
  let calls = 0;
  await openAsk(page);
  await page.route("**/api/ask", async (route) => {
    calls += 1;
    await route.abort("failed");
  });
  await sendQuestion(page);
  const card = page.locator("article").filter({
    hasText: "No pudimos responder ahora. Intente de nuevo.",
  });
  await expect(card).toBeVisible();
  const button = card.getByRole("button", { name: "Intentar de nuevo" });
  await expect(button).toBeVisible();
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  await expect(page.locator("#agroclima-pregunta")).toHaveValue(QUESTION);
  await expect(page.locator("#agroclima-pregunta")).toBeEnabled();
  await expect(page.locator(".animate-spin")).toHaveCount(0);
  await expect(card.getByText("Basado en el pronóstico y la foto de esta pantalla")).toHaveCount(0);
  await expect(card.getByRole("button", { name: /Escuchar/ })).toHaveCount(0);
  expect(calls).toBe(2);
});

test("Intentar de nuevo sends the kept question once the route works", async ({ page }) => {
  test.setTimeout(60_000);
  let calls = 0;
  let drop = true;
  await openAsk(page);
  await page.route("**/api/ask", async (route) => {
    calls += 1;
    if (drop) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({
      json: { ok: true, answer: RETRY_ANSWER, refused: false },
    });
  });
  await sendQuestion(page);
  const button = page.getByRole("button", { name: "Intentar de nuevo" });
  await expect(button).toBeVisible();
  const before = calls;
  drop = false;
  await button.click();
  await expect(page.getByText(RETRY_ANSWER)).toBeVisible();
  await expect(page.getByText("No pudimos responder ahora. Intente de nuevo.")).toHaveCount(0);
  await expect(page.locator("#agroclima-pregunta")).toHaveValue(QUESTION);
  expect(calls).toBe(before + 1);
});
