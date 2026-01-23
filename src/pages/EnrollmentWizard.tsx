import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search, UserPlus, Clock, Users, AlertTriangle, CheckCircle, XCircle, Loader2, ListPlus } from "lucide-react";
import { format } from "date-fns";
import { HEBREW_DAYS } from "@/lib/session-generator";
import { getHebrewAgeLabel } from "@/lib/phoneUtils";

interface Swimmer {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  gender?: "male" | "female" | "other" | null;
  parent_id: string;
  profiles?: { first_name: string; last_name: string; phone: string };
}

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  max_participants: number;
  class_types: { name: string };
  resources?: { name: string };
  coach_profile?: { first_name: string; last_name: string };
  enrollment_count: number;
}

interface WaitlistEntry {
  id: string;
  swimmer_id: string;
  session_id: string;
  position: number;
  status: string;
  created_at: string;
  swimmers: { first_name: string; last_name: string };
  sessions: { start_time: string; class_types: { name: string } };
}

interface ValidationResult {
  success: boolean;
  can_enroll: boolean;
  errors: string[];
  warnings: string[];
  session: {
    id: string;
    class_type_name: string;
    start_time: string;
    end_time: string;
    current_count: number;
    max_capacity: number;
  };
  swimmer: {
    id: string;
    name: string;
    age: number | null;
  };
}

