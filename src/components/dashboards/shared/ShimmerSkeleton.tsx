import { cn } from "@/lib/utils";

interface ShimmerSkeletonProps {
  className?: string;
}

export function ShimmerSkeleton({ className }: ShimmerSkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-muted/50",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        "before:animate-shimmer",
        className
      )}
    />
  );
}

// Dashboard-specific skeleton layouts
export function DashboardHeaderSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 p-6 bg-gradient-to-br from-muted/30 to-muted/10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ShimmerSkeleton className="h-14 w-14 rounded-full" />
          <div className="space-y-2">
            <ShimmerSkeleton className="h-8 w-48" />
            <ShimmerSkeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ShimmerSkeleton className="h-10 w-32 hidden md:block" />
          <ShimmerSkeleton className="h-8 w-24" />
        </div>
      </div>
    </div>
  );
}

export function KPICardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 p-4 bg-gradient-to-br from-muted/30 to-muted/10 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <ShimmerSkeleton className="h-4 w-24" />
          <ShimmerSkeleton className="h-8 w-20" />
          <ShimmerSkeleton className="h-3 w-16" />
        </div>
        <ShimmerSkeleton className="h-10 w-10 rounded-lg" />
      </div>
    </div>
  );
}

export function KPIGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <KPICardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 p-4 bg-gradient-to-br from-muted/30 to-muted/10 backdrop-blur-sm">
      <ShimmerSkeleton className="h-5 w-32 mb-4" />
      <ShimmerSkeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

export function SmartListSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 p-4 bg-gradient-to-br from-muted/30 to-muted/10 backdrop-blur-sm">
      <ShimmerSkeleton className="h-5 w-40 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
            <ShimmerSkeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <ShimmerSkeleton className="h-4 w-3/4" />
              <ShimmerSkeleton className="h-3 w-1/2" />
            </div>
            <ShimmerSkeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
