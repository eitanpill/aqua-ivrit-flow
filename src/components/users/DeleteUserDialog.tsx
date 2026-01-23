import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface DeleteUserDialogProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteUserDialog({ user, open, onOpenChange }: DeleteUserDialogProps) {
  const queryClient = useQueryClient();

  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      
      const { data, error } = await supabase.rpc("admin_delete_user" as any, {
        p_user_id: user.id,
      });

      if (error) throw error;
      
      const result = data as unknown as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || "שגיאה במחיקת המשתמש");
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success("המשתמש נמחק בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (!user) return null;

  const userName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "ללא שם";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">מחיקת משתמש</AlertDialogTitle>
          <AlertDialogDescription>
            האם אתה בטוח שברצונך למחוק את המשתמש <strong>{userName}</strong>?
            <br />
            <span className="text-destructive font-medium">
              פעולה זו אינה ניתנת לביטול!
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              deleteUserMutation.mutate();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteUserMutation.isPending}
          >
            {deleteUserMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            )}
            מחק משתמש
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
