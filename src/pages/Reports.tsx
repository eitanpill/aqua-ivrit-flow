import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Download,
  Calendar,
  Clock,
  ClipboardList
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { he } from "date-fns/locale";

const ATTENDANCE_STATUS_HEBREW: Record<string, string> = {
  present: "נוכח",
  absent: "נעדר",
  late: "איחר",
  excused: "נעדר מוצדק",
};

const Reports = () => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const monthStart = startOfMonth(new Date(selectedMonth));
  const monthEnd = endOfMonth(new Date(selectedMonth));

  // Fetch monthly revenue from transactions
  const { data: revenueData } = useQuery({
    queryKey: ["monthly-revenue", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("amount")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString())
        .eq("status", "completed");

      if (error) throw error;
      const total = data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      return total;
    },
  });

  // Fetch active swimmers count
  const { data: activeSwimmersCount } = useQuery({
    queryKey: ["active-swimmers", selectedMonth],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("enrollments")
        .select("swimmer_id", { count: "exact", head: true })
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString())
        .in("status", ["confirmed", "attended"]);

      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch occupancy rate
  const { data: occupancyData } = useQuery({
    queryKey: ["occupancy-rate", selectedMonth],
    queryFn: async () => {
      const { data: sessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("id, max_participants")
        .gte("start_time", monthStart.toISOString())
        .lte("start_time", monthEnd.toISOString())
        .eq("status", "completed");

      if (sessionsError) throw sessionsError;

      if (!sessions || sessions.length === 0) return 0;

      const sessionIds = sessions.map((s) => s.id);
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("enrollments")
        .select("session_id")
        .in("session_id", sessionIds)
        .in("status", ["confirmed", "attended"]);

      if (enrollmentsError) throw enrollmentsError;

      const totalCapacity = sessions.reduce(
        (sum, s) => sum + (s.max_participants || 4),
        0
      );
      const totalEnrollments = enrollments?.length || 0;

      return totalCapacity > 0
        ? Math.round((totalEnrollments / totalCapacity) * 100)
        : 0;
    },
  });

  // Fetch payroll data
  const { data: payrollData } = useQuery({
    queryKey: ["payroll", selectedMonth],
    queryFn: async () => {
      // Get all coaches
      const { data: coaches, error: coachesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("role", "coach");

      if (coachesError) throw coachesError;

      if (!coaches || coaches.length === 0) return [];

      // Get sessions for the month
      const { data: sessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("coach_id, start_time, end_time")
        .gte("start_time", monthStart.toISOString())
        .lte("start_time", monthEnd.toISOString())
        .in("status", ["completed", "in_progress"]);

      if (sessionsError) throw sessionsError;

      // Get coach rates - using type assertion since table was just created
      const coachIds = coaches.map((c) => c.id);
      const { data: rates, error: ratesError } = await (supabase
        .from("coach_rates" as any)
        .select("coach_id, rate_per_hour")
        .in("coach_id", coachIds)
        .lte("effective_from", monthEnd.toISOString()) as any);

      if (ratesError) throw ratesError;

      // Calculate hours and salary per coach
      return coaches.map((coach) => {
        const coachSessions =
          sessions?.filter((s) => s.coach_id === coach.id) || [];
        const totalMinutes = coachSessions.reduce((sum, s) => {
          const start = new Date(s.start_time);
          const end = new Date(s.end_time);
          return sum + (end.getTime() - start.getTime()) / (1000 * 60);
        }, 0);
        const hours = Math.round((totalMinutes / 60) * 10) / 10;

        const ratesArray = rates as Array<{ coach_id: string; rate_per_hour: number }> || [];
        const rate = ratesArray.find((r) => r.coach_id === coach.id);
        const hourlyRate = rate?.rate_per_hour || 0;
        const totalSalary = hours * Number(hourlyRate);

        return {
          id: coach.id,
          name: `${coach.first_name || ""} ${coach.last_name || ""}`.trim() || "ללא שם",
          hours,
          hourlyRate: Number(hourlyRate),
          totalSalary,
        };
      });
    },
  });

  // Fetch attendance data for export
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ["attendance-report", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select(`
          id,
          status,
          marked_at,
          sessions (
            start_time,
            class_types (name),
            coach:profiles!sessions_coach_id_fkey (first_name, last_name)
          ),
          swimmers (first_name, last_name)
        `)
        .gte("marked_at", monthStart.toISOString())
        .lte("marked_at", monthEnd.toISOString())
        .order("marked_at", { ascending: false });

      if (error) throw error;
      return data as Array<{
        id: string;
        status: string;
        marked_at: string;
        sessions: {
          start_time: string;
          class_types: { name: string } | null;
          coach: { first_name: string | null; last_name: string | null } | null;
        } | null;
        swimmers: { first_name: string; last_name: string } | null;
      }>;
    },
  });

  // Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: he }),
    };
  });

  // Export payroll to CSV
  const handleExportCSV = () => {
    if (!payrollData || payrollData.length === 0) return;

    const headers = ["שם המאמן", "שעות", "תעריף לשעה", "סה״כ שכר"];
    const rows = payrollData.map((row) => [
      row.name,
      row.hours.toString(),
      row.hourlyRate.toFixed(2),
      row.totalSalary.toFixed(2),
    ]);

    const totalHours = payrollData.reduce((sum, r) => sum + r.hours, 0);
    const totalSalary = payrollData.reduce((sum, r) => sum + r.totalSalary, 0);
    rows.push(["סה״כ", totalHours.toString(), "", totalSalary.toFixed(2)]);

    const csvContent =
      "\uFEFF" + // BOM for Hebrew support
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payroll-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export attendance to CSV
  const handleExportAttendanceCSV = () => {
    if (!attendanceData || attendanceData.length === 0) {
      return;
    }

    const headers = ["תאריך", "שם השיעור", "שם המאמן", "שם השחיין", "סטטוס"];
    const rows = attendanceData.map((record) => {
      const sessionDate = record.sessions?.start_time
        ? format(new Date(record.sessions.start_time), "dd/MM/yyyy HH:mm")
        : "-";
      const className = record.sessions?.class_types?.name || "-";
      const coachName = record.sessions?.coach
        ? `${record.sessions.coach.first_name || ""} ${record.sessions.coach.last_name || ""}`.trim()
        : "-";
      const swimmerName = record.swimmers
        ? `${record.swimmers.first_name} ${record.swimmers.last_name}`
        : "-";
      const status = ATTENDANCE_STATUS_HEBREW[record.status] || record.status;

      return [sessionDate, className, coachName, swimmerName, status];
    });

    const csvContent =
      "\uFEFF" + // BOM for Hebrew support
      [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">דוחות וסטטיסטיקות</h1>
          <p className="text-muted-foreground">סקירה כללית של פעילות המערכת</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <Calendar className="h-4 w-4 ml-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              הכנסות החודש
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₪{(revenueData || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              סה״כ הכנסות בחודש הנבחר
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              שחיינים פעילים
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {activeSwimmersCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              שחיינים עם רישום פעיל
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              אחוזי תפוסה
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {occupancyData || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ממוצע תפוסת השיעורים
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different reports */}
      <Tabs defaultValue="payroll" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payroll" className="gap-2">
            <Clock className="h-4 w-4" />
            דוח שכר
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            דוח נוכחות
          </TabsTrigger>
        </TabsList>

        {/* Payroll Report */}
        <TabsContent value="payroll">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle>דוח שכר מאמנים</CardTitle>
              </div>
              <Button onClick={handleExportCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 ml-2" />
                ייצא לאקסל
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">שם המאמן</TableHead>
                      <TableHead className="text-right">שעות עבודה</TableHead>
                      <TableHead className="text-right">תעריף לשעה</TableHead>
                      <TableHead className="text-right">סה״כ שכר</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollData && payrollData.length > 0 ? (
                      <>
                        {payrollData.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell>{row.hours} שעות</TableCell>
                            <TableCell>₪{row.hourlyRate.toFixed(2)}</TableCell>
                            <TableCell className="font-semibold">
                              ₪{row.totalSalary.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell>סה״כ</TableCell>
                          <TableCell>
                            {payrollData.reduce((sum, r) => sum + r.hours, 0)} שעות
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell>
                            ₪{payrollData.reduce((sum, r) => sum + r.totalSalary, 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          אין נתוני שכר לחודש זה
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Report */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <CardTitle>דוח נוכחות</CardTitle>
              </div>
              <Button 
                onClick={handleExportAttendanceCSV} 
                variant="outline" 
                size="sm"
                disabled={!attendanceData || attendanceData.length === 0}
              >
                <Download className="h-4 w-4 ml-2" />
                ייצוא לאקסל
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">תאריך</TableHead>
                      <TableHead className="text-right">שם השיעור</TableHead>
                      <TableHead className="text-right">מאמן</TableHead>
                      <TableHead className="text-right">שחיין</TableHead>
                      <TableHead className="text-right">סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          טוען...
                        </TableCell>
                      </TableRow>
                    ) : attendanceData && attendanceData.length > 0 ? (
                      attendanceData.slice(0, 50).map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            {record.sessions?.start_time
                              ? format(new Date(record.sessions.start_time), "dd/MM/yyyy HH:mm")
                              : "-"}
                          </TableCell>
                          <TableCell>{record.sessions?.class_types?.name || "-"}</TableCell>
                          <TableCell>
                            {record.sessions?.coach
                              ? `${record.sessions.coach.first_name || ""} ${record.sessions.coach.last_name || ""}`.trim()
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {record.swimmers
                              ? `${record.swimmers.first_name} ${record.swimmers.last_name}`
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <span className={
                              record.status === "present" ? "text-success" :
                              record.status === "absent" ? "text-destructive" :
                              "text-warning"
                            }>
                              {ATTENDANCE_STATUS_HEBREW[record.status] || record.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          אין נתוני נוכחות לחודש זה
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {attendanceData && attendanceData.length > 50 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  מוצגות 50 רשומות ראשונות. לצפייה בכל הנתונים, ייצא לאקסל.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
