import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { 
  Trash2, 
  RotateCcw, 
  RefreshCw, 
  User, 
  Calendar,
  Package,
  Users,
  AlertTriangle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeletedItem {
  entity_type: string;
  entity_id: string;
  name: string;
  deleted_at: string;
  deleted_by: string;
  deleted_by_name: string;
}

const entityIcons: Record<string, React.ReactNode> = {
  swimmer: <Users className="h-4 w-4" />,
  session: <Calendar className="h-4 w-4" />,
  product: <Package className="h-4 w-4" />,
  profile: <User className="h-4 w-4" />,
};

const entityLabels: Record<string, string> = {
  swimmer: "שחיין",
  session: "שיעור",
  product: "מוצר",
  profile: "משתמש",
};

export function DeletedItemsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [restoreItem, setRestoreItem] = useState<DeletedItem | null>(null);

  const { data: deletedItems, isLoading, refetch } = useQuery({
    queryKey: ['deleted-items'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_deleted_items');
      if (error) throw error;
      return data as DeletedItem[];
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (item: DeletedItem) => {
      const { data, error } = await (supabase.rpc as any)('restore_deleted_entity', {
        p_entity_type: item.entity_type,
        p_entity_id: item.entity_id
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'שגיאה בשחזור');
      
      return data;
    },
    onSuccess: () => {
      toast({
        title: "שוחזר בהצלחה",
        description: "הפריט שוחזר למערכת",
      });
      queryClient.invalidateQueries({ queryKey: ['deleted-items'] });
      setRestoreItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: "שגיאה בשחזור",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>פריטים שנמחקו</CardTitle>
                <CardDescription>ניהול ושחזור פריטים שנמחקו מהמערכת</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 ml-2" />
              רענון
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : deletedItems && deletedItems.length > 0 ? (
              <div className="space-y-3">
                {deletedItems.map((item) => (
                  <div 
                    key={`${item.entity_type}-${item.entity_id}`}
                    className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        {entityIcons[item.entity_type] || <Trash2 className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.name || 'ללא שם'}</span>
                          <Badge variant="outline">
                            {entityLabels[item.entity_type] || item.entity_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>נמחק ע"י {item.deleted_by_name}</span>
                          <span>•</span>
                          <span>
                            {format(new Date(item.deleted_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setRestoreItem(item)}
                    >
                      <RotateCcw className="h-4 w-4 ml-2" />
                      שחזר
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Trash2 className="h-8 w-8 mb-2" />
                <p>אין פריטים מחוקים</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoreItem} onOpenChange={() => setRestoreItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              שחזור פריט
            </AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך לשחזר את{" "}
              <strong>{restoreItem?.name}</strong>?
              <br />
              הפריט יחזור להיות פעיל במערכת.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreItem && restoreMutation.mutate(restoreItem)}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? "משחזר..." : "שחזר"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}