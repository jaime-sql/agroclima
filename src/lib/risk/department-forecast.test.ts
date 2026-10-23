import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { departmentMapFromWeeks } from "./department-catalog.ts";
import {
  DEPARTMENT_CACHE_KEY,
  DEPARTMENT_CACHE_TTL_MS,
  clearDepartmentRiskCache,
  loadDepartmentRisk,
  shouldWriteDepartmentCache,
  type RiskKv,
  type WeeksResult,
} from "./department-forecast.ts";

const body = departmentMapFromWeeks(new Map(), Date.parse("2026-10-23T21:45:00Z"));

function kvOf(initial?: string): RiskKv & { writes: number; stored: Map<string, string> } {
  const stored = new Map<string, string>();
  if (initial) stored.set(DEPARTMENT_CACHE_KEY, initial);
  let writes = 0;
  return {
    stored,
    get writes() {
      return writes;
    },
    async get(key) {
      return stored.get(key) ?? null;
    },
    async put(key, value) {
      writes += 1;
      stored.set(key, value);
    },
  };
}

describe("department forecast cache", () => {
  it("writes only when the stored value is missing or older than the TTL", () => {
    assert.equal(shouldWriteDepartmentCache(null, 1_000), true);
    assert.equal(shouldWriteDepartmentCache(1_000, 1_000 + DEPARTMENT_CACHE_TTL_MS - 1), false);
    assert.equal(shouldWriteDepartmentCache(1_000, 1_000 + DEPARTMENT_CACHE_TTL_MS), true);
  });

  it("serves memory, skips a fresh KV write, rewrites a stale value, and does not store a failure", async () => {
    clearDepartmentRiskCache();
    let loads = 0;
    const loadWeeks = async (): Promise<WeeksResult> => {
      loads += 1;
      return { ok: true, weeks: new Map() };
    };
    const now = 10_000;
    const first = await loadDepartmentRisk({ now, kv: null, loadWeeks });
    const second = await loadDepartmentRisk({ now: now + 1_000, kv: null, loadWeeks });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(loads, 1);

    clearDepartmentRiskCache();
    const fresh = kvOf(JSON.stringify({ at: now, body }));
    loads = 0;
    const hit = await loadDepartmentRisk({ now: now + 1_000, kv: fresh, loadWeeks });
    assert.equal(hit.ok, true);
    if (hit.ok) assert.equal(hit.body.updatedLabel, body.updatedLabel);
    assert.equal(loads, 0);
    assert.equal(fresh.writes, 0);

    clearDepartmentRiskCache();
    const stale = kvOf(JSON.stringify({ at: now - DEPARTMENT_CACHE_TTL_MS, body }));
    const rewritten = await loadDepartmentRisk({ now, kv: stale, loadWeeks });
    assert.equal(rewritten.ok, true);
    assert.equal(stale.writes, 1);
    assert.equal(loads, 1);

    clearDepartmentRiskCache();
    const kv = kvOf();
    const failed = await loadDepartmentRisk({
      now: 1,
      kv,
      loadWeeks: async () => ({ ok: false }),
    });
    assert.deepEqual(failed, { ok: false, error: "forecast_unavailable" });
    assert.equal(kv.writes, 0);

    clearDepartmentRiskCache();
    let release: (value: WeeksResult) => void = () => {};
    let calls = 0;
    const pending = new Promise<WeeksResult>((resolve) => {
      release = resolve;
    });
    const sharedLoad = () => {
      calls += 1;
      return pending;
    };
    const leftCall = loadDepartmentRisk({ now: 50_000, kv: null, loadWeeks: sharedLoad });
    const rightCall = loadDepartmentRisk({ now: 50_000, kv: null, loadWeeks: sharedLoad });
    release({ ok: true, weeks: new Map() });
    const [left, right] = await Promise.all([leftCall, rightCall]);
    assert.equal(left.ok, true);
    assert.equal(right.ok, true);
    assert.equal(calls, 1);
    clearDepartmentRiskCache();
  });
});