export default function EnrollmentWizard() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSwimmer, setSelectedSwimmer] = useState<Swimmer | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [enrollmentType, setEnrollmentType] = useState<"permanent" | "single" | "makeup">("single");
  const [forceOverride, setForceOverride] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState(() => format(new Date(), "yyyy-MM-dd"));

  // Fetch swimmers with parent info
  const { data: swimmers, isLoading: swimmersLoading } = useQuery({
    queryKey: ["swimmers-with-parents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("swimmers")
        .select(`
          *,
          profiles:parent_id (first_name, last_name, phone)
        `)
        .order("first_name");
      if (error) throw error;
      return data as Swimmer[];
    },
  });

  // Fetch upcoming sessions with enrollment counts
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["sessions-with-counts", dateFilter],
    queryFn: async () => {
      const startOfDay = new Date(dateFilter);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateFilter);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("sessions")
        .select(`
          *,
          class_types (name, max_participants),
          resources (name)
        `)
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfDay.toISOString())
        .eq("status", "scheduled")
        .order("start_time");
      if (error) throw error;

      // Get enrollment counts for each session
      const sessionsWithCounts = await Promise.all(
        (data || []).map(async (session) => {
          const { count } = await supabase
            .from("enrollments")
            .select("*", { count: "exact", head: true })
            .eq("session_id", session.id)
            .neq("status", "cancelled");
          
          return {
            ...session,
            enrollment_count: count || 0,
          };
        })
      );

      return sessionsWithCounts as Session[];
    },
  });

  // Fetch waitlist entries
  const { data: waitlistEntries, isLoading: waitlistLoading } = useQuery({
    queryKey: ["waitlist-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waitlist")
        .select(`
          *,
          swimmers (first_name, last_name),
          sessions (start_time, class_types (name))
        `)
        .in("status", ["waiting", "notified"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as WaitlistEntry[];
    },
  });

  // Validate enrollment mutation
  const validateMutation = useMutation({
    mutationFn: async ({ swimmerId, sessionId }: { swimmerId: string; sessionId: string }) => {
      const { data, error } = await (supabase as any).rpc("validate_enrollment", {
        p_swimmer_id: swimmerId,
        p_session_id: sessionId,
        p_force_override: forceOverride,
      });
      if (error) throw error;
      return data as ValidationResult;
    },
    onSuccess: (result) => {
      setValidationResult(result);
      setIsEnrollDialogOpen(true);
    },
    onError: (error) => {
      toast.error("שגיאה בבדיקת ההרשמה");
      console.error(error);
    },
  });

  // Create enrollment mutation
  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSwimmer || !selectedSession) throw new Error("Missing data");
      
      const { data, error } = await supabase
        .from("enrollments")
        .insert({
          swimmer_id: selectedSwimmer.id,
          session_id: selectedSession.id,
          status: "confirmed",
          type: enrollmentType,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions-with-counts"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("ההרשמה בוצעה בהצלחה!");
      setIsEnrollDialogOpen(false);
      setSelectedSwimmer(null);
      setSelectedSession(null);
      setValidationResult(null);
      setForceOverride(false);
    },
    onError: (error: Error) => {
      if (error.message.includes("כבר רשום")) {
        toast.error("השחיין כבר רשום לשעה זו");
      } else {
        toast.error("שגיאה בהרשמה");
      }
      console.error(error);
    },
  });

  // Add to waitlist mutation
  const addToWaitlistMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSwimmer || !selectedSession) throw new Error("Missing data");
      
      const { data, error } = await (supabase as any).rpc("add_to_waitlist", {
        p_swimmer_id: selectedSwimmer.id,
        p_session_id: selectedSession.id,
        p_parent_id: selectedSwimmer.parent_id,
      });
      if (error) throw error;
      return data as { success: boolean; position?: number; error?: string; message?: string };
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["waitlist-entries"] });
        toast.success(result.message || "נוסף לרשימת ההמתנה");
        setIsEnrollDialogOpen(false);
        setSelectedSwimmer(null);
        setSelectedSession(null);
        setValidationResult(null);
      } else {
        toast.error(result.error || "שגיאה");
      }
    },
    onError: (error) => {
      toast.error("שגיאה בהוספה לרשימת ההמתנה");
      console.error(error);
    },
  });

  // Promote from waitlist mutation
  const promoteMutation = useMutation({
    mutationFn: async (waitlistId: string) => {
      const { data, error } = await (supabase as any).rpc("promote_from_waitlist", {
        p_waitlist_id: waitlistId,
      });
      if (error) throw error;
      return data as { success: boolean; error?: string; message?: string };
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["waitlist-entries"] });
        queryClient.invalidateQueries({ queryKey: ["sessions-with-counts"] });
        toast.success(result.message || "השחיין נרשם בהצלחה");
      } else {
        toast.error(result.error || "שגיאה");
      }
    },
    onError: (error) => {
      toast.error("שגיאה בהעברה מרשימת ההמתנה");
      console.error(error);
    },
  });

  // Filter swimmers by search term
  const filteredSwimmers = useMemo(() => {
    if (!swimmers || !searchTerm) return swimmers || [];
    const term = searchTerm.toLowerCase();
    return swimmers.filter(
      (s) =>
        s.first_name.toLowerCase().includes(term) ||
        s.last_name.toLowerCase().includes(term) ||
        s.profiles?.first_name?.toLowerCase().includes(term) ||
        s.profiles?.last_name?.toLowerCase().includes(term)
    );
  }, [swimmers, searchTerm]);

  const handleSelectSession = (session: Session) => {
    setSelectedSession(session);
    if (selectedSwimmer) {
      validateMutation.mutate({
        swimmerId: selectedSwimmer.id,
        sessionId: session.id,
      });
    }
  };

  const getCapacityBadge = (session: Session) => {
    const max = session.max_participants || 8;
    const current = session.enrollment_count;
    const percent = (current / max) * 100;

    if (percent >= 100) {
      return <Badge variant="destructive">מלא ({current}/{max})</Badge>;
    } else if (percent >= 80) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800">כמעט מלא ({current}/{max})</Badge>;
    }
    return <Badge variant="secondary" className="bg-green-100 text-green-800">פנוי ({current}/{max})</Badge>;
  };

  const formatSessionTime = (session: Session) => {
    const start = new Date(session.start_time);
    const dayName = HEBREW_DAYS[start.getDay()];
    return `${dayName} ${format(start, "HH:mm")}`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">אשף הרשמות</h1>
          <p className="text-muted-foreground mt-1">
            הרשמת שחיינים לשיעורים וניהול רשימת המתנה
          </p>
        </div>
      </div>

      <Tabs defaultValue="enroll" className="space-y-4">
        <TabsList>
          <TabsTrigger value="enroll">הרשמה חדשה</TabsTrigger>
          <TabsTrigger value="waitlist">
            רשימת המתנה
            {waitlistEntries?.length ? (
              <Badge variant="secondary" className="mr-2">{waitlistEntries.length}</Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* Enrollment Tab */}
        <TabsContent value="enroll" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Step 1: Select Swimmer */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  שלב 1: בחירת שחיין
                </CardTitle>
                <CardDescription>חפש ובחר שחיין להרשמה</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="חפש לפי שם שחיין או הורה..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>

                <div className="max-h-80 overflow-y-auto border rounded-md">
                  {swimmersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredSwimmers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      לא נמצאו שחיינים
                    </div>
                  ) : (
                    <Table>
                      <TableBody>
                        {filteredSwimmers.slice(0, 20).map((swimmer) => (
                          <TableRow
                            key={swimmer.id}
                            className={`cursor-pointer ${selectedSwimmer?.id === swimmer.id ? "bg-primary/10" : ""}`}
                            onClick={() => setSelectedSwimmer(swimmer)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span>{swimmer.first_name} {swimmer.last_name}</span>
                                {swimmer.birth_date && (
                                  <Badge variant="secondary" className="text-xs">
                                    {getHebrewAgeLabel(swimmer.birth_date, swimmer.gender)}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {swimmer.profiles?.first_name} {swimmer.profiles?.last_name}
                            </TableCell>
                            <TableCell>
                              {selectedSwimmer?.id === swimmer.id && (
                                <CheckCircle className="h-4 w-4 text-primary" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {selectedSwimmer && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>נבחר: {selectedSwimmer.first_name} {selectedSwimmer.last_name}</AlertTitle>
                    <AlertDescription>
                      הורה: {selectedSwimmer.profiles?.first_name} {selectedSwimmer.profiles?.last_name}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Select Session */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  שלב 2: בחירת שיעור
                </CardTitle>
                <CardDescription>בחר שיעור להרשמה</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-auto"
                  />
                </div>

                <div className="max-h-80 overflow-y-auto border rounded-md">
                  {sessionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : sessions?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      אין שיעורים בתאריך זה
                    </div>
                  ) : (
                    <Table>
                      <TableBody>
                        {sessions?.map((session) => (
                          <TableRow
                            key={session.id}
                            className={`cursor-pointer ${selectedSession?.id === session.id ? "bg-primary/10" : ""}`}
                            onClick={() => handleSelectSession(session)}
                          >
                            <TableCell>
                              <div className="font-medium">{session.class_types?.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {formatSessionTime(session)}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {session.resources?.name || "-"}
                            </TableCell>
                            <TableCell>
                              {getCapacityBadge(session)}
                            </TableCell>
                            <TableCell>
                              {selectedSession?.id === session.id && (
                                <CheckCircle className="h-4 w-4 text-primary" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {selectedSession && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>{selectedSession.class_types?.name}</AlertTitle>
                    <AlertDescription>
                      {formatSessionTime(selectedSession)} | {selectedSession.resources?.name || "לא הוגדרה בריכה"}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Label>סוג הרשמה:</Label>
                  <Select value={enrollmentType} onValueChange={(v) => setEnrollmentType(v as any)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">קבועה</SelectItem>
                      <SelectItem value="single">חד פעמית</SelectItem>
                      <SelectItem value="makeup">השלמה</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  size="lg"
                  disabled={!selectedSwimmer || !selectedSession || validateMutation.isPending}
                  onClick={() => {
                    if (selectedSwimmer && selectedSession) {
                      validateMutation.mutate({
                        swimmerId: selectedSwimmer.id,
                        sessionId: selectedSession.id,
                      });
                    }
                  }}
                >
                  {validateMutation.isPending ? (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="ml-2 h-4 w-4" />
                  )}
                  בדוק והרשם
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Waitlist Tab */}
        <TabsContent value="waitlist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                רשימת המתנה
              </CardTitle>
              <CardDescription>שחיינים הממתינים למקום פנוי</CardDescription>
            </CardHeader>
            <CardContent>
              {waitlistLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : waitlistEntries?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ListPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>אין שחיינים ברשימת ההמתנה</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>מיקום</TableHead>
                      <TableHead>שחיין</TableHead>
                      <TableHead>שיעור</TableHead>
                      <TableHead>תאריך בקשה</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {waitlistEntries?.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Badge variant="outline">#{entry.position}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.swimmers?.first_name} {entry.swimmers?.last_name}
                        </TableCell>
                        <TableCell>
                          <div>{entry.sessions?.class_types?.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(entry.sessions?.start_time), "dd/MM HH:mm")}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.status === "notified" ? "default" : "secondary"}>
                            {entry.status === "waiting" ? "ממתין" : entry.status === "notified" ? "קיבל הודעה" : entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => promoteMutation.mutate(entry.id)}
                            disabled={promoteMutation.isPending}
                          >
                            {promoteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserPlus className="h-4 w-4" />
                            )}
                            <span className="mr-1">העבר לשיעור</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Enrollment Confirmation Dialog */}
      <Dialog open={isEnrollDialogOpen} onOpenChange={setIsEnrollDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>אישור הרשמה</DialogTitle>
            <DialogDescription>
              בדוק את פרטי ההרשמה לפני אישור
            </DialogDescription>
          </DialogHeader>

          {validationResult && (
            <div className="space-y-4 py-4">
              {/* Swimmer Info */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium">{validationResult.swimmer.name}</div>
                {validationResult.swimmer.age && (
                  <div className="text-sm text-muted-foreground">גיל: {validationResult.swimmer.age}</div>
                )}
              </div>

              {/* Session Info */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium">{validationResult.session.class_type_name}</div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(validationResult.session.start_time), "dd/MM/yyyy HH:mm")}
                </div>
                <div className="text-sm">
                  תפוסה: {validationResult.session.current_count}/{validationResult.session.max_capacity}
                </div>
              </div>

              {/* Errors */}
              {validationResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>שגיאות</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside">
                      {validationResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Warnings */}
              {validationResult.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>אזהרות</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside">
                      {validationResult.warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Force Override Option */}
              {!validationResult.can_enroll && validationResult.errors.some(e => e.includes("מלא")) && (
                <div className="flex items-center gap-2 p-4 border rounded-lg">
                  <Checkbox
                    id="forceOverride"
                    checked={forceOverride}
                    onCheckedChange={(checked) => {
                      setForceOverride(!!checked);
                      if (checked && selectedSwimmer && selectedSession) {
                        validateMutation.mutate({
                          swimmerId: selectedSwimmer.id,
                          sessionId: selectedSession.id,
                        });
                      }
                    }}
                  />
                  <Label htmlFor="forceOverride" className="text-sm">
                    הרשמה בכפייה (מנהל בלבד) - עוקף מגבלת קיבולת
                  </Label>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEnrollDialogOpen(false)}>
              ביטול
            </Button>
            
            {validationResult && !validationResult.can_enroll && !forceOverride && (
              <Button
                variant="secondary"
                onClick={() => addToWaitlistMutation.mutate()}
                disabled={addToWaitlistMutation.isPending}
              >
                {addToWaitlistMutation.isPending ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                  <ListPlus className="ml-2 h-4 w-4" />
                )}
                הוסף לרשימת המתנה
              </Button>
            )}

            {validationResult?.can_enroll && (
              <Button
                onClick={() => enrollMutation.mutate()}
                disabled={enrollMutation.isPending}
              >
                {enrollMutation.isPending ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="ml-2 h-4 w-4" />
                )}
                אשר הרשמה
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
