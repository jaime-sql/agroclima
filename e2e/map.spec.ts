import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { formatWeekday } from "../src/lib/format.ts";
import { pinCardLine, worstDay } from "../src/lib/risk/pin-card.ts";

type Place = { id: string; name: string };
type Level = "alto" | "medio" | "bajo";

const places = JSON.parse(readFileSync("src/data/locations.json", "utf8")) as Place[];
const colors: Record<Level, string> = {
  alto: "rgb(138, 28, 20)",
  medio: "rgb(138, 106, 0)",
  bajo: "rgb(30, 91, 42)",
};
const letter: Record<Level, string> = { alto: "A", medio: "M", bajo: "B" };
const dates = [
  "2026-10-18",
  "2026-10-19",
  "2026-10-20",
  "2026-10-21",
  "2026-10-22",
  "2026-10-23",
  "2026-10-24",
];

function levelsFor(index: number): Level[] {
  const kind = index % 3;
  if (kind === 0) return dates.map(() => "bajo");
  if (kind === 1) return dates.map((_, day) => (day === 0 || day === 3 ? "alto" : "medio"));
  return dates.map((_, day) => (day >= 5 ? "medio" : "bajo"));
}

const weeks = places.map((place, index) => {
  const levels = levelsFor(index);
  const scored = dates.map((date, day) => ({ date, level: levels[day] }));
  const worst = worstDay(scored);
  return {
    ...place,
    levels,
    level: worst?.level ?? null,
    day: worst ? formatWeekday(worst.date) : "",
    line: pinCardLine(scored, dates[0]),
  };
});

const pins = weeks.map((place) => ({ id: place.id, level: place.level, day: place.day }));

