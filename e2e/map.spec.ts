import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { project } from "../src/lib/map/cluster.ts";
import { RISK_CUTOFF_FOOTER } from "../src/lib/risk/assess.ts";
import { FAR_GPS_NOTE, MUNICIPALITY_CENTRE_NOTE, farGpsTitle } from "../src/lib/risk/gps.ts";
import { gpsForecastLabel, RISK_ZONE_NOTE } from "../src/lib/vision/copy.ts";
import { MIXED_LEVELS, type FixtureLevel } from "./mixed-levels.ts";
import { PLACES } from "../src/lib/places.ts";

const colors: Record<FixtureLevel, string> = {
  alto: "rgb(138, 28, 20)",
  medio: "rgb(138, 106, 0)",
  bajo: "rgb(30, 91, 42)",
};
const letters: Record<FixtureLevel, string> = { alto: "A", medio: "M", bajo: "B" };
const dates = [
  "2026-10-18",
  "2026-10-19",
  "2026-10-20",
  "2026-10-21",
  "2026-10-22",
  "2026-10-23",
  "2026-10-24",
];

function week(place: (typeof PLACES)[number]) {
  const level = MIXED_LEVELS[place.id];
  return {
    ok: true,
    place: { id: place.id, name: place.name },
    available: true,
    timezone: "America/El_Salvador",
    footer: RISK_CUTOFF_FOOTER,
    plan: {
      fungicideClasses: ["triazol"],
      doseNote: "dosis según etiqueta / su agrónomo",
      nextDryWindow: null,
    },
    days: dates.map((date) => ({
      date,
      level,
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

async function installRisk(page: Page) {
  const pins = PLACES.map((place) => ({
    id: place.id,
    level: MIXED_LEVELS[place.id],
    day: "Domingo",
  }));
  await page.route("**://*.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/api/risk**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/map")) {
      await route.fulfill({ json: { ok: true, places: pins } });
      return;
    }
    const id = url.searchParams.get("place") ?? "";
    const place = PLACES.find((item) => item.id === id);
    if (!place || !MIXED_LEVELS[place.id]) {
      await route.fulfill({ status: 400, json: { ok: false, error: "unknown_place" } });
      return;
    }
    await route.fulfill({ json: week(place) });
  });
}

async function waitForLevels(map: Locator) {
  await expect
    .poll(async () =>
      map.evaluate((element) =>
        [...element.querySelectorAll(".agroclima-pin, .agroclima-cluster")].some((node) =>
          /[AMB]/.test(node.textContent ?? ""),
        ),
      ),
    )
    .toBe(true);
}

async function tapPlace(page: Page, id: string): Promise<number> {
  const map = page.locator("#mapa");
  let taps = 0;
  for (; taps < 3; taps += 1) {
    const pin = map.locator(`.agroclima-pin[data-place-id="${id}"]`);
    if ((await pin.count()) === 1) {
      const point = await pin.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return { x, y, owns: !!hit && (hit === element || element.contains(hit)) };
      });
      if (point.owns) {
        await page.mouse.click(point.x, point.y);
        return taps + 1;
      }
    }
    const zoom = await map.getAttribute("data-zoom");
    const cluster = await map.locator(".agroclima-cluster").evaluateAll((nodes, placeId) => {
      const node = nodes.find((item) =>
        (item.getAttribute("data-place-ids") ?? "").split(",").includes(placeId),
      );
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        x,
        y,
        owns: !!hit && (hit === node || node.contains(hit)),
        count: node.getAttribute("data-count"),
      };
    }, id);
    expect(cluster, `${id} has a pin or a cluster`).not.toBeNull();
    expect(cluster!.owns, `${id} cluster receives the tap`).toBe(true);
    await page.mouse.click(cluster!.x, cluster!.y);
    await expect.poll(async () => map.getAttribute("data-zoom")).not.toBe(zoom);
  }
  return taps;
}

