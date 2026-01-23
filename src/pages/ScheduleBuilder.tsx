import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Calendar, Loader2, Play, Trash2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { HEBREW_DAYS } from "@/lib/session-generator";

const DAYS_OPTIONS = [
  { value: "0", label: "ראשון" },
  { value: "1", label: "שני" },
  { value: "2", label: "שלישי" },
  { value: "3", label: "רביעי" },
  { value: "4", label: "חמישי" },
  { value: "5", label: "שישי" },
  { value: "6", label: "שבת" },
];

interface Term {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean;
}

interface ScheduleSeries {
  id: string;
  name: string;
  term_id: string | null;
  class_type_id: string;
  coach_id: string | null;
  resource_id: string | null;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  max_participants: number;
  recurrence_weeks: number;
  active: boolean;
  start_date?: string | null;
  end_date?: string | null;
  term_name?: string;
  class_type_name?: string;
  resource_name?: string;
}

interface Coach {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface Resource {
  id: string;
  name: string;
  location_name?: string;
}

interface ClassType {
  id: string;
  name: string;
}

export default function ScheduleBuilder() {
  const queryClient = useQueryClient();
  const [isTermDialogOpen, setIsTermDialogOpen] = useState(false);
  const [isSeriesDialogOpen, setIsSeriesDialogOpen] = useState(false);
  
  // Term form state
  const [termName, setTermName] = useState("");
  const [termStartDate, setTermStartDate] = useState("");
  const [termEndDate, setTermEndDate] = useState("");
  
  // Series form state
  const [seriesName, setSeriesName] = useState("");
  const [selectedTermId, setSelectedTermId] = useState("");
  const [selectedClassTypeId, setSelectedClassTypeId] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [startTime, setStartTime] = useState("16:00");
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [maxParticipants, setMaxParticipants] = useState("8");
  const [recurrenceWeeks, setRecurrenceWeeks] = useState("12");
  // New: standalone date range (no term needed)
  const [useDateRange, setUseDateRange] = useState(false);
  const [seriesStartDate, setSeriesStartDate] = useState("");
  const [seriesEndDate, setSeriesEndDate] = useState("");

  // Fetch terms
  const { data: terms, isLoading: termsLoading } = useQuery({
    queryKey: ["terms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terms" as unknown as "attendance")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as unknown as Term[];
    },
  });

