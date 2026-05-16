import type { Sku, TriageItem, ActionKind } from "./types";

/**
 * TRIAGE ENGINE — pure, deterministic, side-effect-free.
 *
 * This file is the safety story of the prototype. The brief is explicit:
 * "A recommendation to price below floor is a failure." So the LLM never
 * computes a price — it phrases what this engine has already decided.
 *
 * Every threshold below is a judgment call. I've documented why each one
 * is what it is, because the Loom will reference this reasoning.
 */

// ─── Tunable constants ──────────────────────────────────────────────────────

/**
 * Default undercut when dropping to win the Buy Box.
 * Brief's example: "Set SKU-001 to Rs.1,189 — Rs.10 below competitor". So Rs.10
 * is the canonical value. For low-priced SKUs (under Rs.500) Rs.10 is a much
 * larger % undercut and wastes margin unnecessarily, so we drop to Rs.5.
 */
function undercutDelta(competitorPrice: number): number {
  return competitorPrice < 500 ? 5 : 10;
}

/**
 * Minimum headroom (in either rupees OR % of our price) for a "raise_for_margin"
 * recommendation to fire. Below this, raising buys nothing meaningful and we
 * shouldn't waste Ranjit's attention on it.
 *
 * Examples from the brief's data:
 *   SKU-002: headroom Rs.11 (1.3% of 849) → hold (too small)
 *   SKU-004: headroom Rs.11 (1.8% of 599) → hold
 *   SKU-006: headroom Rs.240  (21% of 1150) → raise (clear opportunity)
 */
const RAISE_THRESHOLD_RUPEES = 20;
const RAISE_THRESHOLD_PCT = 0.02;

// ─── Main classifier ────────────────────────────────────────────────────────

export function classifySku(sku: Sku): TriageItem {
  // CASE 1: Competitor is pricing below our margin floor.
  // No legal move exists. Brief calls this out explicitly as an edge case
  // (SKU-007). We surface it, flag it, but offer no action.
  if (sku.competitorPrice < sku.marginFloor) {
    return {
      sku,
      action: "blocked_floor",
      targetPrice: null,
      bufferAboveFloor: null,
      bufferPct: null,
      vsCompetitor: null,
      urgencyScore: 0,
      systemReason: `Competitor at Rs.${sku.competitorPrice} is below our margin floor of Rs.${sku.marginFloor}. No profitable response available — monitor for competitor price correction.`,
    };
  }

  // CASE 2: Buy Box Lost, competitor at or above floor → drop to win.
  if (sku.buyBox === "Lost") {
    // Defensive guard: if we're "Lost" but already undercutting the competitor,
    // it's a non-price Buy Box loss (seller rating, fulfillment, stock). The
    // brief's data doesn't contain this case, but the engine handles it cleanly.
    if (sku.ourPrice <= sku.competitorPrice) {
      return {
        sku,
        action: "hold",
        targetPrice: null,
        bufferAboveFloor: null,
        bufferPct: null,
        vsCompetitor: sku.competitorPrice - sku.ourPrice,
        urgencyScore: 0,
        systemReason: "Buy Box lost despite undercutting competitor — likely a non-price factor (seller rating, fulfillment, stock). Price action will not recover it.",
      };
    }

    const delta = undercutDelta(sku.competitorPrice);
    const desiredTarget = sku.competitorPrice - delta;

    // HARD CONSTRAINT: target must never fall below the margin floor.
    // If undercutting by the full delta would breach it, clamp to the floor.
    // This means we still match competitor pricing but accept zero buffer —
    // it's a defensible business decision (race-to-floor) that gets flagged.
    const targetPrice = Math.max(desiredTarget, sku.marginFloor);

    const bufferAboveFloor = targetPrice - sku.marginFloor;
    const bufferPct = bufferAboveFloor / targetPrice;
    const vsCompetitor = sku.competitorPrice - targetPrice;

    // Urgency = how much money we'd retain on recovery × how long we've been bleeding.
    // bufferAboveFloor is a proxy for "margin we'd preserve by acting." Days
    // since last change is a proxy for "how long this has been broken."
    const urgencyScore = bufferAboveFloor * Math.max(sku.daysSinceLastChange, 1);

    return {
      sku,
      action: "drop_to_win",
      targetPrice,
      bufferAboveFloor,
      bufferPct,
      vsCompetitor,
      urgencyScore,
    };
  }

  // CASE 3: Buy Box Won — check if there's headroom worth capturing.
  // ourPrice < competitorPrice is the typical Won state. headroom is the gap.
  const headroom = sku.competitorPrice - sku.ourPrice;

  // Defensive: Won despite being more expensive than competitor → hold.
  if (headroom <= 0) {
    return {
      sku,
      action: "hold",
      targetPrice: null,
      bufferAboveFloor: null,
      bufferPct: null,
      vsCompetitor: headroom,
      urgencyScore: 0,
      systemReason: "Buy Box currently won despite our price matching or exceeding competitor — no action required.",
    };
  }

  const headroomPct = headroom / sku.ourPrice;
  const worthRaising =
    headroom >= RAISE_THRESHOLD_RUPEES || headroomPct >= RAISE_THRESHOLD_PCT;

  if (!worthRaising) {
    return {
      sku,
      action: "hold",
      targetPrice: null,
      bufferAboveFloor: null,
      bufferPct: null,
      vsCompetitor: -headroom,
      urgencyScore: 0,
      systemReason: `Already winning Buy Box at Rs.${sku.ourPrice}, only Rs.${headroom} below competitor. Headroom too small (under Rs.${RAISE_THRESHOLD_RUPEES}) to justify a change.`,
    };
  }

  // Raise to just below competitor — capture margin while keeping the Buy Box.
  const delta = undercutDelta(sku.competitorPrice);
  const targetPrice = Math.max(sku.competitorPrice - delta, sku.marginFloor);

  const bufferAboveFloor = targetPrice - sku.marginFloor;
  const bufferPct = bufferAboveFloor / targetPrice;
  const vsCompetitor = sku.competitorPrice - targetPrice;
  const marginUplift = targetPrice - sku.ourPrice;

  return {
    sku,
    action: "raise_for_margin",
    targetPrice,
    bufferAboveFloor,
    bufferPct,
    vsCompetitor,
    // For raises, urgency is just the size of the margin uplift — it's an
    // opportunity not a crisis, so staleness doesn't compound the way it
    // does for losses.
    urgencyScore: marginUplift,
  };
}

