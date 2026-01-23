import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Wallet, 
  Calculator, 
  Download, 
  Plus, 
  Minus, 
  Loader2, 
  ChevronRight, 
  ChevronLeft,
  Users,
  Calendar as CalendarIcon
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, startOfMonth, subMonths, addMonths } from "date-fns";
import { he } from "date-fns/locale";
import { AdaptiveTable, type AdaptiveColumn, type AdaptiveAction } from "@/components/ui/adaptive-table";

interface CoachPayroll {
  coach_id: string;
  coach_name: string;
  payroll: {
    base_rate: number;
    per_student_bonus: number;
    completed_sessions: number;
    total_students_attended: number;
    base_pay: number;
    bonus_pay: number;
    adjustments_total: number;
    total_pay: number;
  };
}

interface PayrollAdjustment {
  id: string;
  coach_id: string;
  month: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export default function Payroll() {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [adjustmentDialog, setAdjustmentDialog] = useState<{
    open: boolean;
    coachId: string | null;
    coachName: string;
    type: "bonus" | "deduction";
  }>({ open: false, coachId: null, coachName: "", type: "bonus" });
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentDescription, setAdjustmentDescription] = useState("");

  // Fetch payroll summary
  const { data: payrollData, isLoading } = useQuery({
    queryKey: ["payroll-summary", format(selectedMonth, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_monthly_payroll_summary", {
        p_month: format(selectedMonth, "yyyy-MM-dd"),
      });

      if (error) throw error;
      
      // Handle the JSON response properly
      if (!data || !Array.isArray(data)) return [];
      return data as unknown as CoachPayroll[];
    },
  });

  // Fetch adjustments for the month
  const { data: adjustments } = useQuery({
    queryKey: ["payroll-adjustments", format(selectedMonth, "yyyy-MM-01")],
    queryFn: async () => {
      const monthStart = format(selectedMonth, "yyyy-MM-01");
      const { data, error } = await supabase
        .from("payroll_adjustments")
        .select("*")
        .gte("month", monthStart)
        .lt("month", format(addMonths(selectedMonth, 1), "yyyy-MM-01"))
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PayrollAdjustment[];
    },
  });

  // Add adjustment mutation
  const addAdjustmentMutation = useMutation({
    mutationFn: async ({
      coachId,
      amount,
      description,
    }: {
      coachId: string;
      amount: number;
      description: string;
    }) => {
      const { error } = await supabase.from("payroll_adjustments").insert({
        coach_id: coachId,
        month: format(selectedMonth, "yyyy-MM-15"),
        amount,
        description,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-summary"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-adjustments"] });
      toast.success("ההתאמה נוספה בהצלחה");
      resetAdjustmentDialog();
    },
    onError: () => {
      toast.error("שגיאה בהוספת התאמה");
    },
  });

  const resetAdjustmentDialog = () => {
    setAdjustmentDialog({ open: false, coachId: null, coachName: "", type: "bonus" });
    setAdjustmentAmount("");
    setAdjustmentDescription("");
  };

  const handleAddAdjustment = () => {
    if (!adjustmentDialog.coachId || !adjustmentAmount) return;

    const amount = parseFloat(adjustmentAmount);
    const finalAmount = adjustmentDialog.type === "deduction" ? -amount : amount;

    addAdjustmentMutation.mutate({
      coachId: adjustmentDialog.coachId,
      amount: finalAmount,
      description: adjustmentDescription || (adjustmentDialog.type === "bonus" ? "בונוס" : "ניכוי"),
    });
  };

  const exportToCSV = () => {
    if (!payrollData?.length) return;

    const headers = ["שם מאמן", "שיעורים", "תלמידים", "תשלום בסיס", "בונוס תלמידים", "התאמות", "סה״כ"];
    const rows = payrollData.map((coach) => [
      coach.coach_name,
      coach.payroll.completed_sessions,
      coach.payroll.total_students_attended,
      coach.payroll.base_pay,
      coach.payroll.bonus_pay,
      coach.payroll.adjustments_total,
      coach.payroll.total_pay,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payroll-${format(selectedMonth, "yyyy-MM")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("הקובץ הורד בהצלחה");
  };

  const totalPayroll = payrollData?.reduce((sum, coach) => sum + (coach.payroll?.total_pay || 0), 0) || 0;

  // Define columns for AdaptiveTable
  const columns: AdaptiveColumn<CoachPayroll>[] = [
    {
      key: "name",
      header: "מאמן",
      primary: true,
      render: (coach) => <span className="font-medium">{coach.coach_name}</span>,
    },
    {
      key: "sessions",
      header: "שיעורים",
      render: (coach) => <span>{coach.payroll?.completed_sessions || 0}</span>,
    },
    {
      key: "students",
      header: "תלמידים",
      hideOnMobile: true,
      render: (coach) => <span>{coach.payroll?.total_students_attended || 0}</span>,
    },
    {
      key: "base_rate",
      header: "בסיס לשיעור",
      hideOnMobile: true,
      render: (coach) => <span>₪{coach.payroll?.base_rate || 0}</span>,
    },
    {
      key: "bonus_rate",
      header: "בונוס לתלמיד",
      hideOnMobile: true,
      render: (coach) => <span>₪{coach.payroll?.per_student_bonus || 0}</span>,
    },
    {
      key: "base_pay",
      header: "תשלום בסיס",
      hideOnMobile: true,
      render: (coach) => <span>₪{coach.payroll?.base_pay || 0}</span>,
    },
    {
      key: "bonus_pay",
      header: "בונוסים",
      render: (coach) => (
        <span className="text-green-600">₪{coach.payroll?.bonus_pay || 0}</span>
      ),
    },
    {
      key: "adjustments",
      header: "התאמות",
      hideOnMobile: true,
      render: (coach) => (
        <Badge
          variant={
            (coach.payroll?.adjustments_total || 0) > 0
              ? "default"
              : (coach.payroll?.adjustments_total || 0) < 0
              ? "destructive"
              : "outline"
          }
        >
          ₪{coach.payroll?.adjustments_total || 0}
        </Badge>
      ),
    },
    {
      key: "total",
      header: "סה״כ",
      render: (coach) => (
        <span className="font-bold text-lg">₪{coach.payroll?.total_pay || 0}</span>
      ),
    },
  ];

  // Define actions for AdaptiveTable
  const actions: AdaptiveAction<CoachPayroll>[] = [
    {
      label: "הוסף בונוס",
      icon: Plus,
      onClick: (coach) =>
        setAdjustmentDialog({
          open: true,
          coachId: coach.coach_id,
          coachName: coach.coach_name,
          type: "bonus",
        }),
    },
    {
      label: "הוסף ניכוי",
      icon: Minus,
      variant: "destructive",
      onClick: (coach) =>
        setAdjustmentDialog({
          open: true,
          coachId: coach.coach_id,
          coachName: coach.coach_name,
          type: "deduction",
        }),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">דוח שכר</h1>
          <p className="text-muted-foreground mt-1">חישוב וניהול משכורות מאמנים</p>
        </div>
        <Button onClick={exportToCSV} disabled={!payrollData?.length} variant="outline">
          <Download className="h-4 w-4 ml-2" />
          ייצוא CSV
        </Button>
      </div>

      {/* Month Selector */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 min-w-[200px] justify-center">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              <span className="text-xl font-semibold">
                {format(selectedMonth, "MMMM yyyy", { locale: he })}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">מאמנים פעילים</p>
                <p className="text-2xl font-bold">{payrollData?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/20">
                <Calculator className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">סה״כ שיעורים</p>
                <p className="text-2xl font-bold">
                  {payrollData?.reduce((sum, c) => sum + (c.payroll?.completed_sessions || 0), 0) || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/20">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">סה״כ לתשלום</p>
                <p className="text-2xl font-bold">₪{totalPayroll.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Table */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            פירוט שכר מאמנים
          </CardTitle>
          <CardDescription>
            חישוב אוטומטי לפי שיעורים שהושלמו ונוכחות תלמידים
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AdaptiveTable
              data={payrollData || []}
              columns={columns}
              actions={actions}
              keyExtractor={(coach) => coach.coach_id}
              emptyMessage="אין מאמנים עם נתוני שכר לחודש זה"
            />
          )}
        </CardContent>
      </Card>

      {/* Recent Adjustments */}
      {adjustments && adjustments.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">התאמות אחרונות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {adjustments.slice(0, 5).map((adj) => {
                const coach = payrollData?.find((c) => c.coach_id === adj.coach_id);
                return (
                  <div
                    key={adj.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={adj.amount > 0 ? "default" : "destructive"}>
                        {adj.amount > 0 ? "+" : ""}₪{adj.amount}
                      </Badge>
                      <span className="font-medium">{coach?.coach_name || "מאמן"}</span>
                      <span className="text-muted-foreground text-sm">
                        {adj.description || "-"}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(adj.created_at).toLocaleDateString("he-IL")}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Adjustment Dialog */}
      <Dialog open={adjustmentDialog.open} onOpenChange={(open) => !open && resetAdjustmentDialog()}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {adjustmentDialog.type === "bonus" ? "הוספת בונוס" : "הוספת ניכוי"}
            </DialogTitle>
            <DialogDescription>
              {adjustmentDialog.coachName} - {format(selectedMonth, "MMMM yyyy", { locale: he })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>סכום (₪)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                placeholder="הזן סכום"
                className="text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label>תיאור</Label>
              <Textarea
                value={adjustmentDescription}
                onChange={(e) => setAdjustmentDescription(e.target.value)}
                placeholder={
                  adjustmentDialog.type === "bonus"
                    ? "לדוגמה: משוב מצוין, שעות נוספות..."
                    : "לדוגמה: איחור, ביטול שיעור..."
                }
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={resetAdjustmentDialog}>
              ביטול
            </Button>
            <Button
              onClick={handleAddAdjustment}
              disabled={!adjustmentAmount || addAdjustmentMutation.isPending}
              variant={adjustmentDialog.type === "bonus" ? "default" : "destructive"}
            >
              {addAdjustmentMutation.isPending && (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              )}
              {adjustmentDialog.type === "bonus" ? "הוסף בונוס" : "הוסף ניכוי"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
