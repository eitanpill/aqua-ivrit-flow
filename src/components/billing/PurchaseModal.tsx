import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import {
  AdaptiveModal,
  AdaptiveModalContent,
  AdaptiveModalHeader,
  AdaptiveModalTitle,
  AdaptiveModalDescription,
  AdaptiveModalFooter,
} from "@/components/ui/adaptive-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CreditCard, Package, Sparkles, Check, CheckCircle2 } from "lucide-react";
import confetti from "canvas-confetti";

interface PurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  swimmerId?: string;
}

interface PurchaseResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    transaction_id: string;
    transaction_ref: string;
    invoice_number: string | null;
    product: {
      id: string;
      name: string;
      type: string;
      price: number;
    };
    subscription: {
      id: string;
      status: string;
      start_date: string;
      end_date: string | null;
    } | null;
    wallet: {
      credits_added: number;
      new_balance: number;
    } | null;
  };
}

const PurchaseModal = ({ open, onOpenChange, swimmerId }: PurchaseModalProps) => {
  const { user } = useAuth();
  const { isDemoMode, blockDemoAction } = useDemoMode();
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  // Fetch available products
  const { data: products, isLoading } = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("price", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Trigger confetti celebration
  const triggerConfetti = () => {
    const end = Date.now() + 2000;
    const colors = ['#22c55e', '#3b82f6', '#8b5cf6'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  };

  // Purchase mutation using edge function
  const purchaseMutation = useMutation({
    mutationFn: async (productId: string): Promise<PurchaseResponse> => {
      if (!user) throw new Error("משתמש לא מחובר");

      const { data, error } = await supabase.functions.invoke('process-purchase', {
        body: {
          product_id: productId,
          swimmer_id: swimmerId,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'שגיאה בעיבוד הרכישה');
      }

      if (!data.success) {
        throw new Error(data.error || 'הרכישה נכשלה');
      }

      return data as PurchaseResponse;
    },
    onSuccess: (response) => {
      // Trigger celebration
      triggerConfetti();
      
      // Show success toast
      toast.success(response.message || "הרכישה הושלמה בהצלחה!", {
        description: response.data?.invoice_number 
          ? `מספר חשבונית: ${response.data.invoice_number}`
          : undefined,
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        duration: 5000,
      });

      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["customer-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });

      // Close modal and reset selection
      onOpenChange(false);
      setSelectedProduct(null);
    },
    onError: (error: Error) => {
      toast.error("שגיאה ברכישה", {
        description: error.message,
      });
    },
  });

  const handlePurchase = () => {
    if (isDemoMode) {
      blockDemoAction("רכישה");
      return;
    }
    if (selectedProduct) {
      purchaseMutation.mutate(selectedProduct);
    }
  };

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
      case "single_session":
        return "שיעור בודד";
      case "trial":
        return "שיעור ניסיון";
      default:
        return type;
    }
  };

  return (
    <AdaptiveModal open={open} onOpenChange={onOpenChange}>
      <AdaptiveModalContent className="max-w-2xl">
        <AdaptiveModalHeader>
          <AdaptiveModalTitle className="text-xl">רכישת קרדיטים</AdaptiveModalTitle>
          <AdaptiveModalDescription>
            בחר את החבילה המתאימה לך
          </AdaptiveModalDescription>
        </AdaptiveModalHeader>

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

        <AdaptiveModalFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            ביטול
          </Button>
          <Button
            disabled={!selectedProduct || purchaseMutation.isPending}
            onClick={handlePurchase}
            className="w-full sm:w-auto gradient-primary"
          >
            {purchaseMutation.isPending ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ml-2" />
                מעבד תשלום...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 ml-2" />
                שלם עכשיו
              </>
            )}
          </Button>
        </AdaptiveModalFooter>
      </AdaptiveModalContent>
    </AdaptiveModal>
  );
};

export default PurchaseModal;
