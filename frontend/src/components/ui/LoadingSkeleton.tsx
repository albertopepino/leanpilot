interface LoadingSkeletonProps {
  variant?: "card" | "table" | "chart" | "text" | "kpi";
  count?: number;
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-th-bg-3 rounded ${className || ""}`} />;
}

export default function LoadingSkeleton({ variant = "card", count = 1 }: LoadingSkeletonProps) {
  const items = Array.from({ length: count });

  if (variant === "kpi") {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((_, i) => (
          <div key={i} className="bg-th-card border border-th-card-border rounded-xl p-4 border-l-4 border-l-th-bg-3">
            <SkeletonPulse className="h-3 w-20 mb-3" />
            <SkeletonPulse className="h-8 w-24 mb-2" />
            <SkeletonPulse className="h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "chart") {
    return <SkeletonPulse className="h-64 w-full rounded-xl" />;
  }

  if (variant === "table") {
    return (
      <div className="bg-th-card border border-th-card-border rounded-xl overflow-hidden">
        <SkeletonPulse className="h-10 w-full" />
        {items.map((_, i) => (
          <div key={i} className="flex gap-4 p-4 border-t border-th-border">
            <SkeletonPulse className="h-4 w-1/4" />
            <SkeletonPulse className="h-4 w-1/3" />
            <SkeletonPulse className="h-4 w-1/5" />
            <SkeletonPulse className="h-4 w-1/6" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "text") {
    return (
      <div className="space-y-3">
        {items.map((_, i) => (
          <SkeletonPulse key={i} className="h-4 w-full" />
        ))}
        <SkeletonPulse className="h-4 w-2/3" />
      </div>
    );
  }

  // Default card
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((_, i) => (
        <div key={i} className="bg-th-card border border-th-card-border rounded-xl p-6">
          <SkeletonPulse className="h-5 w-32 mb-4" />
          <SkeletonPulse className="h-4 w-full mb-2" />
          <SkeletonPulse className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}
