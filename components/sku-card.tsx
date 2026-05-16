"use client";

import { useState } from "react";
import type { TriageItem, Recommendation } from "@/lib/types";
import { actionLabel } from "@/lib/triage-engine";

interface SkuCardProps {
  item: TriageItem;
  recommendation: Recommendation | undefined;
  loading: boolean;
  onApply: (skuId: string, fromPrice: number, toPrice: number) => void;
  priority?: number;
}

export function SkuCard({
  item,
  recommendation,
  loading,
  onApply,
  priority,
}: SkuCardProps) {
  const [applying, setApplying] = useState(false);

  const isUrgent = item.action === "drop_to_win";
  const accent = isUrgent
    ? { border: "border-urgent/20", chip: "bg-urgentBg text-urgent" }
    : { border: "border-healthy/20", chip: "bg-healthyBg text-healthy" };

  const lastChangedLabel = labelDays(item.sku.daysSinceLastChange);

  const handleApply = () => {
    if (!item.targetPrice) return;
    setApplying(true);
    // Small delay so the user sees the state change before the card removes
    setTimeout(() => {
      onApply(item.sku.id, item.sku.ourPrice, item.targetPrice!);
    }, 280);
  };

  return (
    <article
      className={`group relative rounded-lg border bg-surface shadow-card transition-all duration-300 ${accent.border} ${
        applying ? "translate-y-[-4px] opacity-0" : "fade-in"
      }`}
    >
      <div className="p-6 md:p-7">
        {/* META STRIP */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {priority !== undefined && isUrgent && (
            <span
              className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${accent.chip}`}
            >
              #{priority} {priority === 1 && "· Top priority"}
            </span>
          )}
          <span className="font-mono text-ink tabular">{item.sku.id}</span>
          <span className="text-rule">·</span>
          <span className="text-ink">{item.sku.brand}</span>
          <span className="text-rule">·</span>
          <span className="text-muted">{item.sku.marketplace}</span>
          <span className="text-rule">·</span>
          <span className="text-muted">
            {isUrgent ? `Lost ${lastChangedLabel}` : `Won, last changed ${lastChangedLabel}`}
          </span>
        </div>

        {/* RECOMMENDATION — the verdict */}
        <div className="mt-5 min-h-[5.5rem]">
          {loading || !recommendation ? (
            <RecommendationSkeleton />
          ) : (
            <p className="fade-in font-serif text-[20px] leading-[1.35] tracking-[-0.01em] text-ink md:text-[22px]">
              {recommendation.headline}
            </p>
          )}
        </div>

        {/* TRADEOFF — subordinate */}
        {recommendation && !loading && (
          <p className="fade-in mt-4 max-w-[60ch] text-sm leading-relaxed text-muted">
            <span className="font-medium text-ink/80">Trade-off · </span>
            {recommendation.tradeoff}
          </p>
        )}

        {/* ACTION ROW */}
        <div className="mt-6 flex items-end justify-between gap-4 border-t border-rule pt-4">
          <div className="text-xs text-muted">
            <span className="uppercase tracking-wider">{actionLabel(item.action)}</span>
            {item.targetPrice !== null && (
              <>
                <span className="mx-2 text-rule">·</span>
                <span className="font-mono text-ink tabular">
                  Rs.{item.sku.ourPrice.toLocaleString("en-IN")}
                </span>
                <span className="mx-1 text-rule">→</span>
                <span className="price-display text-ink">
                  Rs.{item.targetPrice.toLocaleString("en-IN")}
                </span>
              </>
            )}
          </div>

          <ApplyButton
            disabled={loading || !recommendation || !item.targetPrice}
            isUrgent={isUrgent}
            onClick={handleApply}
          />
        </div>
      </div>
    </article>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function RecommendationSkeleton() {
  return (
    <div className="space-y-2 pt-1">
      <div className="skeleton h-5 w-[92%]" />
      <div className="skeleton h-5 w-[88%]" />
      <div className="skeleton h-5 w-[64%]" />
    </div>
  );
}

function ApplyButton({
  disabled,
  isUrgent,
  onClick,
}: {
  disabled: boolean;
  isUrgent: boolean;
  onClick: () => void;
}) {
  const base =
    "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40";
  const active = isUrgent
    ? "bg-urgent text-white hover:bg-[#9A330A] active:translate-y-px"
    : "bg-healthy text-white hover:bg-[#324E0E] active:translate-y-px";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${active}`}
    >
      Apply change
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M5 12h14M13 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function labelDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
