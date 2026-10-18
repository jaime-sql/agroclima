import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { shouldKeepAudioCache, wranglerConfigForDeploy } from "./audio-cache-binding.ts";

const R2_DISABLED =
  "Please enable R2 through the Cloudflare Dashboard [code: 10042]";
const BLAXEL_ASK_URL = "https://run.blaxel.ai/hackatonhf2025/agents/agroclima-ask";

describe("audio cache binding", () => {
  it("keeps AUDIO_CACHE when the bucket is created or already exists", () => {
    const config = readFileSync("wrangler.jsonc", "utf8");
    assert.equal(shouldKeepAudioCache(0, ""), true);
    assert.equal(shouldKeepAudioCache(1, "A bucket with this name already exists"), true);
    assert.equal(wranglerConfigForDeploy(config, 0, ""), config);
    assert.equal(
      wranglerConfigForDeploy(config, 1, "The bucket already exists"),
      config,
    );
    assert.match(config, /AUDIO_CACHE/);
    assert.match(config, new RegExp(BLAXEL_ASK_URL.replaceAll(".", "\\.")));
  });

  it("drops AUDIO_CACHE on 10042 and on any other create error", () => {
    const config = readFileSync("wrangler.jsonc", "utf8");
    for (const output of [R2_DISABLED, "Authentication error [code: 10000]", ""]) {
      assert.equal(shouldKeepAudioCache(1, output), false);
      const parsed = JSON.parse(wranglerConfigForDeploy(config, 1, output)) as {
        name: string;
        r2_buckets?: Array<{ binding: string }>;
        services: unknown[];
        vars?: { BLAXEL_ASK_URL?: string };
      };
      assert.equal(parsed.name, "agroclima");
      assert.equal(parsed.r2_buckets, undefined);
      assert.equal(Array.isArray(parsed.services), true);
      assert.equal(parsed.vars?.BLAXEL_ASK_URL, BLAXEL_ASK_URL);
      const serialized = JSON.stringify(parsed);
      assert.equal(serialized.includes("AUDIO_CACHE"), false);
      assert.equal(serialized.includes("API_KEY"), false);
    }
  });

  it("leaves a different R2 bucket in place", () => {
    const config = JSON.stringify({
      name: "agroclima",
      r2_buckets: [
        { binding: "AUDIO_CACHE", bucket_name: "agroclima-audio" },
        { binding: "OTHER", bucket_name: "other" },
      ],
      vars: { BLAXEL_ASK_URL },
    });
    const parsed = JSON.parse(wranglerConfigForDeploy(config, 1, R2_DISABLED)) as {
      r2_buckets: Array<{ binding: string }>;
      vars: { BLAXEL_ASK_URL: string };
    };
    assert.deepEqual(parsed.r2_buckets, [{ binding: "OTHER", bucket_name: "other" }]);
    assert.equal(parsed.vars.BLAXEL_ASK_URL, BLAXEL_ASK_URL);
  });
});
