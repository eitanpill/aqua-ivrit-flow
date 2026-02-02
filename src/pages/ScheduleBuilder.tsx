import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Calendar, Loader2, Play, Trash2, Clock, Users, MapPin } from "lucide-react";
import { format } from "date-fns";
import { HEBREW_DAYS } from "@/lib/session-generator";
import { DashboardStats, DashboardToolbar, DashboardGrid, type ViewMode } from "@/components/dashboard";
import { cn } from "@/lib/utils";

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
  const { activeSchoolId, isLoadingSchool } = useSchool();
  const [isTermDialogOpen, setIsTermDialogOpen] = useState(false);
  const [isSeriesDialogOpen, setIsSeriesDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
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
  const [useDateRange, setUseDateRange] = useState(false);
  const [seriesStartDate, setSeriesStartDate] = useState("");
  const [seriesEndDate, setSeriesEndDate] = useState("");

  // Fetch terms
  const { data: terms, isLoading: termsLoading } = useQuery({
    queryKey: ["terms", activeSchoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terms" as any)
        .select("*")
        .eq("school_id", activeSchoolId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as unknown as Term[];
    },
    enabled: !!activeSchoolId,
  });

  // Fetch schedule series
  const { data: seriesList, isLoading: seriesLoading } = useQuery({
    queryKey: ["schedule_series", activeSchoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_series" as any)
        .select(`
          *,
          terms (name),
          class_types (name),
          resources (name)
        `)
        .eq("school_id", activeSchoolId)
        .order("created_at", { ascending: false });
      if (error) throw error;
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
    enabled: !!activeSchoolId,
  });

  // Fetch class types
  const { data: classTypes } = useQuery({
    queryKey: ["class_types", activeSchoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_types")
        .select("id, name")
        .eq("school_id", activeSchoolId)
        .order("name");
      if (error) throw error;
      return data as ClassType[];
    },
    enabled: !!activeSchoolId,
  });

  // Fetch coaches
  const { data: coaches } = useQuery({
    queryKey: ["coaches", activeSchoolId],
    queryFn: async () => {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("school_id", activeSchoolId)
        .in("role", ["coach", "admin"]);
      if (profilesError) throw profilesError;
      return profilesData as Coach[];
    },
    enabled: !!activeSchoolId,
  });

  // Fetch resources
  const { data: resources } = useQuery({
    queryKey: ["resources", activeSchoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("id, name, locations (name)")
        .eq("school_id", activeSchoolId)
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
    enabled: !!activeSchoolId,
  });

  // Filter series
  const filteredSeries = useMemo(() => {
    if (!seriesList) return [];
    return seriesList.filter((series) => {
      if (statusFilter === 'active' && !series.active) return false;
      if (statusFilter === 'inactive' && series.active) return false;
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        const name = series.name.toLowerCase();
        const classType = series.class_type_name?.toLowerCase() || '';
        if (!name.includes(search) && !classType.includes(search)) return false;
      }
      return true;
    });
  }, [seriesList, statusFilter, searchQuery]);

  // Create term mutation
  const createTermMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any)
        .from("terms")
        .insert({
          name: termName,
          start_date: termStartDate,
          end_date: termEndDate,
          school_id: activeSchoolId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms", activeSchoolId] });
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
        school_id: activeSchoolId,
      };

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
      queryClient.invalidateQueries({ queryKey: ["schedule_series", activeSchoolId] });
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

  const canCreateSeries = seriesName && selectedClassTypeId && selectedDay && (
    useDateRange ? (seriesStartDate && seriesEndDate) : selectedTermId
  );

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy");
  };

  // Stats
  const activeSeriesCount = seriesList?.filter(s => s.active).length || 0;
  const inactiveSeriesCount = seriesList?.filter(s => !s.active).length || 0;
  const totalTermsCount = terms?.length || 0;

  const stats = [
    { id: 'active', label: 'סדרות פעילות', value: activeSeriesCount, color: 'text-green-600' },
    { id: 'inactive', label: 'לא פעילות', value: inactiveSeriesCount, color: 'text-muted-foreground' },
    { id: 'terms', label: 'עונות', value: totalTermsCount, color: 'text-blue-600' },
    { id: 'total', label: 'סה"כ סדרות', value: seriesList?.length || 0 },
  ];

  const statusOptions = [
    { value: 'all', label: 'הכל' },
    { value: 'active', label: 'פעילות' },
    { value: 'inactive', label: 'לא פעילות' },
  ];

  return (
    <div className="space-y-6 pb-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
            <Calendar className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">בונה מערכת שעות</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              ניהול עונות וסדרות שיעורים חוזרות
            </p>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <DashboardStats stats={stats} />

      <Tabs defaultValue="series" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="series">סדרות שיעורים</TabsTrigger>
          <TabsTrigger value="terms">עונות</TabsTrigger>
        </TabsList>

        {/* Terms Tab */}
        <TabsContent value="terms" className="space-y-4">
          <Card className="card-premium border-0 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">עונות</CardTitle>
                <CardDescription>הגדרת תקופות לימוד (סמסטרים)</CardDescription>
              </div>
              <Dialog open={isTermDialogOpen} onOpenChange={setIsTermDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-premium gap-2">
                    <Plus className="h-4 w-4" />
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
              <DashboardGrid
                viewMode="list"
                isLoading={termsLoading}
                isEmpty={!terms?.length}
                emptyMessage="אין עונות עדיין - צור עונה חדשה כדי להתחיל"
                emptyIcon={<Calendar className="h-8 w-8 text-muted-foreground" />}
              >
                {terms?.map((term) => (
                  <Card key={term.id} className="card-hover">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{term.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(term.start_date)} - {formatDate(term.end_date)}
                          </p>
                        </div>
                      </div>
                      <Badge variant={term.active ? "default" : "secondary"}>
                        {term.active ? "פעילה" : "לא פעילה"}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </DashboardGrid>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Series Tab */}
        <TabsContent value="series" className="space-y-4">
          {/* Toolbar */}
          <DashboardToolbar
            showSearch
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="חיפוש סדרה..."
            showViewToggle
            viewMode={viewMode}
            onViewChange={setViewMode}
            showStatusFilter
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            statusOptions={statusOptions}
            actions={
              <Dialog open={isSeriesDialogOpen} onOpenChange={setIsSeriesDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-premium gap-2">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">סדרה חדשה</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>יצירת סדרת שיעורים</DialogTitle>
                    <DialogDescription>
                      הגדר שיעור חוזר שייווצר אוטומטית
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-2">
                      <Label htmlFor="seriesName">שם הסדרה</Label>
                      <Input
                        id="seriesName"
                        placeholder="לדוגמה: שחייה מתקדמים - שני 16:00"
                        value={seriesName}
                        onChange={(e) => setSeriesName(e.target.value)}
                      />
                    </div>

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
            }
          />

          {/* Series Grid */}
          <DashboardGrid
            viewMode={viewMode}
            isLoading={seriesLoading}
            isEmpty={!filteredSeries.length}
            emptyMessage="אין סדרות שיעורים - צור סדרה חדשה כדי להתחיל"
            emptyIcon={<Calendar className="h-8 w-8 text-muted-foreground" />}
          >
            {filteredSeries.map((series) => (
              <SeriesCard
                key={series.id}
                series={series}
                viewMode={viewMode}
                onGenerate={() => generateSessionsMutation.mutate(series.id)}
                onDelete={() => deleteSeriesMutation.mutate(series.id)}
                isGenerating={generateSessionsMutation.isPending}
                isDeleting={deleteSeriesMutation.isPending}
              />
            ))}
          </DashboardGrid>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Series Card Component
interface SeriesCardProps {
  series: ScheduleSeries;
  viewMode: ViewMode;
  onGenerate: () => void;
  onDelete: () => void;
  isGenerating: boolean;
  isDeleting: boolean;
}

function SeriesCard({ series, viewMode, onGenerate, onDelete, isGenerating, isDeleting }: SeriesCardProps) {
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy");
  };

  if (viewMode === 'list') {
    return (
      <Card className="card-hover">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className={cn(
            "w-1 h-12 rounded-full self-center",
            series.active ? "bg-green-500" : "bg-muted"
          )} />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-base truncate">{series.name}</h3>
              <Badge variant={series.active ? "default" : "secondary"} className="shrink-0">
                {series.active ? "פעילה" : "לא פעילה"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {series.class_type_name}
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
            <Clock className="h-4 w-4" />
            <span>{HEBREW_DAYS[series.day_of_week]} {series.start_time.slice(0, 5)}</span>
          </div>

          {series.resource_name && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0 hidden md:flex">
              <MapPin className="h-4 w-4" />
              <span className="truncate max-w-[100px]">{series.resource_name}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-sm shrink-0">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-semibold text-primary">{series.max_participants}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={onGenerate}
              disabled={isGenerating}
              className="gap-1"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">הפק</span>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grid view
  return (
    <Card className="card-hover card-premium overflow-hidden">
      <div className={cn(
        "h-1 w-full",
        series.active ? "gradient-primary" : "bg-muted"
      )} />
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-lg line-clamp-1">{series.name}</h3>
            <p className="text-sm text-muted-foreground">{series.class_type_name}</p>
          </div>
          <Badge variant={series.active ? "default" : "secondary"}>
            {series.active ? "פעילה" : "לא פעילה"}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>{HEBREW_DAYS[series.day_of_week]} {series.start_time.slice(0, 5)}</span>
          </div>
          {series.resource_name && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{series.resource_name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>
              {series.term_name || (series.start_date && series.end_date 
                ? `${formatDate(series.start_date)} - ${formatDate(series.end_date)}`
                : "-")}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-bold text-primary">{series.max_participants} משתתפים</span>
          </div>
          <span className="text-xs text-muted-foreground">{series.recurrence_weeks} שבועות</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="flex-1 gap-2"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            הפק שיעורים
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
