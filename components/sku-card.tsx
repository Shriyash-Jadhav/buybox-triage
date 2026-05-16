"use client";

import { useState } from "react";
import type { TriageItem, Recommendation } from "@/lib/types";

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
  const [showWhy, setShowWhy] = useState(false);

  const isUrgent = item.action === "drop_to_win";
  const accent = isUrgent
    ? { border: "border-urgent/20", chip: "bg-urgentBg text-urgent" }
    : { border: "border-healthy/20", chip: "bg-healthyBg text-healthy" };

  const lastChangedLabel = labelDays(item.sku.daysSinceLastChange);

  const handleApply = () => {
    if (!item.targetPrice) return;
    setApplying(true);
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
      <div className="px-5 py-4 md:px-6 md:py-5">
        {/* META STRIP */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {priority !== undefined && isUrgent && (
            <span
              className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${accent.chip}`}
            >
              #{priority}
              {priority === 1 && (
                <span className="ml-1 hidden sm:inline">· Top priority</span>
              )}
            </span>
          )}
          <span className="font-mono text-ink tabular">{item.sku.id}</span>
          <span className="text-rule">·</span>
          <span className="text-ink">{item.sku.brand}</span>
          <span className="text-rule">·</span>
          <span className="text-muted">{item.sku.marketplace}</span>
          <span className="text-rule">·</span>
          <span className="text-muted">
            {isUrgent
              ? `Lost ${lastChangedLabel}`
              : `Won, changed ${lastChangedLabel}`}
          </span>
        </div>

        {/* RECOMMENDATION — the verdict */}
        <div className="mt-3">
          {loading || !recommendation ? (
            <RecommendationSkeleton />
          ) : (
            <p className="fade-in font-serif text-[17px] leading-[1.4] tracking-[-0.01em] text-ink md:text-[18px]">
              {recommendation.headline}
            </p>
          )}
        </div>

        {/* ACTION ROW — meta info + Why? disclosure + Apply */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-mono text-muted tabular">
              Rs.{item.sku.ourPrice.toLocaleString("en-IN")}
            </span>
            <span className="text-rule">→</span>
            <span className="price-display font-medium text-ink">
              Rs.{item.targetPrice?.toLocaleString("en-IN") ?? "—"}
            </span>
            {recommendation && !loading && (
              <button
                type="button"
                onClick={() => setShowWhy((x) => !x)}
                className="text-xs uppercase tracking-wider text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                {showWhy ? "Hide" : "Why?"}
              </button>
            )}
          </div>

          <ApplyButton
            disabled={loading || !recommendation || !item.targetPrice}
            isUrgent={isUrgent}
            onClick={handleApply}
          />
        </div>

        {/* TRADEOFF — hidden by default, revealed on click */}
        {showWhy && recommendation && (
          <div className="fade-in mt-3 rounded-md bg-cream/40 px-4 py-3 text-sm leading-relaxed text-ink/75">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Trade-off
            </div>
            <p className="mt-1">{recommendation.tradeoff}</p>
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function RecommendationSkeleton() {
  return (
    <div className="space-y-1.5 py-0.5">
      <div className="skeleton h-4 w-[92%]" />
      <div className="skeleton h-4 w-[68%]" />
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
    "inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40";
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
        width="13"
        height="13"
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
  return `${days}d ago`;
}