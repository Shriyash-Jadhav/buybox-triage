"use client";

import { useState } from "react";
import type { TriageItem } from "@/lib/types";

export function RestingCollapsed({ items }: { items: TriageItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="border-t border-rule pt-6">
      <button
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-baseline justify-between text-left"
      >
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
            Resting · {items.length}
          </div>
          <h2 className="mt-1 font-serif text-xl text-ink/70">
            Winning Buy Box, no change recommended
          </h2>
        </div>
        <span className="text-xs uppercase tracking-wider text-muted">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <ul className="fade-in mt-4 divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-surface/60">
          {items.map((item) => (
            <li
              key={item.sku.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm"
            >
              <span className="font-mono text-ink tabular">{item.sku.id}</span>
              <span className="text-rule">·</span>
              <span className="text-ink">{item.sku.brand}</span>
              <span className="text-rule">·</span>
              <span className="price-display text-muted">
                Rs.{item.sku.ourPrice.toLocaleString("en-IN")} (vs Rs.
                {item.sku.competitorPrice.toLocaleString("en-IN")})
              </span>
              <span className="text-rule">·</span>
              <span className="text-xs text-muted">{item.systemReason}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
