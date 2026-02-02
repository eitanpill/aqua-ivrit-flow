import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardGridProps {
  viewMode?: "grid" | "list";
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  skeletonCount?: number;
}

export function DashboardGrid({
  viewMode = "grid",
  isLoading = false,
  isEmpty = false,
  emptyMessage = "אין פריטים להצגה",
  emptyIcon,
  children,
  className,
  skeletonCount = 6,
}: DashboardGridProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          viewMode === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            : "flex flex-col gap-3",
          className
        )}
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl bg-card border border-border/50 animate-pulse",
              viewMode === "grid" ? "h-64" : "h-20"
            )}
          >
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              {viewMode === "grid" && (
                <>
                  <Skeleton className="h-2 w-full mt-4" />
                  <Skeleton className="h-4 w-1/3" />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        {emptyIcon && (
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            {emptyIcon}
          </div>
        )}
        <p className="text-muted-foreground font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        viewMode === "grid"
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          : "flex flex-col gap-3",
        className
      )}
    >
      {children}
    </div>
  );
}
