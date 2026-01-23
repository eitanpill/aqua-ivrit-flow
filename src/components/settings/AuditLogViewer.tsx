import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { 
  Search, 
  RefreshCw, 
  User, 
  FileText, 
  Trash2, 
  Edit, 
  Plus, 
  RotateCcw,
  Calendar,
  Filter,
  Shield
} from "lucide-react";

interface AuditLog {
  id: string;
  user_id: string;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const actionLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  soft_delete: { label: "מחיקה", icon: <Trash2 className="h-4 w-4" />, color: "destructive" },
  restore: { label: "שחזור", icon: <RotateCcw className="h-4 w-4" />, color: "default" },
  create: { label: "יצירה", icon: <Plus className="h-4 w-4" />, color: "default" },
  update: { label: "עדכון", icon: <Edit className="h-4 w-4" />, color: "secondary" },
  cancel_session: { label: "ביטול שיעור", icon: <Calendar className="h-4 w-4" />, color: "destructive" },
  cancel_enrollment: { label: "ביטול הרשמה", icon: <Trash2 className="h-4 w-4" />, color: "destructive" },
  payment: { label: "תשלום", icon: <FileText className="h-4 w-4" />, color: "default" },
};

const entityTypeLabels: Record<string, string> = {
  swimmer: "שחיין",
  session: "שיעור",
  product: "מוצר",
  profile: "משתמש",
  enrollment: "הרשמה",
  charge: "חיוב",
  subscription: "מנוי",
};

export function AuditLogViewer() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', searchTerm, actionFilter, entityFilter],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (actionFilter && actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      if (entityFilter && entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Filter by search term in memory
      if (searchTerm) {
        return (data as AuditLog[]).filter(log => 
          log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.entity_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.action.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      return data as AuditLog[];
    },
  });

  const getActionInfo = (action: string) => {
    return actionLabels[action] || { 
      label: action, 
      icon: <FileText className="h-4 w-4" />, 
      color: "secondary" 
    };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>יומן ביקורת</CardTitle>
              <CardDescription>צפייה בהיסטוריית הפעולות במערכת</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 ml-2" />
            רענון
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש לפי שם משתמש או פריט..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
          
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 ml-2" />
              <SelectValue placeholder="סוג פעולה" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הפעולות</SelectItem>
              <SelectItem value="soft_delete">מחיקות</SelectItem>
              <SelectItem value="restore">שחזורים</SelectItem>
              <SelectItem value="create">יצירות</SelectItem>
              <SelectItem value="update">עדכונים</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 ml-2" />
              <SelectValue placeholder="סוג פריט" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הפריטים</SelectItem>
              <SelectItem value="swimmer">שחיינים</SelectItem>
              <SelectItem value="session">שיעורים</SelectItem>
              <SelectItem value="product">מוצרים</SelectItem>
              <SelectItem value="profile">משתמשים</SelectItem>
              <SelectItem value="enrollment">הרשמות</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Log entries */}
        <ScrollArea className="h-[500px] rounded-md border">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="divide-y">
              {logs.map((log) => {
                const actionInfo = getActionInfo(log.action);
                return (
                  <div 
                    key={log.id} 
                    className="p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                          {actionInfo.icon}
                        </div>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={actionInfo.color as "default" | "secondary" | "destructive"}>
                              {actionInfo.label}
                            </Badge>
                            <Badge variant="outline">
                              {entityTypeLabels[log.entity_type] || log.entity_type}
                            </Badge>
                            {log.entity_name && (
                              <span className="text-sm font-medium">
                                {log.entity_name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{log.user_name || 'משתמש לא ידוע'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground text-left shrink-0">
                        {format(new Date(log.created_at), 'dd/MM/yyyy', { locale: he })}
                        <br />
                        {format(new Date(log.created_at), 'HH:mm', { locale: he })}
                      </div>
                    </div>
                    
                    {/* Details expandable - show if there's meaningful data */}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          פרטים נוספים
                        </summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto" dir="ltr">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2" />
              <p>אין רשומות ביומן הביקורת</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}