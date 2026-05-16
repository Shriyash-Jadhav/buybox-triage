import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { TriageItem, Recommendation } from "@/lib/types";
import { assertSafePrice } from "@/lib/triage-engine";

/**
 * /api/recommend  —  Batched LLM phrasing endpoint.
 *
 * The engine has already classified each SKU and computed a safe target_price.
 * This route asks Claude to do ONLY what it's good at: write a single,
 * specific, actionable English sentence per SKU in the exact shape the brief
 * modeled. No math. No price changes.
 *
 * Even so, we run assertSafePrice as a paranoid final check before sending
 * the recommendation back to the client. Defence in depth.
 */

const MODEL = "claude-haiku-4-5-20251001"; // Fast + cheap; task is constrained.

const SYSTEM_PROMPT = `You are a senior pricing analyst at Opptra writing recommendations for Ranjit, the Category Operations Lead. Ranjit needs to make a decision in seconds, not read analysis.

For each SKU you receive, produce two sentences:

1. headline — ONE imperative sentence that names a specific price, the position vs competitor, the position vs margin floor, and the expected outcome. The format the team uses is:

   "Set [SKU-ID] to Rs.[target] — Rs.[X] below/above competitor, Rs.[Y] above margin floor. [Outcome verb] Buy Box at [Z]% margin."

   Real example (the gold standard):
   "Set SKU-001 to Rs.1,189 — Rs.10 below competitor, Rs.139 above margin floor. Recovers Buy Box at 11.7% margin."

   Anti-example (do not write like this):
   "You should consider lowering the price while being mindful of margins."

2. tradeoff — ONE short sentence (under 22 words) that MUST follow one of these three patterns. Generic "monitor closely" advice is filler and forbidden.

   Pattern A — Comparative across the batch:
     "Thinnest margin buffer of the four lose-recovery SKUs — least room to absorb cost increases."
     "Largest absolute margin uplift in the batch (Rs.230/unit), but on a same-day price change."

   Pattern B — Cite a specific number that creates risk:
     "Rs.139 buffer leaves no room if competitor reprices within Rs.130 of margin floor."
     "Six-day stale price — competitor likely re-anchored their algorithm; drop may not flip Buy Box instantly."

   Pattern C — Name a specific Buy Box mechanic:
     "Same-day raise risks losing Buy Box before Amazon's algo re-confirms — verify lock at +2h."
     "Match-to-floor recovery has zero buffer; one competitor drop puts us below floor."

   Forbidden tradeoff openings: "Monitor", "Track", "Watch closely", "Keep an eye", "Be cautious".
   Forbidden generic phrasing: "may trigger competitor response", "risks aggressive response", "monitor daily".

HARD RULES:
- Use the numbers I give you exactly. Do not recompute, round differently, or substitute.
- Never recommend a price below the margin floor. If I gave you a target, it's already safe — echo it verbatim.
- No hedging words in the headline: "consider", "might want to", "perhaps", "could potentially". You are recommending, not musing.
- No filler: "in order to", "as you can see", "it is important to note".
- Use Indian currency formatting: Rs.1,189 (comma after thousand).
- The tradeoff must reference a SPECIFIC NUMBER or a SPECIFIC COMPARISON across SKUs in the batch. If you can't, the tradeoff is filler — re-think.`;

interface RecommendRequest {
  items: Array<{
    skuId: string;
    brand: string;
    action: "drop_to_win" | "raise_for_margin";
    ourPrice: number;
    competitorPrice: number;
    marginFloor: number;
    targetPrice: number;
    bufferAboveFloor: number;
    bufferPct: number;
    vsCompetitor: number;
    daysSinceLastChange: number;
  }>;
}

