import { describe, it, expect } from "vitest";
import { classifySku, triage, assertSafePrice } from "./triage-engine";
import { SKUS } from "./data";
import type { Sku } from "./types";

// ─── SKU-007: the explicit edge case from the brief ─────────────────────────

describe("SKU-007 — competitor below margin floor", () => {
  const sku = SKUS.find((s) => s.id === "SKU-007")!;

  it("is classified as blocked_floor (no profitable response)", () => {
    const result = classifySku(sku);
    expect(result.action).toBe("blocked_floor");
  });

  it("has no target price — there is no legal move", () => {
    const result = classifySku(sku);
    expect(result.targetPrice).toBeNull();
  });

  it("surfaces a human-readable reason explaining why no action", () => {
    const result = classifySku(sku);
    expect(result.systemReason).toContain("below our margin floor");
  });

  it("appears in the monitoring lane, not urgent", () => {
    const lanes = triage(SKUS);
    expect(lanes.monitoring.map((i) => i.sku.id)).toContain("SKU-007");
    expect(lanes.urgent.map((i) => i.sku.id)).not.toContain("SKU-007");
  });
});

// ─── Margin floor is inviolable across the entire dataset ───────────────────

describe("Margin floor safety — every recommendation across all SKUs", () => {
  for (const sku of SKUS) {
    it(`${sku.id}: any target price must be >= margin floor`, () => {
      const result = classifySku(sku);
      if (result.targetPrice !== null) {
        expect(result.targetPrice).toBeGreaterThanOrEqual(sku.marginFloor);
      }
    });
  }

  it("assertSafePrice throws on a sub-floor price", () => {
    expect(() => assertSafePrice(999, 1000)).toThrow(/Safety violation/);
  });

  it("assertSafePrice passes when target equals the floor", () => {
    expect(() => assertSafePrice(1000, 1000)).not.toThrow();
  });
});

// ─── Synthetic case: competitor just barely above floor (within delta) ─────

describe("Tight floor case — competitor within undercut delta of floor", () => {
  // Competitor at Rs.1005, floor at Rs.1000. Default delta of Rs.10 would
  // push target to Rs.995 — BELOW floor. Engine must clamp to floor.
  const tight: Sku = {
    id: "SKU-TEST",
    brand: "Test",
    marketplace: "Amazon India",
    ourPrice: 1100,
    competitorPrice: 1005,
    buyBox: "Lost",
    marginFloor: 1000,
    daysSinceLastChange: 1,
  };

  it("clamps target to the floor rather than violating it", () => {
    const result = classifySku(tight);
    expect(result.action).toBe("drop_to_win");
    expect(result.targetPrice).toBe(1000); // clamped to floor, not 995
    expect(result.bufferAboveFloor).toBe(0);
  });
});

// ─── Three recommendation archetypes — the data is designed to trigger these ─

describe("The three actionable archetypes show up correctly", () => {
  const lanes = triage(SKUS);

  it("urgent lane contains exactly the four lose-recovery SKUs", () => {
    expect(lanes.urgent.map((i) => i.sku.id).sort()).toEqual([
      "SKU-001",
      "SKU-003",
      "SKU-005",
      "SKU-008",
    ]);
  });

  it("opportunities lane contains only SKU-006 (big headroom)", () => {
    // SKU-002 and SKU-004 have only Rs.11 headroom — too small to fire.
    // SKU-006 has Rs.240 — clear raise opportunity.
    expect(lanes.opportunities.map((i) => i.sku.id)).toEqual(["SKU-006"]);
  });

  it("monitoring lane contains only SKU-007", () => {
    expect(lanes.monitoring.map((i) => i.sku.id)).toEqual(["SKU-007"]);
  });

  it("resting lane contains SKU-002 and SKU-004 (won, headroom too small)", () => {
    expect(lanes.resting.map((i) => i.sku.id).sort()).toEqual(["SKU-002", "SKU-004"]);
  });
});

// ─── Urgency ordering reflects bleeding-time × recovery-value ──────────────

describe("Urgent lane sorting — stale + recoverable beats fresh + small", () => {
  const lanes = triage(SKUS);

  it("ranks SKU-003 first (6 days lost, biggest recoverable margin)", () => {
    expect(lanes.urgent[0]?.sku.id).toBe("SKU-003");
  });

  it("ranks SKU-005 below SKU-008 (1 day vs 4 days, similar recoverable)", () => {
    const order = lanes.urgent.map((i) => i.sku.id);
    expect(order.indexOf("SKU-008")).toBeLessThan(order.indexOf("SKU-005"));
  });
});

// ─── Specific target price for the brief's worked example ──────────────────

describe("SKU-001 — matches the brief's own example recommendation", () => {
  // Brief example: "Set SKU-001 to Rs.1,189 — Rs.10 below competitor,
  // Rs.139 above margin floor."
  const sku = SKUS.find((s) => s.id === "SKU-001")!;
  const result = classifySku(sku);

  it("targets Rs.1,189 — Rs.10 below the Rs.1,199 competitor", () => {
    expect(result.targetPrice).toBe(1189);
  });

  it("sits Rs.139 above the Rs.1,050 margin floor", () => {
    expect(result.bufferAboveFloor).toBe(139);
  });
});
