import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Edit, Trash2, CreditCard, Calendar, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdaptiveTable, type AdaptiveColumn, type AdaptiveAction } from "@/components/ui/adaptive-table";
import { ProductModal } from "@/components/products/ProductModal";

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check for active subscriptions before deleting
      const { data: activeSubscriptions, error: checkError } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("product_id", id)
        .eq("status", "active");
      
      if (checkError) throw checkError;
      
      if (activeSubscriptions && activeSubscriptions.length > 0) {
        throw new Error(`לא ניתן למחוק מוצר עם ${activeSubscriptions.length} מנויים פעילים. יש לבטל את המנויים תחילה.`);
      }
      
      const { error } = await supabase.from("products" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "המוצר נמחק בהצלחה" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "שגיאה במחיקת מוצר", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
    }).format(price);
  };

  // Define columns for AdaptiveTable
  const columns: AdaptiveColumn<Product>[] = [
    {
      key: "name",
      header: "שם המוצר",
      primary: true,
      render: (product) => (
        <div>
          <p className="font-medium">{product.name}</p>
          {product.description && (
            <p className="text-xs text-muted-foreground">{product.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "סוג",
      render: (product) => (
        <div className="flex items-center gap-2">
          {productTypeIcons[product.type]}
          <span>{productTypeLabels[product.type]}</span>
        </div>
      ),
    },
    {
      key: "price",
      header: "מחיר",
      render: (product) => (
        <span className="font-medium text-primary">{formatPrice(product.price)}</span>
      ),
    },
    {
      key: "credits",
      header: "ניקובים",
      hideOnMobile: true,
      render: (product) => <span>{product.credits_amount || "-"}</span>,
    },
    {
      key: "duration",
      header: "תוקף",
      hideOnMobile: true,
      render: (product) => (
        <span>{product.duration_days ? `${product.duration_days} ימים` : "-"}</span>
      ),
    },
    {
      key: "status",
      header: "סטטוס",
      render: (product) => (
        <Badge variant={product.active ? "default" : "secondary"}>
          {product.active ? "פעיל" : "לא פעיל"}
        </Badge>
      ),
    },
  ];

  // Define actions for AdaptiveTable
  const actions: AdaptiveAction<Product>[] = [
    {
      label: "ערוך",
      icon: Edit,
      onClick: (product) => handleOpenEdit(product),
    },
    {
      label: "מחק",
      icon: Trash2,
      variant: "destructive",
      onClick: (product) => deleteMutation.mutate(product.id),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">ניהול מוצרים</h1>
          <p className="text-muted-foreground mt-1">מוצרים ומחירון</p>
        </div>
        <Button className="gradient-primary gap-2" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4" />
          הוסף מוצר
        </Button>
      </div>

      {/* Product Modal for Create/Edit */}
      <ProductModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        product={editingProduct}
      />

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
          ) : (
            <AdaptiveTable
              data={products || []}
              columns={columns}
              actions={actions}
              keyExtractor={(product) => product.id}
              emptyMessage="אין מוצרים במערכת עדיין. לחץ על 'הוסף מוצר' כדי להתחיל."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