test("every place opens from the 390px map in at most 3 taps", async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync("e2e/output", { recursive: true });
  await installRisk(page);
  await page.setViewportSize({ width: 390, height: 800 });
  const tapsByPlace: Record<string, number> = {};

  for (const [index, place] of PLACES.entries()) {
    await page.goto("/");
    const map = page.locator("#mapa");
    await map.scrollIntoViewIfNeeded();
    const box = await map.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(300);
    await waitForLevels(map);
    if (index === 0) {
      const link = page.getByRole("link", { name: "Ver lista" });
      await expect(link).toHaveAttribute("href", "#lista-municipios");
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(map.locator(".agroclima-cluster").first()).toBeVisible();
      await map.screenshot({ path: "e2e/output/clusters-390.png" });
    }
    const taps = await tapPlace(page, place.id);
    tapsByPlace[place.id] = taps;
    expect(taps, place.id).toBeLessThanOrEqual(3);
    const card = page.locator("div.flex.flex-col.gap-3").filter({
      has: page.getByRole("heading", { name: "Riesgo de roya esta semana" }),
    });
    if (place.coordType === "town_centre") {
      await expect(card.getByText(place.name, { exact: true })).toBeVisible();
      await expect(card.getByText(MUNICIPALITY_CENTRE_NOTE)).toHaveCount(1);
      await expect(card.getByText(RISK_ZONE_NOTE)).toHaveCount(0);
      await expect(card.getByText(/Zona cafetalera/)).toHaveCount(0);
    } else {
      await expect(card.getByText(`Zona cafetalera de ${place.name}`)).toBeVisible();
      await expect(card.getByText(RISK_ZONE_NOTE)).toHaveCount(1);
      await expect(card.getByText(MUNICIPALITY_CENTRE_NOTE)).toHaveCount(0);
    }
    await expect(card.getByText(RISK_CUTOFF_FOOTER)).toBeVisible();
    await expect(card.getByText(`Toda la semana: ${MIXED_LEVELS[place.id]}`)).toBeVisible();
    await expect(card.getByRole("button", { name: /riesgo/i })).toHaveCount(7);
    if (place.id === "santa-tecla-la-libertad") {
      await card.screenshot({ path: "e2e/output/card-town-centre-390.png" });
    }
    if (place.id === "ahuachapan") {
      await card.screenshot({ path: "e2e/output/card-slope-point-390.png" });
    }
    if (place.id === "santa-ana") {
      await card.screenshot({ path: "e2e/output/pin-card-390.png" });
    }
    if (place.id === "comasagua-la-libertad") {
      await map.screenshot({ path: "e2e/output/pins-390.png" });
    }
  }

  const worst = Math.max(...Object.values(tapsByPlace));
  console.log(`MAX_TAPS ${worst}`);
  console.log(JSON.stringify(tapsByPlace));
  expect(worst).toBeLessThanOrEqual(3);
});

