import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const SENTINEL = ["AGROCLIMA", "MAP", "LEVEL", "FIXTURE"].join("_");

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full));
    else found.push(full);
  }
  return found;
}

describe("map level fixture", () => {
  it("is not on a production source path", () => {
    const files = filesUnder("src");
    assert.ok(files.length > 10);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(text.includes(SENTINEL), false, file);
      assert.equal(text.includes(["mixed", "levels"].join("-")), false, file);
      assert.equal(text.includes(["demo", "mode"].join("-")), false, file);
    }
  });
});
