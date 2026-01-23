import * as React from "react";
import { useDeviceType } from "@/hooks/useDeviceType";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdaptiveColumn<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  // For mobile cards, mark as "primary" to show prominently
  primary?: boolean;
  // Hide on mobile card view
  hideOnMobile?: boolean;
}

export interface AdaptiveAction<T> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (item: T) => void;
  variant?: "default" | "destructive";
}

interface AdaptiveTableProps<T> {
  data: T[];
  columns: AdaptiveColumn<T>[];
  actions?: AdaptiveAction<T>[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  className?: string;
  // Optional: custom mobile card renderer
  renderMobileCard?: (item: T, actions?: AdaptiveAction<T>[]) => React.ReactNode;
}

export function AdaptiveTable<T>({
  data,
  columns,
  actions,
  keyExtractor,
  emptyMessage = "אין נתונים להצגה",
  className,
  renderMobileCard,
}: AdaptiveTableProps<T>) {
  const { isMobile } = useDeviceType();

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  // Mobile Card View
  if (isMobile) {
    return (
      <div className={cn("space-y-3", className)}>
        {data.map((item) => {
          if (renderMobileCard) {
            return (
              <React.Fragment key={keyExtractor(item)}>
                {renderMobileCard(item, actions)}
              </React.Fragment>
            );
          }

          const primaryColumns = columns.filter((col) => col.primary);
          const secondaryColumns = columns.filter(
            (col) => !col.primary && !col.hideOnMobile
          );

          return (
            <Card key={keyExtractor(item)} className="overflow-hidden">
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {primaryColumns.map((col) => (
                    <CardTitle key={col.key} className="text-base font-semibold truncate">
                      {col.render(item)}
                    </CardTitle>
                  ))}
                </div>
                {actions && actions.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">פעולות</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      {actions.map((action, idx) => (
                        <DropdownMenuItem
                          key={idx}
                          onClick={() => action.onClick(item)}
                          className={cn(
                            "gap-2",
                            action.variant === "destructive" && "text-destructive focus:text-destructive"
                          )}
                        >
                          {action.icon && <action.icon className="h-4 w-4" />}
                          {action.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5 text-sm">
                  {secondaryColumns.map((col) => (
                    <div key={col.key} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{col.header}:</span>
                      <span className="font-medium text-left">{col.render(item)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // Desktop/Tablet Table View
  return (
    <div className={cn("rounded-lg border overflow-hidden", className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {columns.map((col) => (
              <TableHead key={col.key} className="font-semibold">
                {col.header}
              </TableHead>
            ))}
            {actions && actions.length > 0 && (
              <TableHead className="w-[100px] text-center">פעולות</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={keyExtractor(item)} className="hover:bg-muted/30">
              {columns.map((col) => (
                <TableCell key={col.key}>{col.render(item)}</TableCell>
              ))}
              {actions && actions.length > 0 && (
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    {actions.length <= 2 ? (
                      // Show buttons directly if 2 or fewer actions
                      actions.map((action, idx) => (
                        <Button
                          key={idx}
                          variant={action.variant === "destructive" ? "destructive" : "ghost"}
                          size="sm"
                          onClick={() => action.onClick(item)}
                          className="h-8 px-2"
                        >
                          {action.icon && <action.icon className="h-4 w-4" />}
                          <span className="sr-only">{action.label}</span>
                        </Button>
                      ))
                    ) : (
                      // Use dropdown for 3+ actions
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">פעולות</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          {actions.map((action, idx) => (
                            <DropdownMenuItem
                              key={idx}
                              onClick={() => action.onClick(item)}
                              className={cn(
                                "gap-2",
                                action.variant === "destructive" && "text-destructive focus:text-destructive"
                              )}
                            >
                              {action.icon && <action.icon className="h-4 w-4" />}
                              {action.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
