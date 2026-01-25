import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";

export interface DashboardStats {
  totalSwimmers: number;
  totalLocations: number;
  totalCoaches: number;
  todaySessions: number;
  totalRevenue?: number;
  activeEnrollments?: number;
}

export function useDashboardStats({ isAdmin }: { isAdmin: boolean }) {
  const { currentSchool } = useSchool();
  const schoolId = currentSchool?.id ?? null;

  return useQuery({
    queryKey: ["dashboard-stats", isAdmin, schoolId],
    queryFn: async (): Promise<DashboardStats> => {
      console.log("Fetching data for School ID:", schoolId);

      if (!schoolId) {
        return {
          totalSwimmers: 0,
          totalLocations: 0,
          totalCoaches: 0,
          todaySessions: 0,
          totalRevenue: 0,
          activeEnrollments: 0,
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Counts are ALWAYS filtered by school_id
      const swimmersQuery = supabase
        .from("swimmers")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId);

      const locationsQuery = supabase
        .from("locations")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId);

      const sessionsQuery = supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .gte("start_time", today.toISOString())
        .lt("start_time", tomorrow.toISOString());

      const coachesQuery = supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .in("role", ["coach", "admin"]);

      const [{ count: swimmersCount }, { count: locationsCount }, { count: todaySessionsCount }, { count: coachesCount }] =
        await Promise.all([swimmersQuery, locationsQuery, sessionsQuery, coachesQuery]);

      let totalRevenue = 0;
      let activeEnrollments = 0;

      if (isAdmin) {
        const { data: transactions, error: txError } = await supabase
          .from("transactions")
          .select("amount")
          .eq("school_id", schoolId)
          .eq("status", "completed");

        if (txError) throw txError;
        totalRevenue = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        const { count: enrollmentsCount, error: enrollmentsError } = await supabase
          .from("enrollments")
          .select("*", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("status", "confirmed");

        if (enrollmentsError) throw enrollmentsError;
        activeEnrollments = enrollmentsCount || 0;
      }

      return {
        totalSwimmers: swimmersCount || 0,
        totalLocations: locationsCount || 0,
        totalCoaches: coachesCount || 0,
        todaySessions: todaySessionsCount || 0,
        totalRevenue,
        activeEnrollments,
      };
    },
    enabled: !!schoolId,
  });
}
