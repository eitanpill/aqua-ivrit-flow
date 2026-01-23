import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, UserPlus, Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface Swimmer {
  id: string;
  first_name: string;
  last_name: string;
}

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  class_types: { name: string };
  resources: { name: string } | null;
}

interface Enrollment {
  id: string;
  enrolled_at: string;
  status: string;
  sessions: {
    id: string;
    start_time: string;
    class_types: { name: string };
  };
}

interface UserEnrollmentSheetProps {
  userId: string | null;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserEnrollmentSheet({ userId, userName, open, onOpenChange }: UserEnrollmentSheetProps) {
  const [selectedSwimmerId, setSelectedSwimmerId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const queryClient = useQueryClient();

  // Fetch user's swimmers
  const { data: swimmers, isLoading: swimmersLoading } = useQuery({
    queryKey: ["user-swimmers", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("swimmers")
        .select("id, first_name, last_name")
        .eq("parent_id", userId);
      if (error) throw error;
      return data as Swimmer[];
    },
    enabled: !!userId && open,
  });

  // Fetch available sessions (future)
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["future-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select(`
          id,
          start_time,
          end_time,
          class_types (name),
          resources (name)
        `)
        .gte("start_time", new Date().toISOString())
        .eq("is_cancelled", false)
        .order("start_time")
        .limit(50);
      if (error) throw error;
      return data as unknown as Session[];
    },
    enabled: open,
  });

  // Fetch swimmer enrollments
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["swimmer-enrollments", selectedSwimmerId],
    queryFn: async () => {
      if (!selectedSwimmerId) return [];
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          id,
          enrolled_at,
          status,
          sessions (
            id,
            start_time,
            class_types (name)
          )
        `)
        .eq("swimmer_id", selectedSwimmerId)
        .neq("status", "cancelled")
        .order("enrolled_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as unknown as Enrollment[];
    },
    enabled: !!selectedSwimmerId,
  });

  // Force enroll mutation
  const forceEnrollMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_force_enroll" as any, {
        p_swimmer_id: selectedSwimmerId,
        p_session_id: selectedSessionId,
        p_enrollment_type: "permanent",
      });

      if (error) throw error;
      
      const result = data as unknown as { success: boolean; error?: string; enrollment_id?: string };
      if (!result.success) {
        throw new Error(result.error || "שגיאה ברישום");
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success("הילד נרשם בהצלחה לשיעור!");
      queryClient.invalidateQueries({ queryKey: ["swimmer-enrollments", selectedSwimmerId] });
      setSelectedSessionId("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleEnroll = () => {
    if (!selectedSwimmerId || !selectedSessionId) {
      toast.error("יש לבחור שחיין ושיעור");
      return;
    }
    forceEnrollMutation.mutate();
  };

  const formatSessionDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "EEEE, dd/MM/yyyy בשעה HH:mm", { locale: he });
  };

  const statusLabels: Record<string, string> = {
    pending: "ממתין",
    confirmed: "מאושר",
    attended: "השתתף",
    no_show: "לא הגיע",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            ניהול הרשמות - {userName}
          </SheetTitle>
          <SheetDescription>
            רישום ידני לשיעורים והצגת הרשמות קיימות
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Swimmer Selection */}
          <div className="space-y-2">
            <Label>בחר שחיין</Label>
            {swimmersLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !swimmers?.length ? (
              <p className="text-sm text-muted-foreground">אין ילדים רשומים למשתמש זה</p>
            ) : (
              <Select value={selectedSwimmerId} onValueChange={setSelectedSwimmerId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר שחיין..." />
                </SelectTrigger>
                <SelectContent>
                  {swimmers.map((swimmer) => (
                    <SelectItem key={swimmer.id} value={swimmer.id}>
                      {swimmer.first_name} {swimmer.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedSwimmerId && (
            <>
              {/* Force Enroll Section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    רישום ידני לשיעור
                  </CardTitle>
                  <CardDescription>
                    רישום כפוי - עוקף בדיקות קיבולת ותשלום
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>בחר שיעור</Label>
                    {sessionsLoading ? (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר שיעור..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sessions?.map((session) => (
                            <SelectItem key={session.id} value={session.id}>
                              <div className="flex flex-col">
                                <span>{session.class_types.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatSessionDate(session.start_time)}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Button
                    onClick={handleEnroll}
                    disabled={!selectedSessionId || forceEnrollMutation.isPending}
                    className="w-full"
                  >
                    {forceEnrollMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    ) : (
                      <UserPlus className="h-4 w-4 ml-2" />
                    )}
                    רשום לשיעור
                  </Button>
                </CardContent>
              </Card>

              {/* Existing Enrollments */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    הרשמות קיימות
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {enrollmentsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : !enrollments?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      אין הרשמות
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>שיעור</TableHead>
                          <TableHead>תאריך</TableHead>
                          <TableHead>סטטוס</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enrollments.map((enrollment) => (
                          <TableRow key={enrollment.id}>
                            <TableCell className="font-medium">
                              {enrollment.sessions.class_types.name}
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(enrollment.sessions.start_time), "dd/MM HH:mm")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {statusLabels[enrollment.status] || enrollment.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
