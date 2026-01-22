import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  AlertTriangle,
  CreditCard,
  CheckCircle,
  XCircle,
  Download,
  Receipt,
  RefreshCw,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { he } from "date-fns/locale";
import { formatCurrency } from "@/lib/pricingCalculator";

interface FamilyDebt {
  parent_id: string;
  parent_name: string;
  parent_email: string;
  total_pending: number;
  oldest_due_date: string;
  pending_charges_count: number;
}

interface Charge {
  id: string;
  parent_id: string;
  swimmer_id: string | null;
  base_amount: number;
  proration_amount: number;
  discount_amount: number;
  final_amount: number;
  description: string | null;
  status: string;
  due_date: string;
  created_at: string;
  swimmer?: {
    first_name: string;
    last_name: string;
  };
}

const DebtsReport = () => {
  const queryClient = useQueryClient();
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    chargeId: string | null;
    action: "paid" | "failed" | null;
  }>({ open: false, chargeId: null, action: null });

  // Fetch family debts summary
  const { data: debts, isLoading: debtsLoading, refetch } = useQuery({
    queryKey: ["family-debts"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_family_debts");
      if (error) throw error;
      return data as FamilyDebt[];
    },
  });

  // Fetch charges for selected family
  const { data: familyCharges, isLoading: chargesLoading } = useQuery({
    queryKey: ["family-charges", selectedFamily],
    queryFn: async () => {
      if (!selectedFamily) return [];
      
      const { data, error } = await (supabase
        .from("charges" as any)
        .select(`
          *,
          swimmer:swimmers(first_name, last_name)
        `)
        .eq("parent_id", selectedFamily)
        .in("status", ["pending", "failed"])
        .order("due_date", { ascending: true }) as any);
      
      if (error) throw error;
      return data as Charge[];
    },
    enabled: !!selectedFamily,
  });

  // Update charge status mutation
  const updateChargeMutation = useMutation({
    mutationFn: async ({ chargeId, status }: { chargeId: string; status: string }) => {
      const updateData: Record<string, any> = { status };
      
      if (status === "paid") {
        updateData.paid_at = new Date().toISOString();
      }
      
      const { error } = await (supabase
        .from("charges" as any)
        .update(updateData)
        .eq("id", chargeId) as any);
      
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      const message = status === "paid" ? "התשלום נרשם בהצלחה" : "החיוב סומן כנכשל";
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ["family-debts"] });
      queryClient.invalidateQueries({ queryKey: ["family-charges"] });
      setConfirmDialog({ open: false, chargeId: null, action: null });
    },
    onError: (error) => {
      toast.error("שגיאה בעדכון הסטטוס", {
        description: error.message,
      });
    },
  });

  const getOverdueBadge = (dueDate: string) => {
    const days = differenceInDays(new Date(), new Date(dueDate));
    
    if (days <= 0) {
      return <Badge variant="secondary">לתשלום</Badge>;
    } else if (days <= 7) {
      return <Badge variant="outline" className="border-orange-400 text-orange-600">באיחור של {days} ימים</Badge>;
    } else if (days <= 30) {
      return <Badge variant="destructive">באיחור של {days} ימים</Badge>;
    } else {
      return <Badge variant="destructive" className="animate-pulse">חוב ישן - {days} ימים</Badge>;
    }
  };

  const exportToCSV = () => {
    if (!debts || debts.length === 0) return;

    const headers = ["שם", "אימייל", "סה\"כ חוב", "תאריך חוב ישן ביותר", "מספר חיובים"];
    const rows = debts.map((debt) => [
      debt.parent_name,
      debt.parent_email,
      debt.total_pending.toString(),
      debt.oldest_due_date,
      debt.pending_charges_count.toString(),
    ]);

    const csvContent =
      "\uFEFF" + // BOM for Hebrew
      headers.join(",") +
      "\n" +
      rows.map((row) => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `debts-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const totalDebt = debts?.reduce((sum, d) => sum + Number(d.total_pending), 0) || 0;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            דוח חובות
          </h2>
          <p className="text-muted-foreground">
            משפחות עם יתרות חוב פתוחות
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 ml-2" />
            רענן
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={!debts?.length}>
            <Download className="h-4 w-4 ml-2" />
            ייצוא CSV
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">סה"כ חובות פתוחים</p>
              <p className="text-3xl font-bold text-orange-600">
                {formatCurrency(totalDebt)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">משפחות עם חוב</p>
              <p className="text-2xl font-bold">{debts?.length || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            פירוט לפי משפחה
          </CardTitle>
        </CardHeader>
        <CardContent>
          {debtsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : debts && debts.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {debts.map((debt) => (
                <AccordionItem key={debt.parent_id} value={debt.parent_id}>
                  <AccordionTrigger
                    className="hover:no-underline"
                    onClick={() => setSelectedFamily(debt.parent_id)}
                  >
                    <div className="flex w-full items-center justify-between pl-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                          <span className="text-orange-600 font-medium">
                            {debt.parent_name.charAt(0)}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{debt.parent_name}</p>
                          <p className="text-sm text-muted-foreground">{debt.parent_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getOverdueBadge(debt.oldest_due_date)}
                        <div className="text-right">
                          <p className="font-bold text-orange-600">
                            {formatCurrency(Number(debt.total_pending))}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {debt.pending_charges_count} חיובים
                          </p>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {chargesLoading && selectedFamily === debt.parent_id ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    ) : familyCharges && familyCharges.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">תיאור</TableHead>
                            <TableHead className="text-right">שחיין</TableHead>
                            <TableHead className="text-right">תאריך חיוב</TableHead>
                            <TableHead className="text-right">סכום</TableHead>
                            <TableHead className="text-right">פעולות</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {familyCharges.map((charge) => (
                            <TableRow key={charge.id}>
                              <TableCell>{charge.description || "-"}</TableCell>
                              <TableCell>
                                {charge.swimmer
                                  ? `${charge.swimmer.first_name} ${charge.swimmer.last_name}`
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {format(new Date(charge.due_date), "dd/MM/yyyy", { locale: he })}
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatCurrency(Number(charge.final_amount))}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 hover:text-green-700"
                                    onClick={() =>
                                      setConfirmDialog({
                                        open: true,
                                        chargeId: charge.id,
                                        action: "paid",
                                      })
                                    }
                                  >
                                    <CheckCircle className="h-4 w-4 ml-1" />
                                    שולם
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() =>
                                      setConfirmDialog({
                                        open: true,
                                        chargeId: charge.id,
                                        action: "failed",
                                      })
                                    }
                                  >
                                    <XCircle className="h-4 w-4 ml-1" />
                                    נכשל
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">
                        אין חיובים פתוחים
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-lg font-medium text-green-600">אין חובות פתוחים!</p>
              <p className="text-muted-foreground">כל המשפחות מעודכנות בתשלומים</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog({ open, chargeId: null, action: null })
        }
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.action === "paid" ? "אישור תשלום" : "סימון כנכשל"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === "paid"
                ? "האם לסמן את החיוב כשולם?"
                : "האם לסמן את החיוב כנכשל?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog({ open: false, chargeId: null, action: null })
              }
            >
              ביטול
            </Button>
            <Button
              variant={confirmDialog.action === "paid" ? "default" : "destructive"}
              disabled={updateChargeMutation.isPending}
              onClick={() => {
                if (confirmDialog.chargeId && confirmDialog.action) {
                  updateChargeMutation.mutate({
                    chargeId: confirmDialog.chargeId,
                    status: confirmDialog.action,
                  });
                }
              }}
            >
              {updateChargeMutation.isPending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : confirmDialog.action === "paid" ? (
                "אשר תשלום"
              ) : (
                "סמן כנכשל"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DebtsReport;
