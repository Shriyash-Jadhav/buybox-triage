"use client";

interface HeaderSummaryProps {
  urgentCount: number;
  opportunityCount: number;
  monitoringCount: number;
  repricedCount: number;
  recoverableMargin: number;
  marginToCapture: number;
  onReset: () => void;
}

export function HeaderSummary({
  urgentCount,
  opportunityCount,
  monitoringCount,
  repricedCount,
  recoverableMargin,
  marginToCapture,
  onReset,
}: HeaderSummaryProps) {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const totalAtStake = recoverableMargin + marginToCapture;
  const hasMoneyContext = totalAtStake > 0;

  return (
    <header>
      <div className="flex items-baseline justify-between">
        <div className="text-xs font-medium uppercase tracking-[0.22em] text-muted">
          Opptra · Pricing Signal
        </div>
        <div className="text-xs text-muted">{today} · 9:00 AM IST</div>
      </div>

      <h1 className="mt-6 max-w-[28ch] font-serif text-[42px] font-medium leading-[1.05] tracking-tightest text-ink md:text-[52px]">
        {urgentCount > 0 ? (
          <>
            <span className="text-urgent">{urgentCount}</span> SKU
            {urgentCount !== 1 && "s"} need
            <br />
            your attention now.
          </>
        ) : (
          <>You&rsquo;re caught up.</>
        )}
      </h1>

      {/* MONEY AT STAKE — the "why now?" line */}
      {hasMoneyContext && (
        <div className="mt-5 flex flex-wrap items-baseline gap-x-2 text-base">
          <span className="font-mono tabular font-medium text-ink">
            Rs.{totalAtStake.toLocaleString("en-IN")}
          </span>
          <span className="text-muted">at stake across this morning&rsquo;s queue</span>
          <span
            className="text-xs text-muted/80"
            title={`Rs.${recoverableMargin.toLocaleString("en-IN")} margin to preserve on Buy Box recovery · Rs.${marginToCapture.toLocaleString("en-IN")} per-unit uplift on raise opportunities`}
          >
            (Rs.{recoverableMargin.toLocaleString("en-IN")} recoverable
            {marginToCapture > 0 &&
              ` + Rs.${marginToCapture.toLocaleString("en-IN")} capturable`}
            )
          </span>
        </div>
      )}

      {/* COUNT BREAKDOWN — secondary */}
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
        {opportunityCount > 0 && (
          <span>
            <span className="font-medium text-healthy">{opportunityCount}</span>{" "}
            opportunit{opportunityCount === 1 ? "y" : "ies"} to raise
          </span>
        )}
        {monitoringCount > 0 && (
          <span>
            <span className="font-medium text-blocked">{monitoringCount}</span>{" "}
            on watch
          </span>
        )}
        {repricedCount > 0 && (
          <>
            <span>
              <span className="font-medium text-ink">{repricedCount}</span>{" "}
              repriced today
            </span>
            <button
              onClick={onReset}
              className="text-xs uppercase tracking-wider text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Reset demo
            </button>
          </>
        )}
      </div>
    </header>
  );
}