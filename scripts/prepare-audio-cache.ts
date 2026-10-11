import { readFileSync, writeFileSync } from "node:fs";
import { wranglerConfigForDeploy } from "../src/lib/audio-cache-binding.ts";

const configPath = process.argv[2] ?? "wrangler.jsonc";
const status = Number(process.env.AUDIO_CACHE_STATUS ?? "1");
const output = process.env.AUDIO_CACHE_OUTPUT ?? "";
const current = readFileSync(configPath, "utf8");
const next = wranglerConfigForDeploy(current, Number.isFinite(status) ? status : 1, output);

if (next === current) {
  console.log("AUDIO_CACHE binding kept.");
} else {
  writeFileSync(configPath, next);
  console.log(
    "AUDIO_CACHE binding removed for this deploy. Escuchar will run without a cache.",
  );
}
