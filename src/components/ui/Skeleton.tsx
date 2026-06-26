import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render as a circle (for avatars/icons) */
  circle?: boolean;
}

export function Skeleton({ circle, className, ...props }: SkeletonProps) {
  return (
    <div
      role="presentation"
      className={cn(
        "bg-surface-2 animate-pulse shrink-0",
        circle ? "rounded-full" : "rounded-lg",
        className,
      )}
      {...props}
    />
  );
}

/** Pre-composed row skeleton: icon + two lines of text */
export function SkeletonRow({ className, ...props }: { className?: string; [key: string]: any }) {
  return (
    <div
      role="presentation"
      className={cn("flex items-center gap-3", className)}
      {...props}
    >
      <Skeleton circle className="w-9 h-9" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  rows?: number;
  structure?: React.ReactNode;
  children?: React.ReactNode;
}

/** Pre-composed card skeleton: header + body lines */
export function SkeletonCard({
  rows = 3,
  structure,
  children,
  className,
  ...props
}: SkeletonCardProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading content"
      className={cn("rounded-xl border border-line bg-surface overflow-hidden", className)}
      {...props}
    >
      {structure || children ? (
        structure || children
      ) : (
        <>
          <div className="px-5 py-4 border-b border-line flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="px-5 py-5 flex flex-col gap-4">
            {Array.from({ length: rows }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Pre-composed row skeleton matching AssetRow layout exactly */
export function AssetRowSkeleton({ className, ...props }: { className?: string; [key: string]: any }) {
  return (
    <div
      role="presentation"
      className={cn(
        "flex items-center justify-between px-5 py-4 border-b border-line last:border-0",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2.5">
        <Skeleton circle className="w-8 h-8" />
        <div className="flex flex-col gap-1 min-w-0">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      </div>
      <Skeleton className="h-3.5 w-16" />
    </div>
  );
}
