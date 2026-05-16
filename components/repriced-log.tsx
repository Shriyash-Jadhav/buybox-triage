"use client";

import { useEffect, useState } from "react";
import type { RepricedRecord } from "@/lib/types";

interface RepricedLogProps {
  records: RepricedRecord[];
  onUndo: (skuId: string) => void;
}

const UNDO_WINDOW_MS = 60_000;

export function RepricedLog({ records, onUndo }: RepricedLogProps) {
  // Tick once a second so the "X sec ago" labels and undo-window state update
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <section>
      <div className="mb-5 flex items-baseline justify-between border-b border-rule pb-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-ink">
            Repriced this session · {records.length}
          </div>
          <h2 className="mt-1 font-serif text-2xl font-medium text-ink">
            Change requests sent
          </h2>
        </div>
      </div>

      <p className="mb-5 max-w-[60ch] text-sm text-muted">
        Applied changes are sent to the pricing manager for marketplace
        propagation. Undo is available for one minute after applying — after
        that, the request is committed to the queue.
      </p>

      <ol className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-surface">
        {records.map((r) => {
          const ageMs = Date.now() - new Date(r.appliedAt).getTime();
          const canUndo = ageMs < UNDO_WINDOW_MS;
          return (
            <li
              key={`${r.skuId}-${r.appliedAt}`}
              className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-healthy">
                  <CheckIcon />
                  <span className="text-xs font-medium uppercase tracking-wider">
                    Applied
                  </span>
                </span>
                <span className="font-mono text-ink tabular">{r.skuId}</span>
                <span className="text-rule">·</span>
                <span className="price-display text-muted line-through">
                  Rs.{r.fromPrice.toLocaleString("en-IN")}
                </span>
                <span className="text-rule">→</span>
                <span className="price-display font-medium text-ink">
                  Rs.{r.toPrice.toLocaleString("en-IN")}
                </span>
                <span className="text-xs text-muted">· {formatAge(ageMs)}</span>
              </div>
              {canUndo && (
                <button
                  onClick={() => onUndo(r.skuId)}
                  className="text-xs uppercase tracking-wider text-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  Undo
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function formatAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