test("mixed fixture shows A, M and B pins and a mixed cluster", async ({ page }) => {
  mkdirSync("e2e/output", { recursive: true });
  await installRisk(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  const map = page.locator("#mapa");
  await map.scrollIntoViewIfNeeded();
  await waitForLevels(map);

  const initial = await map.evaluate((element) =>
    [...element.querySelectorAll(".agroclima-cluster")].map((node) => ({
      ids: (node.getAttribute("data-place-ids") ?? "").split(","),
      letter: node.getAttribute("data-letter"),
      level: node.getAttribute("data-level"),
      background: getComputedStyle(node.querySelector("span") as HTMLElement).backgroundColor,
      width: node.getBoundingClientRect().width,
      text: (node.textContent ?? "").replace(/\s+/g, " ").trim(),
    })),
  );
  const west = initial.find((cluster) => cluster.ids.includes("ahuachapan") && cluster.ids.includes("tepecoyo-la-libertad"));
  expect(west, "west cluster mixes levels").toBeTruthy();
  expect(west!.letter).toBe("A");
  expect(west!.level).toBe("alto");
  expect(west!.background).toBe(colors.alto);
  expect(west!.width).toBeGreaterThanOrEqual(44);
  expect(west!.text).toContain("A");
  expect(initial.some((cluster) => cluster.letter === "M")).toBe(true);
  expect(initial.some((cluster) => cluster.letter === "B")).toBe(true);
  await map.screenshot({ path: "e2e/output/mixed-clusters-390.png" });

  const viewZoom = 10.8;
  const pair = ["jayaque-la-libertad", "talnique-la-libertad"].map(
    (id) => PLACES.find((place) => place.id === id)!,
  );
  const individuals = ["comasagua-la-libertad", "santa-tecla-la-libertad", "tepecoyo-la-libertad"].map(
    (id) => PLACES.find((place) => place.id === id)!,
  );
  const clusterPoint = project(
    pair.reduce((sum, place) => sum + place.latitude, 0) / pair.length,
    pair.reduce((sum, place) => sum + place.longitude, 0) / pair.length,
    viewZoom,
  );
  const framed = [
    clusterPoint,
    ...individuals.map((place) => project(place.latitude, place.longitude, viewZoom)),
  ];
  const centerX = (Math.min(...framed.map((point) => point.x)) + Math.max(...framed.map((point) => point.x))) / 2;
  const centerY = (Math.min(...framed.map((point) => point.y)) + Math.max(...framed.map((point) => point.y))) / 2;
  const scale = 256 * 2 ** viewZoom;
  const longitude = (centerX / scale) * 360 - 180;
  const mercator = Math.PI - (2 * Math.PI * centerY) / scale;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(mercator));
  await map.evaluate(
    (element, view) => {
      const leafletMap = (
        element as HTMLElement & {
          mapView?: {
            options: { zoomSnap: number };
            setView: (center: [number, number], nextZoom: number, options: { animate: boolean }) => void;
          };
        }
      ).mapView;
      if (!leafletMap) throw new Error("map instance missing");
      const snap = leafletMap.options.zoomSnap;
      leafletMap.options.zoomSnap = 0;
      leafletMap.setView([view.latitude, view.longitude], view.zoom, { animate: false });
      leafletMap.options.zoomSnap = snap;
    },
    { latitude, longitude, zoom: viewZoom },
  );
  await expect
    .poll(async () => {
      const zoom = Number(await map.getAttribute("data-zoom"));
      return Math.abs(zoom - viewZoom) < 0.01;
    })
    .toBe(true);
  const frame = await map.evaluate((element) => {
    const mapRect = element.getBoundingClientRect();
    const inside = (rect: DOMRect) =>
      rect.left >= mapRect.left - 1 &&
      rect.right <= mapRect.right + 1 &&
      rect.top >= mapRect.top - 1 &&
      rect.bottom <= mapRect.bottom + 1;
    return {
      pins: [...element.querySelectorAll(".agroclima-pin")]
        .filter((node) => inside(node.getBoundingClientRect()))
        .map((node) => {
          const disc = node.querySelectorAll("span")[1] as HTMLElement;
          return {
            id: node.getAttribute("data-place-id"),
            text: (node.textContent ?? "").trim(),
            background: getComputedStyle(disc).backgroundColor,
            color: getComputedStyle(disc).color,
          };
        }),
      clusters: [...element.querySelectorAll(".agroclima-cluster")]
        .filter((node) => inside(node.getBoundingClientRect()))
        .map((node) => {
          const bubble = node.querySelector("span") as HTMLElement;
          return {
            ids: (node.getAttribute("data-place-ids") ?? "").split(","),
            text: (node.textContent ?? "").replace(/\s+/g, " ").trim(),
            letter: node.getAttribute("data-letter"),
            level: node.getAttribute("data-level"),
            background: getComputedStyle(bubble).backgroundColor,
            color: getComputedStyle(bubble).color,
          };
        }),
    };
  });
  expect(frame.pins.map((pin) => pin.id).sort()).toEqual(individuals.map((place) => place.id).sort());
  for (const pin of frame.pins) {
    const level = MIXED_LEVELS[pin.id ?? ""];
    expect(pin.text, pin.id ?? "").toBe(letters[level]);
    expect(pin.background, pin.id ?? "").toBe(colors[level]);
    expect(pin.color, pin.id ?? "").toBe("rgb(255, 255, 255)");
  }
  expect(new Set(frame.pins.map((pin) => pin.text))).toEqual(new Set(["A", "M", "B"]));
  expect(frame.clusters).toHaveLength(1);
  const mixed = frame.clusters[0];
  expect(mixed.ids.sort()).toEqual(pair.map((place) => place.id).sort());
  const rank: Record<FixtureLevel, number> = { bajo: 1, medio: 2, alto: 3 };
  const memberLevels = mixed.ids.map((id) => MIXED_LEVELS[id]);
  const worst = memberLevels.reduce((best, level) => (rank[level] > rank[best] ? level : best));
  expect(new Set(memberLevels).size).toBeGreaterThan(1);
  expect(mixed.level).toBe(worst);
  expect(mixed.letter).toBe(letters[worst]);
  expect(mixed.background).toBe(colors[worst]);
  expect(mixed.color).toBe("rgb(255, 255, 255)");
  expect(mixed.text).toContain(String(mixed.ids.length));
  expect(mixed.text).toContain(letters[worst]);
  await map.screenshot({ path: "e2e/output/mixed-open-390.png" });

  await page.goto("/");
  await map.scrollIntoViewIfNeeded();
  await waitForLevels(map);
  await tapPlace(page, "comasagua-la-libertad");
  await expect(map.locator('.agroclima-pin[data-place-id="comasagua-la-libertad"]')).toBeVisible();
  await expect(map.locator('.agroclima-pin[data-place-id="jayaque-la-libertad"]')).toBeVisible();
  await expect(map.locator('.agroclima-pin[data-place-id="santa-tecla-la-libertad"]')).toBeVisible();
  const pins = await map.evaluate((element) =>
    [...element.querySelectorAll(".agroclima-pin")].map((node) => {
      const disc = node.querySelectorAll("span")[1] as HTMLElement | undefined;
      const box = node.getBoundingClientRect();
      const discBox = disc?.getBoundingClientRect();
      return {
        id: node.getAttribute("data-place-id"),
        label: node.getAttribute("aria-label"),
        text: (node.textContent ?? "").trim(),
        background: disc ? getComputedStyle(disc).backgroundColor : "",
        width: box.width,
        height: box.height,
        disc: discBox?.width ?? 0,
      };
    }),
  );
  for (const id of ["comasagua-la-libertad", "jayaque-la-libertad", "santa-tecla-la-libertad"] as const) {
    const level = MIXED_LEVELS[id];
    const pin = pins.find((item) => item.id === id);
    expect(pin?.text, id).toBe(letters[level]);
    expect(pin?.background, id).toBe(colors[level]);
    expect(pin?.width, id).toBeGreaterThanOrEqual(44);
    expect(pin?.height, id).toBeGreaterThanOrEqual(44);
    expect(pin?.disc, id).toBeGreaterThanOrEqual(30);
    expect(pin?.disc, id).toBeLessThanOrEqual(34);
    expect(pin?.label, id).toContain(level);
  }
  await map.screenshot({ path: "e2e/output/mixed-pins-390.png" });
});