// ─── Batch + lane organisation ──────────────────────────────────────────────

export interface TriageLanes {
  urgent: TriageItem[];      // drop_to_win — sorted by urgency
  opportunities: TriageItem[]; // raise_for_margin — sorted by uplift size
  monitoring: TriageItem[];  // blocked_floor — sorted by SKU id
  resting: TriageItem[];     // hold — sorted by SKU id (collapsed by default in UI)
}

export function triage(skus: Sku[]): TriageLanes {
  const all = skus.map(classifySku);

  return {
    urgent: all
      .filter((i) => i.action === "drop_to_win")
      .sort((a, b) => b.urgencyScore - a.urgencyScore),
    opportunities: all
      .filter((i) => i.action === "raise_for_margin")
      .sort((a, b) => b.urgencyScore - a.urgencyScore),
    monitoring: all
      .filter((i) => i.action === "blocked_floor")
      .sort((a, b) => a.sku.id.localeCompare(b.sku.id)),
    resting: all
      .filter((i) => i.action === "hold")
      .sort((a, b) => a.sku.id.localeCompare(b.sku.id)),
  };
}
// ─── Batch totals — feed the hero "money at stake" line ────────────────────

export interface BatchTotals {
  /** Sum of margin preserved across all drop-to-win recommendations, in Rs. */
  recoverableMargin: number;
  /** Sum of per-unit margin uplift across all raise-for-margin recommendations, in Rs. */
  marginToCapture: number;
}

export function batchTotals(lanes: TriageLanes): BatchTotals {
  const recoverableMargin = lanes.urgent.reduce(
    (sum, i) => sum + (i.bufferAboveFloor ?? 0),
    0
  );
  const marginToCapture = lanes.opportunities.reduce(
    (sum, i) => sum + (i.targetPrice !== null ? i.targetPrice - i.sku.ourPrice : 0),
    0
  );
  return { recoverableMargin, marginToCapture };
}
// ─── Hard safety check — used in API route and tests ────────────────────────

/**
 * Asserts a recommended price respects the margin floor. Used both in tests
 * and as the final guard in the API route — even if something upstream
 * miscomputes, this catches it before the user sees a bad number.
 */
export function assertSafePrice(targetPrice: number, marginFloor: number): void {
  if (targetPrice < marginFloor) {
    throw new Error(
      `Safety violation: target price Rs.${targetPrice} is below margin floor Rs.${marginFloor}`
    );
  }
}

/**
 * Helper used in UI badges — gives a human-friendly label for each action.
 */
export function actionLabel(action: ActionKind): string {
  switch (action) {
    case "drop_to_win":
      return "Drop to recover Buy Box";
    case "raise_for_margin":
      return "Raise to capture margin";
    case "blocked_floor":
      return "Monitor — no action available";
    case "hold":
      return "Holding";
  }
}
