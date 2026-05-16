"use client";

import type { TriageItem } from "@/lib/types";

interface MonitoringCardProps {
  item: TriageItem;
}

export function MonitoringCard({ item }: MonitoringCardProps) {
  return (
    <article className="rounded-lg border border-blocked/20 bg-blockedBg/40 shadow-card">
      <div className="p-6 md:p-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center rounded-sm bg-blockedBg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blocked">
            Watch · No action
          </span>
          <span className="font-mono text-ink tabular">{item.sku.id}</span>
          <span className="text-rule">·</span>
          <span className="text-ink">{item.sku.brand}</span>
          <span className="text-rule">·</span>
          <span className="text-muted">{item.sku.marketplace}</span>
        </div>

        <p className="mt-5 max-w-[58ch] font-serif text-[18px] leading-snug text-ink">
          {item.systemReason}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-4 border-t border-rule pt-4 text-xs">
          <Stat label="Our price" value={`Rs.${item.sku.ourPrice.toLocaleString("en-IN")}`} />
          <Stat
            label="Competitor"
            value={`Rs.${item.sku.competitorPrice.toLocaleString("en-IN")}`}
            tone="urgent"
          />
          <Stat
            label="Margin floor"
            value={`Rs.${item.sku.marginFloor.toLocaleString("en-IN")}`}
          />
        </div>
      </div>
    </article>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "urgent";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div
        className={`mt-1 price-display text-sm ${
          tone === "urgent" ? "text-urgent" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
