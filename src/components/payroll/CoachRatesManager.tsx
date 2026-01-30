import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wallet, Save, Loader2, Edit2, X, Check, User, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface CoachWithRate {
  coach_id: string;
  first_name: string | null;
  last_name: string | null;
  rate_per_hour: number;
  per_student_bonus: number;
  effective_from: string | null;
}

export function CoachRatesManager() {
  const queryClient = useQueryClient();
  const { activeSchoolId } = useSchool();
  const [editingCoachId, setEditingCoachId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");
  const [editBonus, setEditBonus] = useState("");

  // Fetch all coaches with their current rates
  const { data: coachesWithRates, isLoading } = useQuery({
    queryKey: ["coaches-with-rates", activeSchoolId],
    queryFn: async () => {
      // Get all coaches (role = 'coach' or 'admin')
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("school_id", activeSchoolId)
        .in("role", ["coach", "admin"])
        .eq("is_deleted", false);

      if (profilesError) throw profilesError;

      // Get current rates for all coaches
      const coachIds = profiles?.map((p) => p.id) || [];
      const { data: rates, error: ratesError } = await supabase
        .from("coach_rates")
        .select("*")
        .in("coach_id", coachIds)
        .order("effective_from", { ascending: false });

      if (ratesError) throw ratesError;

      // Map rates to coaches (get latest rate per coach)
      const ratesByCoach = new Map<string, typeof rates[0]>();
      rates?.forEach((rate) => {
        if (!ratesByCoach.has(rate.coach_id)) {
          ratesByCoach.set(rate.coach_id, rate);
        }
      });

      return profiles?.map((profile) => {
        const rate = ratesByCoach.get(profile.id);
        return {
          coach_id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          rate_per_hour: rate?.rate_per_hour || 0,
          per_student_bonus: rate?.per_student_bonus || 0,
          effective_from: rate?.effective_from || null,
        } as CoachWithRate;
      }) || [];
    },
    enabled: !!activeSchoolId,
  });

  // Save rate mutation
  const saveRateMutation = useMutation({
    mutationFn: async ({ coachId, rate, bonus }: { coachId: string; rate: number; bonus: number }) => {
      const { error } = await supabase.from("coach_rates").insert({
        coach_id: coachId,
        rate_per_hour: rate,
        per_student_bonus: bonus,
        effective_from: format(new Date(), "yyyy-MM-dd"),
        school_id: activeSchoolId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coaches-with-rates", activeSchoolId] });
      queryClient.invalidateQueries({ queryKey: ["payroll-summary", activeSchoolId] });
      toast.success("התעריף עודכן בהצלחה");
      setEditingCoachId(null);
    },
    onError: () => {
      toast.error("שגיאה בעדכון התעריף");
    },
  });

  const startEditing = (coach: CoachWithRate) => {
    setEditingCoachId(coach.coach_id);
    setEditRate(coach.rate_per_hour.toString());
    setEditBonus(coach.per_student_bonus.toString());
  };

  const cancelEditing = () => {
    setEditingCoachId(null);
    setEditRate("");
    setEditBonus("");
  };

  const saveRate = (coachId: string) => {
    saveRateMutation.mutate({
      coachId,
      rate: parseFloat(editRate) || 0,
      bonus: parseFloat(editBonus) || 0,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          תעריפי מאמנים
        </CardTitle>
        <CardDescription>
          הגדרת שכר בסיס ובונוסים לכל מאמן
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!coachesWithRates?.length ? (
          <p className="text-center text-muted-foreground py-8">
            אין מאמנים במערכת
          </p>
        ) : (
          <div className="space-y-3">
            {coachesWithRates.map((coach) => (
              <div
                key={coach.coach_id}
                className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {coach.first_name || ""} {coach.last_name || ""}
                    </p>
                    {coach.effective_from && (
                      <p className="text-xs text-muted-foreground">
                        עדכון אחרון: {new Date(coach.effective_from).toLocaleDateString("he-IL")}
                      </p>
                    )}
                  </div>
                </div>

                {editingCoachId === coach.coach_id ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        className="w-20 h-8 text-center text-sm"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        placeholder="בסיס"
                      />
                      <span className="text-xs text-muted-foreground">₪/שיעור</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        className="w-16 h-8 text-center text-sm"
                        value={editBonus}
                        onChange={(e) => setEditBonus(e.target.value)}
                        placeholder="בונוס"
                      />
                      <span className="text-xs text-muted-foreground">₪/תלמיד</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-green-600"
                      onClick={() => saveRate(coach.coach_id)}
                      disabled={saveRateMutation.isPending}
                    >
                      {saveRateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={cancelEditing}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <div className="flex items-center gap-1 text-sm">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">₪{coach.rate_per_hour}</span>
                        <span className="text-muted-foreground">/שיעור</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>+₪{coach.per_student_bonus}</span>
                        <span>/תלמיד</span>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => startEditing(coach)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
