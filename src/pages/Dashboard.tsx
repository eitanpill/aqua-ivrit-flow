import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Waves, Calendar, DollarSign, TrendingUp, Loader2, UserCircle, CreditCard, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { MyBookings } from "@/components/customer/MyBookings";
import { EmergencyOperations } from "@/components/admin/EmergencyOperations";
import { useSchool } from "@/contexts/SchoolContext";
import { Badge } from "@/components/ui/badge";

interface DashboardStats {
  totalSwimmers: number;
  totalLocations: number;
  totalCoaches: number;
  todaySessions: number;
  totalRevenue?: number;
  activeEnrollments?: number;
}

export default function Dashboard() {
  const { isAdmin, isCoach, isCustomer, isStaff, user } = useAuth();
  const navigate = useNavigate();
  const { activeSchoolId, isSuperAdmin, allSchools, currentSchool } = useSchool();

  // Get active school name for display
  const activeSchoolName = isSuperAdmin 
    ? allSchools.find(s => s.id === activeSchoolId)?.name 
    : currentSchool?.name;

  // Fetch real stats from database - filtered by activeSchoolId
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", isAdmin, activeSchoolId],
    queryFn: async (): Promise<DashboardStats> => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Build base queries with school_id filter
      let swimmersQuery = supabase.from("swimmers").select("*", { count: "exact", head: true });
      let locationsQuery = supabase.from("locations").select("*", { count: "exact", head: true });
      let sessionsQuery = supabase.from("sessions").select("*", { count: "exact", head: true })
        .gte("start_time", today.toISOString())
        .lt("start_time", tomorrow.toISOString());
      
      // Apply school filter if activeSchoolId is set
      if (activeSchoolId) {
        swimmersQuery = swimmersQuery.eq("school_id", activeSchoolId);
        locationsQuery = locationsQuery.eq("school_id", activeSchoolId);
        sessionsQuery = sessionsQuery.eq("school_id", activeSchoolId);
      }

      // Get swimmers count
      const { count: swimmersCount } = await swimmersQuery;

      // Get locations count
      const { count: locationsCount } = await locationsQuery;

      // Get coaches count from user_roles
      const { count: coachesCount } = await supabase
        .from("user_roles" as any)
        .select("*", { count: "exact", head: true })
        .in("role", ["coach", "admin"]);

      // Get today's sessions
      const { count: todaySessionsCount } = await sessionsQuery;

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

        // Get active enrollments with school filter
        let enrollmentsQuery = supabase
          .from("enrollments")
          .select("*", { count: "exact", head: true })
          .eq("status", "confirmed");
        
        if (activeSchoolId) {
          enrollmentsQuery = enrollmentsQuery.eq("school_id", activeSchoolId);
        }

        const { count: enrollmentsCount } = await enrollmentsQuery;
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
    enabled: !!activeSchoolId || !isSuperAdmin, // Run if we have a school or not super admin
  });

  // Fetch recent activity - filtered by school_id
  const { data: recentEnrollments } = useQuery({
    queryKey: ["recent-enrollments", activeSchoolId],
    queryFn: async () => {
      let query = supabase
        .from("enrollments")
        .select(`
          id,
          created_at,
          status,
          swimmer:swimmers(first_name, last_name)
        `)
        .order("created_at", { ascending: false })
        .limit(5);
      
      // CRITICAL: Filter by school_id
      if (activeSchoolId) {
        query = query.eq("school_id", activeSchoolId);
      }

      const { data } = await query;
      return data;
    },
    enabled: (isAdmin || isCoach) && !!activeSchoolId,
  });

  // Fetch upcoming sessions - filtered by school_id
  const { data: upcomingSessions } = useQuery({
    queryKey: ["upcoming-sessions", activeSchoolId],
    queryFn: async () => {
      const now = new Date().toISOString();
      let query = supabase
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
      
      // CRITICAL: Filter by school_id
      if (activeSchoolId) {
        query = query.eq("school_id", activeSchoolId);
      }

      const { data } = await query;
      return data;
    },
    enabled: !!activeSchoolId,
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {getGreeting()}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin && "ברוכים הבאים לממשק הניהול של AquaFlow"}
            {isCoach && "ברוכים הבאים לממשק המאמן"}
            {isCustomer && !isStaff && "ברוכים הבאים ל-AquaFlow"}
          </p>
        </div>
        {isSuperAdmin && activeSchoolName && (
          <Badge variant="outline" className="gap-2 py-2 px-3 text-sm">
            <Building2 className="h-4 w-4" />
            {activeSchoolName}
          </Badge>
        )}
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
      {isCustomer && !isStaff && (
        <CustomerDashboard userId={user?.id} navigate={navigate} />
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

      {/* Emergency Operations - Admin Only */}
      {isAdmin && (
        <div className="grid gap-6 md:grid-cols-3">
          <EmergencyOperations />
        </div>
      )}
    </div>
  );
}

// Customer-specific dashboard component
function CustomerDashboard({ userId, navigate }: { userId?: string; navigate: (path: string) => void }) {
  // Fetch customer's swimmers
  const { data: swimmers = [], isLoading: swimmersLoading } = useQuery({
    queryKey: ["my-swimmers-dashboard", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("swimmers")
        .select("id, first_name, last_name, skill_level")
        .eq("parent_id", userId)
        .order("first_name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Fetch wallet balance
  const { data: wallet } = useQuery({
    queryKey: ["my-wallet-dashboard", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_wallets")
        .select("credits_balance")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const SKILL_LEVELS: Record<string, string> = {
    beginner: "מתחיל",
    intermediate: "בינוני",
    advanced: "מתקדם",
    competitive: "תחרותי",
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats for Customer */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="card-hover border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              הילדים שלי
            </CardTitle>
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
              <UserCircle className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{swimmers.length}</div>
            <Button
              variant="link"
              className="p-0 h-auto text-sm text-primary"
              onClick={() => navigate("/family")}
            >
              ניהול הילדים →
            </Button>
          </CardContent>
        </Card>

        <Card className="card-hover border-border/50 bg-gradient-to-bl from-primary/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              קרדיטים זמינים
            </CardTitle>
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {wallet?.credits_balance ?? 0}
            </div>
            <Button
              variant="link"
              className="p-0 h-auto text-sm text-primary"
              onClick={() => navigate("/billing")}
            >
              רכישת קרדיטים →
            </Button>
          </CardContent>
        </Card>

        <Card className="card-hover border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              הזמנה מהירה
            </CardTitle>
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-accent/10 text-accent">
              <Calendar className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate("/booking")}
              className="w-full"
            >
              הזמן שיעור חדש
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* My Bookings - Real data */}
        <MyBookings limit={4} />

        {/* My Children */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" />
              הילדים שלי
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/family")}
            >
              ניהול
            </Button>
          </CardHeader>
          <CardContent>
            {swimmersLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : swimmers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground mb-4">עדיין לא הוספת ילדים</p>
                <Button onClick={() => navigate("/family")}>
                  הוסף ילד ראשון
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {swimmers.slice(0, 3).map((swimmer: any) => (
                  <div
                    key={swimmer.id}
                    className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {swimmer.first_name} {swimmer.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {SKILL_LEVELS[swimmer.skill_level] || "מתחיל"}
                      </p>
                    </div>
                  </div>
                ))}
                {swimmers.length > 3 && (
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => navigate("/family")}
                  >
                    צפה בכל {swimmers.length} הילדים
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
