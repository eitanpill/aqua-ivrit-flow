import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users, Waves, Calendar, DollarSign, TrendingUp, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface DashboardStats {
  totalSwimmers: number;
  totalLocations: number;
  totalCoaches: number;
  todaySessions: number;
  totalRevenue?: number;
  activeEnrollments?: number;
}

export default function Dashboard() {
  const { isAdmin, isCoach, isCustomer, user } = useAuth();

  // Fetch real stats from database
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", isAdmin],
    queryFn: async (): Promise<DashboardStats> => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get swimmers count
      const { count: swimmersCount } = await supabase
        .from("swimmers")
        .select("*", { count: "exact", head: true });

      // Get locations count
      const { count: locationsCount } = await supabase
        .from("locations")
        .select("*", { count: "exact", head: true });

      // Get coaches count from user_roles
      const { count: coachesCount } = await supabase
        .from("user_roles" as any)
        .select("*", { count: "exact", head: true })
        .in("role", ["coach", "admin"]);

      // Get today's sessions
      const { count: todaySessionsCount } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .gte("start_time", today.toISOString())
        .lt("start_time", tomorrow.toISOString());

      let totalRevenue = 0;
      let activeEnrollments = 0;

      // Admin-only stats
      if (isAdmin) {
        // Get total revenue from transactions
        const { data: transactions } = await supabase
          .from("transactions")
          .select("amount")
          .eq("status", "completed");

        totalRevenue = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        // Get active enrollments
        const { count: enrollmentsCount } = await supabase
          .from("enrollments")
          .select("*", { count: "exact", head: true })
          .eq("status", "confirmed");

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
  });

  // Fetch recent activity
  const { data: recentEnrollments } = useQuery({
    queryKey: ["recent-enrollments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select(`
          id,
          created_at,
          status,
          swimmer:swimmers(first_name, last_name)
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      return data;
    },
    enabled: isAdmin || isCoach,
  });

  // Fetch upcoming sessions
  const { data: upcomingSessions } = useQuery({
    queryKey: ["upcoming-sessions"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("sessions")
        .select(`
          id,
          start_time,
          class_type:class_types(name),
          resource:resources(name, location:locations(name))
        `)
        .gte("start_time", now)
        .order("start_time", { ascending: true })
        .limit(3);

      return data;
    },
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "בוקר טוב";
    if (hour < 17) return "צהריים טובים";
    return "ערב טוב";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {getGreeting()}! 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin && "ברוכים הבאים לממשק הניהול של AquaFlow"}
          {isCoach && "ברוכים הבאים לממשק המאמן"}
          {isCustomer && "ברוכים הבאים ל-AquaFlow"}
        </p>
      </div>

      {/* Stats Grid - Different for each role */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Admin sees global stats */}
        {isAdmin && (
          <>
            <Card className="card-hover border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  סה"כ הכנסות
                </CardTitle>
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-success/10 text-success">
                  <DollarSign className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">₪{stats?.totalRevenue?.toLocaleString() || 0}</div>
              </CardContent>
            </Card>
            <Card className="card-hover border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  רישומים פעילים
                </CardTitle>
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.activeEnrollments || 0}</div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Common stats for staff */}
        {(isAdmin || isCoach) && (
          <>
            <Card className="card-hover border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  שחיינים רשומים
                </CardTitle>
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-accent/10 text-accent">
                  <Users className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.totalSwimmers || 0}</div>
              </CardContent>
            </Card>
            <Card className="card-hover border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  שיעורים היום
                </CardTitle>
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-warning/10 text-warning">
                  <Calendar className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.todaySessions || 0}</div>
              </CardContent>
            </Card>
          </>
        )}

        {isAdmin && (
          <>
            <Card className="card-hover border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  בריכות פעילות
                </CardTitle>
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.totalLocations || 0}</div>
              </CardContent>
            </Card>
            <Card className="card-hover border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  מאמנים
                </CardTitle>
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-secondary/10 text-secondary">
                  <Waves className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.totalCoaches || 0}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Customer Dashboard */}
      {isCustomer && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>השיעורים הבאים שלך</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>לחץ על "הזמנת שיעור" בתפריט כדי לקבוע שיעור</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>הילדים שלי</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>לחץ על "המשפחה שלי" בתפריט כדי להוסיף ילדים</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Staff Dashboard */}
      {(isAdmin || isCoach) && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>שיעורים קרובים</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingSessions?.length ? (
                <div className="space-y-4">
                  {upcomingSessions.map((session: any) => (
                    <div key={session.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <div className="h-12 w-12 rounded-lg gradient-primary flex items-center justify-center">
                        <Waves className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{session.class_type?.name || "שיעור"}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(session.start_time).toLocaleTimeString("he-IL", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          - {session.resource?.location?.name || ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>אין שיעורים קרובים</p>
                </div>
              )}
            </CardContent>
          </Card>

          {isAdmin && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>פעילות אחרונה</CardTitle>
              </CardHeader>
              <CardContent>
                {recentEnrollments?.length ? (
                  <div className="space-y-4">
                    {recentEnrollments.map((enrollment: any) => (
                      <div key={enrollment.id} className="flex items-center gap-4">
                        <div className="h-2 w-2 rounded-full bg-success" />
                        <p className="text-sm flex-1">
                          רישום חדש - {enrollment.swimmer?.first_name} {enrollment.swimmer?.last_name}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {new Date(enrollment.created_at).toLocaleDateString("he-IL")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>אין פעילות אחרונה</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
