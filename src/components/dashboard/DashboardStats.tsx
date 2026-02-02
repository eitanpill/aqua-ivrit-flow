import { cn } from "@/lib/utils";

export interface StatItem {
  id: string;
  label: string;
  value: number | string;
  color?: string;
}

interface DashboardStatsProps {
  stats: StatItem[];
  className?: string;
}

export function DashboardStats({ stats, className }: DashboardStatsProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 sm:p-5 rounded-xl",
        "bg-gradient-to-r from-muted/50 to-muted/30 border border-border/50",
        "shadow-sm backdrop-blur-sm",
        className
      )}
    >
      {stats.map((stat, index) => (
        <div key={stat.id} className="flex items-center gap-4">
          <div className="text-center">
            <p
              className={cn(
                "text-2xl sm:text-3xl lg:text-4xl font-black",
                stat.color || "text-gradient-primary"
              )}
            >
              {stat.value}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
              {stat.label}
            </p>
          </div>
          {index < stats.length - 1 && (
            <div className="h-10 w-px bg-border/60 mx-2 sm:mx-4" />
          )}
        </div>
      ))}
    </div>
  );
}
