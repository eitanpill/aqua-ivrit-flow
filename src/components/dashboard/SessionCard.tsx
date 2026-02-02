import { format } from "date-fns";
import { Clock, MapPin, Users, User, MoreVertical, Trash2, Edit, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SessionStatus = "scheduled" | "completed" | "cancelled" | "inProgress";

export interface SessionCardData {
  id: string;
  name: string;
  subtitle?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  location?: string;
  resource?: string;
  coach?: string;
  enrolledCount?: number;
  maxParticipants?: number;
  progress?: number;
  accentColor?: string;
}

interface SessionCardProps {
  session: SessionCardData;
  viewMode?: "grid" | "list";
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  showActions?: boolean;
  className?: string;
}

const statusConfig: Record<SessionStatus, { label: string; color: string; bgColor: string }> = {
  scheduled: { label: "מתוכנן", color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950" },
  inProgress: { label: "בתהליך", color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950" },
  completed: { label: "הושלם", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950" },
  cancelled: { label: "בוטל", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-950" },
};

export function SessionCard({
  session,
  viewMode = "grid",
  onClick,
  onEdit,
  onDelete,
  onView,
  showActions = true,
  className,
}: SessionCardProps) {
  const status = statusConfig[session.status] || statusConfig.scheduled;
  const progress = session.progress ?? (session.enrolledCount && session.maxParticipants
    ? Math.round((session.enrolledCount / session.maxParticipants) * 100)
    : 0);

  const formatTime = (time: string) => {
    try {
      return format(new Date(time), "HH:mm");
    } catch {
      return time;
    }
  };

  const CardWrapper = ({ children }: { children: React.ReactNode }) => (
    <div
      className={cn(
        "group relative rounded-xl transition-all duration-200",
        "ring-1 ring-border/50 bg-card hover:shadow-lg hover:ring-primary/30",
        viewMode === "list"
          ? "flex items-center gap-4 p-4"
          : "flex flex-col p-5",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );

  if (viewMode === "list") {
    return (
      <CardWrapper>
        {/* Status indicator */}
        <div className={cn("w-1 h-12 rounded-full self-center", status.bgColor)} 
          style={{ backgroundColor: session.accentColor }} />
        
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-base truncate">{session.name}</h3>
            <Badge variant="outline" className={cn("shrink-0", status.color, status.bgColor)}>
              {status.label}
            </Badge>
          </div>
          {session.subtitle && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">{session.subtitle}</p>
          )}
        </div>

        {/* Time */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
          <Clock className="h-4 w-4" />
          <span>{formatTime(session.startTime)} - {formatTime(session.endTime)}</span>
        </div>

        {/* Location */}
        {session.resource && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0 hidden md:flex">
            <MapPin className="h-4 w-4" />
            <span className="truncate max-w-[120px]">{session.resource}</span>
          </div>
        )}

        {/* Enrollment */}
        {session.maxParticipants && (
          <div className="flex items-center gap-1.5 text-sm shrink-0">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-semibold text-primary">
              {session.enrolledCount || 0}/{session.maxParticipants}
            </span>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onView && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
                  <Eye className="h-4 w-4 ml-2" />
                  צפייה
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                  <Edit className="h-4 w-4 ml-2" />
                  עריכה
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 ml-2" />
                  מחיקה
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardWrapper>
    );
  }

  // Grid view
  return (
    <CardWrapper>
      {/* Top accent line */}
      <div
        className={cn("absolute top-0 left-0 right-0 h-1 rounded-t-xl", status.bgColor)}
        style={{ backgroundColor: session.accentColor }}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-muted-foreground font-medium">
          {session.date}
        </span>
        {showActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 -mt-1 -mr-2">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onView && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
                  <Eye className="h-4 w-4 ml-2" />
                  צפייה
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                  <Edit className="h-4 w-4 ml-2" />
                  עריכה
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 ml-2" />
                  מחיקה
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Title */}
      <div className="flex-1">
        <h3 className="font-bold text-lg line-clamp-1">{session.name}</h3>
        {session.subtitle && (
          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
            {session.subtitle}
          </p>
        )}
      </div>

      {/* Time & Location */}
      <div className="space-y-2 mt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          <span>{formatTime(session.startTime)} - {formatTime(session.endTime)}</span>
        </div>
        {session.resource && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{session.resource}</span>
          </div>
        )}
        {session.coach && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            <span className="truncate">{session.coach}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">רשומים</span>
          <span className="font-semibold text-primary">{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
        {session.maxParticipants && (
          <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-bold text-primary">
              {session.enrolledCount || 0}/{session.maxParticipants}
            </span>
          </div>
        )}
        <Badge variant="outline" className={cn("text-xs", status.color, status.bgColor)}>
          {status.label}
        </Badge>
      </div>
    </CardWrapper>
  );
}
