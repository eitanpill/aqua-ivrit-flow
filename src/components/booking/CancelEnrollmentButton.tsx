import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { X, Gift, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { differenceInHours } from "date-fns";

interface CancelEnrollmentButtonProps {
  enrollmentId: string;
  sessionStartTime: string;
  swimmerName: string;
  onSuccess?: () => void;
}

export function CancelEnrollmentButton({
  enrollmentId,
  sessionStartTime,
  swimmerName,
  onSuccess,
}: CancelEnrollmentButtonProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Check if cancellation is within policy window (24 hours before)
  const hoursUntilSession = differenceInHours(
    new Date(sessionStartTime),
    new Date()
  );
  const willReceiveToken = hoursUntilSession >= 24;

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("enrollments" as any)
        .update({ status: "cancelled" } as any)
        .eq("id", enrollmentId) as any;

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swimmer-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["available-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["make-up-tokens"] });

      if (willReceiveToken) {
        toast.success("ההרשמה בוטלה ואסימון השלמה הונפק!", {
          description: "תוכל להשתמש באסימון להרשמה לשיעור אחר",
          icon: <Gift className="h-5 w-5 text-amber-500" />,
        });
      } else {
        toast.success("ההרשמה בוטלה", {
          description: "לא הונפק אסימון השלמה (ביטול מאוחר)",
        });
      }

      setIsOpen(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "שגיאה בביטול ההרשמה");
    },
  });

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive gap-2">
          <X className="h-4 w-4" />
          ביטול
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>ביטול הרשמה</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                האם לבטל את ההרשמה של {swimmerName} לשיעור זה?
              </p>

              {willReceiveToken ? (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-700 dark:text-green-300">
                  <Gift className="h-5 w-5" />
                  <span className="text-sm">
                    יונפק אסימון השלמה (ביטול יותר מ-24 שעות לפני השיעור)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-sm">
                    לא יונפק אסימון השלמה (ביטול פחות מ-24 שעות לפני השיעור)
                  </span>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2">
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              cancelMutation.mutate();
            }}
            disabled={cancelMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {cancelMutation.isPending ? "מבטל..." : "אישור ביטול"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
