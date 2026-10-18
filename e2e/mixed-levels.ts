/**
 * Test-only pin levels for the map screenshot.
 * The app never imports this file. AGROCLIMA_MAP_LEVEL_FIXTURE
 */
export type FixtureLevel = "alto" | "medio" | "bajo";

export const MIXED_LEVELS: Record<string, FixtureLevel> = {
  ahuachapan: "alto",
  "apaneca-ahuachapan": "medio",
  "concepcion-de-ataco-ahuachapan": "bajo",
  chalatenango: "medio",
  "la-palma-chalatenango": "medio",
  "san-fernando-chalatenango": "medio",
  "san-ignacio-chalatenango": "medio",
  "comasagua-la-libertad": "alto",
  "jayaque-la-libertad": "alto",
  "santa-tecla-la-libertad": "medio",
  "talnique-la-libertad": "bajo",
  "tepecoyo-la-libertad": "bajo",
  "perquin-morazan": "bajo",
  "san-fernando-morazan": "bajo",
  "santa-ana": "medio",
  "juayua-sonsonate": "alto",
  "salcoatitan-sonsonate": "medio",
  "alegria-usulutan": "medio",
  "berlin-usulutan": "bajo",
  "santiago-de-maria-usulutan": "medio",
};
