import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Clock, Check, X } from "lucide-react";
import { toast } from "sonner";

interface WaitlistButtonProps {
  sessionId: string;
  swimmerId: string;
  isOnWaitlist?: boolean;
  waitlistPosition?: number;
  onSuccess?: () => void;
}

export function WaitlistButton({
  sessionId,
  swimmerId,
  isOnWaitlist = false,
  waitlistPosition,
  onSuccess,
}: WaitlistButtonProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);

  const joinWaitlistMutation = useMutation({
    mutationFn: async () => {
      // Get next position
      const { data: positionData } = await (supabase.rpc as any)(
        "get_next_waitlist_position",
        { p_session_id: sessionId }
      );

      const { error } = await supabase.from("waitlist" as any).insert({
        session_id: sessionId,
        swimmer_id: swimmerId,
        parent_id: user?.id,
        position: positionData || 1,
        status: "waiting",
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
      toast.success("נוספת לרשימת ההמתנה!");
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "שגיאה בהצטרפות לרשימת המתנה");
    },
  });

  const leaveWaitlistMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("waitlist" as any)
        .update({ status: "cancelled" } as any)
        .eq("session_id", sessionId)
        .eq("swimmer_id", swimmerId) as any;

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
      toast.success("הוסרת מרשימת ההמתנה");
      setShowConfirm(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "שגיאה בהסרה מרשימת המתנה");
    },
  });

  if (isOnWaitlist) {
    if (showConfirm) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">בטוח?</span>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => leaveWaitlistMutation.mutate()}
            disabled={leaveWaitlistMutation.isPending}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowConfirm(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setShowConfirm(true)}
        className="gap-2"
      >
        <Clock className="h-4 w-4" />
        מקום {waitlistPosition} בתור
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => joinWaitlistMutation.mutate()}
      disabled={joinWaitlistMutation.isPending}
      className="gap-2"
    >
      <Clock className="h-4 w-4" />
      הצטרף להמתנה
    </Button>
  );
}