// Tool schema forces Claude to emit a clean, parseable structure per SKU.
const RECOMMEND_TOOL = {
  name: "submit_recommendations",
  description: "Submit the final set of pricing recommendations, one per SKU.",
  input_schema: {
    type: "object" as const,
    properties: {
      recommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            skuId: { type: "string", description: "The SKU id, e.g. SKU-001" },
            headline: {
              type: "string",
              description:
                "The one-sentence recommendation in the team's standard format.",
            },
            tradeoff: {
              type: "string",
              description:
                "One short sentence naming the second-order cost or thing to watch.",
            },
          },
          required: ["skuId", "headline", "tradeoff"],
        },
      },
    },
    required: ["recommendations"],
  },
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server missing ANTHROPIC_API_KEY — see README." },
      { status: 500 }
    );
  }

  let body: RecommendRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  // Paranoid safety pass on inputs — caller has already done this but defence
  // in depth is cheap. If anything is sub-floor we refuse to even ask Claude.
  for (const item of body.items) {
    try {
      assertSafePrice(item.targetPrice, item.marginFloor);
    } catch (e) {
      return NextResponse.json(
        { error: (e as Error).message, skuId: item.skuId },
        { status: 400 }
      );
    }
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Pre-compute batch-level comparisons so the LLM can write Pattern A
  // tradeoffs ("thinnest", "largest", etc.) without re-deriving them.
  const dropItems = body.items.filter((i) => i.action === "drop_to_win");
  const raiseItems = body.items.filter((i) => i.action === "raise_for_margin");
  const buffers = dropItems.map((i) => ({ skuId: i.skuId, buffer: i.bufferAboveFloor }));
  buffers.sort((a, b) => a.buffer - b.buffer);
  const thinnestBuffer = buffers[0];
  const thickestBuffer = buffers[buffers.length - 1];
  const stalest = [...dropItems].sort(
    (a, b) => b.daysSinceLastChange - a.daysSinceLastChange
  )[0];

  const batchContext = `BATCH CONTEXT (use for comparative tradeoffs):
- ${dropItems.length} lose-recovery SKU${dropItems.length === 1 ? "" : "s"}, ${raiseItems.length} raise opportunit${raiseItems.length === 1 ? "y" : "ies"}.
${thinnestBuffer ? `- THINNEST margin buffer: ${thinnestBuffer.skuId} (Rs.${thinnestBuffer.buffer.toLocaleString("en-IN")} above floor).` : ""}
${thickestBuffer && buffers.length > 1 ? `- THICKEST margin buffer: ${thickestBuffer.skuId} (Rs.${thickestBuffer.buffer.toLocaleString("en-IN")} above floor).` : ""}
${stalest ? `- LONGEST stale: ${stalest.skuId} (${stalest.daysSinceLastChange} days since last change).` : ""}`;

  // The user message hands Claude the structured facts and tells it explicitly
  // which numbers to echo. We're not asking it to think — we're asking it to
  // phrase.
  const userMessage = `Write recommendations for these ${body.items.length} SKUs. Use the numbers exactly as given.

${batchContext}

${body.items
  .map(
    (i, idx) => `--- ITEM ${idx + 1} ---
SKU: ${i.skuId} (${i.brand})
Action: ${i.action === "drop_to_win" ? "Drop our price to recover Buy Box" : "Raise our price to capture margin (we already won Buy Box)"}
Current our price: Rs.${i.ourPrice.toLocaleString("en-IN")}
Competitor price: Rs.${i.competitorPrice.toLocaleString("en-IN")}
Margin floor: Rs.${i.marginFloor.toLocaleString("en-IN")}
TARGET PRICE (use this exactly): Rs.${i.targetPrice.toLocaleString("en-IN")}
Buffer above floor: Rs.${i.bufferAboveFloor.toLocaleString("en-IN")} (${(i.bufferPct * 100).toFixed(1)}%)
Gap below competitor: Rs.${i.vsCompetitor.toLocaleString("en-IN")}
Days since last price change: ${i.daysSinceLastChange}
Outcome verb to use: ${i.action === "drop_to_win" ? '"Recovers"' : '"Captures Rs." + uplift + " per unit while holding"'}
`
  )
  .join("\n")}

Call submit_recommendations with one entry per SKU above, in the same order.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools: [RECOMMEND_TOOL],
      tool_choice: { type: "tool", name: "submit_recommendations" },
      messages: [{ role: "user", content: userMessage }],
    });

    // Extract the tool_use block from Claude's response.
    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json(
        { error: "Model did not return structured output." },
        { status: 502 }
      );
    }

    const input = toolUse.input as {
      recommendations: Array<{
        skuId: string;
        headline: string;
        tradeoff: string;
      }>;
    };

    // Map back into a SKU-id-keyed object the UI can look up directly.
    const result: Record<string, Recommendation> = {};
    for (const r of input.recommendations) {
      result[r.skuId] = { headline: r.headline, tradeoff: r.tradeoff };
    }

    return NextResponse.json({ recommendations: result });
  } catch (e) {
    console.error("Claude API call failed:", e);
    return NextResponse.json(
      { error: "Failed to generate recommendations.", detail: (e as Error).message },
      { status: 502 }
    );
  }
}
