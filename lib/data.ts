import type { Sku } from "./types";

/**
 * The 8-SKU snapshot from the case study brief.
 *
 * Why hardcoded? The brief says explicitly: "A working prototype with
 * hardcoded data beats a broken file uploader." This isn't a CSV ingest
 * tool, it's a decision tool. Time goes to the engine and the LLM, not
 * to file parsing UX.
 *
 * The "Last Changed" column from the brief is converted to integer days
 * here — the triage engine uses staleness as part of urgency ranking.
 */
export const SKUS: Sku[] = [
  {
    id: "SKU-001",
    brand: "Natura Casa",
    marketplace: "Amazon India",
    ourPrice: 1299,
    competitorPrice: 1199,
    buyBox: "Lost",
    marginFloor: 1050,
    daysSinceLastChange: 3,
  },
  {
    id: "SKU-002",
    brand: "Natura Casa",
    marketplace: "Amazon India",
    ourPrice: 849,
    competitorPrice: 860,
    buyBox: "Won",
    marginFloor: 720,
    daysSinceLastChange: 0,
  },
  {
    id: "SKU-003",
    brand: "LivSpace Pro",
    marketplace: "Amazon India",
    ourPrice: 2499,
    competitorPrice: 2199,
    buyBox: "Lost",
    marginFloor: 1800,
    daysSinceLastChange: 6,
  },
  {
    id: "SKU-004",
    brand: "LivSpace Pro",
    marketplace: "Amazon India",
    ourPrice: 599,
    competitorPrice: 610,
    buyBox: "Won",
    marginFloor: 480,
    daysSinceLastChange: 2,
  },
  {
    id: "SKU-005",
    brand: "Artisan Home",
    marketplace: "Noon",
    ourPrice: 3799,
    competitorPrice: 3750,
    buyBox: "Lost",
    marginFloor: 3200,
    daysSinceLastChange: 1,
  },
  {
    id: "SKU-006",
    brand: "Artisan Home",
    marketplace: "Noon",
    ourPrice: 1150,
    competitorPrice: 1390,
    buyBox: "Won",
    marginFloor: 900,
    daysSinceLastChange: 0,
  },
  {
    id: "SKU-007",
    brand: "Nordic Basics",
    marketplace: "Noon",
    ourPrice: 449,
    competitorPrice: 399,
    buyBox: "Lost",
    marginFloor: 420,
    daysSinceLastChange: 5,
  },
  {
    id: "SKU-008",
    brand: "Nordic Basics",
    marketplace: "Noon",
    ourPrice: 2199,
    competitorPrice: 2100,
    buyBox: "Lost",
    marginFloor: 1750,
    daysSinceLastChange: 4,
  },
];
