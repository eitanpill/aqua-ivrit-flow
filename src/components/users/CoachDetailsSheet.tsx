import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Calendar,
  Settings,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  Wallet,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { he } from "date-fns/locale";

interface CoachDetailsSheetProps {
  coachId: string | null;
  coachName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CoachRate {
  id: string;
  rate_per_hour: number;
  per_student_bonus: number;
  effective_from: string;
  effective_to: string | null;
}

interface CoachSession {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  is_cancelled: boolean;
  class_type: { name: string } | null;
  resource: { name: string } | null;
  enrolled_count: number;
  attended_count: number;
}

export function CoachDetailsSheet({
  coachId,
  coachName,
  open,
  onOpenChange,
}: CoachDetailsSheetProps) {
  const queryClient = useQueryClient();
  const [baseRate, setBaseRate] = useState("");
  const [perStudentBonus, setPerStudentBonus] = useState("");

  // Fetch coach rates
  const { data: currentRate, isLoading: ratesLoading } = useQuery({
    queryKey: ["coach-rate", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_rates")
        .select("*")
        .eq("coach_id", coachId!)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBaseRate(data.rate_per_hour?.toString() || "");
        setPerStudentBonus(data.per_student_bonus?.toString() || "");
      }

      return data as CoachRate | null;
    },
    enabled: !!coachId && open,
  });

  // Fetch coach sessions with attendance stats
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["coach-sessions", coachId],
    queryFn: async () => {
      const now = new Date();
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

      const { data: sessionsData, error } = await supabase
        .from("sessions")
        .select(`
          id,
          start_time,
          end_time,
          status,
          is_cancelled,
          class_type:class_types(name),
          resource:resources(name)
        `)
        .eq("coach_id", coachId!)
        .gte("start_time", monthStart)
        .lte("start_time", monthEnd + "T23:59:59")
        .order("start_time", { ascending: true });

      if (error) throw error;

      // Get attendance counts for each session
      const sessionsWithStats = await Promise.all(
        (sessionsData || []).map(async (session) => {
          const { count: enrolledCount } = await supabase
            .from("enrollments")
            .select("*", { count: "exact", head: true })
            .eq("session_id", session.id)
            .neq("status", "cancelled");

          const { count: attendedCount } = await supabase
            .from("attendance")
            .select("*", { count: "exact", head: true })
            .eq("session_id", session.id)
            .eq("status", "present");

          return {
            ...session,
            enrolled_count: enrolledCount || 0,
            attended_count: attendedCount || 0,
          };
        })
      );

      return sessionsWithStats as CoachSession[];
    },
    enabled: !!coachId && open,
  });

  // Save rate mutation
  const saveRateMutation = useMutation({
    mutationFn: async () => {
      const { data: schoolId } = await supabase.rpc("get_user_school_id");

      // Insert new rate
      const { error } = await supabase.from("coach_rates").insert({
        coach_id: coachId!,
        rate_per_hour: parseFloat(baseRate) || 0,
        per_student_bonus: parseFloat(perStudentBonus) || 0,
        effective_from: format(new Date(), "yyyy-MM-dd"),
        school_id: schoolId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-rate", coachId] });
      queryClient.invalidateQueries({ queryKey: ["payroll-summary"] });
      toast.success("הגדרות השכר נשמרו בהצלחה");
    },
    onError: () => {
      toast.error("שגיאה בשמירת הגדרות השכר");
    },
  });

  const upcomingSessions = sessions?.filter(
    (s) => new Date(s.start_time) > new Date() && !s.is_cancelled
  );
  const completedSessions = sessions?.filter((s) => s.status === "completed");
  const totalAttended = completedSessions?.reduce((sum, s) => sum + s.attended_count, 0) || 0;
  const totalEnrolled = completedSessions?.reduce((sum, s) => sum + s.enrolled_count, 0) || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {coachName}
          </SheetTitle>
          <SheetDescription>פרטי מאמן ונתוני פעילות</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="activity" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              פעילות
            </TabsTrigger>
            <TabsTrigger value="payroll" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              הגדרות שכר
            </TabsTrigger>
          </TabsList>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4 mt-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-border/50">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">
                      {completedSessions?.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">שיעורים הושלמו</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {upcomingSessions?.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">שיעורים קרובים</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {totalEnrolled > 0 ? `${totalAttended}/${totalEnrolled}` : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">נוכחות</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sessions List */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">שיעורים החודש</CardTitle>
                <CardDescription>
                  {format(new Date(), "MMMM yyyy", { locale: he })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !sessions?.length ? (
                  <p className="text-center text-muted-foreground py-8">
                    אין שיעורים מתוכננים החודש
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          session.is_cancelled
                            ? "bg-red-50 border-red-200 dark:bg-red-900/10"
                            : session.status === "completed"
                            ? "bg-green-50 border-green-200 dark:bg-green-900/10"
                            : "bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-medium text-sm">
                              {session.class_type?.name || "שיעור"}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(session.start_time), "dd/MM HH:mm")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.status === "completed" && (
                            <Badge variant="outline" className="text-xs">
                              {session.attended_count}/{session.enrolled_count}
                            </Badge>
                          )}
                          {session.is_cancelled ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : session.status === "completed" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payroll Settings Tab */}
          <TabsContent value="payroll" className="space-y-4 mt-4">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  הגדרות שכר
                </CardTitle>
                <CardDescription>
                  הגדרת תעריפי שכר למאמן
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {ratesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="baseRate">תעריף בסיס לשיעור (₪)</Label>
                      <Input
                        id="baseRate"
                        type="number"
                        min="0"
                        step="1"
                        value={baseRate}
                        onChange={(e) => setBaseRate(e.target.value)}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">
                        סכום קבוע שהמאמן מקבל על כל שיעור שהושלם
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="perStudent">בונוס לתלמיד (₪)</Label>
                      <Input
                        id="perStudent"
                        type="number"
                        min="0"
                        step="0.5"
                        value={perStudentBonus}
                        onChange={(e) => setPerStudentBonus(e.target.value)}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">
                        סכום נוסף על כל תלמיד שהשתתף בפועל בשיעור
                      </p>
                    </div>

                    {currentRate && (
                      <div className="p-3 bg-muted/50 rounded-lg text-sm">
                        <p className="text-muted-foreground">
                          תעריף נוכחי בתוקף מ-{" "}
                          {new Date(currentRate.effective_from).toLocaleDateString("he-IL")}
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={() => saveRateMutation.mutate()}
                      disabled={saveRateMutation.isPending}
                      className="w-full"
                    >
                      {saveRateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 ml-2" />
                      )}
                      שמור הגדרות
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Formula Explanation */}
            <Card className="border-border/50 bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">נוסחת חישוב השכר</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <p className="font-mono bg-background p-2 rounded text-center">
                    (שיעורים × בסיס) + (תלמידים × בונוס) + התאמות
                  </p>
                  <p className="text-muted-foreground text-xs text-center mt-2">
                    החישוב מתבצע אוטומטית בדוח השכר החודשי
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
