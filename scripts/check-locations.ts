import { PLACES } from "../src/lib/places.ts";
import { fetchForecast } from "../src/lib/weather/openmeteo.ts";

const failures: string[] = [];

for (const place of PLACES) {
  const loaded = await fetchForecast(place.latitude, place.longitude);
  const days = loaded.ok ? (loaded.forecast.daily?.time.length ?? 0) : 0;
  if (!loaded.ok || days !== 7) failures.push(place.name);
}

if (failures.length > 0) {
  for (const name of failures) console.error(name);
  process.exit(1);
}

console.log(`All ${PLACES.length} locations returned a 7-day forecast.`);
