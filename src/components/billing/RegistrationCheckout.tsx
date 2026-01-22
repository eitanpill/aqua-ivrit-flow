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
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CreditCard,
  Package,
  Sparkles,
  Check,
  CalendarIcon,
  Users,
  Percent,
  Calculator,
  Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { formatCurrency } from "@/lib/pricingCalculator";

interface RegistrationCheckoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PricingBreakdown {
  base_amount: number;
  proration_discount: number;
  family_discount: number;
  final_amount: number;
}

const RegistrationCheckout = ({ open, onOpenChange }: RegistrationCheckoutProps) => {
  const { user, isStaff } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSwimmer, setSelectedSwimmer] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [breakdown, setBreakdown] = useState<PricingBreakdown | null>(null);

  // isStaff is now from useAuth hook

  // Fetch swimmers
  const { data: swimmers } = useQuery({
    queryKey: ["swimmers-for-checkout", user?.id, isStaff],
    queryFn: async () => {
      let query = supabase.from("swimmers").select("*");
      
      if (!isStaff) {
        query = query.eq("parent_id", user?.id);
      }
      
      const { data, error } = await query.order("first_name");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ["products-checkout"],
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

  // Fetch current term
  const { data: currentTerm } = useQuery({
    queryKey: ["current-term"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terms")
        .select("*")
        .eq("active", true)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  // Fetch family discount info
  const { data: familyInfo } = useQuery({
    queryKey: ["family-discount", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("check_family_discount", {
        p_parent_id: user?.id,
      });
      if (error) throw error;
      return data as { active_children: number; applicable_discount: { name: string; value: number } | null };
    },
    enabled: !!user?.id,
  });

  // Calculate breakdown when selections change
  const calculateBreakdown = () => {
    if (!selectedProduct || !products) return;
    
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const baseAmount = Number(product.price);
    let prorationDiscount = 0;
    let familyDiscount = 0;

    // Calculate proration if we have a term and start date is after term start
    if (currentTerm) {
      const termStart = new Date(currentTerm.start_date);
      const termEnd = new Date(currentTerm.end_date);
      
      if (startDate > termStart) {
        const totalDays = Math.ceil((termEnd.getTime() - termStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const remainingDays = Math.ceil((termEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const factor = remainingDays / totalDays;
        prorationDiscount = baseAmount - Math.round(baseAmount * factor * 100) / 100;
      }
    }

    // Apply family discount
    if (familyInfo?.applicable_discount) {
      const afterProration = baseAmount - prorationDiscount;
      familyDiscount = Math.round(afterProration * (familyInfo.applicable_discount.value / 100) * 100) / 100;
    }

    const finalAmount = Math.max(0, baseAmount - prorationDiscount - familyDiscount);

    setBreakdown({
      base_amount: baseAmount,
      proration_discount: prorationDiscount,
      family_discount: familyDiscount,
      final_amount: finalAmount,
    });
  };

  // Recalculate when selections change
  useState(() => {
    calculateBreakdown();
  });

  // Update breakdown when dependencies change
  const handleSelectionChange = (type: "swimmer" | "product" | "date", value: any) => {
    if (type === "swimmer") setSelectedSwimmer(value);
    if (type === "product") setSelectedProduct(value);
    if (type === "date") setStartDate(value);
    
    // Defer calculation to next tick
    setTimeout(calculateBreakdown, 0);
  };

  // Charge & Enroll mutation
  const chargeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSwimmer || !selectedProduct || !user) {
        throw new Error("נא לבחור שחיין ומוצר");
      }

      const swimmer = swimmers?.find(s => s.id === selectedSwimmer);
      
      const { data, error } = await (supabase.rpc as any)("create_charge_with_calculations", {
        p_parent_id: swimmer?.parent_id || user.id,
        p_swimmer_id: selectedSwimmer,
        p_product_id: selectedProduct,
        p_start_date: format(startDate, "yyyy-MM-dd"),
        p_apply_family_discount: true,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; charge_id?: string };
      if (!result.success) {
        throw new Error(result.error || "שגיאה ביצירת החיוב");
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success("החיוב נוצר בהצלחה!", {
        description: "ניתן לסמן כשולם בדוח החובות",
      });
      queryClient.invalidateQueries({ queryKey: ["charges"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["family-discount"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("שגיאה ביצירת החיוב", {
        description: error.message,
      });
    },
  });

  const resetForm = () => {
    setSelectedSwimmer(null);
    setSelectedProduct(null);
    setStartDate(new Date());
    setBreakdown(null);
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
        return "ניסיון";
      default:
        return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="h-5 w-5" />
            קופה - רישום והרשמה
          </DialogTitle>
          <DialogDescription>
            בחר שחיין, מוצר ותאריך התחלה לחישוב המחיר
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Step 1: Select Swimmer */}
          <div className="space-y-2">
            <label className="text-sm font-medium">בחר שחיין</label>
            <Select
              value={selectedSwimmer || ""}
              onValueChange={(value) => handleSelectionChange("swimmer", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר שחיין..." />
              </SelectTrigger>
              <SelectContent>
                {swimmers?.map((swimmer) => (
                  <SelectItem key={swimmer.id} value={swimmer.id}>
                    {swimmer.first_name} {swimmer.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Select Product */}
          <div className="space-y-2">
            <label className="text-sm font-medium">בחר מוצר</label>
            <div className="grid gap-3 sm:grid-cols-2">
              {products?.map((product) => (
                <Card
                  key={product.id}
                  className={`cursor-pointer transition-all hover:border-primary ${
                    selectedProduct === product.id
                      ? "border-2 border-primary bg-primary/5"
                      : ""
                  }`}
                  onClick={() => handleSelectionChange("product", product.id)}
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
                    <div className="mt-3 text-lg font-bold text-primary">
                      {formatCurrency(Number(product.price))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Step 3: Start Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium">תאריך התחלה</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-right"
                >
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  {format(startDate, "dd/MM/yyyy", { locale: he })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && handleSelectionChange("date", date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {currentTerm && (
              <p className="text-xs text-muted-foreground">
                עונה נוכחית: {currentTerm.name} ({format(new Date(currentTerm.start_date), "dd/MM")} - {format(new Date(currentTerm.end_date), "dd/MM")})
              </p>
            )}
          </div>

          {/* Family Discount Info */}
          {familyInfo && familyInfo.active_children > 0 && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">
                    {familyInfo.active_children} ילדים פעילים במשפחה
                  </p>
                  {familyInfo.applicable_discount && (
                    <p className="text-sm text-green-600">
                      <Percent className="h-3 w-3 inline ml-1" />
                      {familyInfo.applicable_discount.name} - {familyInfo.applicable_discount.value}% הנחה
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pricing Breakdown */}
          {breakdown && selectedProduct && (
            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <Calculator className="h-5 w-5" />
                  פירוט מחיר
                </div>
                
                <Separator />
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>מחיר בסיס</span>
                    <span>{formatCurrency(breakdown.base_amount)}</span>
                  </div>
                  
                  {breakdown.proration_discount > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>הנחת פרורציה (כניסה באמצע עונה)</span>
                      <span>-{formatCurrency(breakdown.proration_discount)}</span>
                    </div>
                  )}
                  
                  {breakdown.family_discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>
                        {familyInfo?.applicable_discount?.name || "הנחת משפחה"}
                      </span>
                      <span>-{formatCurrency(breakdown.family_discount)}</span>
                    </div>
                  )}
                  
                  <Separator />
                  
                  <div className="flex justify-between text-lg font-bold">
                    <span>סה"כ לתשלום</span>
                    <span className="text-primary">{formatCurrency(breakdown.final_amount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            disabled={!selectedSwimmer || !selectedProduct || chargeMutation.isPending}
            onClick={() => chargeMutation.mutate()}
          >
            {chargeMutation.isPending ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ml-2" />
                מעבד...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 ml-2" />
                חייב והרשם
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrationCheckout;
