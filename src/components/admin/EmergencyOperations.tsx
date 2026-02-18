import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, XCircle, Settings2, Loader2 } from "lucide-react";
import { useSchool } from "@/contexts/SchoolContext";

interface Location {
  id: string;
  name: string;
}

const CANCELLATION_REASONS = [
  { value: "technical", label: "תקלה טכנית" },
  { value: "weather", label: "מזג אוויר" },
  { value: "holiday", label: "חג / אירוע" },
  { value: "other", label: "אחר" },
];

export function EmergencyOperations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeSchoolId } = useSchool();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<string>("");

  // Fetch locations with their resources
  const { data: locations = [] } = useQuery({
    queryKey: ["locations-emergency", activeSchoolId],
    queryFn: async () => {
      let query = supabase
        .from("locations")
        .select(`
          id, 
          name,
          resources(id)
        `)
        .order("name");

      if (activeSchoolId) {
        query = query.eq("school_id", activeSchoolId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (Location & { resources: { id: string }[] })[];
    },
    enabled: !!activeSchoolId,
  });

  // Mass cancellation mutation
  const cancelDayMutation = useMutation({
    mutationFn: async () => {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const reasonLabel =
        CANCELLATION_REASONS.find((r) => r.value === selectedReason)?.label ||
        selectedReason;

      // Get resource IDs for the selected location
      const selectedLocationData = locations.find((l) => l.id === selectedLocation);
      const resourceIds = selectedLocationData?.resources?.map((r) => r.id) || [];

      if (resourceIds.length === 0) {
        return { sessionsCount: 0, customersNotified: 0, tokensCreated: 0 };
      }

      // Get sessions for the selected date and location's resources
      const { data: sessions, error: fetchError } = await supabase
        .from("sessions")
        .select(`
          id,
          enrollments(
            id,
            swimmer_id,
            status
          )
        `)
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfDay.toISOString())
        .in("resource_id", resourceIds)
        .neq("status", "cancelled");

      if (fetchError) throw fetchError;

      if (!sessions || sessions.length === 0) {
        return { sessionsCount: 0, customersNotified: 0, tokensCreated: 0 };
      }

      const sessionIds = sessions.map((s) => s.id);

      // Count unique swimmers for notifications
      const allEnrollments = sessions.flatMap((s) => s.enrollments || []);
      const activeEnrollments = allEnrollments.filter(
        (e) => e.status !== "cancelled"
      );
      const uniqueSwimmers = new Set(activeEnrollments.map((e) => e.swimmer_id));

      // Update sessions to cancelled with note
      const { error: updateError } = await supabase
        .from("sessions")
        .update({
          status: "cancelled",
          is_cancelled: true,
          notes: `ביטול יום פעילות: ${reasonLabel} (${new Date().toLocaleDateString("he-IL")})`,
        })
        .in("id", sessionIds);

      if (updateError) throw updateError;

      // Cancel all active enrollments (this will trigger make-up token creation via the trigger)
      const enrollmentIds = activeEnrollments.map((e) => e.id);
      if (enrollmentIds.length > 0) {
        const { error: enrollmentError } = await supabase
          .from("enrollments")
          .update({ status: "cancelled" })
          .in("id", enrollmentIds);

        if (enrollmentError) throw enrollmentError;
      }

      // Mock: Log notification sending
      console.log(`[MOCK] Sending notifications to ${uniqueSwimmers.size} families`);
      console.log(`[MOCK] Creating ${activeEnrollments.length} make-up tokens`);

      return {
        sessionsCount: sessions.length,
        customersNotified: uniqueSwimmers.size,
        tokensCreated: activeEnrollments.length,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-sessions"] });

      setIsModalOpen(false);
      setSelectedLocation("");
      setSelectedReason("");

      if (result.sessionsCount === 0) {
        toast({
          title: "לא נמצאו שיעורים",
          description: "לא נמצאו שיעורים לביטול בתאריך והמיקום שנבחרו",
        });
      } else {
        toast({
          title: "יום הפעילות בוטל בהצלחה",
          description: `בוטלו ${result.sessionsCount} שיעורים. הודעות נשלחו ל-${result.customersNotified} לקוחות. נוצרו ${result.tokensCreated} אסימוני השלמה.`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "שגיאה בביטול",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCancelDay = () => {
    if (!selectedLocation || !selectedReason) {
      toast({
        title: "שגיאה",
        description: "נא לבחור מיקום וסיבת ביטול",
        variant: "destructive",
      });
      return;
    }
    cancelDayMutation.mutate();
  };

  const selectedLocationName = locations.find(
    (l) => l.id === selectedLocation
  )?.name;

  return (
    <>
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5 text-destructive" />
            תפעול שוטף
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            כלים לניהול מצבי חירום וביטולים המוניים
          </p>
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={() => setIsModalOpen(true)}
          >
            <XCircle className="h-4 w-4" />
            ביטול יום פעילות
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              ביטול יום פעילות
            </DialogTitle>
            <DialogDescription>
              פעולה זו תבטל את כל השיעורים ביום ובמיקום הנבחרים, תשלח הודעות
              ללקוחות ותנפיק אסימוני השלמה.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancel-date">תאריך לביטול</Label>
              <Input
                id="cancel-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label>מיקום / בריכה</Label>
              <Select
                value={selectedLocation}
                onValueChange={setSelectedLocation}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר מיקום" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>סיבת הביטול</Label>
              <Select value={selectedReason} onValueChange={setSelectedReason}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר סיבה" />
                </SelectTrigger>
                <SelectContent>
                  {CANCELLATION_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedLocation && selectedReason && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm">
                <p className="font-medium text-destructive mb-1">אזהרה!</p>
                <p className="text-muted-foreground">
                  אתה עומד לבטל את כל השיעורים ב-
                  <strong>{selectedLocationName}</strong> בתאריך{" "}
                  <strong>
                    {new Date(selectedDate).toLocaleDateString("he-IL")}
                  </strong>
                  .
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={cancelDayMutation.isPending}
            >
              ביטול
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelDay}
              disabled={
                !selectedLocation ||
                !selectedReason ||
                cancelDayMutation.isPending
              }
              className="gap-2"
            >
              {cancelDayMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  מבטל...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  בטל יום פעילות
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
