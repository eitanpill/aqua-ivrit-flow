import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, Clock, X } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";

interface WaitlistEntry {
  id: string;
  session_id: string;
  swimmer_id: string;
  expires_at: string;
  status: string;
  session?: {
    start_time: string;
    class_type?: { name: string };
  };
  swimmer?: {
    first_name: string;
    last_name: string;
  };
}

export function WaitlistNotification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["waitlist-notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waitlist" as any)
        .select(`
          *,
          session:sessions(start_time, class_type:class_types(name)),
          swimmer:swimmers(first_name, last_name)
        `)
        .eq("parent_id", user?.id)
        .eq("status", "notified")
        .gt("expires_at", new Date().toISOString()) as any;

      if (error) throw error;
      return (data || []) as WaitlistEntry[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Check every 30 seconds
  });

  const enrollFromWaitlistMutation = useMutation({
    mutationFn: async (entry: WaitlistEntry) => {
      // Create enrollment
      const { error: enrollError } = await supabase
        .from("enrollments" as any)
        .insert({
          session_id: entry.session_id,
          swimmer_id: entry.swimmer_id,
          enrolled_by: user?.id,
          status: "confirmed",
        } as any);

      if (enrollError) throw enrollError;

      // Update waitlist status
      const { error: waitlistError } = await supabase
        .from("waitlist" as any)
        .update({ status: "enrolled" } as any)
        .eq("id", entry.id) as any;

      if (waitlistError) throw waitlistError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["available-sessions"] });
      toast.success("נרשמת בהצלחה!");
    },
    onError: (error: any) => {
      toast.error(error.message || "שגיאה בהרשמה");
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("waitlist" as any)
        .update({ status: "expired" } as any)
        .eq("id", entryId) as any;

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist-notifications"] });
    },
  });

  if (notifications.length === 0) return null;

  return (
    <div className="space-y-3">
      {notifications.map((entry) => {
        const minutesLeft = differenceInMinutes(
          new Date(entry.expires_at),
          new Date()
        );

        return (
          <Card
            key={entry.id}
            className="border-green-500/50 bg-gradient-to-r from-green-500/10 to-emerald-500/10"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-green-500/20 p-2 animate-pulse">
                  <Bell className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    התפנה מקום! 🎉
                  </p>
                  <p className="text-sm text-green-700/80 dark:text-green-300/80 mt-1">
                    {entry.swimmer?.first_name} - {entry.session?.class_type?.name}
                    <br />
                    {entry.session &&
                      format(new Date(entry.session.start_time), "EEEE dd/MM בשעה HH:mm", {
                        locale: he,
                      })}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-sm text-amber-600">
                    <Clock className="h-3 w-3" />
                    נותרו {minutesLeft} דקות להרשמה
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => dismissMutation.mutate(entry.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => enrollFromWaitlistMutation.mutate(entry)}
                  disabled={enrollFromWaitlistMutation.isPending}
                >
                  לחץ להרשמה
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
