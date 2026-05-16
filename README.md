# Opptra · Pricing Signal — Prototype

> Decisions, not dashboards.

A working prototype for the Opptra AI Product Engineer case study. Built around one product principle: **compress Ranjit's 3-hour repricing lag into 60 seconds of action.**

When you open it, you should see _the answer_ — which SKUs need attention, what to set them to, and an Apply button — not a screen full of data to interpret.

---

## Run it locally (3 steps)

```bash
# 1. Install
npm install

# 2. Add your Anthropic key
cp .env.example .env.local
# then edit .env.local and paste a real key from console.anthropic.com

# 3. Run
npm run dev
```

Open <http://localhost:3000>. The page renders immediately with the triage structure; the LLM-written recommendations stream in within ~2 seconds as one batched call.

### Other useful commands

```bash
npm test          # run the triage-engine safety tests (23 assertions)
npm run build     # production build
```

---

## What's where

```
app/
  page.tsx                  Server component — runs triage, hands off to client
  api/recommend/route.ts    Batched Claude call. Receives engine output, returns
                            one recommendation sentence per SKU. Has a paranoid
                            safety check that refuses to forward any sub-floor
                            price to the LLM.
lib/
  data.ts                   The 8 SKUs from the brief, hardcoded.
  types.ts                  Domain types.
  triage-engine.ts          The brain. Pure functions. Classifies each SKU into
                            one of four action types and computes a target price
                            that CANNOT violate the margin floor by construction.
  triage-engine.test.ts     Vitest suite — 23 assertions covering safety,
                            edge cases, and the brief's worked example.
components/
  triage-view.tsx           Lane orchestration + Apply/Undo state + LLM fetch.
  sku-card.tsx              The actionable card — editorial recommendation,
                            tradeoff line, Apply button.
  monitoring-card.tsx       SKU-007's home. Read-only, explains why no action.
  header-summary.tsx        The big "N SKUs need attention" lede.
  repriced-log.tsx          Applied changes — with 60-second undo window.
  resting-collapsed.tsx     Won-with-no-headroom SKUs, collapsed but findable.
```

---

## Design note — the hardest product decision

**Where does the LLM live in the system?**

There are two defensible places to put it:

1. The LLM looks at the raw SKU table and decides what price to set.
2. A deterministic engine computes the price; the LLM only writes the recommendation sentence.

Option (1) is the more obvious AI showcase. Option (2) is the boring, safer one. I picked (2), and it cost me some apparent "AI horsepower" in the demo.

I went with (2) because the brief is explicit that **a price below the margin floor is a failure**, and LLMs — even with strong system prompts and tool schemas — occasionally produce off-by-one errors, misread inputs, or hallucinate in the long tail. In a pricing tool that touches real revenue, "the AI is right 99% of the time" is a P0 incident waiting to happen. Putting the price math in a pure TypeScript function that's covered by unit tests turns a probabilistic safety property into a deterministic one. The LLM still does real work — it picks framing, expresses the tradeoff, writes the verdict-style sentence the brief modeled — but it cannot reach the part of the system where it could break something.

This is also how I'd ship it in production.

**What I'd change with another 4 hours.** Three things, in priority order:

1. **Streaming the recommendations as they're generated**, so the first card's text appears within a second of page load rather than waiting for the full batched response. The current 2-second skeleton period is acceptable but not delightful.
2. **A "pricing context" panel per SKU** — a 3-day mini-spark of competitor price moves, available behind a hover. Ranjit said "don't show me more data," so it lives behind a deliberate gesture, not in the default view.
3. **Marketplace-API-shaped Apply confirmation** — model the actual handoff to the pricing manager (the WhatsApp loop Ranjit mentioned) by showing "Sent to Priya for approval" instead of "Applied," with a status that resolves when approved. Closer to the real workflow.

---

## Edge case handling

### SKU-007 — competitor below margin floor

The brief flags this explicitly: competitor at Rs.399, our floor at Rs.420. **There is no legal move.** Matching the competitor means losing money on every unit. Undercutting is worse.

The prototype handles it like this:

- The triage engine classifies SKU-007 as `blocked_floor` — its own action type, never `drop_to_win`.
- It gets `targetPrice: null` and a human-readable `systemReason` explaining exactly why no action is available.
- It appears in a separate **"Monitoring"** lane below the actionable lanes, with a slate/neutral colour treatment instead of urgent terracotta.
- It has **no Apply button** — the UI gives Ranjit no way to act, because there's nothing to do.
- The LLM is never asked to write a recommendation for it. The user message in the API call doesn't include blocked SKUs at all.
- The card explicitly displays the three prices (ours, competitor's, floor) so Ranjit can see at a glance that he isn't missing something.

### Other edge cases the engine handles

| Case | Behavior |
|---|---|
| Won Buy Box but our price ≥ competitor | Defensive `hold` with reason "no action required" |
| Lost Buy Box but we're already undercutting competitor | Flagged as a non-price Buy Box loss (seller rating / fulfillment) — price action won't help |
| Lost, but competitor sits within Rs.10 of the floor | Target is **clamped to the floor**, never below. Tested explicitly. |
| Won, but headroom is under Rs.20 _and_ under 2% of price | `hold` — not worth Ranjit's attention. Lives in the collapsed Resting section. |

All of these are unit-tested in `lib/triage-engine.test.ts`.

---

## What I cut, and why

| Cut | Why |
|---|---|
| CSV / file upload | The brief says hardcoded beats a broken uploader. Time went to the engine + LLM. |
| Real marketplace API integration | Out of scope per the brief — Apply is simulated with persisted local state. |
| Auth, multi-user, settings | Single-user prototype. Real product needs these; a 4-hour build doesn't. |
| Historical price charts / analytics | This is data, not decisions. Exactly what Ranjit pushed back on. |
| Multi-marketplace switcher | The snapshot is one moment in time; faking a switcher adds no signal. |
| Notifications / scheduling | There is no live feed in a prototype. Pretending there is would be dishonest. |
| Mobile-responsive polish | Pricing managers work on laptops. Desktop-first, acceptable on mobile. |

---

## Loom walkthrough outline (5 min)

1. **0:00 – 0:30** — Ranjit's pain. Three browser tabs, manual diffing, WhatsApp the pricing manager, 3-hour lag.
2. **0:30 – 1:00** — The header. "4 SKUs need your attention now" — this is what he sees in the first 5 seconds. Not a dashboard. An answer.
3. **1:00 – 2:30** — Walk through the three archetypes. SKU-003 (drop to recover Buy Box, top priority because 6 days lost × biggest recoverable margin). SKU-006 (raise to capture margin — the counterintuitive case most candidates miss). SKU-007 (no action — competitor below our floor, explained inline).
4. **2:30 – 3:30** — Apply flow. Click, optimistic update, moves to "Repriced today" log with 60-second undo. Persists across reloads.
5. **3:30 – 4:30** — Architecture. Why the LLM is a phrasing layer, not a pricing layer. Show `triage-engine.test.ts` — 23 assertions proving the margin floor cannot be violated.
6. **4:30 – 5:00** — What I cut and why. The product decision behind the engine/LLM split. What I'd build next if I had another 4 hours.

---

## Stack

- Next.js 15 (App Router) + TypeScript (strict)
- Tailwind CSS with custom palette (warm paper, terracotta urgent accent, deep-olive healthy, slate blocked)
- Fonts: Fraunces (serif, recommendations), Instrument Sans (UI), JetBrains Mono (prices)
- Anthropic SDK (`claude-haiku-4-5-20251001` by default — swap to `claude-sonnet-4-6` for higher-quality phrasing)
- Vitest for the safety tests