function gpsWeek(elevation: number) {
  return {
    ok: true,
    place: { id: "punto", name: "Punto de la cuadrícula más cercano" },
    elevation_m: elevation,
    available: true,
    timezone: "America/El_Salvador",
    footer: RISK_CUTOFF_FOOTER,
    plan: {
      fungicideClasses: ["triazol"],
      doseNote: "dosis según etiqueta / su agrónomo",
      nextDryWindow: null,
    },
    days: dates.map((date) => ({
      date,
      level: "alto",
      reason: "Humedad o lluvia algunas horas.",
      score: 4,
      wetHours: 10,
      tmax: 24,
      rain: 1,
      warmWetHours: 8,
      optWetHours: 2,
      rainDay: false,
      latencyBand: true,
      consecutiveBonus: false,
    })),
  };
}

async function installGps(page: Page, elevation: number) {
  await page.route("**://*.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/api/risk**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/map")) {
      await route.fulfill({ json: { ok: true, places: [] } });
      return;
    }
    if (url.searchParams.has("lat")) {
      await route.fulfill({ json: gpsWeek(elevation) });
      return;
    }
    await route.fulfill({ status: 400, json: { ok: false, error: "unknown_place" } });
  });
}

test("gps near Santa Tecla names that place and the worst line", async ({ page, context }) => {
  mkdirSync("e2e/output", { recursive: true });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 13.674, longitude: -89.289 });
  await installGps(page, 927);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Usar mi ubicación" }).click();
  const card = page.locator("div.flex.flex-col.gap-3").filter({
    has: page.getByRole("heading", { name: "Riesgo de roya esta semana" }),
  });
  await expect(card.getByText(gpsForecastLabel("Santa Tecla"))).toBeVisible();
  await expect(card.getByText("Toda la semana: alto")).toBeVisible();
  await expect(card.getByText("Punto de la cuadrícula más cercano")).toHaveCount(0);
  await card.screenshot({ path: "e2e/output/gps-card-390.png" });
});

test("gps far from every pin keeps the location title and the worst line", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 13.48, longitude: -88.18 });
  await installGps(page, 812);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Usar mi ubicación" }).click();
  const card = page.locator("div.flex.flex-col.gap-3").filter({
    has: page.getByRole("heading", { name: "Riesgo de roya esta semana" }),
  });
  await expect(card.getByRole("heading", { name: farGpsTitle(812) })).toBeVisible();
  await expect(card.getByText(FAR_GPS_NOTE)).toBeVisible();
  await expect(card.getByText("Toda la semana: alto")).toBeVisible();
  await expect(card.getByText(/Pronóstico de /)).toHaveCount(0);
});

test("the production build cannot load the level fixture", () => {
  const sentinel = "AGROCLIMA_MAP_LEVEL_FIXTURE";
  const roots = [".next/server", ".next/static"].filter((dir) => statSync(dir, { throwIfNoEntry: false })?.isDirectory());
  expect(roots.length).toBe(2);
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|json|html|rsc|txt)$/.test(entry)) files.push(full);
    }
  };
  for (const root of roots) walk(root);
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    expect(readFileSync(file, "utf8").includes(sentinel), file).toBe(false);
  }
});