  // Fetch schedule series with joins
  const { data: seriesList, isLoading: seriesLoading } = useQuery({
    queryKey: ["schedule_series"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_series" as unknown as "attendance")
        .select(`
          *,
          terms (name),
          class_types (name),
          resources (name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Transform data to flatten nested objects
      const rawData = data as unknown as Array<{
        id: string;
        name: string;
        term_id: string;
        class_type_id: string;
        coach_id: string | null;
        resource_id: string | null;
        day_of_week: number;
        start_time: string;
        duration_minutes: number;
        max_participants: number;
        recurrence_weeks: number;
        active: boolean;
        terms?: { name: string };
        class_types?: { name: string };
        resources?: { name: string };
      }>;
      return rawData.map((item) => ({
        ...item,
        term_name: item.terms?.name,
        class_type_name: item.class_types?.name,
        resource_name: item.resources?.name,
      })) as ScheduleSeries[];
    },
  });

  // Fetch class types
  const { data: classTypes } = useQuery({
    queryKey: ["class_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_types")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as ClassType[];
    },
  });

  // Fetch coaches
  const { data: coaches } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["coach", "admin"]);
      if (roleError) throw roleError;
      
      if (!roleData?.length) return [];
      
      const userIds = roleData.map((r) => r.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);
      if (profilesError) throw profilesError;
      
      return profilesData as Coach[];
    },
  });

  // Fetch resources
  const { data: resources } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("id, name, locations (name)")
        .order("name");
      if (error) throw error;
      const rawData = data as unknown as Array<{
        id: string;
        name: string;
        locations?: { name: string };
      }>;
      return rawData.map((r) => ({
        id: r.id,
        name: r.name,
        location_name: r.locations?.name,
      })) as Resource[];
    },
  });

  // Create term mutation
  const createTermMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any)
        .from("terms")
        .insert({
          name: termName,
          start_date: termStartDate,
          end_date: termEndDate,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms"] });
      toast.success("העונה נוצרה בהצלחה");
      setIsTermDialogOpen(false);
      setTermName("");
      setTermStartDate("");
      setTermEndDate("");
    },
    onError: (error) => {
      toast.error("שגיאה ביצירת העונה");
      console.error(error);
    },
  });

  // Create series mutation
  const createSeriesMutation = useMutation({
    mutationFn: async () => {
      const insertData: any = {
        name: seriesName,
        class_type_id: selectedClassTypeId,
        coach_id: selectedCoachId || null,
        resource_id: selectedResourceId || null,
        day_of_week: parseInt(selectedDay),
        start_time: startTime,
        duration_minutes: parseInt(durationMinutes),
        max_participants: parseInt(maxParticipants),
        recurrence_weeks: parseInt(recurrenceWeeks),
      };

      // Use either term OR date range
      if (useDateRange) {
        insertData.start_date = seriesStartDate;
        insertData.end_date = seriesEndDate;
        insertData.term_id = null;
      } else {
        insertData.term_id = selectedTermId;
      }

      const { data, error } = await (supabase as any)
        .from("schedule_series")
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_series"] });
      toast.success("הסדרה נוצרה בהצלחה");
      setIsSeriesDialogOpen(false);
      resetSeriesForm();
    },
    onError: (error) => {
      toast.error("שגיאה ביצירת הסדרה");
      console.error(error);
    },
  });

  // Generate sessions mutation
  const generateSessionsMutation = useMutation({
    mutationFn: async (seriesId: string) => {
      const { data, error } = await supabase.rpc(
        "generate_sessions_from_series" as unknown as "get_user_role",
        { p_series_id: seriesId } as unknown as { _user_id: string }
      );
      if (error) throw error;
      return data as unknown as { success: boolean; sessions_created?: number; conflicts_skipped?: number; error?: string };
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
        toast.success(
          `נוצרו ${result.sessions_created} שיעורים${result.conflicts_skipped ? ` (${result.conflicts_skipped} התנגשויות דולגו)` : ""}`
        );
      } else {
        toast.error(result.error || "שגיאה ביצירת השיעורים");
      }
    },
    onError: (error: Error) => {
      if (error.message.includes("conflict") || error.message.includes("תפוס")) {
        toast.error("שגיאה: הבריכה תפוסה בשעה זו");
      } else {
        toast.error("שגיאה ביצירת השיעורים");
      }
      console.error(error);
    },
  });

  // Delete series mutation
  const deleteSeriesMutation = useMutation({
    mutationFn: async (seriesId: string) => {
      const { error } = await supabase
        .from("schedule_series" as unknown as "attendance")
        .delete()
        .eq("id", seriesId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_series"] });
      toast.success("הסדרה נמחקה");
    },
    onError: (error) => {
      toast.error("שגיאה במחיקת הסדרה");
      console.error(error);
    },
  });

  const resetSeriesForm = () => {
    setSeriesName("");
    setSelectedTermId("");
    setSelectedClassTypeId("");
    setSelectedCoachId("");
    setSelectedResourceId("");
    setSelectedDay("");
    setStartTime("16:00");
    setDurationMinutes("45");
    setMaxParticipants("8");
    setRecurrenceWeeks("12");
    setUseDateRange(false);
    setSeriesStartDate("");
    setSeriesEndDate("");
  };

  // Check if can create series
  const canCreateSeries = seriesName && selectedClassTypeId && selectedDay && (
    useDateRange ? (seriesStartDate && seriesEndDate) : selectedTermId
  );

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">בונה מערכת שעות</h1>
          <p className="text-muted-foreground mt-1">
            ניהול עונות וסדרות שיעורים חוזרות
          </p>
        </div>
      </div>

      <Tabs defaultValue="series" className="space-y-4">
        <TabsList>
          <TabsTrigger value="series">סדרות שיעורים</TabsTrigger>
          <TabsTrigger value="terms">עונות</TabsTrigger>
        </TabsList>

        {/* Terms Tab */}
        <TabsContent value="terms" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>עונות</CardTitle>
                <CardDescription>הגדרת תקופות לימוד (סמסטרים)</CardDescription>
              </div>
              <Dialog open={isTermDialogOpen} onOpenChange={setIsTermDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="ml-2 h-4 w-4" />
                    עונה חדשה
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>יצירת עונה חדשה</DialogTitle>
                    <DialogDescription>
                      הגדר תקופת לימודים חדשה
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="termName">שם העונה</Label>
                      <Input
                        id="termName"
                        placeholder="לדוגמה: חורף 2026"
                        value={termName}
                        onChange={(e) => setTermName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="termStartDate">תאריך התחלה</Label>
                        <Input
                          id="termStartDate"
                          type="date"
                          value={termStartDate}
                          onChange={(e) => setTermStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="termEndDate">תאריך סיום</Label>
                        <Input
                          id="termEndDate"
                          type="date"
                          value={termEndDate}
                          onChange={(e) => setTermEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsTermDialogOpen(false)}
                    >
                      ביטול
                    </Button>
                    <Button
                      onClick={() => createTermMutation.mutate()}
                      disabled={!termName || !termStartDate || !termEndDate || createTermMutation.isPending}
                    >
                      {createTermMutation.isPending && (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      )}
                      צור עונה
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {termsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : terms?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>אין עונות עדיין</p>
                  <p className="text-sm">צור עונה חדשה כדי להתחיל</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>שם</TableHead>
                      <TableHead>תאריך התחלה</TableHead>
                      <TableHead>תאריך סיום</TableHead>
                      <TableHead>סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {terms?.map((term) => (
                      <TableRow key={term.id}>
                        <TableCell className="font-medium">{term.name}</TableCell>
                        <TableCell>{formatDate(term.start_date)}</TableCell>
                        <TableCell>{formatDate(term.end_date)}</TableCell>
                        <TableCell>
                          <Badge variant={term.active ? "default" : "secondary"}>
                            {term.active ? "פעילה" : "לא פעילה"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Series Tab */}
        <TabsContent value="series" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>סדרות שיעורים</CardTitle>
                <CardDescription>
                  הגדר שיעורים חוזרים וצור אותם באופן אוטומטי
                </CardDescription>
              </div>
              <Dialog open={isSeriesDialogOpen} onOpenChange={setIsSeriesDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="ml-2 h-4 w-4" />
                    סדרה חדשה
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>יצירת סדרת שיעורים</DialogTitle>
                    <DialogDescription>
                      הגדר שיעור חוזר שייווצר אוטומטית
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="seriesName">שם הסדרה</Label>
                      <Input
                        id="seriesName"
                        placeholder="לדוגמה: שחייה מתקדמים - שני 16:00"
                        value={seriesName}
                        onChange={(e) => setSeriesName(e.target.value)}
                      />
                    </div>

                    {/* Date Range Toggle */}
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                      <div className="space-y-0.5">
                        <Label>הגדר תאריכים ידנית</Label>
                        <p className="text-xs text-muted-foreground">
                          {useDateRange ? "הזן תאריכי התחלה וסיום" : "השתמש בעונה קיימת"}
                        </p>
                      </div>
                      <Switch
                        checked={useDateRange}
                        onCheckedChange={(checked) => {
                          setUseDateRange(checked);
                          if (checked) setSelectedTermId("");
                        }}
                      />
                    </div>

                    {/* Term OR Date Range */}
                    {useDateRange ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="seriesStartDate">תאריך התחלה</Label>
                          <Input
                            id="seriesStartDate"
                            type="date"
                            value={seriesStartDate}
                            onChange={(e) => setSeriesStartDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="seriesEndDate">תאריך סיום</Label>
                          <Input
                            id="seriesEndDate"
                            type="date"
                            value={seriesEndDate}
                            onChange={(e) => setSeriesEndDate(e.target.value)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>עונה</Label>
                        <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר עונה" />
                          </SelectTrigger>
                          <SelectContent>
                            {terms?.map((term) => (
                              <SelectItem key={term.id} value={term.id}>
                                {term.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!terms?.length && (
                          <p className="text-xs text-amber-600">
                            אין עונות - עבור ללשונית "עונות" ליצירת עונה, או הפעל "הגדר תאריכים ידנית"
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>סוג שיעור</Label>
                      <Select value={selectedClassTypeId} onValueChange={setSelectedClassTypeId}>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר סוג שיעור" />
                        </SelectTrigger>
                        <SelectContent>
                          {classTypes?.map((ct) => (
                            <SelectItem key={ct.id} value={ct.id}>
                              {ct.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>יום</Label>
                        <Select value={selectedDay} onValueChange={setSelectedDay}>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר יום" />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS_OPTIONS.map((day) => (
                              <SelectItem key={day.value} value={day.value}>
                                {day.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="startTime">שעה</Label>
                        <Input
                          id="startTime"
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>מאמן</Label>
                        <Select value={selectedCoachId} onValueChange={setSelectedCoachId}>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר מאמן (אופציונלי)" />
                          </SelectTrigger>
                          <SelectContent>
                            {coaches?.map((coach) => (
                              <SelectItem key={coach.id} value={coach.id}>
                                {coach.first_name} {coach.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>בריכה / מסלול</Label>
                        <Select value={selectedResourceId} onValueChange={setSelectedResourceId}>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר בריכה (אופציונלי)" />
                          </SelectTrigger>
                          <SelectContent>
                            {resources?.map((resource) => (
                              <SelectItem key={resource.id} value={resource.id}>
                                {resource.name} ({resource.location_name})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="durationMinutes">משך (דקות)</Label>
                        <Input
                          id="durationMinutes"
                          type="number"
                          min="15"
                          max="120"
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="maxParticipants">מקסימום משתתפים</Label>
                        <Input
                          id="maxParticipants"
                          type="number"
                          min="1"
                          max="20"
                          value={maxParticipants}
                          onChange={(e) => setMaxParticipants(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="recurrenceWeeks">מספר שבועות</Label>
                        <Input
                          id="recurrenceWeeks"
                          type="number"
                          min="1"
                          max="52"
                          value={recurrenceWeeks}
                          onChange={(e) => setRecurrenceWeeks(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsSeriesDialogOpen(false)}
                    >
                      ביטול
                    </Button>
                    <Button
                      onClick={() => createSeriesMutation.mutate()}
                      disabled={!canCreateSeries || createSeriesMutation.isPending}
                    >
                      {createSeriesMutation.isPending && (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      )}
                      צור סדרה
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {seriesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : seriesList?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>אין סדרות שיעורים עדיין</p>
                  <p className="text-sm">צור סדרה חדשה כדי להתחיל</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>שם</TableHead>
                      <TableHead>תקופה</TableHead>
                      <TableHead>סוג שיעור</TableHead>
                      <TableHead>יום ושעה</TableHead>
                      <TableHead>בריכה</TableHead>
                      <TableHead>שבועות</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seriesList?.map((series) => (
                      <TableRow key={series.id}>
                        <TableCell className="font-medium">{series.name}</TableCell>
                        <TableCell>
                          {series.term_name || (series.start_date && series.end_date 
                            ? `${formatDate(series.start_date)} - ${formatDate(series.end_date)}`
                            : "-")}
                        </TableCell>
                        <TableCell>{series.class_type_name}</TableCell>
                        <TableCell>
                          {HEBREW_DAYS[series.day_of_week]} {series.start_time.slice(0, 5)}
                        </TableCell>
                        <TableCell>{series.resource_name || "-"}</TableCell>
                        <TableCell>{series.recurrence_weeks}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => generateSessionsMutation.mutate(series.id)}
                              disabled={generateSessionsMutation.isPending}
                            >
                              {generateSessionsMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                              <span className="mr-1">הפק שיעורים</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteSeriesMutation.mutate(series.id)}
                              disabled={deleteSeriesMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
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
    </div>
  );
}
