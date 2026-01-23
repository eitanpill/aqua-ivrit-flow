import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Pencil, Shield, UserCog, User } from "lucide-react";
import type { AppRole } from "@/hooks/useAuth";
import { isValidIsraeliPhone, israeliPhoneErrorMessage } from "@/lib/phoneUtils";

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: AppRole;
}

interface EditUserModalProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserModal({ user, open, onOpenChange }: EditUserModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole>("customer");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setPhone(user.phone || "");
      setPhoneError(null);
      setRole(user.role);
    }
  }, [user]);

  const validatePhone = (value: string) => {
    if (!value) {
      setPhoneError(null);
      return true;
    }
    const digits = value.replace(/\D/g, "");
    if (digits && !isValidIsraeliPhone(digits)) {
      setPhoneError(israeliPhoneErrorMessage);
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPhone(value);
    validatePhone(value);
  };

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      
      const { data, error } = await supabase.rpc("admin_update_user" as any, {
        p_user_id: user.id,
        p_first_name: firstName,
        p_last_name: lastName,
        p_phone: phone ? phone.replace(/\D/g, "") : null,
        p_role: role,
      });

      if (error) throw error;
      
      const result = data as unknown as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || "שגיאה בעדכון המשתמש");
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success("המשתמש עודכן בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("יש להזין שם פרטי ושם משפחה");
      return;
    }
    if (phone && !validatePhone(phone)) {
      toast.error(israeliPhoneErrorMessage);
      return;
    }
    updateUserMutation.mutate();
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            עריכת משתמש
          </DialogTitle>
          <DialogDescription>
            עדכון פרטי המשתמש
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editFirstName">שם פרטי</Label>
                <Input
                  id="editFirstName"
                  placeholder="ישראל"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editLastName">שם משפחה</Label>
                <Input
                  id="editLastName"
                  placeholder="ישראלי"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhone">טלפון</Label>
              <Input
                id="editPhone"
                type="tel"
                placeholder="0521234567"
                value={phone}
                onChange={handlePhoneChange}
                dir="ltr"
                className={`text-right ${phoneError ? "border-destructive" : ""}`}
              />
              {phoneError && (
                <p className="text-sm text-destructive">{phoneError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRole">תפקיד</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      לקוח
                    </div>
                  </SelectItem>
                  <SelectItem value="coach">
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4" />
                      מאמן/מדריך
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      מנהל
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              )}
              שמור שינויים
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
