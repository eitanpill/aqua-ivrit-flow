import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, User, CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { CancelEnrollmentButton } from "@/components/booking/CancelEnrollmentButton";

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

interface Enrollment {
  id: string;
  status: string;
  swimmer: {
    id: string;
    first_name: string;
    last_name: string;
  };
  session: {
    id: string;
    start_time: string;
    end_time: string;
    class_type?: { name: string };
    resource?: { name: string; location?: { name: string } };
    coach?: { first_name: string; last_name: string };
  };
}

interface MyBookingsProps {
  limit?: number;
  showViewAll?: boolean;
}

export function MyBookings({ limit = 5, showViewAll = true }: MyBookingsProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch all enrollments for user's swimmers
  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["my-family-bookings", user?.id],
    queryFn: async () => {
      // First get user's swimmers
      const { data: swimmers, error: swimmersError } = await supabase
        .from("swimmers")
        .select("id")
        .eq("parent_id", user?.id);

      if (swimmersError) throw swimmersError;
      if (!swimmers || swimmers.length === 0) return [];

      const swimmerIds = swimmers.map((s) => s.id);

      // Then get all upcoming enrollments for these swimmers
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          id,
          status,
          swimmer:swimmers(id, first_name, last_name),
          session:sessions(
            id,
            start_time,
            end_time,
            class_type:class_types(name),
            resource:resources(name, location:locations(name)),
            coach:profiles!sessions_coach_id_fkey(first_name, last_name)
          )
        `)
        .in("swimmer_id", swimmerIds)
        .in("status", ["confirmed", "pending"])
        .gte("session.start_time", new Date().toISOString())
        .order("session(start_time)");

      if (error) throw error;

      // Filter out null sessions and cast type
      return ((data || []) as unknown as Enrollment[]).filter((e) => e.session);
    },
    enabled: !!user?.id,
  });

  const displayedEnrollments = limit ? enrollments.slice(0, limit) : enrollments;

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            השיעורים שלי
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          השיעורים שלי
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/booking")}
          className="gap-2"
        >
          <CalendarPlus className="h-4 w-4" />
          הזמן שיעור
        </Button>
      </CardHeader>
      <CardContent>
        {enrollments.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">אין שיעורים קרובים</p>
            <Button onClick={() => navigate("/booking")} className="gap-2">
              <CalendarPlus className="h-4 w-4" />
              הזמן שיעור ראשון
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedEnrollments.map((enrollment) => {
              const sessionDate = new Date(enrollment.session.start_time);
              const dayName = HEBREW_DAYS[sessionDate.getDay()];

              return (
                <div
                  key={enrollment.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {enrollment.session.class_type?.name || "שיעור שחייה"}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {enrollment.swimmer.first_name}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        יום {dayName} {format(sessionDate, "dd/MM", { locale: he })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(sessionDate, "HH:mm")}
                      </span>
                      {enrollment.session.resource?.location?.name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {enrollment.session.resource.location.name}
                        </span>
                      )}
                      {enrollment.session.coach && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {enrollment.session.coach.first_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <CancelEnrollmentButton
                    enrollmentId={enrollment.id}
                    sessionStartTime={enrollment.session.start_time}
                    swimmerName={`${enrollment.swimmer.first_name} ${enrollment.swimmer.last_name}`}
                  />
                </div>
              );
            })}
            {showViewAll && enrollments.length > limit && (
              <Button
                variant="ghost"
                className="w-full mt-2"
                onClick={() => navigate("/family")}
              >
                צפה בכל {enrollments.length} ההרשמות
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
