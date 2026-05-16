// Domain types for the Pricing Signal prototype.
// These are intentionally narrow — the brief is explicit that prices below
// the margin floor are a failure, so the type system should make that
// difficult to express by accident.

export type BuyBoxStatus = "Won" | "Lost";

export type Marketplace = "Amazon India" | "Noon" | "Flipkart" | "Lazada";

/**
 * Raw SKU snapshot — mirrors the table in the brief.
 * Prices are stored as integer rupees (no float math on money).
 */
export interface Sku {
  id: string;
  brand: string;
  marketplace: Marketplace;
  ourPrice: number;
  competitorPrice: number;
  buyBox: BuyBoxStatus;
  marginFloor: number;
  daysSinceLastChange: number;
}

/**
 * The four states the brief implies. Computed by the triage engine —
 * never set by hand. The LLM never decides which of these applies.
 */
export type ActionKind =
  | "drop_to_win"      // Buy Box Lost, target above floor → recommend a price drop
  | "raise_for_margin" // Buy Box Won with headroom → recommend a price raise
  | "blocked_floor"    // Competitor below floor → no winning move, monitor
  | "hold";            // Buy Box Won, headroom too small to bother

/**
 * Structured facts for one SKU after the engine runs.
 * The LLM receives this; it does NOT modify the numbers.
 */
export interface TriageItem {
  sku: Sku;
  action: ActionKind;
  /** Recommended new price (only meaningful for drop_to_win and raise_for_margin). */
  targetPrice: number | null;
  /** How far our recommended price sits above the floor, in rupees. */
  bufferAboveFloor: number | null;
  /** Buffer as a % of the target price — used in the "X% margin" wording. */
  bufferPct: number | null;
  /** Gap between our target and the competitor (positive = we're below them). */
  vsCompetitor: number | null;
  /** Urgency ranking — higher = more pressing. Computed from money-at-stake × staleness. */
  urgencyScore: number;
  /** Plain-English reason for blocked / hold states — surfaced in the UI without an LLM call. */
  systemReason?: string;
}

/**
 * The recommendation sentence the LLM produces — strictly shaped.
 * Numbers are echoed from TriageItem; the LLM is responsible for phrasing only.
 */
export interface Recommendation {
  /** The acceptance sentence — the one Ranjit will read and act on. */
  headline: string;
  /** What we give up by taking this action. Forces tradeoff awareness. */
  tradeoff: string;
}

/**
 * UI-side state for SKUs that have been "Repriced" via the Apply button.
 */
export interface RepricedRecord {
  skuId: string;
  fromPrice: number;
  toPrice: number;
  appliedAt: string; // ISO timestamp
}
