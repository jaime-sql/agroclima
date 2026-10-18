import { readFileSync } from "node:fs";
import { fetchForecast } from "../src/lib/weather/openmeteo.ts";

type LocationRow = {
  name?: string;
  lat: number;
  lon: number;
};

const rows = JSON.parse(readFileSync("src/data/locations.json", "utf8")) as LocationRow[];
const failures: string[] = [];

for (const row of rows) {
  const name = row.name?.trim() || "(sin nombre)";
  const loaded = await fetchForecast(row.lat, row.lon);
  const days = loaded.ok ? (loaded.forecast.daily?.time.length ?? 0) : 0;
  if (!loaded.ok || days !== 7) failures.push(name);
}

if (failures.length > 0) {
  for (const name of failures) console.error(name);
  process.exit(1);
}

console.log(`All ${rows.length} locations returned a 7-day forecast.`);
