import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, MapPin, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/ui/empty-state";
import { LocationModal } from "@/components/locations/LocationModal";

interface Location {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  created_at: string;
}

export default function Locations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const { data: locations, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Location[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast({ title: "הבריכה נמחקה בהצלחה" });
    },
    onError: (error: Error) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenCreate = () => {
    setEditingLocation(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (location: Location) => {
    setEditingLocation(location);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">ניהול בריכות</h1>
          <p className="text-muted-foreground mt-1">ניהול מיקומי הבריכות במערכת</p>
        </div>
        <Button className="gradient-primary gap-2" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4" />
          הוסף בריכה
        </Button>
      </div>

      {/* Location Modal for Create/Edit */}
      <LocationModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        location={editingLocation}
      />

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            רשימת בריכות
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">טוען...</div>
          ) : locations && locations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם הבריכה</TableHead>
                  <TableHead className="text-right">כתובת</TableHead>
                  <TableHead className="text-right">טלפון</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell>{location.address || "-"}</TableCell>
                    <TableCell dir="ltr" className="text-right">{location.phone || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleOpenEdit(location)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(location.id)}
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
            <EmptyState
              icon={MapPin}
              title="אין בריכות במערכת עדיין"
              description="הוסיפו את הבריכה הראשונה כדי להתחיל להשתמש במערכת"
              actionLabel="הוסף בריכה"
              onAction={handleOpenCreate}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
