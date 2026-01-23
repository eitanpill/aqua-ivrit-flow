import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Package, Edit, Trash2, CreditCard, Calendar, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

const productTypeLabels: Record<ProductType, string> = {
  subscription: "מנוי",
  punch_card: "כרטיסייה",
  single_session: "שיעור בודד",
  trial: "שיעור ניסיון",
};

const productTypeIcons: Record<ProductType, React.ReactNode> = {
  subscription: <Calendar className="h-4 w-4" />,
  punch_card: <Ticket className="h-4 w-4" />,
  single_session: <CreditCard className="h-4 w-4" />,
  trial: <Package className="h-4 w-4" />,
};

export default function Products() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeSchoolId } = useSchool();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "subscription" as ProductType,
    price: "",
    credits_amount: "",
    duration_days: "",
    active: true,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

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
      setIsDialogOpen(false);
      setForm({
        name: "",
        description: "",
        type: "subscription",
        price: "",
        credits_amount: "",
        duration_days: "",
        active: true,
      });
      toast({ title: "המוצר נוסף בהצלחה" });
    },
    onError: (error: Error) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "המוצר נמחק בהצלחה" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("products" as any).update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
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
    createMutation.mutate({
      name: form.name,
      description: form.description,
      type: form.type,
      price: parseFloat(form.price),
      credits_amount: form.credits_amount ? parseInt(form.credits_amount) : null,
      duration_days: form.duration_days ? parseInt(form.duration_days) : null,
      active: form.active,
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
    }).format(price);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">ניהול מוצרים</h1>
          <p className="text-muted-foreground mt-1">מוצרים ומחירון</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary gap-2">
              <Plus className="h-4 w-4" />
              הוסף מוצר
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>הוספת מוצר חדש</DialogTitle>
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
                <Button type="submit" className="flex-1 gradient-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "מוסיף..." : "הוסף"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  ביטול
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Product Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">סה"כ מוצרים</p>
                <p className="text-2xl font-bold">{products?.length || 0}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">מנויים</p>
                <p className="text-2xl font-bold">
                  {products?.filter((p) => p.type === "subscription").length || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">כרטיסיות</p>
                <p className="text-2xl font-bold">
                  {products?.filter((p) => p.type === "punch_card").length || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Ticket className="h-5 w-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">מוצרים פעילים</p>
                <p className="text-2xl font-bold">
                  {products?.filter((p) => p.active).length || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            רשימת מוצרים
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">טוען...</div>
          ) : products && products.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם המוצר</TableHead>
                  <TableHead className="text-right">סוג</TableHead>
                  <TableHead className="text-right">מחיר</TableHead>
                  <TableHead className="text-right">ניקובים</TableHead>
                  <TableHead className="text-right">תוקף</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-muted-foreground">{product.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {productTypeIcons[product.type]}
                        <span>{productTypeLabels[product.type]}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-primary">
                      {formatPrice(product.price)}
                    </TableCell>
                    <TableCell>{product.credits_amount || "-"}</TableCell>
                    <TableCell>
                      {product.duration_days ? `${product.duration_days} ימים` : "-"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={product.active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: product.id, active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">אין מוצרים במערכת עדיין</p>
              <p className="text-sm text-muted-foreground">לחץ על "הוסף מוצר" כדי להתחיל</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
