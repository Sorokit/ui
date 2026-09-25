import { ActivityTimeline } from "@/components/ActivityTimeline";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FeeEstimator } from "@/components/FeeEstimator";
import { GasOptimizer } from "@/components/GasOptimizer";
import { MultiSigTransactionBuilder } from "@/components/MultiSigTransactionBuilder";
import { TransactionHistory } from "@/components/TransactionHistory";
import { TransactionPanel } from "@/components/TransactionPanel";
import { SCREEN_LABELS } from "@/lib/nav-labels";

export function TransactionsScreen() {
  const { title, sub } = SCREEN_LABELS.transactions;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[15px] font-semibold text-ink leading-none">
          {title}
        </h2>
        <p className="text-[11px] text-ink-3 mt-0.5">{sub}</p>
      </div>
      <GasOptimizer />
      <FeeEstimator />
      <MultiSigTransactionBuilder />
      <ErrorBoundary isolate>
        <TransactionPanel />
      </ErrorBoundary>
      <ErrorBoundary isolate>
        <TransactionHistory />
      </ErrorBoundary>
      <ActivityTimeline />
    </div>
  );
}
