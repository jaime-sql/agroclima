# Department rust map

The opening screen colours El Salvador's 14 departments from the coffee points this app already stores. It does not invent a coordinate.

## Boundaries and points

Boundaries are geoBoundaries gbOpen SLV ADM1, simplified, pinned at commit `9469f09`. The geometry is OpenStreetMap data under CC BY-SA 2.0. The file in `data/dept_map/departments.geojson` matches the SHA-256 in `data/dept_map/department_points.json`. `data/dept_map/SOURCES.md` and `build.py` record how that file was built. The build needs shapely and is not part of CI.

The points are the 20 places in `src/data/locations.json`. Seven departments have points: La Libertad 5, Chalatenango 4, Ahuachapán 3, Usulután 3, Morazán 2, Sonsonate 2, Santa Ana 1. The other seven (Cabañas, Cuscatlán, La Paz, La Unión, San Miguel, San Salvador, San Vicente) have none. They use fill `#E7E5E4` with a diagonal hatch and the label «Sin datos». A tap opens «Aún no tenemos puntos cafetaleros en este departamento.» and does not offer «Ver municipios».

The line under the source line is exactly «Límites: geoBoundaries / © OpenStreetMap, CC BY-SA», 14px, `#57534E` on the page background `#F7F4EF` (above 4.5:1). `#78716C` on that background is below 4.5:1, so it is not used.

## Level

`aggregateDepartmentLevel` is the only aggregation. The level is the worst scored point (alto, then medio, then bajo). The count is how many points returned a level. A point with no forecast stays on the card as «Sin datos» and is left out of the count. No scored point means «Sin datos», with no risk colour. The label is lowercase, for example «alto · 3 puntos» and «bajo · 1 punto».

Each listed point uses the same Alto / Medio / Bajo words and the same fills as the risk cards: alto `#FDE2E1` / `#8A1C14`, medio `#FFF1C2` / `#6B4B00`, bajo `#DDF2E0` / `#1E5B2A`.

The clock on «Riesgo calculado con pronóstico de Open-Meteo · actualizado [hora]» is `America/El_Salvador`, 24-hour, `es-SV`.

## Cache

`GET /api/risk/departments` scores the same 20-place Open-Meteo batch as the pin map (`loadPlaceMap`), then aggregates. A success is kept in memory for 6 hours and, when the `RISK_CACHE` KV binding exists, written under `dept-risk-v1` only if the stored value is missing or older than 6 hours. A failure is not written. One in-flight load is shared. The response sends `Cache-Control: public, max-age=21600` on success and `no-store` on failure.

No KV namespace id is committed. Local and CI run with memory only. Workers Free allows 1,000 KV writes a day; a hit does not write. A stampede of cold isolates can still spend that budget. The department overview can be up to 6 hours older than the 30-minute pin cache. Workers Free CPU is short; this route does not claim a measured CPU time. The hot path is a memory or KV read.

## What the screenshots are

`docs/screenshots/` is the engine run on `test/fixtures/dr01_clear_low.json`, `dr02_clear_medium.json`, and `dr03_clear_high.json`, not a live forecast.

At 366px of map width, some department shapes are under a 44px box. «Ver como lista» rows are at least 44px tall and are the reliable tap target.

## Leaf result and the technician button

The leaf step is labelled «Segunda opinión». The weather engine leads the reasons in «¿Por qué este resultado?». A leaf diagnosis does not show the model's confidence word or score. It shows «Orientativo — no es un diagnóstico». On a diagnosis result, the panel's small grey line is the fixed BRACOL citation (73% accuracy, 95% CI 68–79%, 58% of rusted leaves, 252 public lab photos from Brazil, CC BY 4.0), not this photo's score. The weather cards keep Alto, Medio, and Bajo.

«Consultar a un técnico» calls the same `share()` path as «Compartir con mi agrónomo» (`wa.me`). There is no technician directory. The ISC / CENTA line stays «Contactos ISC / CENTA: pendiente de verificar».
