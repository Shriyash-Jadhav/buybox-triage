"use client";

import { useEffect, useMemo, useState } from "react";
import type { TriageLanes } from "@/lib/triage-engine";
import type { Recommendation, RepricedRecord } from "@/lib/types";
import { SkuCard } from "./sku-card";
import { MonitoringCard } from "./monitoring-card";
import { HeaderSummary } from "./header-summary";
import { RepricedLog } from "./repriced-log";
import { RestingCollapsed } from "./resting-collapsed";

const STORAGE_KEY = "opptra:repriced-v1";

export function TriageView({ lanes }: { lanes: TriageLanes }) {
  const [recommendations, setRecommendations] = useState<
    Record<string, Recommendation>
  >({});
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [repriced, setRepriced] = useState<RepricedRecord[]>([]);

  // ─── Hydrate repriced state from localStorage on mount ────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRepriced(JSON.parse(raw));
    } catch {
      // ignore — corrupt local state shouldn't crash the page
    }
  }, []);

  // ─── Persist repriced state on every change ───────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(repriced));
    } catch {
      // ignore
    }
  }, [repriced]);

  // ─── Fetch LLM recommendations in one batched call on load ────────────────
  useEffect(() => {
    const actionable = [...lanes.urgent, ...lanes.opportunities];
    if (actionable.length === 0) {
      setLoadingRecs(false);
      return;
    }

    const items = actionable.map((i) => ({
      skuId: i.sku.id,
      brand: i.sku.brand,
      action: i.action as "drop_to_win" | "raise_for_margin",
      ourPrice: i.sku.ourPrice,
      competitorPrice: i.sku.competitorPrice,
      marginFloor: i.sku.marginFloor,
      targetPrice: i.targetPrice!,
      bufferAboveFloor: i.bufferAboveFloor!,
      bufferPct: i.bufferPct!,
      vsCompetitor: i.vsCompetitor!,
      daysSinceLastChange: i.sku.daysSinceLastChange,
    }));

    fetch("/api/recommend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Request failed: ${res.status}`);
        }
        return res.json();
      })
      .then((data: { recommendations: Record<string, Recommendation> }) => {
        setRecommendations(data.recommendations);
        setLoadingRecs(false);
      })
      .catch((e: Error) => {
        setRecsError(e.message);
        setLoadingRecs(false);
      });
  }, [lanes]);

  // ─── Apply / Undo handlers ────────────────────────────────────────────────
  const repricedIds = useMemo(
    () => new Set(repriced.map((r) => r.skuId)),
    [repriced]
  );

  const handleApply = (skuId: string, fromPrice: number, toPrice: number) => {
    setRepriced((prev) => [
      {
        skuId,
        fromPrice,
        toPrice,
        appliedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleUndo = (skuId: string) => {
    setRepriced((prev) => prev.filter((r) => r.skuId !== skuId));
  };

  const handleResetAll = () => {
    setRepriced([]);
  };

  // ─── Filter lanes by repriced state ───────────────────────────────────────
  const visibleUrgent = lanes.urgent.filter((i) => !repricedIds.has(i.sku.id));
  const visibleOpportunities = lanes.opportunities.filter(
    (i) => !repricedIds.has(i.sku.id)
  );

  const totalActionable = visibleUrgent.length + visibleOpportunities.length;
  const allClear = totalActionable === 0;

  return (
    <main className="relative z-10 mx-auto max-w-[1100px] px-6 py-10 md:py-14">
      <HeaderSummary
        urgentCount={visibleUrgent.length}
        opportunityCount={visibleOpportunities.length}
        monitoringCount={lanes.monitoring.length}
        repricedCount={repriced.length}
        onReset={handleResetAll}
      />

      {recsError && (
        <div className="mt-6 rounded-md border border-urgent/30 bg-urgentBg px-4 py-3 text-sm text-urgent">
          <span className="font-medium">Couldn&rsquo;t load recommendations:</span>{" "}
          {recsError}
          <div className="mt-1 text-xs text-muted">
            Check that <code className="font-mono">ANTHROPIC_API_KEY</code> is set in your{" "}
            <code className="font-mono">.env.local</code> and restart the dev server.
          </div>
        </div>
      )}

            <div className="mt-10 space-y-10">
        {/* LANE 1 — URGENT: Buy Box Lost, drop to recover */}
        {visibleUrgent.length > 0 && (
          <Lane
            kicker="Urgent"
            title="Lost Buy Box — action available"
            description="A price drop within margin will recover the Buy Box on these SKUs. Sorted by money-at-stake × days lost."
            tone="urgent"
            count={visibleUrgent.length}
          >
            <div className="space-y-3">
              {visibleUrgent.map((item, idx) => (
                <SkuCard
                  key={item.sku.id}
                  item={item}
                  recommendation={recommendations[item.sku.id]}
                  loading={loadingRecs}
                  onApply={handleApply}
                  priority={idx + 1}
                />
              ))}
            </div>
          </Lane>
        )}

        {/* LANE 2 — OPPORTUNITIES: Buy Box Won, raise possible */}
        {visibleOpportunities.length > 0 && (
          <Lane
            kicker="Opportunity"
            title="Won Buy Box with headroom — raise to capture margin"
            description="We&rsquo;re winning the Buy Box well below competitor pricing. Raising the price still beats them but recovers margin."
            tone="healthy"
            count={visibleOpportunities.length}
          >
            <div className="space-y-3">
              {visibleOpportunities.map((item) => (
                <SkuCard
                  key={item.sku.id}
                  item={item}
                  recommendation={recommendations[item.sku.id]}
                  loading={loadingRecs}
                  onApply={handleApply}
                />
              ))}
            </div>
          </Lane>
        )}

        {/* LANE 3 — MONITORING: blocked by floor */}
        {lanes.monitoring.length > 0 && (
          <Lane
            kicker="Monitoring"
            title="Competitor below margin floor — no action available"
            description="The competitor is pricing below what Opptra can match profitably. We flag, hold, and watch for a correction."
            tone="blocked"
            count={lanes.monitoring.length}
          >
            <div className="space-y-3">
              {lanes.monitoring.map((item) => (
                <MonitoringCard key={item.sku.id} item={item} />
              ))}
            </div>
          </Lane>
        )}

        {/* RESTING — won, headroom too small to act */}
        {lanes.resting.length > 0 && (
          <RestingCollapsed items={lanes.resting} />
        )}

        {/* REPRICED LOG */}
        {repriced.length > 0 && (
          <RepricedLog records={repriced} onUndo={handleUndo} />
        )}

        {/* ALL-CLEAR EMPTY STATE */}
        {allClear && lanes.urgent.length > 0 && (
          <div className="mt-6 border-t border-rule pt-10 text-center">
            <div className="font-serif text-2xl text-ink">All clear.</div>
            <div className="mt-2 text-sm text-muted">
              No SKUs need action right now. Check back in a few hours — pricing
              moves fast.
            </div>
          </div>
        )}
      </div>

      <footer className="mt-20 border-t border-rule pt-6 text-xs text-muted">
        Opptra · Pricing Signal · Prototype · Snapshot taken at 9:00 AM IST
      </footer>
    </main>
  );
}

// ─── Lane wrapper ──────────────────────────────────────────────────────────

interface LaneProps {
  kicker: string;
  title: string;
  description: string;
  tone: "urgent" | "healthy" | "blocked";
  count: number;
  children: React.ReactNode;
}

function Lane({ kicker, title, description, tone, count, children }: LaneProps) {
  const toneStyles = {
    urgent: "text-urgent",
    healthy: "text-healthy",
    blocked: "text-blocked",
  };

  return (
    <section>
      <div className="mb-5 flex items-baseline justify-between gap-6 border-b border-rule pb-3">
        <div>
          <div
            className={`text-xs font-medium uppercase tracking-[0.18em] ${toneStyles[tone]}`}
          >
            {kicker} · {count}
          </div>
          <h2 className="mt-1 font-serif text-2xl font-medium text-ink">
            {title}
          </h2>
        </div>
      </div>
      <p className="mb-6 max-w-[60ch] text-sm text-muted">{description}</p>
      {children}
    </section>
  );
}
