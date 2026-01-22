import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sparkles, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { formatCurrency } from "@/lib/pricingCalculator";

interface Subscription {
  id: string;
  swimmer_id: string;
  product_id: string;
  start_date: string;
  end_date: string | null;
  status: string;
  price_override: number | null;
  created_at: string;
  swimmer: {
    first_name: string;
    last_name: string;
  };
  product: {
    name: string;
    price: number;
    type: string;
  };
}

const SubscriptionsManager = () => {
  const { user, isStaff } = useAuth();

  // Fetch subscriptions
  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["subscriptions", user?.id, isStaff],
    queryFn: async () => {
      let query = (supabase
        .from("subscriptions" as any)
        .select(`
          *,
          swimmer:swimmers(first_name, last_name),
          product:products(name, price, type)
        `)
        .order("created_at", { ascending: false }) as any);

      if (!isStaff) {
        query = query.eq("parent_id", user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Subscription[];
    },
    enabled: !!user?.id,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      paused: "secondary",
      cancelled: "destructive",
      expired: "outline",
    };
    const labels: Record<string, string> = {
      active: "פעיל",
      paused: "מושהה",
      cancelled: "מבוטל",
      expired: "פג תוקף",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getProductTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      subscription: "מנוי",
      punch_card: "כרטיסייה",
      single_session: "שיעור בודד",
      trial: "ניסיון",
    };
    return (
      <Badge variant="outline">
        {labels[type] || type}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          מנויים פעילים
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : subscriptions && subscriptions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שחיין</TableHead>
                <TableHead className="text-right">מוצר</TableHead>
                <TableHead className="text-right">סוג</TableHead>
                <TableHead className="text-right">תאריך התחלה</TableHead>
                <TableHead className="text-right">תאריך סיום</TableHead>
                <TableHead className="text-right">מחיר</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {sub.swimmer.first_name} {sub.swimmer.last_name}
                    </div>
                  </TableCell>
                  <TableCell>{sub.product.name}</TableCell>
                  <TableCell>{getProductTypeBadge(sub.product.type)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(sub.start_date), "dd/MM/yyyy", { locale: he })}
                    </div>
                  </TableCell>
                  <TableCell>
                    {sub.end_date
                      ? format(new Date(sub.end_date), "dd/MM/yyyy", { locale: he })
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(sub.price_override || Number(sub.product.price))}
                  </TableCell>
                  <TableCell>{getStatusBadge(sub.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">אין מנויים פעילים</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SubscriptionsManager;
