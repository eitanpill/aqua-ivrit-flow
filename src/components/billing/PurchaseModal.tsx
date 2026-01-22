import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CreditCard, Package, Sparkles, Check } from "lucide-react";

interface PurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PurchaseModal = ({ open, onOpenChange }: PurchaseModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  // Fetch available products
  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("price", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Mock purchase mutation (will be replaced with actual payment later)
  const purchaseMutation = useMutation({
    mutationFn: async (productId: string) => {
      const product = products?.find((p) => p.id === productId);
      if (!product || !user) throw new Error("מוצר או משתמש לא נמצאו");

      // Create transaction record
      const { error: transactionError } = await (supabase
        .from("transactions" as any)
        .insert({
          user_id: user.id,
          amount: product.price,
          type: "credit_purchase",
          status: "pending",
          description: `רכישת ${product.name}`,
        }) as any);

      if (transactionError) throw transactionError;

      // Note: In production, this would redirect to payment gateway
      // For now, we just show a message
      return product;
    },
    onSuccess: (product) => {
      toast.success(`רכישת "${product.name}" נרשמה. המתן לאישור תשלום.`, {
        description: "בקרוב תתווסף אפשרות תשלום מלאה",
      });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      onOpenChange(false);
      setSelectedProduct(null);
    },
    onError: (error) => {
      toast.error("שגיאה ברכישה", {
        description: error.message,
      });
    },
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
    }).format(price);
  };

  const getProductIcon = (type: string) => {
    switch (type) {
      case "subscription":
        return <Sparkles className="h-5 w-5" />;
      case "punch_card":
        return <Package className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  const getProductTypeLabel = (type: string) => {
    switch (type) {
      case "subscription":
        return "מנוי";
      case "punch_card":
        return "כרטיסייה";
      default:
        return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">רכישת קרדיטים</DialogTitle>
          <DialogDescription>
            בחר את החבילה המתאימה לך
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {products.map((product) => (
                <Card
                  key={product.id}
                  className={`cursor-pointer transition-all hover:border-primary ${
                    selectedProduct === product.id
                      ? "border-2 border-primary bg-primary/5"
                      : ""
                  }`}
                  onClick={() => setSelectedProduct(product.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-2 text-primary">
                          {getProductIcon(product.type)}
                        </div>
                        <div>
                          <h3 className="font-semibold">{product.name}</h3>
                          <Badge variant="secondary" className="mt-1">
                            {getProductTypeLabel(product.type)}
                          </Badge>
                        </div>
                      </div>
                      {selectedProduct === product.id && (
                        <div className="rounded-full bg-primary p-1 text-primary-foreground">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    {product.description && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {product.description}
                      </p>
                    )}

                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {product.credits_amount && (
                          <span>{product.credits_amount} קרדיטים</span>
                        )}
                        {product.duration_days && (
                          <span> • {product.duration_days} ימים</span>
                        )}
                      </div>
                      <div className="text-lg font-bold text-primary">
                        {formatPrice(Number(product.price))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">אין מוצרים זמינים כרגע</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            disabled={!selectedProduct || purchaseMutation.isPending}
            onClick={() => selectedProduct && purchaseMutation.mutate(selectedProduct)}
          >
            {purchaseMutation.isPending ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                מעבד...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                המשך לתשלום
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseModal;
