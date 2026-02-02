import { Search, Grid2x2, List, SortAsc, SortDesc, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "list";
export type SortDir = "asc" | "desc";

interface FilterOption {
  value: string;
  label: string;
}

interface SortOption {
  value: string;
  label: string;
}

interface DashboardToolbarProps {
  // Search
  showSearch?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  // View toggle
  showViewToggle?: boolean;
  viewMode?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
  // Status filter
  showStatusFilter?: boolean;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  statusOptions?: FilterOption[];
  statusLabel?: string;
  // Sort
  showSort?: boolean;
  sortBy?: string;
  onSortByChange?: (sortBy: string) => void;
  sortOptions?: SortOption[];
  sortDir?: SortDir;
  onSortDirChange?: (dir: SortDir) => void;
  // Extra filters
  extraFilters?: React.ReactNode;
  // Actions
  actions?: React.ReactNode;
  className?: string;
}

export function DashboardToolbar({
  showSearch = true,
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "חיפוש...",
  showViewToggle = true,
  viewMode = "grid",
  onViewChange,
  showStatusFilter = false,
  statusFilter = "all",
  onStatusFilterChange,
  statusOptions = [],
  statusLabel = "סינון לפי סטטוס",
  showSort = false,
  sortBy,
  onSortByChange,
  sortOptions = [],
  sortDir = "desc",
  onSortDirChange,
  extraFilters,
  actions,
  className,
}: DashboardToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4",
        "p-4 rounded-xl bg-card border border-border/50 shadow-sm",
        className
      )}
    >
      {/* Left side - Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
        {showSearch && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="pr-10 bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>
        )}

        {showStatusFilter && statusOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground hidden sm:inline">
              <Filter className="h-4 w-4" />
            </Label>
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger className="w-[140px] bg-muted/50 border-0">
                <SelectValue placeholder={statusLabel} />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showSort && sortOptions.length > 0 && (
          <div className="flex items-center gap-1">
            <Select value={sortBy} onValueChange={onSortByChange}>
              <SelectTrigger className="w-[120px] bg-muted/50 border-0">
                <SelectValue placeholder="מיון" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => onSortDirChange?.(sortDir === "asc" ? "desc" : "asc")}
            >
              {sortDir === "asc" ? (
                <SortAsc className="h-4 w-4" />
              ) : (
                <SortDesc className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}

        {extraFilters}
      </div>

      {/* Right side - View Toggle and Actions */}
      <div className="flex items-center gap-3">
        {actions}

        {showViewToggle && (
          <div className="flex items-center ring-1 ring-border rounded-lg overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-none transition-colors",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "hover:bg-muted"
              )}
              onClick={() => onViewChange?.("list")}
              title="תצוגת רשימה"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-none transition-colors",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "hover:bg-muted"
              )}
              onClick={() => onViewChange?.("grid")}
              title="תצוגת רשת"
            >
              <Grid2x2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
