import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type ProductType = "subscription" | "punch_card" | "single_session" | "trial";

interface Product {
  id: string;
  name: string;
  description: string | null;
  type: ProductType;
  price: number;
  credits_amount: number | null;
  duration_days: number | null;
  active: boolean;
}

interface ProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

export function ProductModal({ open, onOpenChange, product }: ProductModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeSchoolId } = useSchool();
  const isEditMode = !!product;

  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "subscription" as ProductType,
    price: "",
    credits_amount: "",
    duration_days: "",
    active: true,
  });

  // Reset form when modal opens/closes or product changes
  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        description: product.description || "",
        type: product.type,
        price: product.price.toString(),
        credits_amount: product.credits_amount?.toString() || "",
        duration_days: product.duration_days?.toString() || "",
        active: product.active,
      });
    } else {
      setForm({
        name: "",
        description: "",
        type: "subscription",
        price: "",
        credits_amount: "",
        duration_days: "",
        active: true,
      });
    }
  }, [product, open]);

  const createMutation = useMutation({
    mutationFn: async (newProduct: {
      name: string;
      description: string;
      type: ProductType;
      price: number;
      credits_amount: number | null;
      duration_days: number | null;
      active: boolean;
    }) => {
      const { error } = await supabase.from("products" as any).insert([{
        ...newProduct,
        school_id: activeSchoolId,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
      toast({ title: "המוצר נוסף בהצלחה" });
    },
    onError: (error: Error) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedProduct: {
      id: string;
      name: string;
      description: string;
      type: ProductType;
      price: number;
      credits_amount: number | null;
      duration_days: number | null;
      active: boolean;
    }) => {
      const { id, ...data } = updatedProduct;
      const { error } = await supabase
        .from("products" as any)
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
      toast({ title: "המוצר עודכן בהצלחה" });
    },
    onError: (error: Error) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "שגיאה", description: "שם המוצר הוא שדה חובה", variant: "destructive" });
      return;
    }
    if (!form.price || parseFloat(form.price) < 0) {
      toast({ title: "שגיאה", description: "יש להזין מחיר תקין", variant: "destructive" });
      return;
    }

    const productData = {
      name: form.name,
      description: form.description,
      type: form.type,
      price: parseFloat(form.price),
      credits_amount: form.credits_amount ? parseInt(form.credits_amount) : null,
      duration_days: form.duration_days ? parseInt(form.duration_days) : null,
      active: form.active,
    };

    if (isEditMode && product) {
      updateMutation.mutate({ id: product.id, ...productData });
    } else {
      createMutation.mutate(productData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "עריכת מוצר" : "הוספת מוצר חדש"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-name">שם המוצר *</Label>
            <Input
              id="product-name"
              placeholder='לדוגמה: "מנוי חודשי"'
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-desc">תיאור</Label>
            <Textarea
              id="product-desc"
              placeholder="תיאור המוצר"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>סוג המוצר</Label>
              <Select
                value={form.type}
                onValueChange={(value: ProductType) => setForm({ ...form, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscription">מנוי</SelectItem>
                  <SelectItem value="punch_card">כרטיסייה</SelectItem>
                  <SelectItem value="single_session">שיעור בודד</SelectItem>
                  <SelectItem value="trial">שיעור ניסיון</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-price">מחיר (₪) *</Label>
              <Input
                id="product-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                dir="ltr"
                className="text-left"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-credits">מספר ניקובים/כניסות</Label>
              <Input
                id="product-credits"
                type="number"
                min="1"
                placeholder='לדוגמה: 10'
                value={form.credits_amount}
                onChange={(e) => setForm({ ...form, credits_amount: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-duration">תוקף (ימים)</Label>
              <Input
                id="product-duration"
                type="number"
                min="1"
                placeholder='לדוגמה: 30'
                value={form.duration_days}
                onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="product-active"
              checked={form.active}
              onCheckedChange={(checked) => setForm({ ...form, active: checked })}
            />
            <Label htmlFor="product-active">מוצר פעיל (זמין למכירה)</Label>
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1 gradient-primary" disabled={isPending}>
              {isPending ? "שומר..." : isEditMode ? "שמור שינויים" : "הוסף"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
