/**
 * useNotifications - Hook for sending notifications to parents
 * Integrates with the school's webhook via dispatch-notification edge function
 */

import { useSchool } from "@/contexts/SchoolContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NotificationData {
  parentName: string;
  parentPhone?: string;
  swimmerName?: string;
  sessionDate?: string;
  sessionTime?: string;
  locationName?: string;
  coachName?: string;
  className?: string;
  reason?: string;
  originalCoachName?: string;
  newCoachName?: string;
  oldTime?: string;
  newTime?: string;
}

type NotificationEventType = 
  | "class_cancelled"
  | "new_registration"
  | "waitlist_spot_available"
  | "session_reminder"
  | "makeup_class_available"
  | "payment_due"
  | "coach_substituted"
  | "session_time_changed"
  | "daily_reminder";

export function useNotifications() {
  const { activeSchoolId } = useSchool();

  /**
   * Send a notification to the school's webhook
   */
  const sendNotification = async (
    eventType: NotificationEventType,
    data: NotificationData
  ): Promise<{ success: boolean; error?: string }> => {
    if (!activeSchoolId) {
      console.warn("[useNotifications] No active school ID");
      return { success: false, error: "לא נבחר בית ספר" };
    }

    try {
      const { data: result, error } = await supabase.functions.invoke("dispatch-notification", {
        body: {
          event_type: eventType,
          data: {
            parent_name: data.parentName,
            parent_phone: data.parentPhone || "",
            child_name: data.swimmerName,
            class_time: data.sessionTime 
              ? `${data.sessionDate || ""} ${data.sessionTime}` 
              : data.sessionDate,
            coach_name: data.coachName,
            class_type: data.className,
            location: data.locationName,
            reason: data.reason,
            original_coach_name: data.originalCoachName,
            new_coach_name: data.newCoachName,
            old_time: data.oldTime,
            new_time: data.newTime,
          },
          school_id: activeSchoolId,
          is_test: false,
        },
      });

      if (error) {
        console.error("[useNotifications] Error:", error);
        return { success: false, error: error.message };
      }

      if (!result?.success) {
        console.warn("[useNotifications] Webhook failed:", result?.error);
        // Don't fail silently - webhook might not be configured
        return { success: false, error: result?.error };
      }

      return { success: true };
    } catch (err) {
      console.error("[useNotifications] Exception:", err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "שגיאה לא ידועה" 
      };
    }
  };

  /**
   * Send notification to all enrolled parents for a session
   */
  const notifySessionParents = async (
    sessionId: string,
    eventType: NotificationEventType,
    additionalData: Partial<NotificationData> = {}
  ): Promise<{ sentCount: number; failedCount: number }> => {
    try {
      // Fetch session details with enrollments
      const { data: sessionDetails } = await (supabase.rpc as any)("get_session_enrollment_details", {
        p_session_id: sessionId,
      });

      if (!sessionDetails?.enrolled?.length) {
        console.log("[useNotifications] No enrolled students to notify");
        return { sentCount: 0, failedCount: 0 };
      }

      const session = sessionDetails.session;
      let sentCount = 0;
      let failedCount = 0;

      // Send notification to each enrolled parent
      for (const enrollment of sessionDetails.enrolled) {
        const result = await sendNotification(eventType, {
          parentName: enrollment.parent_name || "הורה יקר",
          parentPhone: enrollment.parent_phone,
          swimmerName: enrollment.swimmer_name,
          sessionDate: new Date(session.start_time).toLocaleDateString("he-IL"),
          sessionTime: new Date(session.start_time).toLocaleTimeString("he-IL", { 
            hour: "2-digit", 
            minute: "2-digit" 
          }),
          locationName: session.location_name || session.resource_name,
          coachName: session.coach_name,
          className: session.class_type_name,
          ...additionalData,
        });

        if (result.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      }

      return { sentCount, failedCount };
    } catch (err) {
      console.error("[useNotifications] Error notifying session parents:", err);
      return { sentCount: 0, failedCount: 0 };
    }
  };

  /**
   * Notify parents about session cancellation
   */
  const notifyCancellation = async (
    sessionId: string,
    reason?: string
  ): Promise<void> => {
    const result = await notifySessionParents(sessionId, "class_cancelled", { reason });
    
    if (result.sentCount > 0) {
      toast.success(`נשלחו ${result.sentCount} הודעות ביטול להורים`);
    }
    if (result.failedCount > 0) {
      toast.warning(`${result.failedCount} הודעות נכשלו`);
    }
  };

  /**
   * Notify parents about coach substitution
   */
  const notifyCoachChange = async (
    sessionId: string,
    originalCoachName: string,
    newCoachName: string
  ): Promise<void> => {
    const result = await notifySessionParents(sessionId, "coach_substituted", {
      originalCoachName,
      newCoachName,
      coachName: newCoachName,
    });
    
    if (result.sentCount > 0) {
      toast.success(`נשלחו ${result.sentCount} הודעות על החלפת מאמן`);
    }
  };

  /**
   * Notify parents about time change
   */
  const notifyTimeChange = async (
    sessionId: string,
    oldTime: string,
    newTime: string
  ): Promise<void> => {
    const result = await notifySessionParents(sessionId, "session_time_changed", {
      oldTime,
      newTime,
      sessionTime: newTime,
    });
    
    if (result.sentCount > 0) {
      toast.success(`נשלחו ${result.sentCount} הודעות על שינוי שעה`);
    }
  };

  return {
    sendNotification,
    notifySessionParents,
    notifyCancellation,
    notifyCoachChange,
    notifyTimeChange,
  };
}
