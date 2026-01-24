import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Location {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

interface LocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: Location | null;
}

export function LocationModal({ open, onOpenChange, location }: LocationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeSchoolId } = useSchool();
  const isEditMode = !!location;

  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
  });

  // Reset form when modal opens/closes or location changes
  useEffect(() => {
    if (location) {
      setForm({
        name: location.name,
        address: location.address || "",
        phone: location.phone || "",
      });
    } else {
      setForm({
        name: "",
        address: "",
        phone: "",
      });
    }
  }, [location, open]);

  const createMutation = useMutation({
    mutationFn: async (newLocation: { name: string; address: string; phone: string }) => {
      const { error } = await supabase.from("locations").insert([{
        ...newLocation,
        school_id: activeSchoolId,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      onOpenChange(false);
      toast({ title: "הבריכה נוספה בהצלחה" });
    },
    onError: (error: Error) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedLocation: {
      id: string;
      name: string;
      address: string;
      phone: string;
    }) => {
      const { id, ...data } = updatedLocation;
      const { error } = await supabase
        .from("locations")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      onOpenChange(false);
      toast({ title: "הבריכה עודכנה בהצלחה" });
    },
    onError: (error: Error) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "שגיאה", description: "שם הבריכה הוא שדה חובה", variant: "destructive" });
      return;
    }

    if (isEditMode && location) {
      updateMutation.mutate({ id: location.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "עריכת בריכה" : "הוספת בריכה חדשה"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="location-name">שם הבריכה *</Label>
            <Input
              id="location-name"
              placeholder="בריכה מרכזית"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location-address">כתובת</Label>
            <Input
              id="location-address"
              placeholder="רחוב הרצל 1, תל אביב"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location-phone">טלפון</Label>
            <Input
              id="location-phone"
              placeholder="03-1234567"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              dir="ltr"
            />
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
