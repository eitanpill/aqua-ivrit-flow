import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Gift } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { CancelEnrollmentButton } from "./CancelEnrollmentButton";
import { MakeUpTokensBanner } from "./MakeUpTokensBanner";

interface SwimmerEnrollmentsProps {
  swimmerId: string;
  swimmerName: string;
}

interface Enrollment {
  id: string;
  status: string;
  session: {
    id: string;
    start_time: string;
    end_time: string;
    class_type?: { name: string };
    resource?: { name: string; location?: { name: string } };
    coach?: { first_name: string; last_name: string };
  };
}

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function SwimmerEnrollments({ swimmerId, swimmerName }: SwimmerEnrollmentsProps) {
  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["swimmer-upcoming-enrollments", swimmerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments" as any)
        .select(`
          id,
          status,
          session:sessions(
            id,
            start_time,
            end_time,
            class_type:class_types(name),
            resource:resources(name, location:locations(name)),
            coach:profiles!sessions_coach_id_fkey(first_name, last_name)
          )
        `)
        .eq("swimmer_id", swimmerId)
        .in("status", ["confirmed", "pending"])
        .gte("session.start_time", new Date().toISOString())
        .order("session(start_time)") as any;

      if (error) throw error;
      // Filter out null sessions (past sessions that got filtered out)
      return ((data || []) as Enrollment[]).filter((e) => e.session);
    },
    enabled: !!swimmerId,
  });

  // Fetch make-up tokens count
  const { data: tokens = [] } = useQuery({
    queryKey: ["make-up-tokens", swimmerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("make_up_tokens" as any)
        .select("id")
        .eq("swimmer_id", swimmerId)
        .is("used_at", null)
        .gte("expiry_date", new Date().toISOString().split("T")[0]) as any;

      if (error) throw error;
      return data || [];
    },
    enabled: !!swimmerId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Make-up Tokens */}
      {tokens.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <Gift className="h-5 w-5 text-amber-600" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {tokens.length} שיעורי השלמה זמינים
          </span>
        </div>
      )}

      {/* Enrollments */}
      {enrollments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          אין הרשמות קרובות
        </p>
      ) : (
        <div className="space-y-2">
          {enrollments.slice(0, 3).map((enrollment) => {
            const sessionDate = new Date(enrollment.session.start_time);
            const dayName = HEBREW_DAYS[sessionDate.getDay()];

            return (
              <div
                key={enrollment.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {enrollment.session.class_type?.name || "שיעור שחייה"}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      יום {dayName} {format(sessionDate, "dd/MM", { locale: he })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(sessionDate, "HH:mm")}
                    </span>
                  </div>
                </div>
                <CancelEnrollmentButton
                  enrollmentId={enrollment.id}
                  sessionStartTime={enrollment.session.start_time}
                  swimmerName={swimmerName}
                />
              </div>
            );
          })}
          {enrollments.length > 3 && (
            <p className="text-xs text-muted-foreground text-center">
              +{enrollments.length - 3} הרשמות נוספות
            </p>
          )}
        </div>
      )}
    </div>
  );
}
