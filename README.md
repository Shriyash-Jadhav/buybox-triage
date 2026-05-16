# Opptra · Pricing Signal: Buybox Triage

> Three hours of manual diffing, compressed into thirty seconds of clicks.

Ranjit opens three browser tabs every morning. He compares prices across Amazon India, Noon, and an internal sheet. When he spots a competitor undercutting, he WhatsApps the pricing manager, who approves a change, who updates it. By the time the price moves, half the morning's Buy Box wins are already gone.

This is the prototype that closes that loop. It opens to the answer, not a dashboard.

---

## Run it locally (3 steps)

```bash
# 1. Install
npm install

# 2. Add your Anthropic key
cp .env.example .env.local
# then paste a real key from console.anthropic.com

# 3. Run
npm run dev
```

Open <http://localhost:3000>. The structure renders instantly. LLM-written recommendations stream in within ~2 seconds as a single batched call.

```bash
npm test          # 23 safety assertions on the triage engine
npm run build     # production build
```

---

## In the first 60 seconds

Open the page. You see this:

> **4 SKUs need your attention now.**
> Rs.1,638 at stake across this morning's queue.

Not a count of total SKUs. Not a chart. The answer — and what it costs you to ignore it.

Below the headline: four cards, ranked by money-at-stake × days lost. The top one reads:

> *Set SKU-003 to Rs.2,189 — Rs.10 below competitor, Rs.389 above margin floor. Recovers Buy Box at 17.8% margin.*

Specific price. Specific position. Specific outcome. If Ranjit wants to verify before clicking, *Why this price?* expands a comparative trade-off ("Longest stale of the batch — competitor likely re-anchored their algorithm"). One click on Apply, the card lifts and disappears, the count drops to three, the rupees-at-stake number ticks down. Sixty-second window to undo. Four clicks and Ranjit is at *You're caught up.*

That's the entire morning workflow, compressed.

---

## The decision that mattered most

**Where does the LLM live in this system?**

Two defensible answers:

1. The LLM looks at the raw SKU table and decides what price to set.
2. A deterministic engine computes the price; the LLM only writes the recommendation sentence.

Option 1 is the obvious AI showcase. Option 2 is the boring, safer one. I picked Option 2 — and it cost me some apparent "AI horsepower" in the demo.

Here's why. The brief is explicit that **a price below the margin floor is a failure.** LLMs are probabilistic. Even with strong system prompts and tool-use schemas, they occasionally produce off-by-one errors, misread inputs, or hallucinate in the long tail. In a tool that touches real revenue, *"right 99% of the time"* is a P0 incident waiting to happen.

So the engine (`lib/triage-engine.ts`) does all the price math, in TypeScript, covered by 23 unit tests. The LLM (`app/api/recommend/route.ts`) receives the pre-computed numbers and writes the verdict sentence. It still does real work — picking framing, expressing the trade-off, choosing the right verb — but it cannot reach the part of the system where it could break something.

Safety becomes deterministic. This is how I'd ship it in production.

---

## SKU-007 — the edge case the brief flagged

Competitor at Rs.399. Our margin floor at Rs.420. **There is no legal move.** Match the competitor and lose money on every unit. Undercut and lose more.

Most submissions will either bury this case or have the LLM write some version of "hold for now." Neither is right.

Here's what the prototype does instead:

- The engine classifies SKU-007 as `blocked_floor` — its own action type, never `drop_to_win`.
- It gets `targetPrice: null` and a human-readable `systemReason` explaining why no action is available.
- It appears in a separate **Monitoring** lane below the actionable ones, with a slate/neutral colour instead of urgent terracotta.
- It has **no Apply button** — because there's nothing to apply.
- The LLM is never asked to write a recommendation for it. The API call doesn't even include blocked SKUs.
- The card displays the three prices (ours, competitor's, floor) so Ranjit can verify at a glance that nothing's being hidden.

When you can't act, the product needs to say *why* you can't, and then leave you alone.

---

## Other edge cases the engine handles

| Case | Behaviour |
|---|---|
| Won Buy Box but our price ≥ competitor | Defensive `hold` with reason "no action required" |
| Lost Buy Box but we're already undercutting | Flagged as a non-price loss (seller rating / fulfillment) — price action won't help |
| Lost, but competitor is within Rs.10 of the floor | Target clamps to the floor, never below. Tested explicitly. |
| Won, but headroom is under Rs.20 *and* under 2% of price | `hold` — not worth attention. Lives in the collapsed Resting section. |

All tested in `lib/triage-engine.test.ts`.

---

## File map

```
app/
  page.tsx                  Server component — runs triage, hands off to client
  api/recommend/route.ts    Batched Claude call. Receives engine output, returns one
                            recommendation per SKU. Refuses to forward a sub-floor
                            price even if upstream miscomputed.
lib/
  data.ts                   The 8 SKUs from the brief, hardcoded.
  types.ts                  Domain types.
  triage-engine.ts          The brain. Classifies each SKU and computes a target
                            price that CANNOT violate the margin floor by construction.
  triage-engine.test.ts     23 assertions covering safety, edge cases, and the
                            brief's own worked example.
components/
  triage-view.tsx           Lane orchestration, Apply/Undo state, LLM fetch.
  sku-card.tsx              The actionable card — recommendation, Why? disclosure, Apply.
  monitoring-card.tsx       SKU-007's home. Read-only, explains why no action.
  header-summary.tsx        Headline count + money-at-stake line.
  repriced-log.tsx          Applied changes — with 60-second undo window.
  resting-collapsed.tsx     Won-with-no-headroom SKUs, collapsed but findable.
```

---

## What I chose not to build

| Cut | Why |
|---|---|
| CSV / file upload | The brief said hardcoded beats a broken uploader. Time went to the engine and the LLM. |
| Real marketplace API | Out of scope. Apply is a simulated state change with localStorage persistence. |
| Auth, users, settings | Single-user prototype. Real product needs these; a 4-hour build doesn't. |
| Historical price charts | This is data, not decisions — exactly what Ranjit pushed back on. |
| Multi-marketplace switcher | The snapshot is one moment in time. Faking a switcher adds no signal. |
| Notifications / cron | There is no live feed in a prototype. Pretending there is would be dishonest. |
| Mobile-responsive polish | Pricing managers work on laptops. Desktop-first, acceptable on mobile. |

---

## What I'd build with another 4 hours

1. **Streaming LLM output**, so the first card's text appears in under a second instead of two.
2. **A per-SKU context panel** — a 3-day mini-spark of competitor moves, behind a hover. Hidden by default because Ranjit said *don't show me more data.*
3. **Model the actual handoff** — replace "Applied" with "Sent to Priya for approval," resolving to "Approved · live on Amazon" when she confirms. Closer to the real WhatsApp loop the brief described.

---

## Stack

- **Next.js 15** (App Router) + **TypeScript** (strict)
- **Tailwind** with a custom warm-paper palette: terracotta for urgent, deep olive for opportunity, slate for blocked
- **Fonts:** Fraunces (serif, for recommendations — makes them read like verdicts), Instrument Sans (UI), JetBrains Mono (prices)
- **Anthropic SDK** with `claude-haiku-4-5-20251001` by default. Swap to `claude-sonnet-4-6` in `app/api/recommend/route.ts` for slightly richer phrasing.
- **Vitest** for the safety tests

---

*Built in 4 hours. Every choice has a reason — and the reasons live in this README, in the test names, and in the prompt comments. Disagree with any of them and I'd love to talk.*