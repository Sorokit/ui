import { Check, ChevronRight } from "lucide-react";

export interface BreadcrumbStep {
  id: string;
  label: string;
}

interface StepBreadcrumbProps {
  steps: BreadcrumbStep[];
  /** Zero-based index of the current step. */
  currentIndex: number;
  /** If provided, completed steps become buttons that jump back. */
  onStepClick?: (index: number) => void;
  className?: string;
}

export function StepBreadcrumb({
  steps,
  currentIndex,
  onStepClick,
  className = "",
}: StepBreadcrumbProps) {
  return (
    <nav aria-label="Progress" className={className}>
      <p className="sr-only">
        Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.label}
      </p>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
        {steps.map((step, i) => {
          const isCurrent = i === currentIndex;
          const isDone = i < currentIndex;
          const text = `Step ${i + 1}: ${step.label}`;

          const content = (
            <>
              {isDone && <Check size={14} aria-hidden="true" className="shrink-0" />}
              <span className={isCurrent ? "" : "hidden sm:inline"}>{text}</span>
              {/* On small screens, show just the number for non-current steps */}
              {!isCurrent && <span className="sm:hidden">{i + 1}</span>}
            </>
          );

          const base =
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors";

          return (
            <li key={step.id} className="flex items-center gap-1">
              {isDone && onStepClick ? (
                <button
                  type="button"
                  onClick={() => onStepClick(i)}
                  className={`${base} text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
                >
                  {content}
                </button>
              ) : (
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  className={`${base} ${
                    isCurrent
                      ? "border border-line bg-surface-2 font-semibold text-ink"
                      : isDone
                        ? "text-ink-2"
                        : "text-ink-3"
                  }`}
                >
                  {content}
                </span>
              )}
              {i < steps.length - 1 && (
                <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-ink-3" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
