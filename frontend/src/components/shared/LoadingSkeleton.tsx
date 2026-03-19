"use client";

interface SkeletonLineProps {
  width?: string;
  height?: string;
  className?: string;
}

function SkeletonLine({ width = "w-full", height = "h-4", className = "" }: SkeletonLineProps) {
  return (
    <div
      className={`${width} ${height} bg-th-border rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

/* ─── Table Skeleton ─── */
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, columns = 4, className = "" }: TableSkeletonProps) {
  return (
    <div className={`w-full ${className}`} role="status" aria-label="Loading table">
      <span className="sr-only">Loading table data...</span>
      {/* Header */}
      <div className="flex gap-4 mb-3 pb-3 border-b border-th-border">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonLine key={`h-${i}`} width="flex-1" height="h-4" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`r-${r}`} className="flex gap-4 py-2.5">
          {Array.from({ length: columns }).map((_, c) => (
            <SkeletonLine
              key={`r-${r}-c-${c}`}
              width="flex-1"
              height="h-3.5"
              className={c === 0 ? "max-w-[200px]" : ""}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Card Skeleton ─── */
interface CardSkeletonProps {
  lines?: number;
  showAvatar?: boolean;
  className?: string;
}

export function CardSkeleton({ lines = 3, showAvatar = false, className = "" }: CardSkeletonProps) {
  return (
    <div
      className={`bg-th-card border border-th-border rounded-xl p-5 ${className}`}
      role="status"
      aria-label="Loading card"
    >
      <span className="sr-only">Loading card...</span>
      {showAvatar && (
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-th-border animate-pulse" aria-hidden="true" />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="w-1/3" height="h-4" />
            <SkeletonLine width="w-1/4" height="h-3" />
          </div>
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine
            key={i}
            width={i === lines - 1 ? "w-2/3" : "w-full"}
            height="h-3.5"
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Chart Skeleton ─── */
interface ChartSkeletonProps {
  height?: string;
  className?: string;
}

export function ChartSkeleton({ height = "h-64", className = "" }: ChartSkeletonProps) {
  return (
    <div
      className={`bg-th-card border border-th-border rounded-xl p-5 ${className}`}
      role="status"
      aria-label="Loading chart"
    >
      <span className="sr-only">Loading chart...</span>
      {/* Title */}
      <SkeletonLine width="w-1/4" height="h-5" className="mb-4" />
      {/* Chart area with bar placeholders */}
      <div className={`${height} flex items-end gap-2 pt-4`}>
        {Array.from({ length: 8 }).map((_, i) => {
          const heights = [40, 65, 50, 80, 55, 70, 45, 60];
          return (
            <div
              key={i}
              className="flex-1 bg-th-border rounded-t animate-pulse"
              style={{ height: `${heights[i % heights.length]}%` }}
              aria-hidden="true"
            />
          );
        })}
      </div>
      {/* X-axis labels */}
      <div className="flex gap-2 mt-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonLine key={i} width="flex-1" height="h-2.5" />
        ))}
      </div>
    </div>
  );
}

/* ─── Form Skeleton ─── */
interface FormSkeletonProps {
  fields?: number;
  className?: string;
}

export function FormSkeleton({ fields = 4, className = "" }: FormSkeletonProps) {
  return (
    <div
      className={`bg-th-card border border-th-border rounded-xl p-6 space-y-5 ${className}`}
      role="status"
      aria-label="Loading form"
    >
      <span className="sr-only">Loading form...</span>
      {/* Title */}
      <SkeletonLine width="w-1/3" height="h-6" />
      {/* Fields */}
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonLine width="w-1/5" height="h-3.5" />
          <SkeletonLine width="w-full" height="h-10" className="rounded-lg" />
        </div>
      ))}
      {/* Submit button */}
      <div className="pt-2">
        <SkeletonLine width="w-32" height="h-10" className="rounded-lg" />
      </div>
    </div>
  );
}

/* ─── Generic Skeleton Grid ─── */
interface SkeletonGridProps {
  count?: number;
  columns?: number;
  className?: string;
}

export function SkeletonGrid({ count = 6, columns = 3, className = "" }: SkeletonGridProps) {
  const gridCols: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={`grid ${gridCols[columns] || gridCols[3]} gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} lines={2} />
      ))}
    </div>
  );
}
