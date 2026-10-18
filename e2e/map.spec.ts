import { mkdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

type Place = { id: string; name: string };

const places = JSON.parse(readFileSync("src/data/locations.json", "utf8")) as Place[];
const levels = ["alto", "medio", "bajo"] as const;
const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const colors: Record<(typeof levels)[number], string> = {
  alto: "rgb(138, 28, 20)",
  medio: "rgb(138, 106, 0)",
  bajo: "rgb(30, 91, 42)",
};

const pins = places.map((place, index) => ({
  id: place.id,
  level: levels[index % levels.length],
  day: days[index % days.length],
}));

function week(place: Place) {
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
    place: { id: place.id, name: place.name },
    available: true,
    timezone: "America/El_Salvador",
    footer: "Estimación.",
    plan: {
      fungicideClasses: ["triazol"],
      doseNote: "dosis según etiqueta / su agrónomo",
      nextDryWindow: null,
    },
    days: dates.map((date, index) => ({
      date,
      level: levels[index % levels.length],
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

test("map is at least 300px tall at 390px and a pin opens its week", async ({ page }) => {
  mkdirSync("e2e/output", { recursive: true });
  await page.route("**://*.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/api/risk**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/map")) {
      await route.fulfill({ json: { ok: true, places: pins } });
      return;
    }
    const id = url.searchParams.get("place") ?? "";
    const place = places.find((item) => item.id === id);
    if (!place) {
      await route.fulfill({ status: 400, json: { ok: false, error: "unknown_place" } });
      return;
    }
    await route.fulfill({ json: week(place) });
  });

  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  const map = page.locator("#mapa");
  await map.scrollIntoViewIfNeeded();
  const box = await map.boundingBox();
  expect(box, "#mapa has no box").not.toBeNull();
  expect(box!.height, "#mapa height").toBeGreaterThanOrEqual(300);

  const link = page.getByRole("link", { name: "Ver lista" });
  await expect(link).toHaveAttribute("href", "#lista-municipios");
  const linkBox = await link.boundingBox();
  expect(linkBox!.height).toBeGreaterThanOrEqual(44);

  const markers = page.locator("#mapa .agroclima-pin");
  await expect(markers).toHaveCount(20);
  await expect
    .poll(async () =>
      markers.evaluateAll((nodes) =>
        nodes.every((node) => {
          const text = node.textContent ?? "";
          return /alto|medio|bajo/.test(text) && /domingo|lunes|martes|miércoles|jueves|viernes|sábado/i.test(text);
        }),
      ),
    )
    .toBe(true);

  const painted = await map.evaluate((element) => {
    const mapRect = element.getBoundingClientRect();
    return [...element.querySelectorAll(".agroclima-pin")].map((marker) => {
      const pill = marker.querySelector("span");
      const rect = pill?.getBoundingClientRect();
      return {
        title: marker.getAttribute("title"),
        text: pill?.textContent ?? "",
        background: pill ? getComputedStyle(pill).backgroundColor : "",
        overflowX: pill ? pill.scrollWidth - pill.clientWidth : 99,
        overflowY: pill ? pill.scrollHeight - pill.clientHeight : 99,
        left: rect ? rect.left - mapRect.left : -1,
        top: rect ? rect.top - mapRect.top : -1,
        right: rect ? mapRect.right - rect.right : -1,
        bottom: rect ? mapRect.bottom - rect.bottom : -1,
      };
    });
  });
  expect(painted).toHaveLength(20);
  for (const [index, place] of places.entries()) {
    const pin = pins[index];
    const paint = painted[index];
    expect(paint.title, place.id).toBe(place.name);
    expect(paint.text, place.name).toContain(pin.level);
    expect(paint.text, place.name).toContain(pin.day);
    expect(paint.background, place.name).toBe(colors[pin.level]);
    expect(paint.overflowX, place.name).toBeLessThanOrEqual(1);
    expect(paint.overflowY, place.name).toBeLessThanOrEqual(1);
    expect(paint.left, place.name).toBeGreaterThanOrEqual(-1);
    expect(paint.top, place.name).toBeGreaterThanOrEqual(-1);
    expect(paint.right, place.name).toBeGreaterThanOrEqual(-1);
    expect(paint.bottom, place.name).toBeGreaterThanOrEqual(-1);
  }

  await map.screenshot({ path: "e2e/output/mapa-390.png" });

  const hit = await map.evaluate((element) => {
    const markers = [...element.querySelectorAll(".agroclima-pin")];
    for (const marker of markers) {
      const rect = marker.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const top = document.elementFromPoint(x, y);
      if (!top || !marker.contains(top)) continue;
      const pill = marker.querySelector("span");
      const day = pill?.querySelector("span")?.textContent ?? "";
      const level = (pill?.childNodes[0]?.textContent ?? "").trim();
      return { title: marker.getAttribute("title") ?? "", level, day, x, y };
    }
    return null;
  });
  expect(hit, "a pin can be tapped").not.toBeNull();
  await page.touchscreen.tap(hit!.x, hit!.y);
  const card = page.getByText(`${hit!.title}: ${hit!.level}, ${hit!.day}`);
  await expect(card).toBeVisible();
  await expect(page.getByRole("button", { name: /riesgo/i })).toHaveCount(7);
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "e2e/output/pin-card-390.png", fullPage: false });
});