function week(place: (typeof weeks)[number]) {
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
      level: place.levels[index],
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

async function pinSpread(map: import("@playwright/test").Locator) {
  return map.evaluate((element) => {
    const mapRect = element.getBoundingClientRect();
    const pins = [...element.querySelectorAll(".agroclima-pin")].map((marker) => {
      const pill = marker.querySelector("span");
      const rect = marker.getBoundingClientRect();
      return {
        id: marker.getAttribute("data-place-id"),
        label: marker.getAttribute("aria-label"),
        text: (marker.textContent ?? "").trim(),
        background: pill ? getComputedStyle(pill).backgroundColor : "",
        width: rect.width,
        height: rect.height,
        z: Number((marker as HTMLElement).style.zIndex || 0),
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        left: rect.left - mapRect.left,
        top: rect.top - mapRect.top,
        right: mapRect.right - rect.right,
        bottom: mapRect.bottom - rect.bottom,
      };
    });
    let min = Number.POSITIVE_INFINITY;
    let pair: [string, string] = ["", ""];
    for (let i = 0; i < pins.length; i += 1) {
      for (let j = i + 1; j < pins.length; j += 1) {
        const distance = Math.hypot(pins[i].cx - pins[j].cx, pins[i].cy - pins[j].cy);
        if (distance < min) {
          min = distance;
          pair = [pins[i].id ?? "", pins[j].id ?? ""];
        }
      }
    }
    const xs = pins.map((pin) => pin.cx);
    const ys = pins.map((pin) => pin.cy);
    return {
      mapWidth: mapRect.width,
      mapHeight: mapRect.height,
      spanX: Math.max(...xs) - Math.min(...xs),
      spanY: Math.max(...ys) - Math.min(...ys),
      minDistance: min,
      closest: pair,
      pins,
    };
  });
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
    const place = weeks.find((item) => item.id === id);
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
        nodes.every((node) => /^[AMB]$/.test((node.textContent ?? "").trim())),
      ),
    )
    .toBe(true);
  await expect.poll(async () => (await pinSpread(map)).spanX).toBeGreaterThan((box!.width ?? 0) * 0.7);

  const painted = await pinSpread(map);
  expect(painted.pins).toHaveLength(20);
  expect(painted.mapHeight).toBeGreaterThanOrEqual(300);
  expect(painted.spanX).toBeGreaterThan(painted.mapWidth * 0.7);
  for (const place of weeks) {
    const paint = painted.pins.find((item) => item.id === place.id);
    expect(paint, place.id).toBeTruthy();
    if (!paint || !place.level) continue;
    expect(paint.text, place.name).toBe(letter[place.level]);
    expect(paint.label, place.name).toBe(
      `${place.name}: ${place.level}, ${place.day.toLocaleLowerCase("es-SV")}`,
    );
    expect(paint.background, place.name).toBe(colors[place.level]);
    expect(paint.width, place.name).toBeGreaterThanOrEqual(40);
    expect(paint.height, place.name).toBeGreaterThanOrEqual(40);
    expect(paint.left, place.name).toBeGreaterThanOrEqual(-1);
    expect(paint.top, place.name).toBeGreaterThanOrEqual(-1);
    expect(paint.right, place.name).toBeGreaterThanOrEqual(-1);
    expect(paint.bottom, place.name).toBeGreaterThanOrEqual(-1);
  }
  await expect(page.locator(".leaflet-control-zoom-out")).toHaveClass(/leaflet-disabled/);

  await map.screenshot({ path: "e2e/output/mapa-390.png" });

  const targetId = "san-fernando-chalatenango";
  const target = weeks.find((place) => place.id === targetId);
  expect(target?.name).toBe("San Fernando");
  expect(target?.line).toBe("Peor día: Viernes");
  const point = await page.locator(`[data-place-id="${targetId}"]`).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const samples = [
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
      [rect.left + 8, rect.top + rect.height / 2],
      [rect.right - 8, rect.top + rect.height / 2],
      [rect.left + rect.width / 2, rect.top + 8],
      [rect.left + rect.width / 2, rect.bottom - 8],
    ];
    for (const [x, y] of samples) {
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === element || element.contains(hit))) return { x, y, owns: true };
    }
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, owns: false };
  });
  expect(point.owns, "San Fernando is the marker under the tap").toBe(true);
  await page.touchscreen.tap(point.x, point.y);

  const raised = await page.locator("#mapa .agroclima-pin").evaluateAll((nodes, id) => {
    const zOf = (node: Element) => Number((node as HTMLElement).style.zIndex || 0);
    const selected = nodes.find((node) => node.getAttribute("data-place-id") === id);
    const others = nodes.filter((node) => node.getAttribute("data-place-id") !== id).map(zOf);
    return { selected: selected ? zOf(selected) : 0, maxOther: Math.max(...others) };
  }, targetId);
  expect(raised.selected).toBeGreaterThan(raised.maxOther);

  const card = page
    .locator("div.flex.flex-col.gap-3")
    .filter({ has: page.getByRole("heading", { name: "Riesgo de roya esta semana" }) })
    .filter({ hasText: target!.line! });
  await expect(card.getByText(target!.line!)).toBeVisible();
  await expect(card.getByText(`Zona cafetalera de ${target!.name}`)).toBeVisible();
  await expect(card.getByRole("button", { name: /riesgo/i })).toHaveCount(7);
  await card.screenshot({ path: "e2e/output/pin-card-390.png" });

  await page.locator(".leaflet-control-zoom-in").click();
  let previous = 0;
  const zoomedMin = await expect
    .poll(async () => {
      const spread = await pinSpread(map);
      const settled =
        previous > 0 &&
        Math.abs(spread.minDistance - previous) < 0.5 &&
        spread.minDistance > painted.minDistance * 1.7;
      previous = spread.minDistance;
      return settled ? spread.minDistance : 0;
    })
    .toBeGreaterThan(painted.minDistance * 1.7)
    .then(() => pinSpread(map));

  const report = {
    mapWidth: painted.mapWidth,
    mapHeight: painted.mapHeight,
    spanX: painted.spanX,
    spanY: painted.spanY,
    minDistancePx: painted.minDistance,
    closest: painted.closest,
    minDistanceAfterOneZoomPx: zoomedMin.minDistance,
    closestAfterOneZoom: zoomedMin.closest,
  };
  writeFileSync("e2e/output/pin-distance.json", JSON.stringify(report, null, 2));
  console.log(`MIN_PIN_DISTANCE_PX ${report.minDistancePx.toFixed(1)} ${report.closest.join(" ")}`);
  console.log(
    `MIN_PIN_DISTANCE_AFTER_ONE_ZOOM_PX ${report.minDistanceAfterOneZoomPx.toFixed(1)} ${report.closestAfterOneZoom.join(" ")}`,
  );
  expect(report.minDistanceAfterOneZoomPx).toBeGreaterThan(report.minDistancePx * 1.7);
});
