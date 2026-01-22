import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt, CreditCard, Plus, Download, Wallet, AlertTriangle, Sparkles, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import PurchaseModal from "@/components/billing/PurchaseModal";
import RegistrationCheckout from "@/components/billing/RegistrationCheckout";
import DebtsReport from "@/components/billing/DebtsReport";
import SubscriptionsManager from "@/components/billing/SubscriptionsManager";

// Temporary types until Supabase types are regenerated
interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  status: string;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

interface Invoice {
  id: string;
  user_id: string;
  transaction_id: string | null;
  invoice_number: string;
  amount: number;
  url: string | null;
  issued_at: string;
  created_at: string;
}

const Billing = () => {
  // Billing page - displays transactions and invoices for the current user
  const { user, isStaff, isAdmin } = useAuth();
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Fetch transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("transactions" as any)
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user?.id,
  });

  // Fetch invoices
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["invoices", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("invoices" as any)
        .select("*")
        .eq("user_id", user?.id)
        .order("issued_at", { ascending: false }) as any);

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!user?.id,
  });

  // Fetch wallet balance
  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_wallets")
        .select("credits_balance")
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
    }).format(amount);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      credit_purchase: "רכישת קרדיטים",
      class_deduction: "ניכוי שיעור",
      refund: "החזר",
      adjustment: "התאמה",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
      refunded: "outline",
    };
    const labels: Record<string, string> = {
      completed: "הושלם",
      pending: "ממתין",
      failed: "נכשל",
      refunded: "הוחזר",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            תשלומים וחשבוניות
          </h1>
          <p className="text-muted-foreground">
            ניהול תשלומים, רכישות וחשבוניות
          </p>
        </div>
        <div className="flex gap-2">
          {isStaff && (
            <Button onClick={() => setIsCheckoutOpen(true)} variant="outline" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              קופה - רישום
            </Button>
          )}
          <Button onClick={() => setIsPurchaseOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            רכישת קרדיטים
          </Button>
        </div>
      </div>

      {/* Wallet Balance Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="rounded-full bg-primary/20 p-3">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">יתרת קרדיטים</p>
            <p className="text-3xl font-bold text-primary">
              {wallet?.credits_balance ?? 0}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="transactions" className="gap-2">
            <CreditCard className="h-4 w-4" />
            תנועות
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <Receipt className="h-4 w-4" />
            חשבוניות
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="gap-2">
            <Sparkles className="h-4 w-4" />
            מנויים
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="debts" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              חובות
            </TabsTrigger>
          )}
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                היסטוריית תנועות
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : transactions && transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">תאריך</TableHead>
                      <TableHead className="text-right">תיאור</TableHead>
                      <TableHead className="text-right">סכום</TableHead>
                      <TableHead className="text-right">סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {format(new Date(transaction.created_at), "dd/MM/yyyy", {
                            locale: he,
                          })}
                        </TableCell>
                        <TableCell>
                          {transaction.description || getTypeLabel(transaction.type)}
                        </TableCell>
                        <TableCell
                          className={
                            transaction.type === "credit_purchase" ||
                            transaction.type === "refund"
                              ? "text-green-600 font-medium"
                              : "text-red-600 font-medium"
                          }
                        >
                          {transaction.type === "credit_purchase" ||
                          transaction.type === "refund"
                            ? "+"
                            : "-"}
                          {formatAmount(Math.abs(Number(transaction.amount)))}
                        </TableCell>
                        <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CreditCard className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">אין תנועות להצגה</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                חשבוניות
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : invoices && invoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">מספר חשבונית</TableHead>
                      <TableHead className="text-right">תאריך</TableHead>
                      <TableHead className="text-right">סכום</TableHead>
                      <TableHead className="text-right">חשבונית</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.issued_at), "dd/MM/yyyy", {
                            locale: he,
                          })}
                        </TableCell>
                        <TableCell>{formatAmount(Number(invoice.amount))}</TableCell>
                        <TableCell>
                          {invoice.url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-2"
                              onClick={() => window.open(invoice.url, "_blank")}
                            >
                              <Download className="h-4 w-4" />
                              הורדה
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              לא זמין
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">אין חשבוניות להצגה</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions">
          <SubscriptionsManager />
        </TabsContent>

        {/* Debts Tab (Admin only) */}
        {isAdmin && (
          <TabsContent value="debts">
            <DebtsReport />
          </TabsContent>
        )}
      </Tabs>

      {/* Purchase Modal */}
      <PurchaseModal open={isPurchaseOpen} onOpenChange={setIsPurchaseOpen} />
      
      {/* Registration Checkout Modal */}
      <RegistrationCheckout open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen} />
    </div>
  );
};

export default Billing;
